import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad, effectiveClinic } from '@/lib/api'
import { waUrl, fillTemplate, DEFAULT_TEMPLATES, type TemplateKey } from '@/lib/whatsapp'

// ============================================================
// MÓDULO 08 — CRM: Campañas WhatsApp
// POST body { segment, templateKey }
//   - segment: INACTIVOS_30 | INACTIVOS_60 | INACTIVOS_90 | INACTIVOS_180
//              |CUMPLEANOS_MES|CUMPLEANOS_SEMANA|CUMPLEANOS_HOY
//              |DIABETICOS|NUEVOS_MES|RIESGO_ABANDONO
//   - templateKey: tplInactive | tplBirthday | tplFollowUp | tplReminder
//
// Devuelve [{ patientId, name, phone, waUrl }] — el frontend abre cada wa.me
// secuencialmente. También registra SegmentMembership para trackear contactados.
// ============================================================

const VALID_TEMPLATE_KEYS: TemplateKey[] = [
  'tplInactive',
  'tplBirthday',
  'tplFollowUp',
  'tplReminder',
]

const VALID_SEGMENTS = [
  'INACTIVOS_30',
  'INACTIVOS_60',
  'INACTIVOS_90',
  'INACTIVOS_180',
  'CUMPLEANOS_MES',
  'CUMPLEANOS_SEMANA',
  'CUMPLEANOS_HOY',
  'DIABETICOS',
  'NUEVOS_MES',
  'RIESGO_ABANDONO',
]

