import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { startOfDay, endOfDay, parseISO } from 'date-fns'

/**
 * GET /api/bloqueos
 * Query: date (YYYY-MM-DD), podologistId?
 * Returns blocks for that day in the user's clinic.
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response

  const sp = req.nextUrl.searchParams
  const dateStr = sp.get('date') || new Date().toISOString().slice(0, 10)
  const podologistId = sp.get('podologistId') || undefined

  const dayStart = startOfDay(parseISO(dateStr))
  const dayEnd = endOfDay(parseISO(dateStr))

  const where: any = {
    date: { gte: dayStart, lte: dayEnd },
    clinicId: user!.clinicId,
  }
  if (podologistId) where.podologistId = podologistId

  // PODOLOGIST only sees their own blocks
  if (user!.role === 'PODOLOGIST' && user!.podologistId) {
    where.podologistId = user!.podologistId
  } else if (user!.role === 'SUPER') {
    delete where.clinicId
  }

  const blocks = await db.appointmentBlock.findMany({
    where,
    include: { podologist: { select: { id: true, name: true } } },
    orderBy: { startTime: 'asc' },
  })

  return ok(blocks)
}

/**
 * POST /api/bloqueos
 * Body: { podologistId, date (YYYY-MM-DD), startTime (HH:mm), endTime (HH:mm),
 *         reason: VACACIONES|CAPACITACION|INCAPACIDAD|OTRO, fullDay, notes? }
 *  - 403 for PODOLOGIST
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Sin permisos para crear bloqueos', 403)

  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')

  const { podologistId, date, startTime, endTime, reason, fullDay, notes } = body as {
    podologistId?: string
    date?: string
    startTime?: string
    endTime?: string
    reason?: string
    fullDay?: boolean
    notes?: string
  }

  if (!podologistId || !date || !reason) {
    return bad('Faltan campos: podologistId, date, reason')
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad('Fecha inválida (YYYY-MM-DD)')

  const clinicId = user!.clinicId
  if (!clinicId) return bad('Sin clínica asignada', 403)

  const pod = await db.podologist.findUnique({ where: { id: podologistId } })
  if (!pod) return bad('Podólogo no encontrado', 404)
  if (user!.role !== 'SUPER' && pod.clinicId !== clinicId) return bad('Podólogo no permitido', 403)

  let sTime: Date
  let eTime: Date
  if (fullDay) {
    sTime = new Date(`${date}T00:00:00`)
    eTime = new Date(`${date}T23:59:00`)
  } else {
    if (!startTime || !endTime || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
      return bad('Rango horario inválido (HH:mm)')
    }
    sTime = new Date(`${date}T${startTime}:00`)
    eTime = new Date(`${date}T${endTime}:00`)
    if (eTime <= sTime) return bad('La hora final debe ser mayor a la inicial')
  }

  const dayDate = startOfDay(parseISO(date))

  const created = await db.appointmentBlock.create({
    data: {
      clinicId,
      podologistId,
      date: dayDate,
      startTime: sTime,
      endTime: eTime,
      reason,
      notes: notes || null,
      fullDay: !!fullDay,
    },
  })

  return ok(created, 201)
}
