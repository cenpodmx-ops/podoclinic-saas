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
  // Usar la fecha existente SIN convertir a timezone local
  let dStr: string
  if (existing.date) {
    // Extraer YYYY-MM-DD del ISO sin convertir timezone
    const dateIso = existing.date.toISOString()
    dStr = dateIso.slice(0, 10)
  } else {
    dStr = new Date().toISOString().slice(0, 10)
  }
  if (body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    dStr = body.date
    updates.date = new Date(dStr + 'T00:00:00.000Z')
  }

  if (body.startTime && /^\d{2}:\d{2}$/.test(body.startTime)) {
    updates.startTime = new Date(`${dStr}T${body.startTime}:00.000Z`)
  }
  if (body.endTime && /^\d{2}:\d{2}$/.test(body.endTime)) {
    updates.endTime = new Date(`${dStr}T${body.endTime}:00.000Z`)
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
 *  - 403 for PODOLOGIST
 *  - body (opcional): { motivo?: string }
 *  - Si la cita está PENDIENTE/CANCELADA y sin consulta → se borra directo
 *  - Si la cita está FINALIZADA o tiene consulta asociada → se requiere un motivo
 *    y se revierten: CashMovement, StockMovement (devolver productos),
 *    Patient.totalSpent (restar), y luego se borra consulta + cita.
 *  - En todos los casos se audita el motivo.
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Sin permisos para eliminar citas', 403)

  const { id } = await ctx.params
  const existing = await db.appointment.findUnique({ where: { id } })
  if (!existing) return bad('Cita no encontrada', 404)
  if (user!.role !== 'SUPER' && existing.clinicId !== user!.clinicId) {
    return bad('Cita fuera de tu clínica', 403)
  }

  // Parsear body para obtener motivo (acepta body vacío para compatibilidad)
  let motivo = ''
  try {
    const body = await req.json()
    motivo = typeof body?.motivo === 'string' ? body.motivo.trim() : ''
  } catch {
    // body vacío o JSON inválido → no hay motivo
  }

  const consultation = await db.consultation.findUnique({ where: { appointmentId: id } })

  // Si hay consulta asociada o la cita está finalizada → requerir motivo
  const requiresMotivo = !!consultation || existing.status === 'FINALIZADA' || existing.status === 'EN_CONSULTA' || existing.status === 'CONFIRMADA' || existing.status === 'NO_ASISTIO'

  if (requiresMotivo && !motivo) {
    return bad('Se requiere un motivo para eliminar esta cita (está finalizada o tiene consulta asociada). Por favor describe el motivo del borrado.', 400)
  }

  // Si hay consulta asociada, revertir todo (CashMovement, stock, totalSpent)
  if (consultation) {
    // 1. Borrar CashMovement asociado (si existe)
    await db.cashMovement.deleteMany({
      where: { refId: consultation.id, source: 'CONSULTA' },
    })

    // 2. Devolver stock de los productos vendidos en la consulta
    try {
      const items = JSON.parse(consultation.itemsJson || '[]') as any[]
      for (const it of items) {
        if ((it.type === 'PRODUCTO' || it.type === 'MEDICAMENTO') && it.productId) {
          const qty = Number(it.qty) || 1
          await db.product.update({
            where: { id: it.productId },
            data: { stock: { increment: qty } },
          })
          await db.stockMovement.create({
            data: {
              productId: it.productId,
              clinicId: existing.clinicId,
              type: 'ENTRADA',
              quantity: qty,
              reason: `Devolución por eliminación de cita ${id}${motivo ? ` — ${motivo}` : ''}`,
            },
          })
        }
      }
    } catch {}

    // 3. Ajustar Patient.totalSpent (restar el total de la consulta)
    if (consultation.paid && consultation.total > 0) {
      await db.patient.update({
        where: { id: consultation.patientId },
        data: { totalSpent: { decrement: consultation.total } },
      })
    }

    // 4. Borrar FollowUps de esta consulta
    await db.followUp.deleteMany({ where: { consultationId: consultation.id } })

    // 5. Borrar la consulta
    await db.consultation.delete({ where: { id: consultation.id } })
  }

  // Auditar el motivo (log simple en consola para no crear modelo nuevo)
  console.log(`[DELETE CITA] Cita ${id} eliminada por ${user!.email} — motivo: ${motivo || '(sin motivo, cita pendiente)'}`)

  // Finalmente borrar la cita
  await db.appointment.delete({ where: { id } })
  return ok({ deleted: true, motivo: motivo || undefined })
}
