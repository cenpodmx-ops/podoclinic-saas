import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'

// ============================================================
// MÓDULO 06 — INVENTARIO [id]/movimientos
// GET  → lista de movimientos del producto
// POST → registrar movimiento {type: ENTRADA|AJUSTE, quantity, reason?, cost?, supplier?}
//        SALIDA y VENTA son generados por el sistema, no manuales.
// ============================================================

type Ctx = { params: Promise<{ id: string }> }

const MANUAL_TYPES = ['ENTRADA', 'AJUSTE']

export async function GET(req: NextRequest, ctx: Ctx) {
  const { user, response } = await requireSession()
  if (response) return response

  const { id } = await ctx.params
  const url = req.nextUrl
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')))
  const skip = (page - 1) * limit

  const product = await db.product.findUnique({ where: { id } })
  if (!product) return bad('Producto no encontrado', 404)

  if (user!.role !== 'SUPER' && product.clinicId !== user!.clinicId) {
    return bad('No tienes acceso a este producto', 403)
  }

  const [rows, total] = await Promise.all([
    db.stockMovement.findMany({
      where: { productId: id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    db.stockMovement.count({ where: { productId: id } }),
  ])

  return ok({ data: rows, total, page, limit })
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { user, response } = await requireSession()
  if (response) return response

  // PODOLOGIST y RECEPTION no pueden registrar movimientos manuales
  if (user!.role === 'PODOLOGIST' || user!.role === 'RECEPTION') {
    return bad('No tienes permisos para registrar movimientos de inventario', 403)
  }

  const { id } = await ctx.params
  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')

  const { type, quantity, reason, cost, supplier } = body as {
    type?: string
    quantity?: number
    reason?: string
    cost?: number
    supplier?: string
  }

  if (!type || !MANUAL_TYPES.includes(type)) {
    return bad(`Tipo inválido. Solo se permiten: ${MANUAL_TYPES.join(', ')} (SALIDA y VENTA son automáticos)`)
  }
  const qty = Number(quantity)
  if (!Number.isFinite(qty) || qty === 0) {
    return bad('La cantidad debe ser un número diferente de cero')
  }

  const product = await db.product.findUnique({ where: { id } })
  if (!product) return bad('Producto no encontrado', 404)

  if (user!.role !== 'SUPER' && product.clinicId !== user!.clinicId) {
    return bad('No tienes acceso a este producto', 403)
  }

  // Calcular nuevo stock según tipo
  let newStock = product.stock
  if (type === 'ENTRADA') {
    if (qty <= 0) return bad('Las entradas deben ser positivas')
    newStock = product.stock + qty
  } else if (type === 'AJUSTE') {
    newStock = product.stock + qty // puede ser positivo o negativo
    if (newStock < 0) {
      return bad(`El ajuste dejaría stock negativo (stock actual: ${product.stock}, ajuste: ${qty})`)
    }
  }

  // Crear movimiento + actualizar stock
  const movement = await db.stockMovement.create({
    data: {
      productId: id,
      clinicId: product.clinicId,
      type,
      quantity: qty,
      reason: reason?.trim() || null,
      cost: cost !== undefined ? Number(cost) || null : null,
      supplier: supplier?.trim() || null,
    },
  })

  const updated = await db.product.update({
    where: { id },
    data: { stock: newStock },
  })

  return ok({ movement, product: updated }, 201)
}
