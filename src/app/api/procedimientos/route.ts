import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { logAudit } from '@/lib/audit'

// ============================================================
// MÓDULO EXPEDIENTE NOM-004 — Procedimientos podológicos
// GET  /api/procedimientos?patientId=  → lista de procedimientos (newest first)
// POST /api/procedimientos             → crea un procedimiento
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

  const rows = await db.procedure.findMany({
    where: { patientId },
    orderBy: { fecha: 'desc' },
    include: {
      podologist: { select: { id: true, name: true } },
    },
  })

  // Parsear anestesiaJson para el cliente
  const data = rows.map((r) => ({
    ...r,
    anestesiaJson: r.anestesiaJson ? safeParse(r.anestesiaJson) : null,
  }))

  return ok({ data })
}

function safeParse<T = any>(s: string | null | undefined, fallback: T = {} as T): T {
  if (!s) return fallback
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('No tienes permiso para registrar procedimientos', 403)

  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')

  const patientId = String(body.patientId || '')
  if (!patientId) return bad('patientId es requerido', 400)

  const access = await loadPatientForUser(patientId, user!)
  if (access === null) return bad('Paciente no encontrado', 404)
  if (access === 'forbidden') return bad('Sin acceso a este paciente', 403)

  if (!body.procedimiento || !String(body.procedimiento).trim()) {
    return bad('procedimiento es requerido', 400)
  }

  const data: any = {
    patientId,
    clinicId: access.clinicId,
    procedimiento: String(body.procedimiento).trim(),
    indicacion: body.indicacion || null,
    diagnosticoRelacionado: body.diagnosticoRelacionado || null,
    regionAnatomica: body.regionAnatomica || null,
    pieDedoLado: body.pieDedoLado || null,
    tecnica: body.tecnica || null,
    antisepctico: body.antisepctico || null,
    instrumental: body.instrumental || null,
    anestesiaJson: body.anestesiaJson ? JSON.stringify(body.anestesiaJson) : null,
    hemostasia: body.hemostasia || null,
    hallazgos: body.hallazgos || null,
    complicaciones: body.complicaciones || null,
    materialCuracion: body.materialCuracion || null,
    indicacionesPost: body.indicacionesPost || null,
    tolerancia: body.tolerancia || null,
    profesionalResponsable: body.profesionalResponsable || null,
    firmaData: body.firmaData || null,
  }

  if (body.consultationId) {
    const cons = await db.consultation.findUnique({ where: { id: String(body.consultationId) }, select: { clinicId: true } })
    if (cons && cons.clinicId === access.clinicId) {
      data.consultationId = String(body.consultationId)
    }
  }
  if (body.podologistId) {
    const pod = await db.podologist.findUnique({ where: { id: String(body.podologistId) }, select: { clinicId: true } })
    if (pod && pod.clinicId === access.clinicId) {
      data.podologistId = String(body.podologistId)
    }
  }
  if (body.fecha) {
    const d = new Date(body.fecha)
    if (!isNaN(d.getTime())) data.fecha = d
  }

  const created = await db.procedure.create({ data })

  await logAudit(
    patientId,
    access.clinicId,
    user!.id,
    user!.name,
    'CREATE_PROCEDURE',
    'PROCEDIMIENTO',
    `Registro de procedimiento: ${created.procedimiento} (${created.id})`,
  )

  return ok(
    {
      ...created,
      anestesiaJson: created.anestesiaJson ? JSON.parse(created.anestesiaJson) : null,
    },
    201,
  )
}
