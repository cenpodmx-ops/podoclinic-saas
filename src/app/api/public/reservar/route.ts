import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { startOfDay, endOfDay, parseISO } from 'date-fns'

/**
 * POST /api/public/reservar
 * PÚBLICO (sin auth). Crea una cita desde la página pública /reservar.
 *
 * Body:
 *  {
 *    clinicId, podologistId?, date (YYYY-MM-DD), startTime (HH:mm),
 *    firstName, lastName, phone, email?, reason?, esNuevo
 *  }
 *
 * Validaciones:
 *  - clinicId, date, startTime, firstName, lastName, phone obligatorios
 *  - phone: 10 dígitos (MX)
 *  - Slot debe seguir libre (sin citas que se solapen, sin bloqueos)
 *  - Si podologistId no viene → se elige cualquiera con disponibilidad
 *
 * Acciones:
 *  - Si existe paciente con ese phone en la clínica → se enlaza
 *  - Si no → se crea con expNumber auto (formato C{n}-00001)
 *  - Se crea Appointment con status='PENDIENTE', source='WEB'
 *
 * Retorna:
 *  { success, appointmentId, patientId, isNewPatient, whatsappUrl }
 */

const REASON_BLOCKED = ['SPAM', 'PRUEBA', 'TEST'] // simple sanity filter

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** Genera el siguiente número de expediente: C{clinicNumber}-{5 dígitos}. */
async function generateExpNumber(clinicId: string, slug: string): Promise<string> {
  const m = slug.match(/\d+/)
  const clinicNum = m ? m[0] : '0'
  const prefix = `C${clinicNum}`
  const existing = await db.patient.findMany({
    where: { clinicId, expNumber: { startsWith: `${prefix}-` } },
    select: { expNumber: true },
  })
  let maxNum = 0
  for (const p of existing) {
    const parts = p.expNumber.split('-')
    if (parts.length === 2) {
      const n = parseInt(parts[1], 10)
      if (!isNaN(n) && n > maxNum) maxNum = n
    }
  }
  return `${prefix}-${String(maxNum + 1).padStart(5, '0')}`
}

/** Normaliza un teléfono MX a 10 dígitos. Devuelve null si inválido. */
function normalizePhone(raw: string): string | null {
  const digits = String(raw || '').replace(/\D/g, '')
  // Caso: +52 1 662 123 4567 → quitar prefijo 521
  if (digits.length === 13 && digits.startsWith('521')) return digits.slice(3)
  // 52 + 10 dígitos
  if (digits.length === 12 && digits.startsWith('52')) return digits.slice(2)
  // 10 dígitos exactos
  if (digits.length === 10) return digits
  return null
}

function overlaps(a: { start: Date; end: Date }, b: { start: Date; end: Date }): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime()
}

