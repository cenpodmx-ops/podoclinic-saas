import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad, effectiveClinic } from '@/lib/api'
import { waUrl, fillTemplate, DEFAULT_TEMPLATES } from '@/lib/whatsapp'

// ============================================================
// MÓDULO 08 — CRM: Leads
// GET  ?status=NUEVO|CONTACTADO|AGENDADO|PERDIDO  → lista
// POST { name, phone, email?, interest?, notes? } → crea lead
// ============================================================

const VALID_STATUSES = ['NUEVO', 'CONTACTADO', 'AGENDADO', 'PERDIDO']

export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response

  if (user!.role === 'RECEPTION' || user!.role === 'PODOLOGIST') {
    return bad('Acceso denegado. CRM es exclusivo para Dueños.', 403)
  }

  const sp = req.nextUrl.searchParams
  const status = sp.get('status') || undefined
  if (status && !VALID_STATUSES.includes(status)) {
    return bad('Status inválido', 400)
  }

  const all = sp.get('all') || undefined
  const clinicId = effectiveClinic(user!, all)
  const where: any = {}
  if (clinicId) where.clinicId = clinicId
  if (status) where.status = status

  const leads = await db.lead.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, expNumber: true } },
    },
    take: 200,
  })

  // Generar URL WhatsApp para cada lead (tplFollowUp por defecto, sin variables de cita)
  const rows = leads.map((l) => {
    const name = l.name
    const text = fillTemplate(DEFAULT_TEMPLATES.tplFollowUp, {
      nombre_paciente: name,
      clinica: '',
      link_reserva: '',
      fecha: '',
      hora: '',
      podologo: '',
    })
    return {
      id: l.id,
      name: l.name,
      phone: l.phone,
      email: l.email,
      interest: l.interest,
      status: l.status,
      notes: l.notes,
      patientId: l.patientId,
      patient: l.patient,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
      waUrl: waUrl(l.phone, text),
    }
  })

  return ok({ rows, total: rows.length, status })
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response

  if (user!.role === 'RECEPTION' || user!.role === 'PODOLOGIST') {
    return bad('Acceso denegado. CRM es exclusivo para Dueños.', 403)
  }

  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')

  const { name, phone, email, interest, notes } = body as {
    name?: string
    phone?: string
    email?: string
    interest?: string
    notes?: string
  }

  if (!name || !name.trim()) return bad('El nombre es obligatorio', 400)

  const clinicId = user!.clinicId
  const created = await db.lead.create({
    data: {
      clinicId,
      name: name.trim(),
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      interest: interest?.trim() || null,
      notes: notes?.trim() || null,
      status: 'NUEVO',
    },
    include: { patient: { select: { id: true, firstName: true, lastName: true, expNumber: true } } },
  })

  return ok(created, 201)
}
