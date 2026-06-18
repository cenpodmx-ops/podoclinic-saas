import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { logAudit } from '@/lib/audit'

// ============================================================
// MÓDULO EXPEDIENTE NOM-004 — Consentimientos / [id]
// GET    → consentimiento completo con riesgos parseados
// DELETE → elimina. 403 si PODOLOGIST o cross-clinic. Log audit.
// ============================================================

function safeParse<T = any>(s: string | null | undefined, fallback: T = [] as unknown as T): T {
  if (!s) return fallback
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}

async function loadConsentForUser(id: string, user: { role: string; clinicId: string }) {
  const c = await db.consent.findUnique({
    where: { id },
    select: { id: true, clinicId: true, patientId: true, procedimientoPropuesto: true },
  })
  if (!c) return null
  if (user.role !== 'SUPER' && c.clinicId !== user.clinicId) return 'forbidden' as const
  return c
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)
  const { id } = await ctx.params

  const access = await loadConsentForUser(id, user!)
  if (access === null) return bad('Consentimiento no encontrado', 404)
  if (access === 'forbidden') return bad('Sin acceso a este consentimiento', 403)

  const c = await db.consent.findUnique({
    where: { id },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, expNumber: true } },
    },
  })
  if (!c) return bad('Consentimiento no encontrado', 404)

  return ok({
    ...c,
    riesgosJson: c.riesgosJson ? safeParse<string[]>(c.riesgosJson, []) : [],
  })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('No tienes permiso para eliminar consentimientos', 403)
  const { id } = await ctx.params

  const access = await loadConsentForUser(id, user!)
  if (access === null) return bad('Consentimiento no encontrado', 404)
  if (access === 'forbidden') return bad('Sin acceso a este consentimiento', 403)

  await db.consent.delete({ where: { id } })

  await logAudit(
    access.patientId,
    access.clinicId,
    user!.id,
    user!.name,
    'DELETE',
    'CONSENT',
    `Eliminación del consentimiento informado: ${access.procedimientoPropuesto} (${id})`,
  )

  return ok({ ok: true })
}
