import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad, effectiveClinic } from '@/lib/api'

// ============================================================
// MÓDULO 06 — INVENTARIO (lectura, soporte para Consulta)
// GET  ?q=<texto>   → busca por nombre o código (activos)
//      ?all=1       → SUPER puede ver todo
// ============================================================

export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response

  const url = req.nextUrl
  const all = url.searchParams.get('all') || undefined
  const clinicId = effectiveClinic(user!, all || undefined)
  const q = (url.searchParams.get('q') || '').trim()

  const where: any = { active: true }
  if (clinicId) where.clinicId = clinicId
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { code: { contains: q } },
      { description: { contains: q } },
    ]
  }

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
