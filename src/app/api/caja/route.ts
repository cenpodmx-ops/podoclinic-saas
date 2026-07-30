import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { startOfDayHermosillo, endOfDayHermosillo, formatDateHermosillo } from '@/lib/timezone'
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

  // Determinar el día a consultar (en zona horaria de Hermosillo)
  let hermosilloDayStr: string
  if (dateParam) {
    // Si el parámetro ya es YYYY-MM-DD, usarlo directamente
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      hermosilloDayStr = dateParam
    } else {
      const parsed = new Date(dateParam + 'T12:00:00')
      if (isNaN(parsed.getTime())) return bad('Fecha inválida')
      hermosilloDayStr = formatDateHermosillo(parsed)
    }
  } else {
    hermosilloDayStr = formatDateHermosillo(new Date())
  }

  // Rango para campo `date` (CashSession.date, guardado como medianoche UTC
  // del día calendario de Hermosillo): 00:00:00Z a 23:59:59Z de ese día
  const dateFieldStart = new Date(hermosilloDayStr + 'T00:00:00.000Z')
  const dateFieldEnd = new Date(hermosilloDayStr + 'T23:59:59.999Z')

  // Rango para campo `createdAt` (movimientos, timestamp real UTC):
  // 07:00 UTC (00:00 Hermosillo) a 06:59:59 UTC del día siguiente (23:59:59 Hermosillo)
  const createdFieldStart = startOfDayHermosillo(new Date(hermosilloDayStr + 'T12:00:00'))
  const createdFieldEnd = endOfDayHermosillo(new Date(hermosilloDayStr + 'T12:00:00'))

  // Buscar sesión de ese día para la clínica del usuario
  // SUPER sin clínica asignada → 403 si no tiene clinicId
  const clinicId = user!.clinicId
  if (!clinicId) return bad('Sin clínica asignada', 403)

  const session = await db.cashSession.findFirst({
    where: {
      clinicId,
      date: { gte: dateFieldStart, lte: dateFieldEnd },
    },
  })

  // Buscar TODOS los movimientos del día (no solo los de la sesión encontrada)
  // Esto arregla el problema donde movimientos creados en una sesión del día anterior
  // pero con createdAt del día actual no se mostraban en caja
  const allDayMovements = await db.cashMovement.findMany({
    where: {
      clinicId,
      createdAt: { gte: createdFieldStart, lte: createdFieldEnd },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Si hay sesión, usar sus movimientos + los del día que no tengan sesión
  // Si no hay sesión, usar los movimientos del día
  let movements: any[] = allDayMovements
  if (session) {
    // Obtener movimientos de la sesión
    const sessionMovements = await db.cashMovement.findMany({
      where: { cashSessionId: session.id },
      orderBy: { createdAt: 'asc' },
    })
    // Combinar: movimientos del día + movimientos de la sesión (sin duplicar)
    const allIds = new Set(allDayMovements.map(m => m.id))
    const extraFromSession = sessionMovements.filter(m => !allIds.has(m.id))
    // Solo incluir movimientos de la sesión que caigan en el rango del día
    const extraInDay = extraFromSession.filter(m => m.createdAt >= createdFieldStart && m.createdAt <= createdFieldEnd)
    movements = [...allDayMovements, ...extraInDay].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  }

  // Resumen calculado a partir de TODOS los movimientos del día
  const summary = computeSummary(session, movements)

  return ok({
    date: hermosilloDayStr,
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
  // Usar midnight UTC del día calendario de Hermosillo (igual que operaciones/apertura)
  const todayStr = formatDateHermosillo(new Date())
  const todayDateStart = new Date(todayStr + 'T00:00:00.000Z')
  const todayDateEnd = new Date(todayStr + 'T23:59:59.999Z')
  const existing = await db.cashSession.findFirst({
    where: { clinicId, date: { gte: todayDateStart, lte: todayDateEnd } },
  })
  if (existing) {
    return bad(
      existing.closed
        ? 'La caja de hoy ya fue cerrada. No se puede abrir una nueva.'
        : 'Ya existe una caja abierta para hoy',
      409,
    )
  }

  // Crear la sesión — usar medianoche UTC del día calendario de Hermosillo
  // (igual que operaciones/apertura, para que las búsquedas por `date` coincidan)
  const session = await db.cashSession.create({
    data: {
      clinicId,
      date: todayDateStart,
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
  // IMPORTANTE: el saldo esperado en CAJA (efectivo físico) solo incluye
  // ingresos en EFECTIVO. Los ingresos con tarjeta/transferencia NO están
  // en el cajón, son bancarios.
  const openingFund = session?.openingFund ?? 0
  const ingresosOperativos = movements
    .filter((m) => m.type === 'INGRESO' && m.source !== 'EFECTIVO_INICIAL')
    .reduce((s, m) => s + m.amount, 0)
  const ingresosEfectivo = movements
    .filter((m) => m.type === 'INGRESO' && m.source !== 'EFECTIVO_INICIAL' && (m.method || 'EFECTIVO') === 'EFECTIVO')
    .reduce((s, m) => s + m.amount, 0)
  const egresosEfectivo = movements
    .filter((m) => m.type === 'EGRESO' && (m.method || 'EFECTIVO') === 'EFECTIVO')
    .reduce((s, m) => s + m.amount, 0)
  // Saldo esperado en el cajón = fondo + ingresos en efectivo - egresos en efectivo
  const saldoEsperado = openingFund + ingresosEfectivo - egresosEfectivo

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
