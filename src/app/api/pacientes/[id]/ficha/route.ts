import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { logAudit } from '@/lib/audit'

// ============================================================
// MÓDULO EXPEDIENTE NOM-004 — Ficha de identificación
// PATCH /api/pacientes/[id]/ficha
// Guarda el objeto completo de ficha de identificación (sección 3).
// 403 si PODOLOGIST o cross-clinic.
// ============================================================

async function loadPatientForUser(id: string, user: { role: string; clinicId: string }) {
  const p = await db.patient.findUnique({
    where: { id },
    select: { id: true, clinicId: true },
  })
  if (!p) return null
  if (user.role !== 'SUPER' && p.clinicId !== user.clinicId) return 'forbidden' as const
  return p
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('No tienes permiso para editar la ficha de identificación', 403)
  const { id } = await ctx.params

  const access = await loadPatientForUser(id, user!)
  if (access === null) return bad('Paciente no encontrado', 404)
  if (access === 'forbidden') return bad('Sin acceso a este paciente', 403)

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return bad('Cuerpo inválido (se esperaba objeto)')

  // La ficha de identificación puede contener:
  //   estadoCivil, ocupacion, escolaridad, contactoEmergencia, parentesco,
  //   grupoSanguineo, religion, grupoEtnico, pacienteNuevoSubsecuente,
  //   medioLlegada, motivoAdmin, etc.
  const fichaStr = JSON.stringify(body)
  const updated = await db.patient.update({
    where: { id },
    data: { fichaIdentificacion: fichaStr },
    select: {
      id: true,
      fichaIdentificacion: true,
    },
  })

  await logAudit(
    id,
    access.clinicId,
    user!.id,
    user!.name,
    'EDIT',
    'FICHA',
    'Actualización de la ficha de identificación del paciente',
  )

  return ok({
    id: updated.id,
    fichaIdentificacion: updated.fichaIdentificacion ? JSON.parse(updated.fichaIdentificacion) : null,
  })
}
