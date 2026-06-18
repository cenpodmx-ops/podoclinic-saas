import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad, effectiveClinic } from '@/lib/api'
import { waUrl, fillTemplate, DEFAULT_TEMPLATES } from '@/lib/whatsapp'
import { format } from 'date-fns'

// ============================================================
// MÓDULO 14 — SEGUIMIENTO POST-CONSULTA
// GET /api/seguimiento/[id]/whatsapp
//
// Devuelve { waUrl, message } con el template tplFollowUp lleno:
//   {{nombre_paciente}}, {{podologo}}, {{link_reserva}}, {{clinica}}, {{fecha}}, {{hora}}
//
// Marca whatsappSent=true (mejor esfuerzo, no bloqueante).
//
// Acceso: SUPER + OWNER + RECEPTION. PODOLOGIST → 403.
// ============================================================

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response

  if (user!.role === 'PODOLOGIST') {
    return bad('Acceso denegado', 403)
  }

  const { id } = await ctx.params

  const f = await db.followUp.findUnique({
    where: { id },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
      consultation: {
        select: {
          id: true,
          date: true,
          podologist: { select: { id: true, name: true } },
        },
      },
    },
  })
  if (!f) return bad('Seguimiento no encontrado', 404)
  if (user!.role !== 'SUPER' && f.clinicId !== user!.clinicId) {
    return bad('Sin acceso a este seguimiento', 403)
  }

  const clinicId = effectiveClinic(user!, undefined) || f.clinicId

  const [clinic, cfg] = await Promise.all([
    db.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true, slug: true, phone: true },
    }),
    db.clinicConfig.findUnique({
      where: { clinicId },
      select: { tplFollowUp: true },
    }),
  ])

  const tplRaw = cfg?.tplFollowUp || DEFAULT_TEMPLATES.tplFollowUp
  const linkReserva = `${process.env.NEXT_PUBLIC_APP_URL || ''}/reserva?slug=${clinic?.slug || ''}`
  const clinicaName = clinic?.name || 'CENPOD'

  const consultationDate = f.consultation?.date
    ? format(new Date(f.consultation.date), 'dd/MM/yyyy')
    : ''

  const message = fillTemplate(tplRaw, {
    nombre_paciente: f.patient.firstName,
    podologo: f.consultation?.podologist?.name || '',
    link_reserva: linkReserva,
    clinica: clinicaName,
    fecha: consultationDate,
    hora: '',
  })

  const url = waUrl(f.patient.phone, message)

  // Mejor esfuerzo: marcar whatsappSent=true (no bloqueante)
  try {
    await db.followUp.update({
      where: { id: f.id },
      data: { whatsappSent: true },
    })
  } catch {
    // no-op
  }

  return ok({
    id: f.id,
    patientId: f.patient.id,
    patientName: `${f.patient.firstName} ${f.patient.lastName}`.trim(),
    phone: f.patient.phone,
    message,
    waUrl: url,
  })
}
