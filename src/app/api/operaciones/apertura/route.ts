import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { startOfDayHermosillo, endOfDayHermosillo, formatDateHermosillo } from '@/lib/timezone'

// ============================================================
// MÓDULO 15 — CIERRE Y APERTURA DE SUCURSAL
// POST /api/operaciones/apertura
// Body: { openingFund, notes? }
// - Crea DailyOperation type='APERTURA' para hoy (409 si ya existe)
// - Crea/abre CashSession con openingFund
// 403 si PODOLOGIST
// ============================================================

export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')

  const { openingFund, notes } = body as { openingFund?: number; notes?: string }
  if (openingFund === undefined || isNaN(Number(openingFund))) {
    return bad('Falta openingFund')
  }

  const clinicId = user!.clinicId

  // Usar zona horaria de Hermosillo (UTC-7)
  // Para campo `date` (citas, operaciones): UTC medianoche del día calendario
  const todayStr = formatDateHermosillo(new Date())
  const ds = new Date(todayStr + 'T00:00:00.000Z')
  const de = new Date(todayStr + 'T23:59:59.999Z')

  // Para campo `createdAt` (movimientos): rango UTC de Hermosillo
  const dsCreated = startOfDayHermosillo(new Date())
  const deCreated = endOfDayHermosillo(new Date())

  // 409 si ya abrió hoy
  const yaAbierta = await db.dailyOperation.findFirst({
    where: { clinicId, type: 'APERTURA', date: { gte: ds, lte: de } },
  })
  if (yaAbierta) return bad('La sucursal ya está abierta hoy', 409)

  // Crear o reabrir CashSession
  let session = await db.cashSession.findFirst({
    where: { clinicId, date: { gte: ds, lte: de } },
  })
  if (session) {
    session = await db.cashSession.update({
      where: { id: session.id },
      data: {
        openingFund: Number(openingFund),
        closed: false,
        closedAt: null,
        closedBy: null,
        countedCash: null,
        expectedCash: null,
        difference: null,
        notes: notes || null,
        signatureData: null,
      },
    })
  } else {
    session = await db.cashSession.create({
      data: {
        clinicId,
        date: ds, // medianoche UTC del día de Hermosillo
        openingFund: Number(openingFund),
        closed: false,
        notes: notes || null,
      },
    })
  }

  // Crear DailyOperation APERTURA
  const apertura = await db.dailyOperation.create({
    data: {
      clinicId,
      date: ds, // medianoche UTC del día de Hermosillo
      type: 'APERTURA',
      openingFund: Number(openingFund),
      notes: notes || null,
      performedBy: user!.name || user!.email,
    },
  })

  return ok({ apertura, cashSession: session }, 201)
}
