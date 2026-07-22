import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { formatDateHermosillo } from '@/lib/timezone'
import { computeDailySummary } from '../_summary'

// ============================================================
// MÓDULO 15 — CIERRE Y APERTURA DE SUCURSAL
// POST /api/operaciones/cierre
// Body: { countedCash, notes?, signatureData? }
// ============================================================

export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')

  const { countedCash, notes, signatureData } = body as {
    countedCash?: number
    notes?: string
    signatureData?: string
  }
  if (countedCash === undefined || isNaN(Number(countedCash))) {
    return bad('Falta countedCash')
  }

  const clinicId = user!.clinicId

  // Usar zona horaria de Hermosillo (UTC-7)
  const todayStr = formatDateHermosillo(new Date())
  const ds = new Date(todayStr + 'T00:00:00.000Z')
  const de = new Date(todayStr + 'T23:59:59.999Z')

  // Validaciones de estado
  const apertura = await db.dailyOperation.findFirst({
    where: { clinicId, type: 'APERTURA', date: { gte: ds, lte: de } },
  })
  if (!apertura) return bad('Primero debes abrir la sucursal', 400)

  const yaCerrada = await db.dailyOperation.findFirst({
    where: { clinicId, type: 'CIERRE', date: { gte: ds, lte: de } },
  })
  if (yaCerrada) return bad('La sucursal ya está cerrada hoy', 409)

  // Computar resumen
  const summary = await computeDailySummary(clinicId, new Date())
  const counted = Number(countedCash)
  const expected = summary.expectedCash
  const difference = Math.round((counted - expected) * 100) / 100

  const summaryJson = JSON.stringify({
    date: todayStr,
    citas: summary.citas,
    ingresos: summary.ingresos,
    egresos: summary.egresos,
    openingFund: summary.openingFund,
    expectedCash: expected,
    countedCash: counted,
    difference,
    totalEfectivo: summary.totalEfectivo,
    totalTarjeta: summary.totalTarjeta,
    totalTransferencia: summary.totalTransferencia,
    totalConsulta: summary.totalConsulta,
    totalProductos: summary.totalProductos,
    byPodologo: summary.byPodologo,
  })

  // Crear DailyOperation CIERRE
  const cierre = await db.dailyOperation.create({
    data: {
      clinicId,
      date: ds, // medianoche UTC del día de Hermosillo
      type: 'CIERRE',
      closingCounted: counted,
      closingExpected: expected,
      difference,
      notes: notes || null,
      signatureData: signatureData || null,
      summaryJson,
      performedBy: user!.name || user!.email,
    },
  })

  // Cerrar CashSession
  const session = await db.cashSession.findFirst({
    where: { clinicId, date: { gte: ds, lte: de } },
  })
  if (session) {
    await db.cashSession.update({
      where: { id: session.id },
      data: {
        closed: true,
        closedAt: new Date(),
        closedBy: user!.name || user!.email,
        countedCash: counted,
        expectedCash: expected,
        difference,
        notes: notes || null,
        signatureData: signatureData || null,
      },
    })
  }

  return ok({
    cierre,
    summary: {
      citas: summary.citas,
      ingresos: summary.ingresos,
      egresos: summary.egresos,
      openingFund: summary.openingFund,
      expectedCash: expected,
      countedCash: counted,
      difference,
    },
  }, 201)
}
