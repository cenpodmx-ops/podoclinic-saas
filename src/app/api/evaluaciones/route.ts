import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad, effectiveClinic } from '@/lib/api'
import { startOfMonth, endOfMonth, format, parseISO, subMonths } from 'date-fns'

// ============================================================
// MÓDULO 16 — EVALUACIÓN DE PODÓLOGOS
// GET  ?period=YYYY-MM&podologistId=&all=1
//      Para cada podólogo de la clínica, calcula para el periodo:
//        consultsDone / consultsCancelled / consultsNoShow / revenue /
//        avgValue / googleReviews / goalConsults / goalRevenue / progressPct
//      403 si RECEPTION / PODOLOGIST
// ============================================================

export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'RECEPTION' || user!.role === 'PODOLOGIST') {
    return bad('Acceso denegado', 403)
  }

  const url = req.nextUrl
  const periodParam = url.searchParams.get('period') || format(new Date(), 'yyyy-MM')
  const filterPodologistId = url.searchParams.get('podologistId') || undefined
  const all = url.searchParams.get('all') || undefined

  // Validar periodo YYYY-MM
  const periodDate = parseISO(`${periodParam}-01`)
  if (isNaN(periodDate.getTime())) return bad('Periodo inválido (use YYYY-MM)')
  const monthStart = startOfMonth(periodDate)
  const monthEnd = endOfMonth(periodDate)

  const clinicId = effectiveClinic(user!, all || undefined)
  const wherePod: any = { active: true }
  if (clinicId) wherePod.clinicId = clinicId
  if (filterPodologistId) wherePod.id = filterPodologistId

  const podologos = await db.podologist.findMany({
    where: wherePod,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      specialty: true,
      photoUrl: true,
      commissionPct: true,
      monthlyGoalConsults: true,
      monthlyGoalRevenue: true,
      clinicId: true,
    },
  })

  // Si la clínica está activa, traer todo en bloque
  const clinicIds = clinicId ? [clinicId] : Array.from(new Set(podologos.map((p) => p.clinicId)))
  const clinicFilter = clinicIds.length === 1 ? { clinicId: clinicIds[0] } : { clinicId: { in: clinicIds } }

  const [appts, consults, evals] = await Promise.all([
    db.appointment.findMany({
      where: { ...clinicFilter, date: { gte: monthStart, lte: monthEnd } },
      select: { id: true, podologistId: true, status: true },
    }),
    db.consultation.findMany({
      where: { ...clinicFilter, date: { gte: monthStart, lte: monthEnd }, paid: true },
      select: { id: true, podologistId: true, total: true },
    }),
    db.podologistEvaluation.findMany({
      where: { period: periodParam, ...(clinicId ? { clinicId } : {}) },
    }),
  ])

  const evalMap = new Map(evals.map((e) => [e.podologistId, e]))

  const rows = podologos.map((p) => {
    const apptsPod = appts.filter((a) => a.podologistId === p.id)
    const consultsPod = consults.filter((c) => c.podologistId === p.id)
    const consultsDone = apptsPod.filter((a) => a.status === 'FINALIZADA').length
    const consultsCancelled = apptsPod.filter((a) => a.status === 'CANCELADA').length
    const consultsNoShow = apptsPod.filter((a) => a.status === 'NO_ASISTIO').length
    const revenue = consultsPod.reduce((s, c) => s + c.total, 0)
    const avgValue = consultsDone > 0 ? revenue / consultsDone : 0
    const ev = evalMap.get(p.id)
    const googleReviews = ev?.googleReviews ?? 0
    const goalConsults = ev?.goalConsults ?? p.monthlyGoalConsults ?? 0
    const goalRevenue = ev?.goalRevenue ?? p.monthlyGoalRevenue ?? 0
    const progressConsults = goalConsults > 0 ? Math.min(100, Math.round((consultsDone / goalConsults) * 100)) : 0
    const progressRevenue = goalRevenue > 0 ? Math.min(100, Math.round((revenue / goalRevenue) * 100)) : 0
    const cancellationRate = apptsPod.length > 0 ? Math.round(((consultsCancelled + consultsNoShow) / apptsPod.length) * 100) : 0

    return {
      podologistId: p.id,
      name: p.name,
      specialty: p.specialty,
      photoUrl: p.photoUrl,
      commissionPct: p.commissionPct,
      period: periodParam,
      consultsDone,
      consultsCancelled,
      consultsNoShow,
      cancellationRate,
      revenue,
      avgValue,
      googleReviews,
      goalConsults,
      goalRevenue,
      progressConsults,
      progressRevenue,
    }
  })

  return ok({ period: periodParam, rows })
}

