import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad, effectiveClinic } from '@/lib/api'
import { parseISO, format } from 'date-fns'
import { startOfDayHermosillo, endOfDayHermosillo, formatDateHermosillo } from '@/lib/timezone'
import { computeDailySummary } from './_summary'

// ============================================================
// MÓDULO 15 — CIERRE Y APERTURA DE SUCURSAL
// GET /api/operaciones
//   ?date=YYYY-MM-DD  (default hoy)
//   ?from=&to=        (rango opcional; si se pasa, devuelve historial del rango)
// Devuelve DailyOperation records + summary en vivo.
// 403 si PODOLOGIST
// ============================================================

export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const url = req.nextUrl
  const all = url.searchParams.get('all') || undefined
  const clinicId = effectiveClinic(user!, all || undefined)
  const fromParam = url.searchParams.get('from') || undefined
  const toParam = url.searchParams.get('to') || undefined
  const dateParam = url.searchParams.get('date')

  // ── Caso rango: devuelve historial
  if (fromParam && toParam) {
    const from = startOfDayHermosillo(parseISO(fromParam))
    const to = endOfDayHermosillo(parseISO(toParam))
    const where: any = { date: { gte: from, lte: to } }
    if (clinicId) where.clinicId = clinicId
    const rows = await db.dailyOperation.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { clinic: { select: { name: true } } },
    })
    return ok({ rows })
  }

  // ── Caso día único (default hoy)
  // Usar formatDateHermosillo para obtener YYYY-MM-DD y luego medianoche UTC
  // (igual que la API de apertura, para que coincidan)
  const dateStr = dateParam || formatDateHermosillo(new Date())
  const ds = new Date(dateStr + 'T00:00:00.000Z')
  const de = new Date(dateStr + 'T23:59:59.999Z')

  const targetClinicId = clinicId || user!.clinicId

  const [apertura, cierre, cashSession] = await Promise.all([
    db.dailyOperation.findFirst({
      where: { clinicId: targetClinicId, type: 'APERTURA', date: { gte: ds, lte: de } },
    }),
    db.dailyOperation.findFirst({
      where: { clinicId: targetClinicId, type: 'CIERRE', date: { gte: ds, lte: de } },
    }),
    db.cashSession.findFirst({
      where: { clinicId: targetClinicId, date: { gte: ds, lte: de } },
    }),
  ])

  const summary = await computeDailySummary(targetClinicId, ds)

  return ok({
    date: dateStr,
    status: cierre ? 'CERRADA' : apertura ? 'ABIERTA' : 'CERRADA_SIN_ABRIR',
    apertura,
    cierre,
    cashSession,
    summary,
  })
}
