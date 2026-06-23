import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad, effectiveClinic } from '@/lib/api'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, format, parseISO } from 'date-fns'

// ============================================================
// MÓDULO 01 — CITAS
// GET  (Agenda shape) ?date=YYYY-MM-DD&view=day|week&podologistId=&all=1
//      → { appointments, blocks, clinic }
// GET  (Consulta shape) ?hoy=1 | ?fecha=YYYY-MM-DD | ?paciente=<id> | ?actionable=1
//      → { rows: [...] }
// POST body { patientId, podologistId, date, startTime, endTime, reason, notes, serviceId }
// ============================================================

export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response

  const sp = req.nextUrl.searchParams
  const all = sp.get('all') || undefined
  const clinicId = effectiveClinic(user!, all)

  // ---- Consulta-module-compatible shape (legacy params) ----
  const hoy = sp.get('hoy')
  const pacienteId = sp.get('paciente')
  const fecha = sp.get('fecha')
  const actionable = sp.get('actionable') === '1'

  if (hoy === '1' || pacienteId || fecha || actionable) {
    const baseWhere: any = clinicId ? { clinicId } : {}
    let where: any = baseWhere
    if (hoy === '1') {
      // Forzar UTC: hoy = medianoche UTC de hoy a medianoche UTC de mañana
      const todayStr = new Date().toISOString().slice(0, 10)
      where = { ...where, date: { gte: new Date(todayStr + 'T00:00:00.000Z'), lte: new Date(todayStr + 'T23:59:59.999Z') } }
    } else if (fecha) {
      where = { ...where, date: { gte: new Date(fecha + 'T00:00:00.000Z'), lte: new Date(fecha + 'T23:59:59.999Z') } }
    }
    if (pacienteId) where = { ...where, patientId: pacienteId }
    if (actionable) {
      where = { ...where, status: { in: ['CONFIRMADA', 'PENDIENTE'] } }
    }

    // Podólogo: solo sus propias citas
    if (user!.role === 'PODOLOGIST' && user!.podologistId) {
      where = { ...where, podologistId: user!.podologistId }
    }

    const rows = await db.appointment.findMany({
      where,
      orderBy: { startTime: 'asc' },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, expNumber: true, isDiabetic: true, allergies: true, riskLevel: true } },
        podologist: { select: { id: true, name: true } },
        consultation: { select: { id: true, paid: true } },
      },
    })

    return ok({
      rows: rows.map((a) => ({
        id: a.id,
        status: a.status,
        date: a.date,
        startTime: a.startTime,
        endTime: a.endTime,
        reason: a.reason,
        serviceName: a.serviceName,
        serviceId: a.serviceId,
        price: a.price,
        patient: a.patient,
        podologist: a.podologist,
        hasConsultation: !!a.consultation,
        consultationPaid: a.consultation?.paid ?? false,
      })),
    })
  }

  // ---- Agenda-module shape ----
  const dateStr = sp.get('date') || format(new Date(), 'yyyy-MM-dd')
  const view = sp.get('view') === 'week' ? 'week' : 'day'
  const podologistId = sp.get('podologistId') || undefined

  if (!clinicId && user!.role !== 'SUPER') {
    return bad('Sin clínica asignada', 403)
  }

  const baseDate = parseISO(dateStr)
  // Forzar UTC para evitar problemas de zona horaria.
  // El campo date se guarda como medianoche UTC, así que la consulta debe usar el mismo rango.
  const rangeStart = view === 'week'
    ? startOfWeek(baseDate, { weekStartsOn: 1 })
    : new Date(dateStr + 'T00:00:00.000Z')
  const rangeEnd = view === 'week'
    ? endOfWeek(baseDate, { weekStartsOn: 1 })
    : new Date(dateStr + 'T23:59:59.999Z')

  // PODOLOGIST: only their own appointments
  const podFilter = user!.role === 'PODOLOGIST' && user!.podologistId
    ? user!.podologistId
    : podologistId

  const where: any = { date: { gte: rangeStart, lte: rangeEnd } }
  if (clinicId) where.clinicId = clinicId
  if (podFilter) where.podologistId = podFilter

  const blockWhere: any = { date: { gte: rangeStart, lte: rangeEnd } }
  if (clinicId) blockWhere.clinicId = clinicId
  if (podFilter) blockWhere.podologistId = podFilter

  // Ejecutar las 3 queries en paralelo (1 sola ida a la DB en vez de 3 secuenciales)
  const [appointments, blocks, clinicData] = await Promise.all([
    db.appointment.findMany({
      where,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, phone: true, expNumber: true } },
        podologist: { select: { id: true, name: true } },
      },
      orderBy: { startTime: 'asc' },
    }),
    db.appointmentBlock.findMany({
      where: blockWhere,
      orderBy: { startTime: 'asc' },
    }),
    clinicId
      ? db.clinic.findUnique({
          where: { id: clinicId },
          select: { id: true, name: true, openingTime: true, closingTime: true, slotMinutes: true },
        })
      : Promise.resolve(null),
  ])

  let clinic: any = clinicData
  if (!clinic && user!.role === 'SUPER' && !clinicId) {
    clinic = { name: 'Todas las clínicas', openingTime: '08:00', closingTime: '20:00', slotMinutes: 30 }
  }

  return ok({
    appointments: appointments.map((a) => ({
      id: a.id,
      clinicId: a.clinicId,
      patient: a.patient,
      podologist: a.podologist,
      date: a.date,
      startTime: a.startTime,
      endTime: a.endTime,
      status: a.status,
      reason: a.reason,
      notes: a.notes,
      serviceName: a.serviceName,
      price: a.price,
      source: a.source,
      serviceId: a.serviceId,
    })),
    blocks: blocks.map((b) => ({
      id: b.id,
      podologistId: b.podologistId,
      date: b.date,
      startTime: b.startTime,
      endTime: b.endTime,
      reason: b.reason,
      notes: b.notes,
      fullDay: b.fullDay,
    })),
    clinic,
  })
}

