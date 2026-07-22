import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad, effectiveClinic } from '@/lib/api'
import { canAccessFinance } from '@/lib/session'
import {
  subDays,
  subWeeks,
  subMonths,
  subYears,
  format,
  eachDayOfInterval,
  eachMonthOfInterval,
  parseISO,
  isWithinInterval,
} from 'date-fns'
import {
  startOfDayHermosillo,
  endOfDayHermosillo,
  startOfWeekHermosillo,
  endOfWeekHermosillo,
  startOfMonthHermosillo,
  endOfMonthHermosillo,
  startOfYearHermosillo,
  endOfYearHermosillo,
} from '@/lib/timezone'

// ============================================================
// MÓDULO 07 — FINANZAS — Dashboard
// GET /api/finanzas  ?period=dia|semana|mes|año  &from=&to=  &all=1
// Acceso: OWNER + SUPER. RECEPTION/PODOLOGIST = 403.
// ============================================================

type Period = 'dia' | 'semana' | 'mes' | 'año'

export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (!canAccessFinance(user)) return bad('Acceso denegado', 403)

  const url = req.nextUrl
  const all = url.searchParams.get('all') || undefined
  const clinicId = effectiveClinic(user!, all || undefined)

  // Determinar el periodo
  const period = (url.searchParams.get('period') as Period) || 'mes'
  const fromParam = url.searchParams.get('from')
  const toParam = url.searchParams.get('to')

  let start: Date
  let end: Date
  let prevStart: Date
  let prevEnd: Date

  if (fromParam && toParam) {
    start = startOfDayHermosillo(parseISO(fromParam))
    end = endOfDayHermosillo(parseISO(toParam))
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    prevStart = startOfDayHermosillo(subDays(start, days))
    prevEnd = endOfDayHermosillo(subDays(start, 1))
  } else {
    const r = getRangeForPeriod(period)
    start = r.start
    end = r.end
    const p = getPreviousRange(period, start, end)
    prevStart = p.start
    prevEnd = p.end
  }

  // Cargar movimientos del periodo actual
  const where = {
    ...(clinicId ? { clinicId } : {}),
    createdAt: { gte: start, lte: end },
  }
  const prevWhere = {
    ...(clinicId ? { clinicId } : {}),
    createdAt: { gte: prevStart, lte: prevEnd },
  }

  const [movements, prevMovements, consultations, podologists] = await Promise.all([
    db.cashMovement.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    }),
    db.cashMovement.findMany({
      where: prevWhere,
      orderBy: { createdAt: 'asc' },
    }),
    db.consultation.findMany({
      where: {
        ...(clinicId ? { clinicId } : {}),
        date: { gte: start, lte: end },
        paid: true,
      },
      include: {
        podologist: { select: { id: true, name: true, commissionPct: true } },
        appointment: { select: { id: true, serviceName: true, serviceId: true } },
      },
    }),
    db.podologist.findMany({
      where: clinicId ? { clinicId } : {},
      select: { id: true, name: true, commissionPct: true },
    }),
  ])

  // ── Totales por fuente
  const ingresosBySource = { consulta: 0, mostrador: 0, otros: 0 }
  const egresosByCategory: Record<string, number> = {}
  const ingresosByMethod = { EFECTIVO: 0, TARJETA: 0, TRANSFERENCIA: 0, OTRO: 0 }

  for (const m of movements) {
    if (m.type === 'INGRESO') {
      if (m.source === 'CONSULTA') ingresosBySource.consulta += m.amount
      else if (m.source === 'MOSTRADOR') ingresosBySource.mostrador += m.amount
      else if (m.source === 'EFECTIVO_INICIAL') continue
      else ingresosBySource.otros += m.amount

      // Por método
      if (m.method === 'EFECTIVO') ingresosByMethod.EFECTIVO += m.amount
      else if (m.method === 'DEBITO' || m.method === 'CREDITO') ingresosByMethod.TARJETA += m.amount
      else if (m.method === 'TRANSFERENCIA') ingresosByMethod.TRANSFERENCIA += m.amount
      else ingresosByMethod.OTRO += m.amount
    } else if (m.type === 'EGRESO') {
      // Description format: "[CATEGORY] description"
      const match = (m.description || '').match(/^\[([A-Z_]+)\]/)
      const cat = match ? match[1] : 'OTRO'
      egresosByCategory[cat] = (egresosByCategory[cat] || 0) + m.amount
    }
  }

  const ingresosTotal = ingresosBySource.consulta + ingresosBySource.mostrador + ingresosBySource.otros
  const egresosTotal = Object.values(egresosByCategory).reduce((s, v) => s + v, 0)
  const neto = ingresosTotal - egresosTotal

  // ── Periodo anterior (para comparación)
  const prevIngresos = prevMovements
    .filter((m) => m.type === 'INGRESO' && m.source !== 'EFECTIVO_INICIAL')
    .reduce((s, m) => s + m.amount, 0)
  const prevEgresos = prevMovements
    .filter((m) => m.type === 'EGRESO')
    .reduce((s, m) => s + m.amount, 0)
  const prevNeto = prevIngresos - prevEgresos

  const pctChange = (curr: number, prev: number) => {
    if (prev === 0) return curr === 0 ? 0 : 100
    return ((curr - prev) / Math.abs(prev)) * 100
  }

  // ── Por podólogo
  const byPodologistMap = new Map<
    string,
    { name: string; consults: number; revenue: number; commissionPct: number }
  >()
  for (const c of consultations) {
    const podId = c.podologistId || '__sin'
    const podName = c.podologist?.name || 'Sin asignar'
    const commissionPct = c.podologist?.commissionPct ?? 0
    const cur = byPodologistMap.get(podId) || { name: podName, consults: 0, revenue: 0, commissionPct }
    cur.consults += 1
    cur.revenue += c.total
    byPodologistMap.set(podId, cur)
  }
  const byPodologist = Array.from(byPodologistMap.values()).map((p) => ({
    ...p,
    commission: (p.revenue * p.commissionPct) / 100,
  }))

  // ── Top servicios (basado en citas finalizaron consulta)
  const topServicesMap = new Map<string, { count: number; revenue: number }>()
  for (const c of consultations) {
    const name = c.appointment?.serviceName || 'Consulta general'
    const cur = topServicesMap.get(name) || { count: 0, revenue: 0 }
    cur.count += 1
    cur.revenue += c.total
    topServicesMap.set(name, cur)
  }
  const topServices = Array.from(topServicesMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)

  // ── Serie diaria del periodo
  const dailySeries = buildDailySeries(movements, start, end, period)

  return ok({
    period,
    range: { from: format(start, 'yyyy-MM-dd'), to: format(end, 'yyyy-MM-dd') },
    totals: {
      ingresos: ingresosTotal,
      egresos: egresosTotal,
      neto,
      bySource: ingresosBySource,
      egresosByCategory,
    },
    byMethod: ingresosByMethod,
    byPodologist,
    topServices,
    dailySeries,
    comparison: {
      prevIngresos,
      prevEgresos,
      prevNeto,
      ingresosPct: pctChange(ingresosTotal, prevIngresos),
      egresosPct: pctChange(egresosTotal, prevEgresos),
      netoPct: pctChange(neto, prevNeto),
    },
  })
}

