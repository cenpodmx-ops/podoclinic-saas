import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { formatDateHermosillo, dateFieldStart, dateFieldEnd } from '@/lib/timezone'

/**
 * GET /api/dev/reset-portillo-caja
 * → Preview de lo que se va a borrar/resetear (dry-run)
 *
 * POST /api/dev/reset-portillo-caja
 * → Ejecuta el reset de caja + cierre/apertura de Portillo del día de hoy.
 *
 * Qué hace:
 * 1. Borra DailyOperations (APERTURA + CIERRE) de Portillo del día
 * 2. Borra CashMovements de Portillo con source='EFECTIVO_INICIAL' del día
 *    (NO toca los movimientos de CONSULTA — las consultas finalizadas se quedan intactas)
 * 3. Resetea (no borra) las CashSessions de Portillo del día:
 *    openingFund=0, closed=false, closedAt=null, countedCash=null,
 *    expectedCash=null, difference=null, notes=null, signatureData=null
 *
 * Solo SUPER puede ejecutarlo.
 */
const PORTILLO_ID = 'cmql78lg7000yo1wq59g786jr'

function getDayRanges() {
  const todayStr = formatDateHermosillo(new Date())
  const ds = dateFieldStart(todayStr)
  const de = dateFieldEnd(todayStr)
  const dayCreatedStart = new Date(todayStr + 'T07:00:00.000Z')
  const dayCreatedEnd = new Date(dayCreatedStart.getTime() + 24 * 60 * 60 * 1000 - 1)
  return { todayStr, ds, de, dayCreatedStart, dayCreatedEnd }
}

export async function GET() {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role !== 'SUPER') return bad('Solo SUPER', 403)

  const { todayStr, ds, de, dayCreatedStart, dayCreatedEnd } = getDayRanges()

  const [aperturas, cierres, sessions, movementsInicial, movementsConsulta] = await Promise.all([
    db.dailyOperation.findMany({ where: { clinicId: PORTILLO_ID, type: 'APERTURA', date: { gte: ds, lte: de } }, select: { id: true, openingFund: true, createdAt: true } }),
    db.dailyOperation.findMany({ where: { clinicId: PORTILLO_ID, type: 'CIERRE', date: { gte: ds, lte: de } }, select: { id: true, closingCounted: true, closingExpected: true, difference: true, createdAt: true } }),
    db.cashSession.findMany({ where: { clinicId: PORTILLO_ID, date: { gte: ds, lte: de } }, select: { id: true, openingFund: true, closed: true, closedAt: true, countedCash: true, expectedCash: true, difference: true } }),
    db.cashMovement.findMany({ where: { clinicId: PORTILLO_ID, source: 'EFECTIVO_INICIAL', createdAt: { gte: dayCreatedStart, lte: dayCreatedEnd } }, select: { id: true, amount: true, description: true } }),
    db.cashMovement.findMany({ where: { clinicId: PORTILLO_ID, source: 'CONSULTA', createdAt: { gte: dayCreatedStart, lte: dayCreatedEnd } }, select: { id: true, amount: true, description: true } }),
  ])

  return ok({
    clinicId: PORTILLO_ID,
    date: todayStr,
    before: {
      aperturas: aperturas,
      cierres: cierres,
      sessions: sessions,
      efectivo_inicial_movements: movementsInicial,
      consulta_movements_preservados: movementsConsulta,
    },
    dryRun: true,
    message: 'POST para ejecutar. Las consultas (source=CONSULTA) NO se tocarán.',
  })
}

export async function POST() {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role !== 'SUPER') return bad('Solo SUPER', 403)

  const { todayStr, ds, de, dayCreatedStart, dayCreatedEnd } = getDayRanges()

  // 1. Borrar DailyOperations (APERTURA + CIERRE)
  const deletedAperturas = await db.dailyOperation.deleteMany({
    where: { clinicId: PORTILLO_ID, type: 'APERTURA', date: { gte: ds, lte: de } },
  })
  const deletedCierres = await db.dailyOperation.deleteMany({
    where: { clinicId: PORTILLO_ID, type: 'CIERRE', date: { gte: ds, lte: de } },
  })

  // 2. Borrar movimientos EFECTIVO_INICIAL (fondo de apertura de caja)
  // NO tocar los source='CONSULTA'
  const deletedEFECTIVO_INICIAL = await db.cashMovement.deleteMany({
    where: {
      clinicId: PORTILLO_ID,
      source: 'EFECTIVO_INICIAL',
      createdAt: { gte: dayCreatedStart, lte: dayCreatedEnd },
    },
  })

  // 3. Manejar TODAS las cashSessions de Portillo del día
  // Puede haber varias (duplicadas por bugs anteriores). Para cada una:
  //  - Si tiene movimientos de CONSULTA vinculados → resetearla (no borrar)
  //  - Si NO tiene movimientos vinculados → borrarla
  const allSessions = await db.cashSession.findMany({
    where: { clinicId: PORTILLO_ID, date: { gte: ds, lte: de } },
    include: { movements: { select: { id: true, source: true } } },
  })

  let deletedSessionsCount = 0
  let resetSessionsCount = 0

  for (const session of allSessions) {
    const hasConsultaMovement = session.movements.some(m => m.source === 'CONSULTA')
    if (hasConsultaMovement) {
      // Reseteaar (no borrar) — preserva los movimientos de CONSULTA
      await db.cashSession.update({
        where: { id: session.id },
        data: {
          openingFund: 0,
          closed: false,
          closedAt: null,
          closedBy: null,
          countedCash: null,
          expectedCash: null,
          difference: null,
          notes: null,
          signatureData: null,
        },
      })
      resetSessionsCount++
    } else {
      // Borrar — no tiene movimientos de CONSULTA que preservar
      await db.cashSession.delete({ where: { id: session.id } })
      deletedSessionsCount++
    }
  }

  // Verificar el resultado
  const after = await db.cashMovement.findMany({
    where: { clinicId: PORTILLO_ID, createdAt: { gte: dayCreatedStart, lte: dayCreatedEnd } },
    select: { id: true, source: true, amount: true, description: true },
  })

  return ok({
    clinicId: PORTILLO_ID,
    date: todayStr,
    deleted: {
      aperturas: deletedAperturas.count,
      cierres: deletedCierres.count,
      efectivo_inicial_movements: deletedEFECTIVO_INICIAL.count,
      empty_sessions: deletedSessionsCount,
    },
    reset: {
      sessions_with_consultas: resetSessionsCount,
    },
    preserved: {
      message: 'Las consultas finalizadas y sus movimientos de CONSULTA NO fueron tocados.',
      consulta_movements_remaining: after.filter(m => m.source === 'CONSULTA').map(m => ({ id: m.id, amount: m.amount, description: m.description })),
    },
    movements_after: after,
  })
}
