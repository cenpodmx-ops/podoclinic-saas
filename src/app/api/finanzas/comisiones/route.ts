import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad, effectiveClinic } from '@/lib/api'
import { canAccessFinance } from '@/lib/session'
import {
  formatDateHermosillo,
  dateFieldStart,
  dateFieldEnd,
  startOfMonthHermosillo,
  endOfMonthHermosillo,
} from '@/lib/timezone'

// ============================================================
// MÓDULO 07 — FINANZAS — Comisiones por podólogo
// GET /api/finanzas/comisiones  ?from=&to=
// Devuelve por podólogo: { name, consultCount, totalGenerated, commissionPct, commissionAmount }
// Acceso: OWNER + SUPER. RECEPTION/PODOLOGIST = 403.
// ============================================================

export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (!canAccessFinance(user)) return bad('Acceso denegado', 403)

  const url = req.nextUrl
  const all = url.searchParams.get('all') || undefined
  const clinicId = effectiveClinic(user!, all || undefined)

  // Rango: por defecto mes actual (Hermosillo)
  const fromParam = url.searchParams.get('from')
  const toParam = url.searchParams.get('to')
  const fromStr = fromParam || formatDateHermosillo(startOfMonthHermosillo(new Date()))
  const toStr = toParam || formatDateHermosillo(endOfMonthHermosillo(new Date()))

  // Para campo `date` (consultas, guardado como midnight UTC del día calendario)
  const start = dateFieldStart(fromStr)
  const end = dateFieldEnd(toStr)

  // Consultas pagadas en el rango
  const consultations = await db.consultation.findMany({
    where: {
      ...(clinicId ? { clinicId } : {}),
      date: { gte: start, lte: end },
      paid: true,
    },
    include: {
      podologist: { select: { id: true, name: true, commissionPct: true } },
    },
  })

  // Agrupar por podólogo
  const map = new Map<
    string,
    { name: string; consultCount: number; totalGenerated: number; commissionPct: number }
  >()
  for (const c of consultations) {
    const podId = c.podologistId || '__sin'
    const podName = c.podologist?.name || 'Sin asignar'
    const commissionPct = c.podologist?.commissionPct ?? 0
    const cur = map.get(podId) || { name: podName, consultCount: 0, totalGenerated: 0, commissionPct }
    cur.consultCount += 1
    cur.totalGenerated += c.total
    // Mantener el commissionPct (siempre el último visto)
    if (commissionPct > 0) cur.commissionPct = commissionPct
    map.set(podId, cur)
  }

  const rows = Array.from(map.values())
    .map((r) => ({
      ...r,
      commissionAmount: (r.totalGenerated * r.commissionPct) / 100,
    }))
    .sort((a, b) => b.totalGenerated - a.totalGenerated)

  const total = {
    consultCount: rows.reduce((s, r) => s + r.consultCount, 0),
    totalGenerated: rows.reduce((s, r) => s + r.totalGenerated, 0),
    commissionAmount: rows.reduce((s, r) => s + r.commissionAmount, 0),
  }

  return ok({
    range: { from: fromStr, to: toStr },
    rows,
    total,
  })
}
