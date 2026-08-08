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
  formatDateHermosillo,
  createdAtFieldStart,
  createdAtFieldEnd,
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
    // Cuando el usuario pasa from=2026-07-24&to=2026-07-30, queremos:
    //  - Para `createdAt` (movimientos): del 2026-07-24T07:00Z (00:00 Hermosillo) al 2026-07-31T06:59:59Z (23:59 Hermosillo del 30)
    //  - Para `date` (consultas): del 2026-07-24T00:00Z al 2026-07-30T23:59:59Z (medianoche UTC del día calendario)
    //
    // BUG ANTERIOR: startOfDayHermosillo(parseISO('2026-07-24')) devolvía 2026-07-23T07:00Z
    // (un día antes) porque parseISO crea medianoche UTC y startOfDayHermosillo lo trataba
    // como un instante Hermosillo (17:00 del día anterior) → tomaba midnight de ese día anterior.
    start = createdAtFieldStart(fromParam)
    end = createdAtFieldEnd(toParam)
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    prevStart = createdAtFieldStart(formatDateHermosillo(subDays(start, days)))
    prevEnd = createdAtFieldEnd(formatDateHermosillo(subDays(start, 1)))
  } else {
    const r = getRangeForPeriod(period)
    start = r.start
    end = r.end
    const p = getPreviousRange(period, start, end)
    prevStart = p.start
    prevEnd = p.end
  }

  // Para Consultation.date (que es @default(now()), timestamp real):
  // Usar Hermosillo day range (igual que CashMovement.createdAt)
  const consultRangeStart = createdAtFieldStart(fromParam || formatDateHermosillo(start))
  const consultRangeEnd = createdAtFieldEnd(fromParam ? toParam! : formatDateHermosillo(end))

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
        // Consultation.date es @default(now()) → timestamp real (no midnight UTC).
        // Por eso se filtra con Hermosillo day range (igual que CashMovement.createdAt),
        // NO con midnight UTC range. Antes usabamos dateFieldRange y causaba que
        // consultas creadas después de 5 PM Hermosillo se contaran en el día siguiente.
        date: { gte: consultRangeStart, lte: consultRangeEnd },
        paid: true,
      },
      include: {
        podologist: { select: { id: true, name: true, commissionPct: true } },
        appointment: { select: { id: true, serviceName: true, serviceId: true } },
      },
      select: {
        id: true,
        date: true,
        consultPrice: true,
        productsTotal: true,
        discount: true,
        total: true,
        paymentMethod: true,
        itemsJson: true,
        podologistId: true,
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
  // Desglose detallado: count, revenue (con descuento), avgPrice, descuento total,
  // productos vendidos por tipo de servicio
  const topServicesMap = new Map<
    string,
    {
      count: number
      revenue: number
      bruto: number
      descuento: number
      productos: number
      podologos: Set<string>
    }
  >()
  for (const c of consultations) {
    const name = c.appointment?.serviceName || 'Consulta general'
    const cur = topServicesMap.get(name) || { count: 0, revenue: 0, bruto: 0, descuento: 0, productos: 0, podologos: new Set() }
    cur.count += 1
    cur.revenue += c.total
    cur.bruto += (c.consultPrice || 0) + (c.productsTotal || 0)
    cur.descuento += c.discount || 0
    // Productos vendidos en esta consulta
    try {
      const items = JSON.parse(c.itemsJson || '[]') as any[]
      for (const it of items) {
        if (it.type === 'PRODUCTO' || it.type === 'MEDICAMENTO') {
          cur.productos += (Number(it.qty) || 1)
        }
      }
    } catch {}
    if (c.podologist?.name) cur.podologos.add(c.podologist.name)
    topServicesMap.set(name, cur)
  }
  const topServices = Array.from(topServicesMap.entries())
    .map(([name, v]) => ({
      name,
      count: v.count,
      revenue: v.revenue,
      bruto: v.bruto,
      descuento: v.descuento,
      productos: v.productos,
      avgPrice: v.count > 0 ? v.revenue / v.count : 0,
      podologosCount: v.podologos.size,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)

  // ── Descuentos aplicados (resumen)
  let descuentosCount = 0
  let descuentosTotal = 0
  let brutoTotalConsultas = 0  // consultPrice + productsTotal antes de descuento
  let netoTotalConsultas = 0   // total ya con descuento aplicado (= revenue)
  for (const c of consultations) {
    const bruto = (c.consultPrice || 0) + (c.productsTotal || 0)
    const desc = c.discount || 0
    brutoTotalConsultas += bruto
    netoTotalConsultas += c.total
    if (desc > 0) {
      descuentosCount += 1
      descuentosTotal += desc
    }
  }

  // ── Productos vendidos (desglose)
  // Dos fuentes:
  //  1) Ventas de mostrador (CashMovement source='MOSTRADOR') — ya en ingresosBySource.mostrador
  //  2) Productos vendidos en consulta (Consultation.itemsJson con type='PRODUCTO'/'MEDICAMENTO')
  //     — NO se pueden separar del monto total del CashMovement de consulta, hay que iterar itemsJson.
  let productosEnConsultas = 0   // total $ de productos vendidos dentro de consultas
  let productosMostrador = ingresosBySource.mostrador  // total $ de ventas de mostrador
  const topProductosMap = new Map<string, { count: number; revenue: number; category: string }>()
  const productosByPodologoMap = new Map<string, { name: string; productsCount: number; productsRevenue: number }>()

  for (const c of consultations) {
    let items: any[] = []
    try {
      items = JSON.parse(c.itemsJson || '[]') as any[]
    } catch {
      items = []
    }
    let podProductsRevenue = 0
    let podProductsCount = 0
    for (const it of items) {
      if (it.type !== 'PRODUCTO' && it.type !== 'MEDICAMENTO') continue
      const qty = Number(it.qty) || 1
      const price = Number(it.price) || 0
      const lineTotal = qty * price
      productosEnConsultas += lineTotal
      podProductsRevenue += lineTotal
      podProductsCount += qty
      // Top productos
      const name = String(it.name || 'Sin nombre')
      const cur = topProductosMap.get(name) || { count: 0, revenue: 0, category: it.type }
      cur.count += qty
      cur.revenue += lineTotal
      topProductosMap.set(name, cur)
    }
    // Productos por podólogo
    if (podProductsCount > 0) {
      const podId = c.podologistId || '__sin'
      const podName = c.podologist?.name || 'Sin asignar'
      const cur = productosByPodologoMap.get(podId) || { name: podName, productsCount: 0, productsRevenue: 0 }
      cur.productsCount += podProductsCount
      cur.productsRevenue += podProductsRevenue
      productosByPodologoMap.set(podId, cur)
    }
  }
  const topProductos = Array.from(topProductosMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
  const productosByPodologo = Array.from(productosByPodologoMap.values())
    .sort((a, b) => b.productsRevenue - a.productsRevenue)
  const totalProductos = productosEnConsultas + productosMostrador

  // ── Serie diaria del periodo
  const dailySeries = buildDailySeries(movements, start, end, period)

  return ok({
    period,
    range: { from: formatDateHermosillo(start), to: formatDateHermosillo(end) },
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
    // ── Productos vendidos ──
    productos: {
      total: totalProductos,
      enConsultas: productosEnConsultas,
      mostrador: productosMostrador,
      top: topProductos,
      byPodologo: productosByPodologo,
    },
    // ── Descuentos aplicados ──
    descuentos: {
      count: descuentosCount,
      total: descuentosTotal,
      bruto: brutoTotalConsultas,
      neto: netoTotalConsultas,
      pctAhorro: brutoTotalConsultas > 0 ? (descuentosTotal / brutoTotalConsultas) * 100 : 0,
    },
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

  // Generar días del rango en zona horaria de Hermosillo
  // Para evitar desfases, generamos los días en "tiempo local Hermosillo"
  const HERMOSILLO_OFFSET = -7
  const toHermosillo = (d: Date) => new Date(d.getTime() + HERMOSILLO_OFFSET * 60 * 60 * 1000)
  const fromHermosillo = (d: Date) => new Date(d.getTime() - HERMOSILLO_OFFSET * 60 * 60 * 1000)

  // Convertir start y end a Hermosillo para generar los días
  const localStart = toHermosillo(start)
  const localEnd = toHermosillo(end)

  // Generar cada día en zona local Hermosillo
  const days: Date[] = []
  const cur = new Date(localStart.getFullYear(), localStart.getMonth(), localStart.getDate())
  const lastDay = new Date(localEnd.getFullYear(), localEnd.getMonth(), localEnd.getDate())
  while (cur <= lastDay) {
    days.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }

  return days.map((d) => {
    // Para cada día local, calcular el rango UTC correspondiente
    const dStart = fromHermosillo(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0))
    const dEnd = fromHermosillo(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999))

    const inRange = movements.filter((mv) => mv.createdAt >= dStart && mv.createdAt <= dEnd)
    const ingresos = inRange
      .filter((mv) => mv.type === 'INGRESO' && mv.source !== 'EFECTIVO_INICIAL')
      .reduce((s, mv) => s + mv.amount, 0)
    const egresos = inRange.filter((mv) => mv.type === 'EGRESO').reduce((s, mv) => s + mv.amount, 0)

    // Formatear la fecha usando el día local de Hermosillo
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    const dayStr = period === 'mes'
      ? `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]}`
      : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`

    return {
      date: dayStr,
      ingresos,
      egresos,
    }
  })
}
