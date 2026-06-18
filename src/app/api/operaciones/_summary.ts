import { db } from '@/lib/db'
import { startOfDay, endOfDay } from 'date-fns'

/**
 * Calcula el resumen de operación de un día para una clínica:
 *   - citas atendidas, canceladas, no-show, pendientes, total
 *   - ingresos por método (de CashMovement INGRESO hoy)
 *   - egresos (CashMovement EGRESO hoy)
 *   - efectivo esperado en caja = openingFund + INGRESO EFECTIVO - EGRESO EFECTIVO
 *   - monto apertura (de DailyOperation APERTURA o CashSession openingFund)
 */
export async function computeDailySummary(clinicId: string, date: Date) {
  const ds = startOfDay(date)
  const de = endOfDay(date)

  const [appts, movements, aperturaOp, cashSession] = await Promise.all([
    db.appointment.findMany({
      where: { clinicId, date: { gte: ds, lte: de } },
      select: { id: true, status: true, podologistId: true },
    }),
    db.cashMovement.findMany({
      where: { clinicId, createdAt: { gte: ds, lte: de } },
      select: { type: true, source: true, method: true, amount: true },
    }),
    db.dailyOperation.findFirst({
      where: { clinicId, type: 'APERTURA', date: { gte: ds, lte: de } },
    }),
    db.cashSession.findFirst({
      where: { clinicId, date: { gte: ds, lte: de } },
    }),
  ])

  const citas = {
    total: appts.length,
    atendidas: appts.filter((a) => a.status === 'FINALIZADA').length,
    canceladas: appts.filter((a) => a.status === 'CANCELADA').length,
    noAsistio: appts.filter((a) => a.status === 'NO_ASISTIO').length,
    pendientes: appts.filter((a) => a.status === 'PENDIENTE' || a.status === 'CONFIRMADA' || a.status === 'EN_CONSULTA').length,
  }

  // Ingresos por método (CashMovement INGRESO)
  const byMethod: Record<string, number> = { EFECTIVO: 0, DEBITO: 0, CREDITO: 0, TRANSFERENCIA: 0, OTRO: 0 }
  let totalIngresos = 0
  let totalEgresos = 0
  let egresosEfectivo = 0
  let ingresosEfectivo = 0

  for (const m of movements) {
    if (m.type === 'INGRESO') {
      const k = (m.method || 'EFECTIVO') as keyof typeof byMethod
      byMethod[k] = (byMethod[k] || 0) + m.amount
      totalIngresos += m.amount
      if (k === 'EFECTIVO') ingresosEfectivo += m.amount
    } else if (m.type === 'EGRESO') {
      totalEgresos += m.amount
      if ((m.method || 'EFECTIVO') === 'EFECTIVO') egresosEfectivo += m.amount
    }
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
  }
}

export type DailySummary = Awaited<ReturnType<typeof computeDailySummary>>
