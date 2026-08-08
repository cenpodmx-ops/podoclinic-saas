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

  // Agrupar por podólogo — incluye desglose de productos vendidos en consulta
  const map = new Map<
    string,
    {
      name: string
      consultCount: number
      totalGenerated: number
      commissionPct: number
      productsCount: number
      productsRevenue: number
    }
  >()
  for (const c of consultations) {
    const podId = c.podologistId || '__sin'
    const podName = c.podologist?.name || 'Sin asignar'
    const commissionPct = c.podologist?.commissionPct ?? 0
    const cur = map.get(podId) || { name: podName, consultCount: 0, totalGenerated: 0, commissionPct, productsCount: 0, productsRevenue: 0 }
    cur.consultCount += 1
    cur.totalGenerated += c.total
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
        cur.productsRevenue += qty * price
      }
    } catch {}
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
    productsCount: rows.reduce((s, r) => s + r.productsCount, 0),
    productsRevenue: rows.reduce((s, r) => s + r.productsRevenue, 0),
  }

  return ok({
    range: { from: fromStr, to: toStr },
    rows,
    total,
  })
}
