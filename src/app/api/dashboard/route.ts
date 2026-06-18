import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, effectiveClinic } from '@/lib/api'
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subDays, format, isSameDay } from 'date-fns'

export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return ok({ message: 'Sin dashboard' })

  const all = req.nextUrl.searchParams.get('all') || undefined
  const clinicId = effectiveClinic(user!, all || undefined)

  const todayStart = startOfDay(new Date())
  const todayEnd = endOfDay(new Date())
  const monthStart = startOfMonth(new Date())
  const monthEnd = endOfMonth(new Date())

  const where = clinicId ? { clinicId } : {}

  // Citas de hoy
  const todaysAppts = await db.appointment.findMany({
    where: { ...where, date: { gte: todayStart, lte: todayEnd } },
    include: { patient: true, podologist: true },
    orderBy: { startTime: 'asc' },
  })

  const byStatus = (s: string) => todaysAppts.filter((a) => a.status === s).length

  // Ingresos hoy (consultas finalizadas hoy + ventas mostrador hoy)
  const todayConsults = await db.consultation.findMany({
    where: { ...where, date: { gte: todayStart, lte: todayEnd }, paid: true },
  })
  const todayRevenue = todayConsults.reduce((s, c) => s + c.total, 0)

  // Pacientes nuevos hoy
  const newPatientsToday = await db.patient.count({
    where: { ...where, createdAt: { gte: todayStart, lte: todayEnd } },
  })

  // Productos vendidos hoy (en consultas)
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

  // Serie de ingresos últimos 30 días
  const revenueSeries: { date: string; total: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = subDays(new Date(), i)
    const ds = startOfDay(d)
    const de = endOfDay(d)
    const cs = await db.consultation.findMany({
      where: { ...where, date: { gte: ds, lte: de }, paid: true },
      select: { total: true },
    })
    revenueSeries.push({ date: format(d, 'dd/MM'), total: cs.reduce((s, c) => s + c.total, 0) })
  }

  // Servicios más vendidos del mes
  const monthConsults = await db.consultation.findMany({
    where: { ...where, date: { gte: monthStart, lte: monthEnd }, paid: true },
    select: { itemsJson: true, consultPrice: true, total: true },
  })
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
  const monthAppts = await db.appointment.count({
    where: { ...where, date: { gte: monthStart, lte: monthEnd } },
  })
  const monthFinalized = await db.appointment.count({
    where: { ...where, status: 'FINALIZADA', date: { gte: monthStart, lte: monthEnd } },
  })

  // Mensajes no leídos Red CENPOD
  const unreadMessages = await db.redMessage.count({
    where: {
      toClinicId: user!.clinicId || undefined,
      status: 'ABIERTO',
      readAt: null,
    },
  })

  // Citas de hoy por podólogo (para mini agenda)
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
