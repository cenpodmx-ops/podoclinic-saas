import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { logAudit } from '@/lib/audit'

// ============================================================
// MÓDULO EXPEDIENTE NOM-004 — Historia clínica inicial
// GET   → devuelve el JSON parseado + metadata (completa, fecha)
// PATCH → guarda (total o parcial, mergeado) la historia clínica
//         inicial. Marca historiaClinicaCompleta=true y
//         historiaClinicaFecha=now en el primer guardado.
// 403 si PODOLOGIST o cross-clinic.
// ============================================================

async function loadPatientForUser(id: string, user: { role: string; clinicId: string }) {
  const p = await db.patient.findUnique({
    where: { id },
    select: { id: true, clinicId: true },
  })
  if (!p) return null
  // Modo global: OWNER/RECEPTION pueden ver/editar pacientes de cualquier clínica
  if (user.role === 'PODOLOGIST' && p.clinicId !== user.clinicId) return 'forbidden' as const
  return p
}

function safeParse<T = any>(s: string | null | undefined, fallback: T = {} as T): T {
  if (!s) return fallback
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  const { id } = await ctx.params

  const access = await loadPatientForUser(id, user!)
  if (access === null) return bad('Paciente no encontrado', 404)
  if (access === 'forbidden') return bad('Sin acceso a este paciente', 403)

  const patient = await db.patient.findUnique({
    where: { id },
    select: {
      id: true,
      historiaClinicaInicial: true,
      historiaClinicaCompleta: true,
      historiaClinicaFecha: true,
    },
  })
  if (!patient) return bad('Paciente no encontrado', 404)

  return ok({
    id: patient.id,
    historiaClinicaInicial: safeParse(patient.historiaClinicaInicial, null),
    completa: patient.historiaClinicaCompleta,
    fecha: patient.historiaClinicaFecha,
  })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('No tienes permiso para editar la historia clínica', 403)
  const { id } = await ctx.params

  const access = await loadPatientForUser(id, user!)
  if (access === null) return bad('Paciente no encontrado', 404)
  if (access === 'forbidden') return bad('Sin acceso a este paciente', 403)

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return bad('Cuerpo inválido (se esperaba objeto)')

  // Cargar el valor existente para merge (PATCH parcial)
  const existing = await db.patient.findUnique({
    where: { id },
    select: { historiaClinicaInicial: true, historiaClinicaCompleta: true },
  })
  if (!existing) return bad('Paciente no encontrado', 404)

  const existingJson = safeParse(existing.historiaClinicaInicial, {})
  // Merge shallow de primer nivel. El frontend puede enviar el objeto
  // completo o solo algunas secciones (motivoConsulta, padecimientoActual,
  // antecedentesFamiliares, antecedentesPatologicos, etc.).
  const merged = { ...existingJson, ...body }
  const mergedStr = JSON.stringify(merged)

  const data: any = { historiaClinicaInicial: mergedStr }
  // Primera vez que se guarda historia clínica → marcar completa + fecha
  if (!existing.historiaClinicaCompleta) {
    data.historiaClinicaCompleta = true
    data.historiaClinicaFecha = new Date()
  }

  const updated = await db.patient.update({
    where: { id },
    data,
    select: {
      id: true,
      historiaClinicaInicial: true,
      historiaClinicaCompleta: true,
      historiaClinicaFecha: true,
    },
  })

  await logAudit(
    id,
    access.clinicId,
    user!.id,
    user!.name,
    'EDIT',
    'HISTORIA',
    `Actualización de la historia clínica inicial. Secciones modificadas: ${Object.keys(body).join(', ')}`,
  )

  return ok({
    id: updated.id,
    historiaClinicaInicial: safeParse(updated.historiaClinicaInicial, null),
    completa: updated.historiaClinicaCompleta,
    fecha: updated.historiaClinicaFecha,
  })
}
