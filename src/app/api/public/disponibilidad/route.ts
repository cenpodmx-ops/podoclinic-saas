import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { startOfDay, endOfDay } from 'date-fns'

/**
 * GET /api/public/disponibilidad?clinicId=&podologistId=&date=YYYY-MM-DD
 * PÚBLICO (sin auth).
 *
 * Devuelve 2-3 horarios disponibles para el día indicado, por podólogo.
 * Si no se especifica podólogo, elige cualquiera con disponibilidad.
 *
 * Lógica:
 *  - Genera slots de `clinic.slotMinutes` (default 30) desde openingTime hasta closingTime.
 *  - Filtra los slots que se solapan con citas existentes (no CANCELADA) o con bloqueos
 *    del podólogo ese día.
 *  - Si es hoy, omite slots que ya pasaron.
 *  - Devuelve máximo 3 slots: primero de la mañana, primero de la tarde, uno más.
 */

type Slot = { start: Date; end: Date }

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function parseTime(t: string | null | undefined, fallback: string): [number, number] {
  if (!t || !/^\d{2}:\d{2}$/.test(t)) {
    const [h, m] = fallback.split(':').map(Number)
    return [h, m]
  }
  const [h, m] = t.split(':').map(Number)
  return [h, m]
}

function generateSlots(
  dateStr: string,
  opening: string | null,
  closing: string | null,
  slotMin: number,
): Slot[] {
  const [oh, om] = parseTime(opening, '08:00')
  const [ch, cm] = parseTime(closing, '20:00')
  const start = new Date(`${dateStr}T${pad(oh)}:${pad(om)}:00`)
  const end = new Date(`${dateStr}T${pad(ch)}:${pad(cm)}:00`)
  const slotMs = slotMin * 60 * 1000
  const slots: Slot[] = []
  let cur = new Date(start)
  while (cur.getTime() + slotMs <= end.getTime()) {
    slots.push({ start: new Date(cur), end: new Date(cur.getTime() + slotMs) })
    cur = new Date(cur.getTime() + slotMs)
  }
  return slots
}

function overlaps(a: Slot, b: Slot): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime()
}

/** Quita los slots que se solapan con citas o bloqueos del podólogo ese día. */
function filterFreeSlots(
  slots: Slot[],
  appointments: { startTime: Date; endTime: Date; status: string }[],
  blocks: { startTime: Date; endTime: Date; fullDay: boolean }[],
  isToday: boolean,
): Slot[] {
  const now = Date.now()
  // Normaliza a {start, end} para reutilizar overlaps
  const apSlots: Slot[] = appointments
    .filter((a) => a.status !== 'CANCELADA')
    .map((a) => ({ start: a.startTime, end: a.endTime }))
  const blockSlots: Slot[] = blocks.map((b) => ({ start: b.startTime, end: b.endTime }))
  const hasFullDayBlock = blocks.some((b) => b.fullDay)
  return slots.filter((s) => {
    // Si es hoy, saltar slots pasados
    if (isToday && s.end.getTime() <= now) return false
    if (hasFullDayBlock) return false
    // Solapamiento con citas existentes
    for (const ap of apSlots) {
      if (overlaps(s, ap)) return false
    }
    // Solapamiento con bloqueos parciales
    for (const b of blockSlots) {
      if (overlaps(s, b)) return false
    }
    return true
  })
}

/** Selecciona máx 3 slots: primero de la mañana, primero de la tarde, uno más. */
function pickThree(free: Slot[]): Slot[] {
  const morning = free.filter((s) => s.start.getHours() < 12)
  const afternoon = free.filter((s) => s.start.getHours() >= 12)
  const result: Slot[] = []
  if (morning.length > 0) result.push(morning[0])
  if (afternoon.length > 0) result.push(afternoon[0])
  if (result.length < 3) {
    if (morning.length > 1) result.push(morning[1])
    else if (afternoon.length > 1) result.push(afternoon[1])
  }
  return result.sort((a, b) => a.start.getTime() - b.start.getTime()).slice(0, 3)
}

function fmtSlot(d: Date): string {
  // "HH:mm"
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const clinicId = sp.get('clinicId')
  const podologistId = sp.get('podologistId') || undefined
  const dateStr = sp.get('date')

  if (!clinicId) return NextResponse.json({ error: 'clinicId requerido' }, { status: 400 })
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: 'date requerido (YYYY-MM-DD)' }, { status: 400 })
  }

  const clinic = await db.clinic.findUnique({
    where: { id: clinicId },
    select: { openingTime: true, closingTime: true, slotMinutes: true, name: true },
  })
  if (!clinic) return NextResponse.json({ error: 'Clínica no encontrada' }, { status: 404 })

  const dayStart = startOfDay(new Date(dateStr + 'T00:00:00'))
  const dayEnd = endOfDay(new Date(dateStr + 'T00:00:00'))
  const today = new Date()
  const isToday = dayStart.getFullYear() === today.getFullYear()
    && dayStart.getMonth() === today.getMonth()
    && dayStart.getDate() === today.getDate()

  // Si el día ya pasó → sin slots
  if (dayStart.getTime() < startOfDay(today).getTime() && !isToday) {
    return NextResponse.json({
      podologistId: podologistId || null,
      podologistName: null,
      slots: [],
      message: 'Fecha pasada',
    })
  }

  const allSlots = generateSlots(dateStr, clinic.openingTime, clinic.closingTime, clinic.slotMinutes || 30)

  // Caso A: podólogo específico
  if (podologistId) {
    const [appts, blocks] = await Promise.all([
      db.appointment.findMany({
        where: { podologistId, date: { gte: dayStart, lte: dayEnd } },
        select: { startTime: true, endTime: true, status: true },
      }),
      db.appointmentBlock.findMany({
        where: { podologistId, date: { gte: dayStart, lte: dayEnd } },
        select: { startTime: true, endTime: true, fullDay: true },
      }),
    ])
    const free = filterFreeSlots(allSlots, appts, blocks, isToday)
    const picked = pickThree(free)

    const pod = await db.podologist.findUnique({
      where: { id: podologistId },
      select: { name: true },
    })

    return NextResponse.json({
      podologistId,
      podologistName: pod?.name || null,
      slots: picked.map((s) => ({ startTime: fmtSlot(s.start), endTime: fmtSlot(s.end) })),
    })
  }

  // Caso B: cualquier podólogo → itera y devuelve el primero con slots
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
    const free = filterFreeSlots(allSlots, appts, blocks, isToday)
    const picked = pickThree(free)
    if (picked.length > 0) {
      return NextResponse.json({
        podologistId: p.id,
        podologistName: p.name,
        slots: picked.map((s) => ({ startTime: fmtSlot(s.start), endTime: fmtSlot(s.end) })),
      })
    }
  }

  // Ningún podólogo con disponibilidad
  return NextResponse.json({
    podologistId: null,
    podologistName: null,
    slots: [],
    message: 'Sin horarios disponibles para esta fecha',
  })
}
