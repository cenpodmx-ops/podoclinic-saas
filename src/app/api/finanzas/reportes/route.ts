import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad, effectiveClinic } from '@/lib/api'
import { canAccessFinance } from '@/lib/session'
import { format } from 'date-fns'
import {
  formatDateHermosillo,
  createdAtFieldStart,
  createdAtFieldEnd,
  startOfMonthHermosillo,
  endOfMonthHermosillo,
} from '@/lib/timezone'

// ============================================================
// MÓDULO 07 — FINANZAS — Reportes
// GET /api/finanzas/reportes?type=citas|inventario|comisiones|ingresos&from=&to=
// Acceso: OWNER + SUPER. RECEPTION/PODOLOGIST = 403.
// ============================================================

type ReportType = 'citas' | 'inventario' | 'comisiones' | 'ingresos'

export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (!canAccessFinance(user)) return bad('Acceso denegado', 403)

  const url = req.nextUrl
  const all = url.searchParams.get('all') || undefined
  const clinicId = effectiveClinic(user!, all || undefined)

  const type = url.searchParams.get('type') as ReportType
  if (!type) return bad('Tipo de reporte requerido')

  // Rango por defecto: mes actual (en Hermosillo)
  const fromParam = url.searchParams.get('from')
  const toParam = url.searchParams.get('to')
  const fromStr = fromParam || formatDateHermosillo(startOfMonthHermosillo(new Date()))
  const toStr = toParam || formatDateHermosillo(endOfMonthHermosillo(new Date()))

  switch (type) {
    case 'citas':
      return ok(await reporteCitas(clinicId, fromStr, toStr))
    case 'inventario':
      return ok(await reporteInventario(clinicId))
    case 'comisiones':
      return ok(await reporteComisiones(clinicId, fromStr, toStr))
    case 'ingresos':
      return ok(await reporteIngresos(clinicId, fromStr, toStr))
    default:
      return bad('Tipo de reporte inválido')
  }
}

// ── Citas: lista detallada de citas en el periodo
// `startTime` es un timestamp real (no midnight UTC), así que usamos Hermosillo range
async function reporteCitas(clinicId: string | undefined, fromStr: string, toStr: string) {
  const start = createdAtFieldStart(fromStr)
  const end = createdAtFieldEnd(toStr)

  const appointments = await db.appointment.findMany({
    where: {
      ...(clinicId ? { clinicId } : {}),
      startTime: { gte: start, lte: end },
    },
    include: {
      patient: { select: { firstName: true, lastName: true, expNumber: true, phone: true } },
      podologist: { select: { name: true } },
    },
    orderBy: { startTime: 'asc' },
  })

  const byStatus: Record<string, number> = {}
  for (const a of appointments) {
    byStatus[a.status] = (byStatus[a.status] || 0) + 1
  }

  return {
    title: 'Reporte de Citas',
    range: { from: fromStr, to: toStr },
    total: appointments.length,
    byStatus,
    rows: appointments.map((a) => ({
      fecha: format(a.startTime, 'dd/MM/yyyy'),
      hora: format(a.startTime, 'HH:mm'),
      paciente: `${a.patient.firstName} ${a.patient.lastName}`,
      expediente: a.patient.expNumber,
      telefono: a.patient.phone || '',
      podologo: a.podologist?.name || 'Sin asignar',
      servicio: a.serviceName || '',
      precio: a.price ?? 0,
      status: a.status,
    })),
  }
}

// ── Inventario: snapshot actual con valorización
async function reporteInventario(clinicId: string | undefined) {
  const products = await db.product.findMany({
    where: clinicId ? { clinicId } : {},
    orderBy: { name: 'asc' },
  })

  const totalCostValue = products.reduce((s, p) => s + p.stock * p.costPrice, 0)
  const totalSaleValue = products.reduce((s, p) => s + p.stock * p.salePrice, 0)
  const lowStock = products.filter((p) => p.stock <= p.minStock && p.minStock > 0)

  return {
    title: 'Reporte de Inventario',
    generatedAt: new Date().toISOString(),
    totalProducts: products.length,
    totalUnits: products.reduce((s, p) => s + p.stock, 0),
    totalCostValue,
    totalSaleValue,
    potentialProfit: totalSaleValue - totalCostValue,
    lowStockCount: lowStock.length,
    rows: products.map((p) => ({
      codigo: p.code || '',
      nombre: p.name,
      categoria: p.category,
      stock: p.stock,
      minStock: p.minStock,
      costoUnitario: p.costPrice,
      precioVenta: p.salePrice,
      valorCosto: p.stock * p.costPrice,
      valorVenta: p.stock * p.salePrice,
      estado: p.stock <= 0 ? 'AGOTADO' : p.stock <= p.minStock && p.minStock > 0 ? 'BAJO' : 'OK',
    })),
  }
}

