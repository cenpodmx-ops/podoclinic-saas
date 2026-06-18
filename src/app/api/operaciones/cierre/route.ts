import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { startOfDay, endOfDay } from 'date-fns'
import { computeDailySummary } from '../_summary'

// ============================================================
// MÓDULO 15 — CIERRE Y APERTURA DE SUCURSAL
// POST /api/operaciones/cierre
// Body: { countedCash, notes?, signatureData? }
// - 400 si no se abrió hoy
// - 409 si ya se cerró hoy
// - Calcula summaryJson (citas, ingresos by method, expected cash)
// - Crea DailyOperation CIERRE con counted/expected/difference/summary/signature
// - Cierra CashSession
// 403 si PODOLOGIST
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
  const ds = startOfDay(new Date())
  const de = endOfDay(new Date())

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
    date: new Date().toISOString(),
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
      date: new Date(),
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
