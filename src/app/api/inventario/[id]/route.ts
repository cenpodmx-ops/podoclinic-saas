import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'

// ============================================================
// MÓDULO 06 — INVENTARIO [id]
// GET    → detalle producto + movimientos recientes
// PATCH  → actualizar campos (OWNER/SUPER)
// DELETE → soft delete (active=false) (OWNER/SUPER)
// ============================================================

const CATEGORIES = ['MEDICAMENTO', 'PRODUCTO', 'MATERIAL', 'EQUIPO']
const IVA_TYPES = ['EXENTO', 'IVA0', 'IVA16']

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  const { user, response } = await requireSession()
  if (response) return response

  const { id } = await ctx.params

  const product = await db.product.findUnique({
    where: { id },
    include: {
      clinic: { select: { id: true, name: true, slug: true } },
    },
  })
  if (!product) return bad('Producto no encontrado', 404)

  // Cross-clinic guard (SUPER puede ver cualquiera)
  if (user!.role !== 'SUPER' && product.clinicId !== user!.clinicId) {
    return bad('No tienes acceso a este producto', 403)
  }

  const movements = await db.stockMovement.findMany({
    where: { productId: id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return ok({
    ...product,
    stockBajo: product.stock <= product.minStock,
    movements,
  })
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { user, response } = await requireSession()
  if (response) return response

  if (user!.role === 'PODOLOGIST' || user!.role === 'RECEPTION') {
    return bad('No tienes permisos para editar productos', 403)
  }

  const { id } = await ctx.params
  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')

  const product = await db.product.findUnique({ where: { id } })
  if (!product) return bad('Producto no encontrado', 404)

  if (user!.role !== 'SUPER' && product.clinicId !== user!.clinicId) {
    return bad('No tienes acceso a este producto', 403)
  }

  const {
    name,
    description,
    code,
    category,
    costPrice,
    salePrice,
    ivaType,
    stock,
    minStock,
    supplier,
    active,
  } = body as any

  // Validaciones
  if (category && !CATEGORIES.includes(category)) {
    return bad('Categoría inválida')
  }
  if (ivaType && !IVA_TYPES.includes(ivaType)) {
    return bad('Tipo de IVA inválido')
  }

  // Validar code único si se cambia
  if (code !== undefined && code && code.trim() && code !== product.code) {
    const dup = await db.product.findFirst({
      where: { code: code.trim(), clinicId: product.clinicId, NOT: { id } },
    })
    if (dup) return bad('Ya existe otro producto con ese código', 409)
  }

  // Si se cambia stock directamente, registrar AJUSTE
  const newStock = stock !== undefined ? Math.max(0, Number(stock) || 0) : undefined
  let stockMovementCreated = false
  if (newStock !== undefined && newStock !== product.stock) {
    const diff = newStock - product.stock
    await db.stockMovement.create({
      data: {
        productId: id,
        clinicId: product.clinicId,
        type: 'AJUSTE',
        quantity: diff,
        reason: 'Ajuste manual de inventario',
      },
    })
    stockMovementCreated = true
  }

  const data: any = {}
  if (name !== undefined) data.name = String(name).trim()
  if (description !== undefined) data.description = description?.trim() || null
  if (code !== undefined) data.code = code?.trim() || null
  if (category !== undefined) data.category = category
  if (costPrice !== undefined) data.costPrice = Number(costPrice) || 0
  if (salePrice !== undefined) data.salePrice = Number(salePrice) || 0
  if (ivaType !== undefined) data.ivaType = ivaType
  if (newStock !== undefined) data.stock = newStock
  if (minStock !== undefined) data.minStock = Math.max(0, Number(minStock) || 0)
  if (supplier !== undefined) data.supplier = supplier?.trim() || null
  if (active !== undefined) data.active = !!active

  const updated = await db.product.update({ where: { id }, data })

  return ok({ ...updated, stockMovementCreated })
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { user, response } = await requireSession()
  if (response) return response

  if (user!.role === 'PODOLOGIST' || user!.role === 'RECEPTION') {
    return bad('No tienes permisos para eliminar productos', 403)
  }

  const { id } = await ctx.params
  const product = await db.product.findUnique({ where: { id } })
  if (!product) return bad('Producto no encontrado', 404)

  if (user!.role !== 'SUPER' && product.clinicId !== user!.clinicId) {
    return bad('No tienes acceso a este producto', 403)
  }

  // Soft delete
  const updated = await db.product.update({
    where: { id },
    data: { active: false },
  })

  return ok({ id: updated.id, active: false })
}
