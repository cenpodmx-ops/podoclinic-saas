import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad, effectiveClinic } from '@/lib/api'
import { startOfDay, endOfDay, parseISO, subDays } from 'date-fns'

// ============================================================
// MÓDULO 15 — CIERRE Y APERTURA DE SUCURSAL
// GET /api/operaciones/historial?from=&to=
// Devuelve lista de DailyOperations (aperturas + cierres) para historial.
// Default: últimos 30 días. 403 si PODOLOGIST. OWNER/SUPER only.
// ============================================================

export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)
  if (user!.role !== 'SUPER' && user!.role !== 'OWNER') {
    return bad('Acceso denegado', 403)
  }

  const url = req.nextUrl
  const all = url.searchParams.get('all') || undefined
  const clinicId = effectiveClinic(user!, all || undefined)

  const today = new Date()
  const fromParam = url.searchParams.get('from') || format(subDays(today, 30))
  const toParam = url.searchParams.get('to') || format(today)

  const from = startOfDay(parseISO(fromParam))
  const to = endOfDay(parseISO(toParam))
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return bad('Fechas inválidas (use YYYY-MM-DD)')
  }

  const where: any = { date: { gte: from, lte: to } }
  if (clinicId) where.clinicId = clinicId

  const rows = await db.dailyOperation.findMany({
    where,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    include: { clinic: { select: { id: true, name: true } } },
  })

  // Agrupar por fecha
  const byDate = new Map<string, { date: string; clinicName: string; apertura?: any; cierre?: any }>()
  for (const r of rows) {
    const key = r.date.toISOString().slice(0, 10)
    if (!byDate.has(key)) {
      byDate.set(key, { date: key, clinicName: r.clinic?.name || '' })
    }
    const entry = byDate.get(key)!
    if (r.type === 'APERTURA') entry.apertura = r
    else entry.cierre = r
  }

  return ok({ rows: Array.from(byDate.values()), total: rows.length })
}

function format(d: Date) {
  return d.toISOString().slice(0, 10)
}
