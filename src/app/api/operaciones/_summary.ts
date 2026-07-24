import { db } from '@/lib/db'

/**
 * Calcula el resumen de operación de un día para una clínica:
 *   - citas atendidas, canceladas, no-show, pendientes, total
 *   - ingresos por método (efectivo, tarjeta, transferencia)
 *   - desglose por concepto: consulta vs productos/medicamentos
 *   - total por podólogo (ingreso bruto, sin descontar comisión)
 *   - egresos
 *   - efectivo esperado en caja
 *
 * IMPORTANTE:
 * - El fondo de apertura (EFECTIVO_INICIAL) NO se cuenta como ingreso
 * - totalConsulta usa el `total` de la consulta (con descuento aplicado), no consultPrice
 * - totalProductos incluye items de consultas + ventas de mostrador
 * - expectedCash = fondo + ingresosEfectivo - egresosEfectivo
 */
export async function computeDailySummary(clinicId: string, date: Date) {
  const dayStr = date.toISOString().slice(0, 10)
  const ds = new Date(dayStr + 'T00:00:00.000Z')
  const de = new Date(dayStr + 'T23:59:59.999Z')

  // Para campo `createdAt` (movimientos): rango UTC de Hermosillo
  const dsCreated = new Date(dayStr + 'T07:00:00.000Z')
  const deCreated = new Date(dayStr + 'T06:59:59.999Z')
  deCreated.setDate(deCreated.getDate() + 1)

  const [appts, movements, aperturaOp, cashSession, consultations] = await Promise.all([
    db.appointment.findMany({
      where: { clinicId, date: { gte: ds, lte: de } },
      select: { id: true, status: true, podologistId: true, podologist: { select: { name: true } } },
    }),
    db.cashMovement.findMany({
      where: { clinicId, createdAt: { gte: dsCreated, lte: deCreated } },
      select: { type: true, source: true, method: true, amount: true },
    }),
    db.dailyOperation.findFirst({
      where: { clinicId, type: 'APERTURA', date: { gte: ds, lte: de } },
    }),
    db.cashSession.findFirst({
      where: { clinicId, date: { gte: ds, lte: de } },
    }),
    db.consultation.findMany({
      where: { clinicId, createdAt: { gte: dsCreated, lte: deCreated }, paid: true },
      select: {
        id: true,
        consultPrice: true,
        productsTotal: true,
        total: true,
        discount: true,
        itemsJson: true,
        podologistId: true,
        podologist: { select: { name: true } },
      },
    }),
  ])

  const citas = {
    total: appts.length,
    atendidas: appts.filter((a) => a.status === 'FINALIZADA').length,
    canceladas: appts.filter((a) => a.status === 'CANCELADA').length,
    noAsistio: appts.filter((a) => a.status === 'NO_ASISTIO').length,
    pendientes: appts.filter((a) => a.status === 'PENDIENTE' || a.status === 'CONFIRMADA' || a.status === 'EN_CONSULTA').length,
  }

  // ===== Ingresos por método =====
  // IMPORTANTE: excluir EFECTIVO_INICIAL del fondo de apertura
  const byMethod: Record<string, number> = { EFECTIVO: 0, DEBITO: 0, CREDITO: 0, TRANSFERENCIA: 0, OTRO: 0 }
  let totalIngresos = 0
  let totalEgresos = 0
  let egresosEfectivo = 0
  let ingresosEfectivo = 0

  for (const m of movements) {
    if (m.type === 'INGRESO') {
      // El fondo inicial NO es un ingreso operativo
      if (m.source === 'EFECTIVO_INICIAL') continue
      const k = (m.method || 'EFECTIVO') as keyof typeof byMethod
      byMethod[k] = (byMethod[k] || 0) + m.amount
      totalIngresos += m.amount
      if (k === 'EFECTIVO') ingresosEfectivo += m.amount
    } else if (m.type === 'EGRESO') {
      totalEgresos += m.amount
      if ((m.method || 'EFECTIVO') === 'EFECTIVO') egresosEfectivo += m.amount
    }
  }

  // ===== Desglose por concepto =====
  // totalConsulta = precio real cobrado (con descuento) = total - productsTotal
  // totalProductos = items de consultas + ventas de mostrador
  let totalConsulta = 0
  let totalProductos = 0

  // Productos de consultas
  for (const c of consultations) {
    // El precio de consulta con descuento = total - productsTotal
    const consultaReal = (c.total || 0) - (c.productsTotal || 0)
    totalConsulta += consultaReal
    // Productos vendidos en la consulta
    totalProductos += c.productsTotal || 0
  }

  // Ventas de mostrador (movimientos con source='MOSTRADOR')
  for (const m of movements) {
    if (m.type === 'INGRESO' && m.source === 'MOSTRADOR') {
      totalProductos += m.amount
    }
  }

  // ===== Ingreso bruto por podólogo =====
  // Usar el total real (con descuento) de cada consulta
  const byPodologo: Record<string, { name: string; consultas: number; total: number }> = {}
  for (const c of consultations) {
    const key = c.podologistId || 'sin'
    const name = c.podologist?.name || 'Sin asignar'
    if (!byPodologo[key]) byPodologo[key] = { name, consultas: 0, total: 0 }
    byPodologo[key].consultas++
    byPodologo[key].total += c.total || 0
  }

  const openingFund = aperturaOp?.openingFund ?? cashSession?.openingFund ?? 0
  const expectedCash = openingFund + ingresosEfectivo - egresosEfectivo

  return {
    citas,
    ingresos: { byMethod, total: totalIngresos },
    egresos: { total: totalEgresos, efectivo: egresosEfectivo },
    openingFund,
    expectedCash,
    cashSession,
    totalEfectivo: byMethod.EFECTIVO || 0,
    totalTarjeta: (byMethod.DEBITO || 0) + (byMethod.CREDITO || 0),
    totalTransferencia: byMethod.TRANSFERENCIA || 0,
    totalConsulta,
    totalProductos,
    byPodologo: Object.values(byPodologo),
  }
}

export type DailySummary = Awaited<ReturnType<typeof computeDailySummary>>
