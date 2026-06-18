import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'

// ============================================================
// MÓDULO 16 — EVALUACIÓN DE PODÓLOGOS
// PATCH /api/evaluaciones/[podologistId]
// Body: { period, googleReviews?, goalConsults?, goalRevenue? }
// Upsert PodologistEvaluation. 403 si RECEPTION / PODOLOGIST.
// ============================================================

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ podologistId: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'RECEPTION' || user!.role === 'PODOLOGIST') {
    return bad('Acceso denegado', 403)
  }

  const { podologistId } = await ctx.params
  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')

  const { period, googleReviews, goalConsults, goalRevenue } = body as {
    period?: string
    googleReviews?: number
    goalConsults?: number | null
    goalRevenue?: number | null
  }

  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return bad('Periodo inválido (use YYYY-MM)')
  }

  const pod = await db.podologist.findUnique({ where: { id: podologistId } })
  if (!pod) return bad('Podólogo no encontrado', 404)
  if (user!.role !== 'SUPER' && pod.clinicId !== user!.clinicId) {
    return bad('No tienes acceso a este podólogo', 403)
  }

  // Buscar registro existente
  const existing = await db.podologistEvaluation.findFirst({
    where: { podologistId, period },
  })

  const data = {
    googleReviews: googleReviews !== undefined ? Number(googleReviews) : existing?.googleReviews ?? 0,
    goalConsults: goalConsults !== undefined ? (goalConsults === null ? null : Number(goalConsults)) : existing?.goalConsults ?? null,
    goalRevenue: goalRevenue !== undefined ? (goalRevenue === null ? null : Number(goalRevenue)) : existing?.goalRevenue ?? null,
  }

  const upserted = existing
    ? await db.podologistEvaluation.update({ where: { id: existing.id }, data })
    : await db.podologistEvaluation.create({
        data: {
          podologistId,
          clinicId: pod.clinicId,
          period,
          ...data,
        },
      })

  return ok({
    id: upserted.id,
    podologistId: upserted.podologistId,
    period: upserted.period,
    googleReviews: upserted.googleReviews,
    goalConsults: upserted.goalConsults,
    goalRevenue: upserted.goalRevenue,
  })
}
