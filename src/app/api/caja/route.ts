import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { startOfDay, endOfDay, format } from 'date-fns'
import { METHOD_LABELS } from '@/lib/format'

// ============================================================
// MÓDULO 07 — CAJA
// GET  ?date=YYYY-MM-DD  → sesión de hoy (o null) + movimientos + resumen
// POST body { openingFund } → abrir caja para hoy (409 si ya existe)
// Acceso: RECEPTION + OWNER + SUPER. PODOLOGIST = 403.
// ============================================================

export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const url = req.nextUrl
  const dateParam = url.searchParams.get('date')

  // Determinar el día a consultar
  let dayStart: Date
  let dayEnd: Date
  if (dateParam) {
    const parsed = new Date(dateParam + 'T00:00:00')
    if (isNaN(parsed.getTime())) return bad('Fecha inválida')
    dayStart = startOfDay(parsed)
    dayEnd = endOfDay(parsed)
  } else {
    dayStart = startOfDay(new Date())
    dayEnd = endOfDay(new Date())
  }

  // Buscar sesión de ese día para la clínica del usuario
  // SUPER sin clínica asignada → 403 si no tiene clinicId
  const clinicId = user!.clinicId
  if (!clinicId) return bad('Sin clínica asignada', 403)

  const session = await db.cashSession.findFirst({
    where: {
      clinicId,
      date: { gte: dayStart, lte: dayEnd },
    },
    include: {
      movements: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  // Resumen calculado a partir de movimientos
  const movements = session?.movements ?? []
  const summary = computeSummary(session, movements)

  return ok({
    date: format(dayStart, 'yyyy-MM-dd'),
    session: session
      ? {
          id: session.id,
          openingFund: session.openingFund,
          closed: session.closed,
          closedAt: session.closedAt,
          closedBy: session.closedBy,
          countedCash: session.countedCash,
          expectedCash: session.expectedCash,
          difference: session.difference,
          notes: session.notes,
          signatureData: session.signatureData,
          createdAt: session.createdAt,
          date: session.date,
        }
      : null,
    movements: movements.map((m) => ({
      id: m.id,
      type: m.type,
      source: m.source,
      amount: m.amount,
      method: m.method,
      description: m.description,
      refId: m.refId,
      time: m.createdAt,
    })),
    summary,
  })
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')

  const openingFund = Number(body.openingFund)
  if (isNaN(openingFund) || openingFund < 0) {
    return bad('Fondo inicial inválido')
  }

  const clinicId = user!.clinicId
  if (!clinicId) return bad('Sin clínica asignada', 403)

  // Verificar si ya existe una sesión para hoy
  const todayStart = startOfDay(new Date())
  const todayEnd = endOfDay(new Date())
  const existing = await db.cashSession.findFirst({
    where: { clinicId, date: { gte: todayStart, lte: todayEnd } },
  })
  if (existing) {
    return bad(
      existing.closed
        ? 'La caja de hoy ya fue cerrada. No se puede abrir una nueva.'
        : 'Ya existe una caja abierta para hoy',
      409,
    )
  }

  // Crear la sesión
  const session = await db.cashSession.create({
    data: {
      clinicId,
      date: new Date(),
      openingFund,
      closed: false,
    },
  })

  // Crear movimiento inicial (fondo de apertura en EFECTIVO)
  await db.cashMovement.create({
    data: {
      cashSessionId: session.id,
      clinicId,
      type: 'INGRESO',
      source: 'EFECTIVO_INICIAL',
      amount: openingFund,
      method: 'EFECTIVO',
      description: 'Fondo inicial de caja',
    },
  })

  return ok(
    {
      id: session.id,
      openingFund: session.openingFund,
      closed: session.closed,
      createdAt: session.createdAt,
      date: session.date,
    },
    201,
  )
}

// ── Helpers
type MovementRow = {
  type: string
  source: string
  amount: number
  method: string | null
}

function computeSummary(
  session:
    | {
        openingFund: number
        closed: boolean
        countedCash: number | null
        expectedCash: number | null
        difference: number | null
      }
    | null,
  movements: MovementRow[],
) {
  const ingresos = movements
    .filter((m) => m.type === 'INGRESO')
    .reduce((s, m) => s + m.amount, 0)
  const egresos = movements
    .filter((m) => m.type === 'EGRESO')
    .reduce((s, m) => s + m.amount, 0)

  const byMethod = {
    EFECTIVO: 0,
    DEBITO: 0,
    CREDITO: 0,
    TRANSFERENCIA: 0,
    OTRO: 0,
  }
  for (const m of movements) {
    if (m.type !== 'INGRESO') continue
    if (m.source === 'EFECTIVO_INICIAL') continue // el fondo inicial no cuenta como "ingreso operativo"
    const k = (m.method || 'EFECTIVO') as keyof typeof byMethod
    if (k in byMethod) byMethod[k] += m.amount
    else byMethod.OTRO += m.amount
  }

  // Para el saldo "operativo" (sin fondo inicial) — pero el saldo en caja
  // incluye el fondo inicial porque físicamente está en el cajón.
  const openingFund = session?.openingFund ?? 0
  const ingresosOperativos = movements
    .filter((m) => m.type === 'INGRESO' && m.source !== 'EFECTIVO_INICIAL')
    .reduce((s, m) => s + m.amount, 0)
  const saldoEsperado = openingFund + ingresosOperativos - egresos

  return {
    openingFund,
    ingresos: ingresosOperativos,
    egresos,
    saldoEsperado,
    byMethod: {
      EFECTIVO: byMethod.EFECTIVO,
      TARJETA: byMethod.DEBITO + byMethod.CREDITO,
      TRANSFERENCIA: byMethod.TRANSFERENCIA,
      OTRO: byMethod.OTRO,
    },
    methodLabels: METHOD_LABELS,
    closed: session?.closed ?? false,
    countedCash: session?.countedCash ?? null,
    expectedCash: session?.expectedCash ?? null,
    difference: session?.difference ?? null,
  }
}
