import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { logAudit } from '@/lib/audit'

// ============================================================
// MÓDULO EXPEDIENTE NOM-004 — Consentimientos informados
// GET  /api/consentimientos?patientId=
// POST /api/consentimientos
// 403 si PODOLOGIST en escritura.
// ============================================================

async function loadPatientForUser(patientId: string, user: { role: string; clinicId: string }) {
  const p = await db.patient.findUnique({
    where: { id: patientId },
    select: { id: true, clinicId: true, firstName: true, lastName: true, expNumber: true },
  })
  if (!p) return null
  if (user.role !== 'SUPER' && p.clinicId !== user.clinicId) return 'forbidden' as const
  return p
}

function safeParse<T = any>(s: string | null | undefined, fallback: T = [] as unknown as T): T {
  if (!s) return fallback
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}

export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get('patientId')
  if (!patientId) return bad('patientId es requerido', 400)

  const access = await loadPatientForUser(patientId, user!)
  if (access === null) return bad('Paciente no encontrado', 404)
  if (access === 'forbidden') return bad('Sin acceso a este paciente', 403)

  const rows = await db.consent.findMany({
    where: { patientId },
    orderBy: { fecha: 'desc' },
  })

  const data = rows.map((r) => ({
    ...r,
    riesgosJson: r.riesgosJson ? safeParse<string[]>(r.riesgosJson, []) : [],
  }))

  return ok({ data })
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('No tienes permiso para registrar consentimientos', 403)

  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')

  const patientId = String(body.patientId || '')
  if (!patientId) return bad('patientId es requerido', 400)

  const access = await loadPatientForUser(patientId, user!)
  if (access === null) return bad('Paciente no encontrado', 404)
  if (access === 'forbidden') return bad('Sin acceso a este paciente', 403)

  if (!body.procedimientoPropuesto || !String(body.procedimientoPropuesto).trim()) {
    return bad('procedimientoPropuesto es requerido', 400)
  }

  // riesgosJson es un array de strings
  let riesgosStr: string | null = null
  if (Array.isArray(body.riesgosJson)) {
    riesgosStr = JSON.stringify(body.riesgosJson.filter((r: any) => typeof r === 'string'))
  }

  const data: any = {
    patientId,
    clinicId: access.clinicId,
    procedimientoPropuesto: String(body.procedimientoPropuesto).trim(),
    diagnostico: body.diagnostico || null,
    explicacion: body.explicacion || null,
    beneficios: body.beneficios || null,
    riesgosJson: riesgosStr,
    alternativas: body.alternativas || null,
    consecuenciasNoRealizar: body.consecuenciasNoRealizar || null,
    confirmacionPreguntas: !!body.confirmacionPreguntas,
    aceptacionVoluntaria: !!body.aceptacionVoluntaria,
    firmaPaciente: body.firmaPaciente || null,
    firmaProfesional: body.firmaProfesional || null,
    firmaTestigo: body.firmaTestigo || null,
    firmaTutor: body.firmaTutor || null,
    identificacionAdjuntaUrl: body.identificacionAdjuntaUrl || null,
  }

  if (body.fecha) {
    const d = new Date(body.fecha)
    if (!isNaN(d.getTime())) data.fecha = d
  }

  const created = await db.consent.create({ data })

  await logAudit(
    patientId,
    access.clinicId,
    user!.id,
    user!.name,
    'CREATE_CONSENT',
    'CONSENT',
    `Registro de consentimiento informado: ${created.procedimientoPropuesto} (${created.id})`,
  )

  return ok(
    {
      ...created,
      riesgosJson: created.riesgosJson ? safeParse<string[]>(created.riesgosJson, []) : [],
    },
    201,
  )
}
