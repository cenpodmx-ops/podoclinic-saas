import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad, effectiveClinic } from '@/lib/api'

// ============================================================
// MÓDULO 06 — INVENTARIO
// GET:
//   ?q=<texto>                            → quick search {rows:[...]} (uso Consulta)
//   ?page=1&limit=20&category=&stockBajo=1&includeInactive=0  → listado paginado {data,total,page,limit}
//   ?all=1                                → SUPER ve todas las clínicas
// POST: crear producto (OWNER/SUPER)
// ============================================================

const CATEGORIES = ['MEDICAMENTO', 'PRODUCTO', 'MATERIAL', 'EQUIPO']
const IVA_TYPES = ['EXENTO', 'IVA0', 'IVA16']

export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response

  const url = req.nextUrl
  const all = url.searchParams.get('all') || undefined
  const clinicId = effectiveClinic(user!, all || undefined)
  const q = (url.searchParams.get('q') || '').trim()

  // ── Caso A: búsqueda rápida para Consulta module (mantener compatibilidad)
  if (q && !url.searchParams.has('page')) {
    const where: any = { active: true }
    if (clinicId) where.clinicId = clinicId
    where.OR = [
      { name: { contains: q } },
      { code: { contains: q } },
      { description: { contains: q } },
    ]
    const products = await db.product.findMany({
      where,
      orderBy: { name: 'asc' },
      take: 30,
    })
    return ok({
      rows: products.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        category: p.category,
        salePrice: p.salePrice,
        costPrice: p.costPrice,
        stock: p.stock,
        minStock: p.minStock,
        ivaType: p.ivaType,
      })),
    })
  }

  // ── Caso B: listado paginado completo
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')))
  const skip = (page - 1) * limit
  const category = url.searchParams.get('category') || undefined
  const stockBajo = url.searchParams.get('stockBajo') === '1'
  const includeInactive = url.searchParams.get('includeInactive') === '1'

  const where: any = {}
  if (clinicId) where.clinicId = clinicId
  if (!includeInactive) where.active = true
  if (category && CATEGORIES.includes(category)) where.category = category

  const [rows, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: [{ name: 'asc' }],
      skip,
      take: limit,
    }),
    db.product.count({ where }),
  ])

  // Filtrado de stockBajo (no se puede hacer directamente en where con prisma fácilmente)
  let data = rows.map((p) => ({
    ...p,
    stockBajo: p.stock <= p.minStock,
  }))
  if (stockBajo) {
    data = data.filter((p) => p.stockBajo)
  }

  return ok({
    data,
    total: stockBajo ? data.length : total,
    page,
    limit,
  })
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response

  // PODOLOGIST y RECEPTION no pueden crear productos
  if (user!.role === 'PODOLOGIST' || user!.role === 'RECEPTION') {
    return bad('No tienes permisos para crear productos', 403)
  }

  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')

  const {
    name,
    description,
    code,
    category,
    costPrice = 0,
    salePrice = 0,
    ivaType = 'EXENTO',
    stock = 0,
    minStock = 0,
    supplier,
    clinicId: overrideClinicId,
  } = body as {
    name?: string
    description?: string
    code?: string
    category?: string
    costPrice?: number
    salePrice?: number
    ivaType?: string
    stock?: number
    minStock?: number
    supplier?: string
    clinicId?: string
  }

  if (!name || !name.trim()) return bad('El nombre es obligatorio')
  if (!category || !CATEGORIES.includes(category)) {
    return bad(`Categoría inválida. Debe ser una de: ${CATEGORIES.join(', ')}`)
  }
  if (!IVA_TYPES.includes(ivaType)) {
    return bad(`Tipo de IVA inválido. Debe ser uno de: ${IVA_TYPES.join(', ')}`)
  }

  // Determinar clinicId: SUPER puede indicar, otros usan su clínica
  let targetClinicId = user!.clinicId
  if (user!.role === 'SUPER' && overrideClinicId) {
    targetClinicId = overrideClinicId
  }

  // Validar que el code no esté duplicado dentro de la clínica
  if (code && code.trim()) {
    const existing = await db.product.findFirst({
      where: { code: code.trim(), clinicId: targetClinicId },
    })
    if (existing) return bad('Ya existe un producto con ese código en esta clínica', 409)
  }

  const product = await db.product.create({
    data: {
      clinicId: targetClinicId,
      name: name.trim(),
      description: description?.trim() || null,
      code: code?.trim() || null,
      category,
      costPrice: Number(costPrice) || 0,
      salePrice: Number(salePrice) || 0,
      ivaType,
      stock: Math.max(0, Number(stock) || 0),
      minStock: Math.max(0, Number(minStock) || 0),
      supplier: supplier?.trim() || null,
      active: true,
    },
  })

  // Si el producto arranca con stock, crear movimiento ENTRADA
  if (product.stock > 0) {
    await db.stockMovement.create({
      data: {
        productId: product.id,
        clinicId: targetClinicId,
        type: 'ENTRADA',
        quantity: product.stock,
        reason: 'Stock inicial',
        cost: product.costPrice || null,
        supplier: product.supplier || null,
      },
    })
  }

  return ok(product, 201)
}
