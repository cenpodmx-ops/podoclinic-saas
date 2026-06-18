import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'

/**
 * GET /api/podologos
 * Returns the list of active podologists for the user's clinic.
 * SUPER can pass ?clinicId= to pick a clinic, or ?all=1 to list every clinic's podologists.
 * PODOLOGIST only sees themselves.
 * ?includeInactive=1 → incluye inactivos
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response

  const clinicParam = req.nextUrl.searchParams.get('clinicId')
  const all = req.nextUrl.searchParams.get('all')
  const includeInactive = req.nextUrl.searchParams.get('includeInactive') === '1'

  // Podólogo: solo se ve a sí mismo
  if (user!.role === 'PODOLOGIST') {
    if (!user!.podologistId) return ok([])
    const me = await db.podologist.findUnique({
      where: { id: user!.podologistId },
      select: {
        id: true, name: true, specialty: true, cedula: true, certNumber: true,
        phone: true, email: true, commissionPct: true,
        monthlyGoalConsults: true, monthlyGoalRevenue: true,
        openingTime: true, closingTime: true, slotMinutes: true,
        clinicId: true, active: true,
      },
    })
    return ok(me ? [me] : [])
  }

  let where: any = {}
  if (!includeInactive) where.active = true
  if (user!.role === 'SUPER') {
    if (clinicParam) where.clinicId = clinicParam
    else if (all !== '1') where.clinicId = user!.clinicId
  } else {
    where.clinicId = user!.clinicId
  }

  const podologos = await db.podologist.findMany({
    where,
    select: {
      id: true, name: true, specialty: true, cedula: true, certNumber: true,
      photoUrl: true, phone: true, email: true, commissionPct: true,
      monthlyGoalConsults: true, monthlyGoalRevenue: true,
      openingTime: true, closingTime: true, slotMinutes: true,
      clinicId: true, active: true,
    },
    orderBy: { name: 'asc' },
  })

  return ok(podologos)
}

/** POST crear podólogo (OWNER/SUPER) */
export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'RECEPTION' || user!.role === 'PODOLOGIST') return bad('Sin permisos', 403)

  const body = await req.json()
  const {
    name, specialty, cedula, certNumber, photoUrl, phone, email,
    commissionPct, monthlyGoalConsults, monthlyGoalRevenue, clinicId,
    openingTime, closingTime, slotMinutes,
  } = body
  if (!name) return bad('Nombre requerido')

  const created = await db.podologist.create({
    data: {
      name,
      specialty: specialty || null,
      cedula: cedula || null,
      certNumber: certNumber || null,
      photoUrl: photoUrl || null,
      phone: phone || null,
      email: email || null,
      commissionPct: Number(commissionPct) || 0,
      monthlyGoalConsults: monthlyGoalConsults ? Number(monthlyGoalConsults) : null,
      monthlyGoalRevenue: monthlyGoalRevenue ? Number(monthlyGoalRevenue) : null,
      openingTime: openingTime || null,
      closingTime: closingTime || null,
      slotMinutes: slotMinutes ? Number(slotMinutes) : null,
      clinicId: user!.role === 'SUPER' && clinicId ? clinicId : user!.clinicId,
    },
  })
  return ok(created, 201)
}

