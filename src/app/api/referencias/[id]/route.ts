import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { logAudit } from '@/lib/audit'

// ============================================================
// MÓDULO EXPEDIENTE NOM-004 — Referencias / [id]
// GET    → referencia completa con motivoClinicoJson parseado
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

async function loadReferralForUser(id: string, user: { role: string; clinicId: string }) {
  const r = await db.referral.findUnique({
    where: { id },
    select: { id: true, clinicId: true, patientId: true, tipo: true, prioridad: true },
  })
  if (!r) return null
  if (user.role !== 'SUPER' && r.clinicId !== user.clinicId) return 'forbidden' as const
  return r
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)
  const { id } = await ctx.params

  const access = await loadReferralForUser(id, user!)
  if (access === null) return bad('Referencia no encontrada', 404)
  if (access === 'forbidden') return bad('Sin acceso a esta referencia', 403)

  const r = await db.referral.findUnique({
    where: { id },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, expNumber: true } },
    },
  })
  if (!r) return bad('Referencia no encontrada', 404)

  return ok({
    ...r,
    motivoClinicoJson: r.motivoClinicoJson ? safeParse<string[]>(r.motivoClinicoJson, []) : [],
  })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('No tienes permiso para eliminar referencias', 403)
  const { id } = await ctx.params

  const access = await loadReferralForUser(id, user!)
  if (access === null) return bad('Referencia no encontrada', 404)
  if (access === 'forbidden') return bad('Sin acceso a esta referencia', 403)

  await db.referral.delete({ where: { id } })

  await logAudit(
    access.patientId,
    access.clinicId,
    user!.id,
    user!.name,
    'DELETE',
    'REFERRAL',
    `Eliminación de ${access.tipo.toLowerCase()} (${id})`,
  )

  return ok({ ok: true })
}