// ── Helpers
function getRangeForPeriod(period: Period) {
  const now = new Date()
  switch (period) {
    case 'dia':
      return { start: startOfDayHermosillo(now), end: endOfDayHermosillo(now) }
    case 'semana':
      return { start: startOfWeekHermosillo(now), end: endOfWeekHermosillo(now) }
    case 'mes':
      return { start: startOfMonthHermosillo(now), end: endOfMonthHermosillo(now) }
    case 'año':
      return { start: startOfYearHermosillo(now), end: endOfYearHermosillo(now) }
  }
}

function getPreviousRange(period: Period, _start: Date, end: Date) {
  // El "periodo anterior" es el periodo inmediato anterior al actual
  switch (period) {
    case 'dia':
      return { start: startOfDayHermosillo(subDays(end, 1)), end: endOfDayHermosillo(subDays(end, 1)) }
    case 'semana':
      return {
        start: startOfWeekHermosillo(subWeeks(end, 1)),
        end: endOfWeekHermosillo(subWeeks(end, 1)),
      }
    case 'mes':
      return { start: startOfMonthHermosillo(subMonths(end, 1)), end: endOfMonthHermosillo(subMonths(end, 1)) }
    case 'año':
      return { start: startOfYearHermosillo(subYears(end, 1)), end: endOfYearHermosillo(subYears(end, 1)) }
  }
}

function buildDailySeries(
  movements: Array<{ type: string; source: string; amount: number; createdAt: Date }>,
  start: Date,
  end: Date,
  period: Period,
) {
  // Para 'año' agrupar por mes, para los demás por día
  if (period === 'año') {
    const months = eachMonthOfInterval({ start, end })
    return months.map((m) => {
      const mStart = startOfMonthHermosillo(m)
      const mEnd = endOfMonthHermosillo(m)
      const inRange = movements.filter((mv) => isWithinInterval(mv.createdAt, { start: mStart, end: mEnd }))
      const ingresos = inRange
        .filter((mv) => mv.type === 'INGRESO' && mv.source !== 'EFECTIVO_INICIAL')
        .reduce((s, mv) => s + mv.amount, 0)
      const egresos = inRange.filter((mv) => mv.type === 'EGRESO').reduce((s, mv) => s + mv.amount, 0)
      return {
        date: format(m, 'MMM yy'),
        ingresos,
        egresos,
      }
    })
  }

  const days = eachDayOfInterval({ start, end })
  return days.map((d) => {
    const dStart = startOfDayHermosillo(d)
    const dEnd = endOfDayHermosillo(d)
    const inRange = movements.filter((mv) => isWithinInterval(mv.createdAt, { start: dStart, end: dEnd }))
    const ingresos = inRange
      .filter((mv) => mv.type === 'INGRESO' && mv.source !== 'EFECTIVO_INICIAL')
      .reduce((s, mv) => s + mv.amount, 0)
    const egresos = inRange.filter((mv) => mv.type === 'EGRESO').reduce((s, mv) => s + mv.amount, 0)
    return {
      date: format(d, period === 'mes' ? 'dd MMM' : 'dd/MM'),
      ingresos,
      egresos,
    }
  })
}
