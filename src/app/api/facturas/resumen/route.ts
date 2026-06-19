import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad, effectiveClinic } from '@/lib/api'
import { startOfMonth, endOfMonth, parseISO } from 'date-fns'
import type { InvoiceItem, IvaType } from '@/lib/invoice-types'

// ============================================================
// MÓDULO 04 — FACTURACIÓN
// GET /api/facturas/resumen?month=YYYY-MM&all=1
//   → { month, totalFacturado, totalCancelado, desgloseIva: {IVA16, IVA0, EXENTO}, countEmitidas, countCanceladas, countTimbradas, countSimuladas }
// ============================================================

export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)
  if (user!.role !== 'SUPER' && user!.role !== 'OWNER') {
    return bad('Acceso denegado', 403)
  }

  const sp = req.nextUrl.searchParams
  const all = sp.get('all') || undefined
  const clinicId = effectiveClinic(user!, all)

  const monthParam = sp.get('month') || new Date().toISOString().slice(0, 7) // YYYY-MM
  if (!/^\d{4}-\d{2}$/.test(monthParam)) return bad('Mes inválido (YYYY-MM)')

  const base = parseISO(`${monthParam}-01`)
  const start = startOfMonth(base)
  const end = endOfMonth(base)

  const where: any = { date: { gte: start, lte: end } }
  if (clinicId) where.clinicId = clinicId

  const invoices = await db.invoice.findMany({
    where,
    select: {
      id: true,
      itemsJson: true,
      subtotal: true,
      iva: true,
      total: true,
      status: true,
    },
  })

  const desgloseIva = {
    IVA16: { base: 0, iva: 0, total: 0 },
    IVA0: { base: 0, iva: 0, total: 0 },
    EXENTO: { base: 0, iva: 0, total: 0 },
  }
  let totalFacturado = 0
  let totalSubtotal = 0
  let totalIva = 0
  let countEmitidas = 0
  let countCanceladas = 0
  let countTimbradas = 0
  let countSimuladas = 0

  for (const inv of invoices) {
    if (inv.status === 'CANCELADA') {
      countCanceladas++
      continue
    }
    countEmitidas++
    if (inv.status === 'TIMBRADA') countTimbradas++
    else countSimuladas++

    totalFacturado += inv.total
    totalSubtotal += inv.subtotal
    totalIva += inv.iva

    // Desglose por item
    let items: InvoiceItem[] = []
    try {
      items = JSON.parse(inv.itemsJson) as InvoiceItem[]
    } catch {}
    for (const it of items) {
      const tasa = it.ivaType as IvaType
      if (!desgloseIva[tasa]) continue
      const base = it.qty * it.price
      const iva = tasa === 'IVA16' ? base * 0.16 : 0
      desgloseIva[tasa].base += base
      desgloseIva[tasa].iva += iva
      desgloseIva[tasa].total += base + iva
    }
  }

  // Redondear a 2 decimales
  const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

  return ok({
    month: monthParam,
    totalFacturado: r2(totalFacturado),
    totalSubtotal: r2(totalSubtotal),
    totalIva: r2(totalIva),
    desgloseIva: {
      IVA16: {
        base: r2(desgloseIva.IVA16.base),
        iva: r2(desgloseIva.IVA16.iva),
        total: r2(desgloseIva.IVA16.total),
      },
      IVA0: {
        base: r2(desgloseIva.IVA0.base),
        iva: r2(desgloseIva.IVA0.iva),
        total: r2(desgloseIva.IVA0.total),
      },
      EXENTO: {
        base: r2(desgloseIva.EXENTO.base),
        iva: r2(desgloseIva.EXENTO.iva),
        total: r2(desgloseIva.EXENTO.total),
      },
    },
    countEmitidas,
    countCanceladas,
    countTimbradas,
    countSimuladas,
  })
}
