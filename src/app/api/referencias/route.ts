import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { logAudit } from '@/lib/audit'

// ============================================================
// MÓDULO EXPEDIENTE NOM-004 — Referencias / Contrarreferencias
// GET  /api/referencias?patientId=
// POST /api/referencias
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

  const rows = await db.referral.findMany({
    where: { patientId },
    orderBy: { fecha: 'desc' },
  })

  const data = rows.map((r) => ({
    ...r,
    motivoClinicoJson: r.motivoClinicoJson ? safeParse<string[]>(r.motivoClinicoJson, []) : [],
  }))

  return ok({ data })
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('No tienes permiso para registrar referencias', 403)

  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')

  const patientId = String(body.patientId || '')
  if (!patientId) return bad('patientId es requerido', 400)

  const access = await loadPatientForUser(patientId, user!)
  if (access === null) return bad('Paciente no encontrado', 404)
  if (access === 'forbidden') return bad('Sin acceso a este paciente', 403)

  // motivoClinicoJson es un array de strings
  let motivoStr: string | null = null
  if (Array.isArray(body.motivoClinicoJson)) {
    motivoStr = JSON.stringify(body.motivoClinicoJson.filter((r: any) => typeof r === 'string'))
  }

  const prioridad = body.prioridad && ['ORDINARIA', 'PREFERENTE', 'URGENTE'].includes(body.prioridad)
    ? body.prioridad
    : 'ORDINARIA'
  const tipo = body.tipo && ['REFERENCIA', 'CONTRARREFERENCIA'].includes(body.tipo)
    ? body.tipo
    : 'REFERENCIA'

  const data: any = {
    patientId,
    clinicId: access.clinicId,
    tipo,
    motivoReferencia: body.motivoReferencia || null,
    diagnosticoPresuntivo: body.diagnosticoPresuntivo || null,
    hallazgosRelevantes: body.hallazgosRelevantes || null,
    tratamientoRealizado: body.tratamientoRealizado || null,
    motivoClinicoJson: motivoStr,
    servicioSugerido: body.servicioSugerido || null,
    prioridad,
    firmaData: body.firmaData || null,
  }

  if (body.fecha) {
    const d = new Date(body.fecha)
    if (!isNaN(d.getTime())) data.fecha = d
  }

  const created = await db.referral.create({ data })

  await logAudit(
    patientId,
    access.clinicId,
    user!.id,
    user!.name,
    'CREATE_REFERRAL',
    'REFERRAL',
    `Registro de ${tipo.toLowerCase()}: ${created.id} (prioridad ${prioridad})`,
  )

  return ok(
    {
      ...created,
      motivoClinicoJson: created.motivoClinicoJson ? safeParse<string[]>(created.motivoClinicoJson, []) : [],
    },
    201,
  )
}
