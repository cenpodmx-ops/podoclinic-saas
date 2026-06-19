import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { startOfDay, parseISO } from 'date-fns'

const VALID_STATUSES = ['PENDIENTE', 'CONFIRMADA', 'EN_CONSULTA', 'FINALIZADA', 'CANCELADA', 'NO_ASISTIO']

/**
 * GET /api/citas/[id]
 * Detail of one appointment (with patient, podólogo, consulta).
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response

  const { id } = await ctx.params
  const a = await db.appointment.findUnique({
    where: { id },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, phone: true, expNumber: true, riskLevel: true, isDiabetic: true } },
      podologist: { select: { id: true, name: true, specialty: true } },
      consultation: true,
      clinic: { select: { id: true, name: true } },
    },
  })
  if (!a) return bad('Cita no encontrada', 404)
  if (user!.role !== 'SUPER' && a.clinicId !== user!.clinicId) {
    return bad('No tienes acceso a esta cita', 403)
  }

  return ok({
    id: a.id,
    clinicId: a.clinicId,
    status: a.status,
    date: a.date,
    startTime: a.startTime,
    endTime: a.endTime,
    reason: a.reason,
    notes: a.notes,
    source: a.source,
    serviceName: a.serviceName,
    serviceId: a.serviceId,
    price: a.price,
    patient: a.patient,
    podologist: a.podologist,
    consultation: a.consultation,
    clinic: a.clinic,
  })
}

/**
 * PATCH /api/citas/[id]
 * Body: { status?, startTime?, endTime?, reason?, notes?, podologistId?, date? }
 *  - status must be one of VALID_STATUSES
 *  - When status becomes FINALIZADA, do NOT auto-create consultation (Consulta module's job)
 *  - PODOLOGIST: 403
 *  - date (YYYY-MM-DD) re-maps startTime/endTime to that day
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Sin permisos para editar citas', 403)

  const { id } = await ctx.params
  const existing = await db.appointment.findUnique({ where: { id } })
  if (!existing) return bad('Cita no encontrada', 404)
  if (user!.role !== 'SUPER' && existing.clinicId !== user!.clinicId) {
    return bad('Cita fuera de tu clínica', 403)
  }

  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')

  const updates: any = {}

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return bad(`Estado inválido. Válidos: ${VALID_STATUSES.join(', ')}`)
    }
    updates.status = body.status
  }

  // Optional date move (YYYY-MM-DD) — re-maps startTime/endTime
  let dStr = existing.date.toISOString().slice(0, 10)
  if (body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    dStr = body.date
    updates.date = startOfDay(parseISO(body.date))
  }

  if (body.startTime && /^\d{2}:\d{2}$/.test(body.startTime)) {
    updates.startTime = new Date(`${dStr}T${body.startTime}:00`)
  }
  if (body.endTime && /^\d{2}:\d{2}$/.test(body.endTime)) {
    updates.endTime = new Date(`${dStr}T${body.endTime}:00`)
  }
  if (updates.startTime && updates.endTime && updates.endTime <= updates.startTime) {
    return bad('La hora final debe ser mayor a la inicial')
  }

  if (body.reason !== undefined) updates.reason = body.reason || null
  if (body.notes !== undefined) updates.notes = body.notes || null

  if (body.podologistId !== undefined) {
    if (body.podologistId) {
      const pod = await db.podologist.findUnique({ where: { id: body.podologistId } })
      if (!pod) return bad('Podólogo no encontrado', 404)
      if (user!.role !== 'SUPER' && pod.clinicId !== user!.clinicId) return bad('Podólogo no permitido', 403)
      updates.podologistId = body.podologistId
    } else {
      updates.podologistId = null
    }
  }

  const updated = await db.appointment.update({
    where: { id },
    data: updates,
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, phone: true, expNumber: true } },
      podologist: { select: { id: true, name: true } },
    },
  })

  return ok(updated)
}

/**
 * DELETE /api/citas/[id]
 *  - Only allow if status is PENDIENTE or CANCELADA
 *  - 403 for PODOLOGIST
 *  - Block delete if a Consultation is already attached
 */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Sin permisos para eliminar citas', 403)

  const { id } = await ctx.params
  const existing = await db.appointment.findUnique({ where: { id } })
  if (!existing) return bad('Cita no encontrada', 404)
  if (user!.role !== 'SUPER' && existing.clinicId !== user!.clinicId) {
    return bad('Cita fuera de tu clínica', 403)
  }
  if (existing.status !== 'PENDIENTE' && existing.status !== 'CANCELADA') {
    return bad('Solo se pueden eliminar citas pendientes o canceladas', 400)
  }

  const consultation = await db.consultation.findUnique({ where: { appointmentId: id } })
  if (consultation) {
    return bad('La cita ya tiene una consulta asociada y no puede eliminarse', 400)
  }

  await db.appointment.delete({ where: { id } })
  return ok({ deleted: true })
}
