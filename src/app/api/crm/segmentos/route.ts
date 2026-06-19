import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad, effectiveClinic } from '@/lib/api'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay, addDays, format } from 'date-fns'

// ============================================================
// MÓDULO 08 — CRM: Segmentación dinámica
// GET ?type=INACTIVOS_30|INACTIVOS_60|INACTIVOS_90|INACTIVOS_180
//         |CUMPLEANOS_MES|CUMPLEANOS_SEMANA|CUMPLEANOS_HOY
//         |DIABETICOS|NUEVOS_MES|RIESGO_ABANDONO
// ============================================================
//
// Devuelve { segment, count, patients: [{ id, firstName, lastName, phone, birthDate?, lastVisit?, daysSinceVisit?, riskLevel?, isDiabetic?, createdAt }] }
//
// Acceso: SUPER + OWNER. RECEPTION/PODOLOGIST → 403.
// ============================================================

type SegmentType =
  | 'INACTIVOS_30'
  | 'INACTIVOS_60'
  | 'INACTIVOS_90'
  | 'INACTIVOS_180'
  | 'CUMPLEANOS_MES'
  | 'CUMPLEANOS_SEMANA'
  | 'CUMPLEANOS_HOY'
  | 'DIABETICOS'
  | 'NUEVOS_MES'
  | 'RIESGO_ABANDONO'

const VALID_SEGMENTS: SegmentType[] = [
  'INACTIVOS_30',
  'INACTIVOS_60',
  'INACTIVOS_90',
  'INACTIVOS_180',
  'CUMPLEANOS_MES',
  'CUMPLEANOS_SEMANA',
  'CUMPLEANOS_HOY',
  'DIABETICOS',
  'NUEVOS_MES',
  'RIESGO_ABANDONO',
]

export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response

  // CRM es OWNER+SUPER per spec
  if (user!.role === 'RECEPTION' || user!.role === 'PODOLOGIST') {
    return bad('Acceso denegado. CRM es exclusivo para Dueños.', 403)
  }

  const sp = req.nextUrl.searchParams
  const type = sp.get('type') as SegmentType | null
  if (!type || !VALID_SEGMENTS.includes(type)) {
    return bad(
      `Segmento inválido. Válidos: ${VALID_SEGMENTS.join(', ')}`,
      400,
    )
  }

  const all = sp.get('all') || undefined
  const clinicId = effectiveClinic(user!, all)
  const where = clinicId ? { clinicId } : {}

  // Cargar pacientes (con su última cita FINALIZADA para cálculos de inactividad)
  const patients = await db.patient.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      birthDate: true,
      isDiabetic: true,
      riskLevel: true,
      createdAt: true,
      appointments: {
        where: { status: 'FINALIZADA' },
        select: { startTime: true },
        orderBy: { startTime: 'desc' },
        take: 1,
      },
    },
  })

  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)

  let result = patients.map((p) => {
    const lastVisit = p.appointments[0]?.startTime ?? null
    const daysSinceVisit = lastVisit
      ? Math.floor((now.getTime() - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24))
      : null
    return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      phone: p.phone,
      birthDate: p.birthDate,
      isDiabetic: p.isDiabetic,
      riskLevel: p.riskLevel,
      createdAt: p.createdAt,
      lastVisit,
      daysSinceVisit,
    }
  })

  // Filtrar por tipo de segmento
  switch (type) {
    case 'INACTIVOS_30':
    case 'INACTIVOS_60':
    case 'INACTIVOS_90':
    case 'INACTIVOS_180': {
      const days = parseInt(type.split('_')[1], 10)
      result = result.filter(
        (p) => p.daysSinceVisit === null || p.daysSinceVisit > days,
      )
      break
    }

    case 'CUMPLEANOS_MES': {
      const m = now.getMonth()
      result = result.filter((p) => p.birthDate && new Date(p.birthDate).getMonth() === m)
      break
    }

    case 'CUMPLEANOS_SEMANA': {
      const ws = startOfWeek(now, { weekStartsOn: 1 })
      const we = endOfWeek(now, { weekStartsOn: 1 })
      result = result.filter((p) => {
        if (!p.birthDate) return false
        const b = new Date(p.birthDate)
        const bThisYear = new Date(now.getFullYear(), b.getMonth(), b.getDate())
        return bThisYear >= ws && bThisYear <= we
      })
      break
    }

    case 'CUMPLEANOS_HOY': {
      result = result.filter((p) => {
        if (!p.birthDate) return false
        const b = new Date(p.birthDate)
        return b.getDate() === now.getDate() && b.getMonth() === now.getMonth()
      })
      break
    }

    case 'DIABETICOS': {
      result = result.filter((p) => p.isDiabetic)
      break
    }

    case 'NUEVOS_MES': {
      const ms = startOfMonth(now)
      const me = endOfMonth(now)
      result = result.filter((p) => {
        const c = new Date(p.createdAt)
        return c >= ms && c <= me
      })
      break
    }

    case 'RIESGO_ABANDONO': {
      // No visit en > 90 días AND (diabetic OR riskLevel=ALTO)
      result = result.filter(
        (p) =>
          (p.daysSinceVisit === null || p.daysSinceVisit > 90) &&
          (p.isDiabetic || p.riskLevel === 'ALTO'),
      )
      break
    }
  }

  // Ordenar
  if (type.startsWith('INACTIVOS') || type === 'RIESGO_ABANDONO') {
    result.sort((a, b) => (b.daysSinceVisit ?? 99999) - (a.daysSinceVisit ?? 99999))
  } else if (type.startsWith('CUMPLEANOS')) {
    result.sort((a, b) => {
      const da = a.birthDate ? new Date(a.birthDate).getDate() : 99
      const db = b.birthDate ? new Date(b.birthDate).getDate() : 99
      return da - db
    })
  } else {
    result.sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
  }

  return ok({
    segment: type,
    count: result.length,
    generatedAt: now.toISOString(),
    today: format(now, 'yyyy-MM-dd'),
    todayStart: todayStart.toISOString(),
    todayEnd: todayEnd.toISOString(),
    in7Days: addDays(now, 7).toISOString(),
    patients: result,
  })
}