// ── Comisiones: por podólogo en el periodo
// `Consultation.date` es @default(now()) → timestamp real → usar Hermosillo range
async function reporteComisiones(clinicId: string | undefined, fromStr: string, toStr: string) {
  const start = createdAtFieldStart(fromStr)
  const end = createdAtFieldEnd(toStr)

  const consultations = await db.consultation.findMany({
    where: {
      ...(clinicId ? { clinicId } : {}),
      date: { gte: start, lte: end },
      paid: true,
    },
    include: {
      podologist: { select: { id: true, name: true, commissionPct: true } },
      patient: { select: { firstName: true, lastName: true } },
    },
  })

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
    if (commissionPct > 0) cur.commissionPct = commissionPct
    map.set(podId, cur)
  }

  const rows = Array.from(map.values())
    .map((r) => ({ ...r, commissionAmount: (r.totalGenerated * r.commissionPct) / 100 }))
    .sort((a, b) => b.totalGenerated - a.totalGenerated)

  return {
    title: 'Reporte de Comisiones',
    range: { from: fromStr, to: toStr },
    totalConsults: rows.reduce((s, r) => s + r.consultCount, 0),
    totalGenerated: rows.reduce((s, r) => s + r.totalGenerated, 0),
    totalCommission: rows.reduce((s, r) => s + r.commissionAmount, 0),
    rows,
  }
}

// ── Ingresos: movimientos de caja del periodo
// `createdAt` es un timestamp real, así que usamos Hermosillo range
async function reporteIngresos(clinicId: string | undefined, fromStr: string, toStr: string) {
  const start = createdAtFieldStart(fromStr)
  const end = createdAtFieldEnd(toStr)

  const movements = await db.cashMovement.findMany({
    where: {
      ...(clinicId ? { clinicId } : {}),
      createdAt: { gte: start, lte: end },
    },
    orderBy: { createdAt: 'asc' },
  })

  const ingresos = movements.filter((m) => m.type === 'INGRESO' && m.source !== 'EFECTIVO_INICIAL')
  const egresos = movements.filter((m) => m.type === 'EGRESO')

  const bySource: Record<string, number> = {}
  for (const m of ingresos) {
    bySource[m.source] = (bySource[m.source] || 0) + m.amount
  }
  const byMethod: Record<string, number> = {}
  for (const m of ingresos) {
    const k = m.method || 'OTRO'
    byMethod[k] = (byMethod[k] || 0) + m.amount
  }
  const byCategory: Record<string, number> = {}
  for (const m of egresos) {
    const match = (m.description || '').match(/^\[([A-Z_]+)\]/)
    const cat = match ? match[1] : 'OTRO'
    byCategory[cat] = (byCategory[cat] || 0) + m.amount
  }

  return {
    title: 'Reporte de Ingresos y Egresos',
    range: { from: fromStr, to: toStr },
    totalIngresos: ingresos.reduce((s, m) => s + m.amount, 0),
    totalEgresos: egresos.reduce((s, m) => s + m.amount, 0),
    neto: ingresos.reduce((s, m) => s + m.amount, 0) - egresos.reduce((s, m) => s + m.amount, 0),
    bySource,
    byMethod,
    byCategory,
    rows: movements.map((m) => ({
      fecha: format(m.createdAt, 'dd/MM/yyyy HH:mm'),
      tipo: m.type,
      fuente: m.source,
      monto: m.amount,
      metodo: m.method || '',
      descripcion: m.description || '',
    })),
  }
}
