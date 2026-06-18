import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad, effectiveClinic } from '@/lib/api'
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfDay,
  format,
} from 'date-fns'

// ============================================================
// MÓDULO 08 — CRM: Reportes
// GET ?months=6  → indicadores de retención, nuevos vs recurrentes,
//                  efectividad de campañas, riesgo abandono.
// ============================================================

export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response

  if (user!.role === 'RECEPTION' || user!.role === 'PODOLOGIST') {
    return bad('Acceso denegado. CRM es exclusivo para Dueños.', 403)
  }

  const sp = req.nextUrl.searchParams
  const all = sp.get('all') || undefined
  const clinicId = effectiveClinic(user!, all)
  const where = clinicId ? { clinicId } : {}

  const monthsParam = Math.min(12, Math.max(1, parseInt(sp.get('months') || '6', 10)))
  const now = new Date()
  const periodStart = startOfMonth(subMonths(now, monthsParam - 1))
  const periodEnd = endOfMonth(now)

  // ── 1) Pacientes activos en el período (con al menos 1 cita FINALIZADA)
  const patientsInPeriod = await db.patient.findMany({
    where: {
      ...where,
      appointments: {
        some: {
          status: 'FINALIZADA',
          startTime: { gte: periodStart, lte: periodEnd },
        },
      },
    },
    select: { id: true, createdAt: true },
  })

  // ── 2) Nuevos vs recurrentes por mes
  // Paciente "nuevo" en mes M = su createdAt está en M y tiene una cita finalizada ese mes.
  // Paciente "recurrente" en mes M = ya existía antes y tiene cita en M.
  const byMonth: { month: string; nuevos: number; recurrentes: number }[] = []
  for (let i = monthsParam - 1; i >= 0; i--) {
    const mStart = startOfMonth(subMonths(now, i))
    const mEnd = endOfMonth(mStart)
    const label = format(mStart, 'MMM yy')

    const patientsWithVisitThisMonth = await db.patient.findMany({
      where: {
        ...where,
        appointments: {
          some: {
            status: 'FINALIZADA',
            startTime: { gte: mStart, lte: mEnd },
          },
        },
      },
      select: { id: true, createdAt: true },
    })
    let nuevos = 0
    let recurrentes = 0
    for (const p of patientsWithVisitThisMonth) {
      const created = new Date(p.createdAt)
      if (created >= mStart && created <= mEnd) nuevos++
      else recurrentes++
    }
    byMonth.push({ month: label, nuevos, recurrentes })
  }

  // ── 3) Retención
  // % de pacientes activos en el período cuyo createdAt fue hace más de 30 días
  // (i.e. no son nuevos este mes) — proxy simple.
  const activos = patientsInPeriod.length
  const nuevosEstePeriodo = patientsInPeriod.filter((p) => new Date(p.createdAt) >= periodStart).length
  const recurrentes = activos - nuevosEstePeriodo
  const retencionRate = activos > 0 ? Math.round((recurrentes / activos) * 100) : 0

  // ── 4) Efectividad de campañas
  // % de leads marcados como CONTACTADO que terminaron con patientId (es decir, regresaron).
  const leadsContactados = await db.lead.count({
    where: { ...where, status: 'CONTACTADO' },
  })
  const leadsAgendados = await db.lead.count({
    where: { ...where, status: 'AGENDADO' },
  })
  const totalLeads = await db.lead.count({ where })
  const efectividadCampana =
    totalLeads > 0 ? Math.round((leadsAgendados / totalLeads) * 100) : 0

  // ── 5) Riesgo abandono (sin cita FINALIZADA en > 90 días AND (diabetic OR riskLevel=ALTO))
  const cutoff90 = new Date()
  cutoff90.setDate(cutoff90.getDate() - 90)
  // Pacientes con al menos 1 cita histórica (para no contar recién llegados sin visita)
  const pacientesConVisita = await db.patient.findMany({
    where: {
      ...where,
      appointments: { some: { status: 'FINALIZADA' } },
    },
    select: {
      id: true,
      isDiabetic: true,
      riskLevel: true,
      appointments: {
        where: { status: 'FINALIZADA' },
        select: { startTime: true },
        orderBy: { startTime: 'desc' },
        take: 1,
      },
    },
  })
  const riesgoAbandono = pacientesConVisita.filter((p) => {
    const last = p.appointments[0]?.startTime
    if (!last) return false
    const overdue = new Date(last) < cutoff90
    return overdue && (p.isDiabetic || p.riskLevel === 'ALTO')
  }).length

  // ── 6) Totales
  const totalPacientes = await db.patient.count({ where })
  const todayStart = startOfDay(now)
  const nuevosHoy = await db.patient.count({
    where: { ...where, createdAt: { gte: todayStart } },
  })

  return ok({
    period: {
      months: monthsParam,
      start: periodStart.toISOString(),
      end: periodEnd.toISOString(),
    },
    retencionRate,
    activosPeriodo: activos,
    nuevosPeriodo: nuevosEstePeriodo,
    recurrentesPeriodo: recurrentes,
    totalPacientes,
    nuevosHoy,
    byMonth,
    efectividadCampana,
    leads: {
      total: totalLeads,
      contactados: leadsContactados,
      agendados: leadsAgendados,
    },
    riesgoAbandono,
    generatedAt: now.toISOString(),
  })
}
