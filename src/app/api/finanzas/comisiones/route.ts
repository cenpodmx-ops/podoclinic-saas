import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad, effectiveClinic } from '@/lib/api'
import { canAccessFinance } from '@/lib/session'
import {
  formatDateHermosillo,
  createdAtFieldStart,
  createdAtFieldEnd,
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
// MÓDULO 07 — FINANZAS — Comisiones por podólogo
// GET /api/finanzas/comisiones  ?from=&to=  |  ?period=dia|semana|mes|año
// Devuelve por podólogo: { name, consultCount, totalGenerated, commissionPct, commissionAmount,
//                          productsCount, productsRevenue }
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

  // Rango: o bien from/to explícitos, o bien un preset (dia/semana/mes/año)
  // igual que el dashboard principal — para que comisiones SIEMPRE muestre el
  // mismo rango que el dashboard (era un bug: tenían selectores separados).
  const fromParam = url.searchParams.get('from')
  const toParam = url.searchParams.get('to')
  const periodParam = (url.searchParams.get('period') as Period) || 'mes'

  let fromStr: string
  let toStr: string
  if (fromParam && toParam) {
    fromStr = fromParam
    toStr = toParam
  } else {
    const now = new Date()
    let start: Date, end: Date
    switch (periodParam) {
      case 'dia':
        start = startOfDayHermosillo(now); end = endOfDayHermosillo(now); break
      case 'semana':
        start = startOfWeekHermosillo(now); end = endOfWeekHermosillo(now); break
      case 'año':
        start = startOfYearHermosillo(now); end = endOfYearHermosillo(now); break
      case 'mes':
      default:
        start = startOfMonthHermosillo(now); end = endOfMonthHermosillo(now); break
    }
    fromStr = formatDateHermosillo(start)
    toStr = formatDateHermosillo(end)
  }

  // Para Consultation.date (que es @default(now()), timestamp real):
  // Usar Hermosillo day range (igual que CashMovement.createdAt)
  const start = createdAtFieldStart(fromStr)
  const end = createdAtFieldEnd(toStr)

  // Consultas pagadas en el rango — incluir consultPrice y productsTotal
  // para calcular comisión SOLO sobre la consulta, no sobre productos
  const consultations = await db.consultation.findMany({
    where: {
      ...(clinicId ? { clinicId } : {}),
      date: { gte: start, lte: end },
      paid: true,
    },
    select: {
      id: true,
      consultPrice: true,
      productsTotal: true,
      discount: true,
      total: true,
      itemsJson: true,
      podologistId: true,
      podologist: { select: { id: true, name: true, commissionPct: true } },
      appointment: { select: { id: true, serviceName: true, serviceId: true } },
    },
  })

  // Agrupar por podólogo — incluye desglose de productos vendidos en consulta
  // IMPORTANTE: la comisión se calcula SOLO sobre el precio de la consulta
  // DESPUÉS DEL DESCUENTO (no sobre consultPrice full, ni sobre productos).
  // Ej: consultPrice=$600, discount=$120 → consultCharged=$480
  //     comisión = $480 × pct (NO $600 × pct, NO ($480+$producto) × pct)
  // El descuento se atribuye primero a la consulta; si sobra, a los productos.
  const map = new Map<
    string,
    {
      name: string
      consultCount: number
      totalGenerated: number        // total cobrado (consulta + productos - descuento)
      consultRevenue: number        // solo consulta DESPUÉS del descuento (para comisión)
      commissionPct: number
      productsCount: number
      productsRevenue: number        // productos DESPUÉS del descuento (si aplica)
    }
  >()
  for (const c of consultations) {
    const podId = c.podologistId || '__sin'
    const podName = c.podologist?.name || 'Sin asignar'
    const commissionPct = c.podologist?.commissionPct ?? 0
    const cur = map.get(podId) || { name: podName, consultCount: 0, totalGenerated: 0, consultRevenue: 0, commissionPct, productsCount: 0, productsRevenue: 0 }

    // Atribuir el descuento primero a la consulta, luego a los productos
    let consultCharged = c.consultPrice || 0
    let productsCharged = c.productsTotal || 0
    let remainingDiscount = c.discount || 0
    if (remainingDiscount > 0) {
      const consultDiscount = Math.min(consultCharged, remainingDiscount)
      consultCharged -= consultDiscount
      remainingDiscount -= consultDiscount
      if (remainingDiscount > 0) {
        const productsDiscount = Math.min(productsCharged, remainingDiscount)
        productsCharged -= productsDiscount
      }
    }

    cur.consultCount += 1
    cur.totalGenerated += c.total
    cur.consultRevenue += consultCharged
    // Mantener el commissionPct (siempre el último visto)
    if (commissionPct > 0) cur.commissionPct = commissionPct
    // Productos vendidos en esta consulta (iterar itemsJson)
    try {
      const items = JSON.parse(c.itemsJson || '[]') as any[]
      for (const it of items) {
        if (it.type !== 'PRODUCTO' && it.type !== 'MEDICAMENTO') continue
        const qty = Number(it.qty) || 1
        const price = Number(it.price) || 0
        cur.productsCount += qty
      }
    } catch {}
    cur.productsRevenue += productsCharged
    map.set(podId, cur)
  }

  const rows = Array.from(map.values())
    .map((r) => ({
      ...r,
      // Comisión SOLO sobre consulta (después del descuento), no sobre productos
      commissionAmount: Math.round((r.consultRevenue * r.commissionPct) / 100 * 100) / 100,
    }))
    .sort((a, b) => b.totalGenerated - a.totalGenerated)

  const total = {
    consultCount: rows.reduce((s, r) => s + r.consultCount, 0),
    totalGenerated: rows.reduce((s, r) => s + r.totalGenerated, 0),
    consultRevenue: rows.reduce((s, r) => s + r.consultRevenue, 0),
    commissionAmount: rows.reduce((s, r) => s + r.commissionAmount, 0),
    productsCount: rows.reduce((s, r) => s + r.productsCount, 0),
    productsRevenue: rows.reduce((s, r) => s + r.productsRevenue, 0),
  }

  return ok({
    range: { from: fromStr, to: toStr },
    rows,
    total,
  })
}