function buildWhatsappUrl(
  clinicPhone: string,
  msg: string,
): string {
  const digits = clinicPhone.replace(/\D/g, '')
  // Si ya trae 52, no lo doblamos; si son 10 dígitos, le anteponemos 52
  const fullPhone = digits.length === 10 ? `52${digits}` : digits
  return `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })

  const clinicId = String(body.clinicId || '').trim()
  const podologistIdRaw = body.podologistId ? String(body.podologistId).trim() : ''
  const podologistId = podologistIdRaw || undefined
  const dateStr = String(body.date || '').trim()
  const startTimeStr = String(body.startTime || '').trim()
  const firstName = String(body.firstName || '').trim()
  const lastName = String(body.lastName || '').trim()
  const email = body.email ? String(body.email).trim() : undefined
  const reason = body.reason ? String(body.reason).trim() : undefined
  const esNuevo = !!body.esNuevo

  // --- Validaciones básicas ---
  if (!clinicId) return NextResponse.json({ error: 'clinicId requerido' }, { status: 400 })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: 'Fecha inválida (YYYY-MM-DD)' }, { status: 400 })
  }
  if (!/^\d{2}:\d{2}$/.test(startTimeStr)) {
    return NextResponse.json({ error: 'Hora inválida (HH:mm)' }, { status: 400 })
  }
  if (!firstName) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
  if (!lastName) return NextResponse.json({ error: 'Apellido requerido' }, { status: 400 })
  const phone = normalizePhone(String(body.phone || ''))
  if (!phone) {
    return NextResponse.json({ error: 'Teléfono inválido (10 dígitos MX)' }, { status: 400 })
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  }
  if (reason && REASON_BLOCKED.some((r) => reason.toUpperCase().includes(r))) {
    return NextResponse.json({ error: 'Motivo no permitido' }, { status: 400 })
  }

  // --- Clínica ---
  const clinic = await db.clinic.findUnique({
    where: { id: clinicId },
    select: {
      id: true, name: true, slug: true, phone: true, isDistributor: true,
      openingTime: true, closingTime: true, slotMinutes: true,
    },
  })
  if (!clinic) return NextResponse.json({ error: 'Clínica no encontrada' }, { status: 404 })
  if (clinic.isDistributor) {
    return NextResponse.json({ error: 'Clínica no válida para reservas' }, { status: 400 })
  }

  // --- Fecha/hora en objetos Date ---
  const dayStart = startOfDay(parseISO(dateStr))
  const dayEnd = endOfDay(parseISO(dateStr))
  const slotStart = new Date(`${dateStr}T${startTimeStr}:00`)
  const slotMin = clinic.slotMinutes || 30
  const slotEnd = new Date(slotStart.getTime() + slotMin * 60 * 1000)

  // Validar que esté dentro del horario de la clínica
  const [oh, om] = (clinic.openingTime || '08:00').split(':').map(Number)
  const [ch, cm] = (clinic.closingTime || '20:00').split(':').map(Number)
  const openDate = new Date(`${dateStr}T${pad(oh)}:${pad(om)}:00`)
  const closeDate = new Date(`${dateStr}T${pad(ch)}:${pad(cm)}:00`)
  if (slotStart < openDate || slotEnd > closeDate) {
    return NextResponse.json({ error: 'El horario está fuera del horario de atención de la clínica' }, { status: 400 })
  }
  // No permitir fechas pasadas
  const now = new Date()
  if (slotEnd.getTime() <= now.getTime()) {
    return NextResponse.json({ error: 'No se puede reservar en una hora pasada' }, { status: 400 })
  }

  // --- Resolución de podólogo ---
  let resolvedPodologistId = podologistId
  let resolvedPodologistName: string | null = null
  if (resolvedPodologistId) {
    const pod = await db.podologist.findUnique({
      where: { id: resolvedPodologistId },
      select: { id: true, name: true, clinicId: true, active: true },
    })
    if (!pod || pod.clinicId !== clinicId || !pod.active) {
      return NextResponse.json({ error: 'Podólogo no disponible' }, { status: 400 })
    }
    resolvedPodologistName = pod.name
  } else {
    // Elegir cualquier podólogo activo que tenga este slot libre
    const pods = await db.podologist.findMany({
      where: { clinicId, active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    for (const p of pods) {
      const [appts, blocks] = await Promise.all([
        db.appointment.findMany({
          where: { podologistId: p.id, date: { gte: dayStart, lte: dayEnd } },
          select: { startTime: true, endTime: true, status: true },
        }),
        db.appointmentBlock.findMany({
          where: { podologistId: p.id, date: { gte: dayStart, lte: dayEnd } },
          select: { startTime: true, endTime: true, fullDay: true },
        }),
      ])
      const conflict = appts.some((a) => a.status !== 'CANCELADA' && overlaps(
        { start: slotStart, end: slotEnd },
        { start: a.startTime, end: a.endTime },
      )) || blocks.some((b) => b.fullDay || overlaps(
        { start: slotStart, end: slotEnd },
        { start: b.startTime, end: b.endTime },
      ))
      if (!conflict) {
        resolvedPodologistId = p.id
        resolvedPodologistName = p.name
        break
      }
    }
    if (!resolvedPodologistId) {
      return NextResponse.json({ error: 'No hay podólogos disponibles en ese horario' }, { status: 409 })
    }
  }

  // --- Validar que el slot siga libre para el podólogo elegido ---
  const existingAppts = await db.appointment.findMany({
    where: { podologistId: resolvedPodologistId, date: { gte: dayStart, lte: dayEnd } },
    select: { startTime: true, endTime: true, status: true },
  })
  const conflictAppt = existingAppts.some((a) => a.status !== 'CANCELADA' && overlaps(
    { start: slotStart, end: slotEnd },
    { start: a.startTime, end: a.endTime },
  ))
  if (conflictAppt) {
    return NextResponse.json({ error: 'Ese horario acaba de ser reservado. Elige otro.' }, { status: 409 })
  }

  const existingBlocks = await db.appointmentBlock.findMany({
    where: { podologistId: resolvedPodologistId, date: { gte: dayStart, lte: dayEnd } },
    select: { startTime: true, endTime: true, fullDay: true },
  })
  const conflictBlock = existingBlocks.some((b) => b.fullDay || overlaps(
    { start: slotStart, end: slotEnd },
    { start: b.startTime, end: b.endTime },
  ))
  if (conflictBlock) {
    return NextResponse.json({ error: 'El podólogo no está disponible en ese horario' }, { status: 409 })
  }

  // --- Paciente: buscar por teléfono en la clínica, si no existe crear ---
  let patient = await db.patient.findFirst({
    where: { clinicId, phone },
    select: { id: true, firstName: true, lastName: true, expNumber: true },
  })
  let isNewPatient = false
  if (!patient) {
    const expNumber = await generateExpNumber(clinicId, clinic.slug)
    patient = await db.patient.create({
      data: {
        clinic: { connect: { id: clinicId } },
        expNumber,
        firstName,
        lastName,
        phone,
        email: email || null,
        generalNotes: esNuevo ? 'Paciente nuevo (registro vía web)' : 'Paciente existente (registro vía web)',
      },
      select: { id: true, firstName: true, lastName: true, expNumber: true },
    })
    isNewPatient = true
  }

  // --- Crear la cita ---
  const appointment = await db.appointment.create({
    data: {
      clinic: { connect: { id: clinicId } },
      patient: { connect: { id: patient.id } },
      podologist: { connect: { id: resolvedPodologistId } },
      date: dayStart,
      startTime: slotStart,
      endTime: slotEnd,
      reason: reason || null,
      notes: `Reservado vía web. Paciente ${esNuevo ? 'nuevo' : 'existente'}.`,
      status: 'PENDIENTE',
      source: 'WEB',
    },
    select: { id: true },
  })

  // --- WhatsApp URL al teléfono de la clínica ---
  const fechaFmt = slotStart.toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const horaFmt = slotStart.toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
  const msg = `Hola, agendé una cita para ${firstName} el ${fechaFmt} a las ${horaFmt} con ${resolvedPodologistName}. Confirmo mi asistencia.`
  const whatsappUrl = clinic.phone
    ? buildWhatsappUrl(clinic.phone, msg)
    : null

  return NextResponse.json({
    success: true,
    appointmentId: appointment.id,
    patientId: patient.id,
    isNewPatient,
    patientName: `${patient.firstName} ${patient.lastName}`,
    expNumber: patient.expNumber,
    podologistName: resolvedPodologistName,
    clinicName: clinic.name,
    whatsappUrl,
  }, { status: 201 })
}
