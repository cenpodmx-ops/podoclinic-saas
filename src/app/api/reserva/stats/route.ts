import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { startOfMonth, endOfMonth } from 'date-fns'

/**
 * GET /api/reserva/stats
 * Estadísticas de reservas web para la página interna /reserva.
 *
 * SUPER ve TODAS las clínicas; el resto solo la suya.
 * Retorna: { thisMonth, thisMonthConfirmed, thisMonthPending, total, byClinic? }
 */
export async function GET(_req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role !== 'SUPER' && user!.role !== 'OWNER') {
    return bad('Sin permisos', 403)
  }

  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  const isSuper = user!.role === 'SUPER'

  // Filtro base
  const whereAny = {
    source: 'WEB',
    ...(isSuper ? {} : { clinicId: user!.clinicId }),
  }
  const whereThisMonth = {
    ...whereAny,
    createdAt: { gte: monthStart, lte: monthEnd },
  }

  const [thisMonth, thisMonthConfirmed, thisMonthPending, total] = await Promise.all([
    db.appointment.count({ where: whereThisMonth }),
    db.appointment.count({ where: { ...whereThisMonth, status: 'CONFIRMADA' } }),
    db.appointment.count({ where: { ...whereThisMonth, status: 'PENDIENTE' } }),
    db.appointment.count({ where: whereAny }),
  ])

  let byClinic: { clinicId: string; name: string; count: number }[] = []
  if (isSuper) {
    const grouped = await db.appointment.groupBy({
      by: ['clinicId'],
      where: whereThisMonth,
      _count: { _all: true },
    })
    const clinics = await db.clinic.findMany({
      where: { id: { in: grouped.map((g) => g.clinicId) } },
      select: { id: true, name: true },
    })
    byClinic = grouped.map((g) => ({
      clinicId: g.clinicId,
      name: clinics.find((c) => c.id === g.clinicId)?.name || 'Desconocida',
      count: g._count._all,
    }))
  }

  return ok({
    thisMonth,
    thisMonthConfirmed,
    thisMonthPending,
    total,
    byClinic,
  })
}