/**
 * POST /api/citas
 * Body: { patientId, podologistId?, date (YYYY-MM-DD), startTime (HH:mm), endTime (HH:mm),
 *         reason?, notes?, serviceId? }
 * - PODOLOGIST: 403
 * - patient must exist in the same clinic (or SUPER can specify any)
 * - status='PENDIENTE', source='MANUAL'
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Sin permisos para crear citas', 403)

  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')

  const { patientId, podologistId, date, startTime, endTime, reason, notes, serviceId } = body as {
    patientId?: string
    podologistId?: string
    date?: string
    startTime?: string
    endTime?: string
    reason?: string
    notes?: string
    serviceId?: string
  }

  if (!patientId || !date || !startTime || !endTime) {
    return bad('Faltan campos obligatorios: patientId, date, startTime, endTime')
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad('Fecha inválida (YYYY-MM-DD)')
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
    return bad('Hora inválida (HH:mm)')
  }

  const clinicId = user!.clinicId
  if (!clinicId) return bad('Sin clínica asignada', 403)

  // Patient can be from any clinic in the group (modo global)
  // La cita se crea en la clínica del usuario, no en la del paciente
  const patient = await db.patient.findUnique({ where: { id: patientId } })
  if (!patient) return bad('Paciente no encontrado', 404)
  // Solo PODOLOGIST no puede agendar pacientes de otra clínica
  if (user!.role === 'PODOLOGIST' && patient.clinicId !== clinicId) {
    return bad('El paciente no pertenece a tu clínica', 403)
  }

  // Service + price (if provided)
  let serviceName: string | undefined
  let price: number | undefined
  if (serviceId) {
    const svc = await db.service.findUnique({ where: { id: serviceId } })
    if (svc) {
      if (user!.role !== 'SUPER' && svc.clinicId !== clinicId) return bad('Servicio no permitido', 403)
      serviceName = svc.name
      price = svc.price
    }
  }

  // Podologist must belong to same clinic (if provided)
  if (podologistId) {
    const pod = await db.podologist.findUnique({ where: { id: podologistId } })
    if (!pod) return bad('Podólogo no encontrado', 404)
    if (user!.role !== 'SUPER' && pod.clinicId !== clinicId) return bad('Podólogo no permitido', 403)
  }

  const dayStart = new Date(`${date}T${startTime}:00`)
  const dayEnd = new Date(`${date}T${endTime}:00`)
  if (dayEnd <= dayStart) return bad('La hora final debe ser mayor a la inicial')

  // Forzar medianoche UTC (igual que en el GET) para que coincidan las consultas
  const dayDate = new Date(date + 'T00:00:00.000Z')

  const created = await db.appointment.create({
    data: {
      clinicId,
      patientId,
      podologistId: podologistId || null,
      date: dayDate,
      startTime: dayStart,
      endTime: dayEnd,
      reason: reason || null,
      notes: notes || null,
      status: 'PENDIENTE',
      source: 'MANUAL',
      serviceId: serviceId || null,
      serviceName,
      price,
    },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, phone: true, expNumber: true } },
      podologist: { select: { id: true, name: true } },
    },
  })

  return ok(created, 201)
}