// Helper exportado para /reporte (no expuesto como API)
export async function computePodologistMonthlyReport(
  podologistId: string,
  periodParam: string,
  userClinicId: string,
  isSuper: boolean,
) {
  const periodDate = parseISO(`${periodParam}-01`)
  const monthStart = startOfMonth(periodDate)
  const monthEnd = endOfMonth(periodDate)

  const pod = await db.podologist.findUnique({
    where: { id: podologistId },
    include: { clinic: true },
  })
  if (!pod) return null
  if (!isSuper && pod.clinicId !== userClinicId) return null

  const [appts, consults, ev] = await Promise.all([
    db.appointment.findMany({
      where: { clinicId: pod.clinicId, podologistId: pod.id, date: { gte: monthStart, lte: monthEnd } },
      include: { patient: { select: { firstName: true, lastName: true, expNumber: true } } },
      orderBy: { startTime: 'asc' },
    }),
    db.consultation.findMany({
      where: { clinicId: pod.clinicId, podologistId: pod.id, date: { gte: monthStart, lte: monthEnd }, paid: true },
      select: { id: true, total: true, paymentMethod: true, date: true },
      orderBy: { date: 'asc' },
    }),
    db.podologistEvaluation.findFirst({
      where: { podologistId: pod.id, period: periodParam },
    }),
  ])

  const consultsDone = appts.filter((a) => a.status === 'FINALIZADA').length
  const consultsCancelled = appts.filter((a) => a.status === 'CANCELADA').length
  const consultsNoShow = appts.filter((a) => a.status === 'NO_ASISTIO').length
  const revenue = consults.reduce((s, c) => s + c.total, 0)
  const avgValue = consultsDone > 0 ? revenue / consultsDone : 0
  const googleReviews = ev?.googleReviews ?? 0
  const goalConsults = ev?.goalConsults ?? pod.monthlyGoalConsults ?? 0
  const goalRevenue = ev?.goalRevenue ?? pod.monthlyGoalRevenue ?? 0
  const progressConsults = goalConsults > 0 ? Math.round((consultsDone / goalConsults) * 100) : 0
  const progressRevenue = goalRevenue > 0 ? Math.round((revenue / goalRevenue) * 100) : 0

  // Tendencia últimos 6 meses
  const trend: { period: string; consults: number; revenue: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(periodDate, i)
    const ds = startOfMonth(d)
    const de = endOfMonth(d)
    const [a, c] = await Promise.all([
      db.appointment.count({
        where: { clinicId: pod.clinicId, podologistId: pod.id, status: 'FINALIZADA', date: { gte: ds, lte: de } },
      }),
      db.consultation.aggregate({
        where: { clinicId: pod.clinicId, podologistId: pod.id, paid: true, date: { gte: ds, lte: de } },
        _sum: { total: true },
      }),
    ])
    trend.push({ period: format(d, 'yyyy-MM'), consults: a, revenue: c._sum.total || 0 })
  }

  return {
    podologist: {
      id: pod.id,
      name: pod.name,
      specialty: pod.specialty,
      cedula: pod.cedula,
      certNumber: pod.certNumber,
      photoUrl: pod.photoUrl,
      commissionPct: pod.commissionPct,
    },
    clinic: { id: pod.clinic.id, name: pod.clinic.name },
    period: periodParam,
    periodLabel: spanishMonthYear(periodDate),
    metrics: {
      consultsDone,
      consultsCancelled,
      consultsNoShow,
      revenue,
      avgValue,
      googleReviews,
      goalConsults,
      goalRevenue,
      progressConsults,
      progressRevenue,
      cancellationRate: appts.length > 0 ? Math.round(((consultsCancelled + consultsNoShow) / appts.length) * 100) : 0,
    },
    trend,
    appointments: appts.map((a) => ({
      id: a.id,
      date: a.date,
      startTime: a.startTime,
      status: a.status,
      patient: a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : '—',
      exp: a.patient?.expNumber,
      serviceName: a.serviceName,
    })),
    recentConsults: consults.slice(-10).map((c) => ({
      id: c.id,
      date: c.date,
      total: c.total,
      paymentMethod: c.paymentMethod,
    })),
  }
}

const SPANISH_MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function spanishMonthYear(d: Date): string {
  return `${SPANISH_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}
