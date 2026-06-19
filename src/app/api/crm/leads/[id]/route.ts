import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'

// ============================================================
// MÓDULO 08 — CRM: Lead individual
// PATCH { status?, convertToPatient? }
//   - status: NUEVO | CONTACTADO | AGENDADO | PERDIDO
//   - convertToPatient: true → crea Patient y asocia patientId
// ============================================================

const VALID_STATUSES = ['NUEVO', 'CONTACTADO', 'AGENDADO', 'PERDIDO']

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response

  if (user!.role === 'RECEPTION' || user!.role === 'PODOLOGIST') {
    return bad('Acceso denegado. CRM es exclusivo para Dueños.', 403)
  }

  const { id } = await ctx.params
  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')

  const lead = await db.lead.findUnique({ where: { id } })
  if (!lead) return bad('Lead no encontrado', 404)
  if (user!.role !== 'SUPER' && lead.clinicId !== user!.clinicId) {
    return bad('Sin acceso a este lead', 403)
  }

  const { status, convertToPatient, notes, interest } = body as {
    status?: string
    convertToPatient?: boolean
    notes?: string
    interest?: string
  }

  // ── Convertir a paciente
  if (convertToPatient) {
    if (lead.patientId) {
      return bad('Este lead ya fue convertido a paciente', 400)
    }
    const clinic = await db.clinic.findUnique({
      where: { id: lead.clinicId },
      select: { slug: true },
    })
    const expNumber = await generateExpNumber(lead.clinicId, clinic?.slug || 'C0')

    const parts = lead.name.trim().split(/\s+/)
    const firstName = parts[0] || lead.name
    const lastName = parts.slice(1).join(' ') || '-'

    const patient = await db.patient.create({
      data: {
        clinicId: lead.clinicId,
        expNumber,
        firstName,
        lastName,
        phone: lead.phone,
        email: lead.email,
        generalNotes: lead.notes || lead.interest || null,
      },
    })

    const updated = await db.lead.update({
      where: { id },
      data: {
        patientId: patient.id,
        status: 'AGENDADO',
        notes: notes !== undefined ? notes : lead.notes,
        interest: interest !== undefined ? interest : lead.interest,
      },
      include: { patient: { select: { id: true, firstName: true, lastName: true, expNumber: true } } },
    })

    return ok({ lead: updated, patient, converted: true })
  }

  // ── Cambio de status (u otros campos)
  const data: any = {}
  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) return bad('Status inválido', 400)
    data.status = status
  }
  if (notes !== undefined) data.notes = notes
  if (interest !== undefined) data.interest = interest

  const updated = await db.lead.update({
    where: { id },
    data,
    include: { patient: { select: { id: true, firstName: true, lastName: true, expNumber: true } } },
  })
  return ok({ lead: updated })
}

/** Genera el siguiente número de expediente: C{clinicNumber}-{seq 5 dígitos}. */
async function generateExpNumber(clinicId: string, slug: string): Promise<string> {
  const m = slug.match(/\d+/)
  const clinicNum = m ? m[0] : '0'
  const prefix = `C${clinicNum}`

  const existing = await db.patient.findMany({
    where: { clinicId, expNumber: { startsWith: `${prefix}-` } },
    select: { expNumber: true },
  })

  let maxNum = 0
  for (const p of existing) {
    const parts = p.expNumber.split('-')
    if (parts.length === 2) {
      const n = parseInt(parts[1], 10)
      if (!isNaN(n) && n > maxNum) maxNum = n
    }
  }

  return `${prefix}-${String(maxNum + 1).padStart(5, '0')}`
}
