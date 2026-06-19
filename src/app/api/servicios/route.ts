import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'

// ============================================================
// MÓDULO 09 — SERVICIOS
// GET    ?all=1            → lista (SUPER puede ver todo)
// POST                     → crear (OWNER/SUPER)
// ============================================================

export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response

  const url = req.nextUrl
  const all = url.searchParams.get('all') || undefined
  const clinicIdParam = url.searchParams.get('clinicId')
  const includeInactive = url.searchParams.get('includeInactive') === '1'

  let clinicId: string | undefined
  if (user!.role === 'SUPER') {
    clinicId = clinicIdParam || (all === '1' ? undefined : user!.clinicId)
  } else {
    clinicId = user!.clinicId
  }

  const where: any = {}
  if (clinicId) where.clinicId = clinicId
  if (!includeInactive) where.active = true

  const services = await db.service.findMany({
    where,
    orderBy: { name: 'asc' },
  })

  return ok({
    rows: services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      durationMin: s.durationMin,
      price: s.price,
      commissionPct: s.commissionPct,
      ivaType: s.ivaType,
      active: s.active,
      clinicId: s.clinicId,
    })),
  })
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'RECEPTION' || user!.role === 'PODOLOGIST') return bad('Sin permisos', 403)

  const body = await req.json()
  const { name, description, durationMin, price, commissionPct, ivaType, active, clinicId } = body
  if (!name) return bad('Nombre requerido')

  const svc = await db.service.create({
    data: {
      name,
      description: description || null,
      durationMin: Number(durationMin) || 30,
      price: Number(price) || 0,
      commissionPct: Number(commissionPct) || 0,
      ivaType: ivaType || 'EXENTO',
      active: active !== false,
      clinicId: user!.role === 'SUPER' && clinicId ? clinicId : user!.clinicId,
    },
  })
  return ok(svc, 201)
}