export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response

  if (user!.role === 'RECEPTION' || user!.role === 'PODOLOGIST') {
    return bad('Acceso denegado. CRM es exclusivo para Dueños.', 403)
  }

  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')

  const { segment, templateKey } = body as {
    segment?: string
    templateKey?: TemplateKey
  }

  if (!segment || !VALID_SEGMENTS.includes(segment)) {
    return bad('Segmento inválido', 400)
  }
  if (!templateKey || !VALID_TEMPLATE_KEYS.includes(templateKey)) {
    return bad('Plantilla inválida. Válidas: ' + VALID_TEMPLATE_KEYS.join(', '), 400)
  }

  const all = req.nextUrl.searchParams.get('all') || undefined
  const clinicId = effectiveClinic(user!, all)
  if (!clinicId) {
    // SUPER con all=1 — usar la clínica del usuario como fallback para traer plantillas
    // (no deberíamos mezclar campañas cross-clinic)
    return bad('Especifica una clínica para campañas (no uses ?all=1)', 400)
  }

  // ── Cargar plantilla de la clínica
  const cfg = await db.clinicConfig.findUnique({
    where: { clinicId },
    select: { tplInactive: true, tplBirthday: true, tplFollowUp: true, tplReminder: true },
  })
  const clinic = await db.clinic.findUnique({
    where: { id: clinicId },
    select: { name: true, slug: true, phone: true },
  })

  const tplRaw = cfg?.[templateKey] || DEFAULT_TEMPLATES[templateKey]
  const linkReserva = `${process.env.NEXT_PUBLIC_APP_URL || ''}/reserva?slug=${clinic?.slug || ''}`
  const clinicaName = clinic?.name || 'PodoClinic'

  // ── Llamar internamente a la lógica del endpoint segmentos (re-cálculo)
  // Para no duplicar la lógica, importamos segmentos usando fetch interno no es ideal.
  // En su lugar, replicamos el cálculo mínimo necesario aquí.
  const patientsRaw = await db.patient.findMany({
    where: { clinicId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      birthDate: true,
      isDiabetic: true,
      riskLevel: true,
      createdAt: true,
      appointments: {
        where: { status: 'FINALIZADA' },
        select: { startTime: true },
        orderBy: { startTime: 'desc' },
        take: 1,
      },
    },
  })

  const now = new Date()
  type P = (typeof patientsRaw)[number] & {
    lastVisit: Date | null
    daysSinceVisit: number | null
  }
  const withDays: P[] = patientsRaw.map((p) => {
    const lastVisit = p.appointments[0]?.startTime ?? null
    const daysSinceVisit = lastVisit
      ? Math.floor((now.getTime() - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24))
      : null
    return { ...p, lastVisit, daysSinceVisit }
  })

  // Filtrar por segmento (espejo de /api/crm/segmentos)
  let filtered: P[] = withDays
  switch (segment) {
    case 'INACTIVOS_30':
    case 'INACTIVOS_60':
    case 'INACTIVOS_90':
    case 'INACTIVOS_180': {
      const days = parseInt(segment.split('_')[1], 10)
      filtered = withDays.filter((p) => p.daysSinceVisit === null || p.daysSinceVisit! > days)
      break
    }
    case 'CUMPLEANOS_MES':
      filtered = withDays.filter((p) => p.birthDate && new Date(p.birthDate).getMonth() === now.getMonth())
      break
    case 'CUMPLEANOS_SEMANA': {
      const ws = new Date(now)
      ws.setDate(now.getDate() - ((now.getDay() + 6) % 7))
      ws.setHours(0, 0, 0, 0)
      const we = new Date(ws)
      we.setDate(ws.getDate() + 6)
      we.setHours(23, 59, 59, 999)
      filtered = withDays.filter((p) => {
        if (!p.birthDate) return false
        const b = new Date(p.birthDate)
        const by = new Date(now.getFullYear(), b.getMonth(), b.getDate())
        return by >= ws && by <= we
      })
      break
    }
    case 'CUMPLEANOS_HOY':
      filtered = withDays.filter((p) => {
        if (!p.birthDate) return false
        const b = new Date(p.birthDate)
        return b.getDate() === now.getDate() && b.getMonth() === now.getMonth()
      })
      break
    case 'DIABETICOS':
      filtered = withDays.filter((p) => p.isDiabetic)
      break
    case 'NUEVOS_MES': {
      const m = now.getMonth()
      const y = now.getFullYear()
      filtered = withDays.filter((p) => {
        const c = new Date(p.createdAt)
        return c.getMonth() === m && c.getFullYear() === y
      })
      break
    }
    case 'RIESGO_ABANDONO':
      filtered = withDays.filter(
        (p) =>
          (p.daysSinceVisit === null || p.daysSinceVisit! > 90) &&
          (p.isDiabetic || p.riskLevel === 'ALTO'),
      )
      break
  }

  // ── Generar URLs wa.me para cada paciente y (mejor esfuerzo) registrar/actualizar
  //    su SegmentMembership para trackear la campaña.
  const out = await Promise.all(
    filtered.map(async (p) => {
      const name = `${p.firstName} ${p.lastName}`.trim()
      const text = fillTemplate(tplRaw, {
        nombre_paciente: p.firstName,
        clinica: clinicaName,
        link_reserva: linkReserva,
        fecha: '',
        hora: '',
        podologo: '',
      })

      // Upsert SegmentMembership (mejor esfuerzo — no bloquear si falla)
      try {
        const existing = await db.segmentMembership.findFirst({
          where: { patientId: p.id, clinicId, segment },
          select: { id: true },
        })
        if (existing) {
          // Reset contacted=false en nueva campaña (la marcará el frontend)
          await db.segmentMembership.update({
            where: { id: existing.id },
            data: { contacted: false },
          })
        } else {
          await db.segmentMembership.create({
            data: { patientId: p.id, clinicId, segment, contacted: false },
          })
        }
      } catch {
        // no-op
      }

      return {
        patientId: p.id,
        name,
        firstName: p.firstName,
        lastName: p.lastName,
        phone: p.phone,
        message: text,
        waUrl: waUrl(p.phone, text),
      }
    }),
  )

  return ok({
    segment,
    templateKey,
    count: out.length,
    clinica: clinicaName,
    generatedAt: now.toISOString(),
    recipients: out,
  })
}
