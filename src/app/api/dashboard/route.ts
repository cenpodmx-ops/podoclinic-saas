import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, effectiveClinic } from '@/lib/api'
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subDays, format } from 'date-fns'

export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return ok({ message: 'Sin dashboard' })

  const all = req.nextUrl.searchParams.get('all') || undefined
  const clinicId = effectiveClinic(user!, all || undefined)

  // Forzar UTC para consistencia
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayStart = new Date(todayStr + 'T00:00:00.000Z')
  const todayEnd = new Date(todayStr + 'T23:59:59.999Z')
  const monthStart = startOfMonth(new Date())
  const monthEnd = endOfMonth(new Date())

  const where = clinicId ? { clinicId } : {}

  // Ejecutar todas las consultas en paralelo (1 sola ida a la DB)
  const [
    todaysAppts,
    todayConsults,
    newPatientsToday,
    monthConsults,
    monthAppts,
    monthFinalized,
    unreadMessages,
    // Serie de ingresos: 1 sola consulta para los 30 días
    last30DaysConsults,
  ] = await Promise.all([
    db.appointment.findMany({
      where: { ...where, date: { gte: todayStart, lte: todayEnd } },
      include: { patient: { select: { firstName: true, lastName: true } }, podologist: { select: { name: true } } },
      orderBy: { startTime: 'asc' },
    }),
    db.consultation.findMany({
      where: { ...where, date: { gte: todayStart, lte: todayEnd }, paid: true },
      select: { total: true, itemsJson: true },
    }),
    db.patient.count({
      where: { ...where, createdAt: { gte: todayStart, lte: todayEnd } },
    }),
    db.consultation.findMany({
      where: { ...where, date: { gte: monthStart, lte: monthEnd }, paid: true },
      select: { itemsJson: true, consultPrice: true, total: true },
    }),
    db.appointment.count({
      where: { ...where, date: { gte: monthStart, lte: monthEnd } },
    }),
    db.appointment.count({
      where: { ...where, status: 'FINALIZADA', date: { gte: monthStart, lte: monthEnd } },
    }),
    db.redMessage.count({
      where: { toClinicId: user!.clinicId || undefined, status: 'ABIERTO', readAt: null },
    }),
    // 1 sola consulta para los 30 días en vez de 30 consultas separadas
    db.consultation.findMany({
      where: {
        ...where,
        date: { gte: subDays(new Date(), 30), lte: new Date() },
        paid: true,
      },
      select: { date: true, total: true },
    }),
  ])

  const byStatus = (s: string) => todaysAppts.filter((a) => a.status === s).length

  const todayRevenue = todayConsults.reduce((s, c) => s + c.total, 0)

  // Productos vendidos hoy
  let productsSoldToday = 0
  for (const c of todayConsults) {
    try {
      const items = JSON.parse(c.itemsJson || '[]') as any[]
      productsSoldToday += items.filter((i) => i.type === 'PRODUCTO' || i.type === 'MEDICAMENTO').reduce((s, i) => s + (i.qty || 0), 0)
    } catch {}
  }

  // Próximas citas en 2 horas
  const now = new Date()
  const twoHours = new Date(now.getTime() + 2 * 3600 * 1000)
  const upcoming = todaysAppts.filter(
    (a) => (a.status === 'CONFIRMADA' || a.status === 'PENDIENTE') && a.startTime >= now && a.startTime <= twoHours
  )

  // Serie de ingresos: agrupar en memoria (1 sola consulta, no 30)
  const revenueMap: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    const d = subDays(new Date(), i)
    revenueMap[format(d, 'dd/MM')] = 0
  }
  for (const c of last30DaysConsults) {
    const key = format(c.date, 'dd/MM')
    if (key in revenueMap) revenueMap[key] += c.total
  }
  const revenueSeries = Object.entries(revenueMap).map(([date, total]) => ({ date, total }))

  // Servicios más vendidos del mes
  const serviceCount: Record<string, { count: number; revenue: number }> = {}
  for (const c of monthConsults) {
    try {
      const items = JSON.parse(c.itemsJson || '[]') as any[]
      for (const it of items) {
        if (it.type === 'SERVICIO') {
          const k = it.name || 'Otro'
          serviceCount[k] = serviceCount[k] || { count: 0, revenue: 0 }
          serviceCount[k].count += it.qty || 1
          serviceCount[k].revenue += (it.price || 0) * (it.qty || 1)
        }
      }
    } catch {}
  }
  const topServices = Object.entries(serviceCount)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  // Resumen mensual
  const monthRevenue = monthConsults.reduce((s, c) => s + c.total, 0)

  // Citas de hoy por podólogo
  const byPodologist = todaysAppts.reduce<Record<string, { name: string; total: number; done: number }>>((acc, a) => {
    const key = a.podologistId || 'sin'
    const name = a.podologist?.name || 'Sin asignar'
    acc[key] = acc[key] || { name, total: 0, done: 0 }
    acc[key].total++
    if (a.status === 'FINALIZADA') acc[key].done++
    return acc
  }, {})

  return ok({
    kpis: {
      citasHoy: todaysAppts.length,
      pendientes: byStatus('PENDIENTE'),
      confirmadas: byStatus('CONFIRMADA'),
      finalizadas: byStatus('FINALIZADA'),
      canceladas: byStatus('CANCELADA'),
      noAsistio: byStatus('NO_ASISTIO'),
      ingresosHoy: todayRevenue,
      productosHoy: productsSoldToday,
      pacientesNuevosHoy: newPatientsToday,
      monthRevenue,
      monthAppts,
      monthFinalized,
      unreadMessages,
    },
    upcoming: upcoming.map((a) => ({
      id: a.id,
      paciente: `${a.patient.firstName} ${a.patient.lastName}`,
      hora: format(a.startTime, 'HH:mm'),
      podologo: a.podologist?.name || '—',
      status: a.status,
    })),
    revenueSeries,
    topServices,
    byPodologist: Object.values(byPodologist),
    clinicName: user!.clinicName,
  })
}
