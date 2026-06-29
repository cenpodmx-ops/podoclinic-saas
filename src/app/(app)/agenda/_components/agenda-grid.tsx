'use client'

import { useMemo } from 'react'
import { addDays, format, isSameDay, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'
import { STATUS_LABELS } from '@/lib/format'
import type { AppointmentItem, BlockItem, ClinicInfo, PodologistOption } from './types'

type Props = {
  view: 'day' | 'week'
  date: string // YYYY-MM-DD
  data: { appointments: AppointmentItem[]; blocks: BlockItem[]; clinic: ClinicInfo | null } | undefined
  isLoading: boolean
  podologos: PodologistOption[]
  selectedPodologistId: string // '' means "Todos"
  onSlotClick: (podologistId: string, time: string) => void
  onAppointmentClick: (appt: AppointmentItem) => void
  onBlockClick: (block: BlockItem) => void
}

const SLOT_HEIGHT = 72 // px per 30-min slot — más aire entre filas
const REASON_LABELS: Record<string, string> = {
  VACACIONES: 'Vacaciones',
  CAPACITACION: 'Capacitación',
  INCAPACIDAD: 'Incapacidad',
  OTRO: 'Otro',
}

function parseHHmm(hhmm: string): [number, number] {
  const [h, m] = hhmm.split(':').map(Number)
  return [h, m]
}

function buildSlots(opening: string, closing: string, slotMin: number) {
  const [oh, om] = parseHHmm(opening || '08:00')
  const [ch, cm] = parseHHmm(closing || '20:00')
  const slots: { time: string; minutes: number }[] = []
  let cur = oh * 60 + om
  const end = ch * 60 + cm
  while (cur < end) {
    const h = Math.floor(cur / 60)
    const m = cur % 60
    slots.push({ time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, minutes: cur })
    cur += slotMin
  }
  return slots
}

/** Extrae los minutos desde medianoche de un ISO string UTC, SIN convertir a timezone local.
 *  Ej: "2026-06-19T10:00:00.000Z" → 600 (10:00) */
function minutesOf(d: string | Date): number {
  const s = typeof d === 'string' ? d : d.toISOString()
  // Extraer la parte de tiempo HH:MM:SS del ISO string
  const match = s.match(/T(\d{2}):(\d{2}):(\d{2})/)
  if (match) {
    return Number(match[1]) * 60 + Number(match[2])
  }
  // Fallback: usar Date pero en UTC
  const date = new Date(d)
  return date.getUTCHours() * 60 + date.getUTCMinutes()
}

/** Formatea una hora ISO UTC como "HH:MM" sin convertir a timezone local. */
function fmtTimeShort(d: string | Date): string {
  const s = typeof d === 'string' ? d : d.toISOString()
  const match = s.match(/T(\d{2}):(\d{2})/)
  if (match) {
    return `${match[1]}:${match[2]}`
  }
  const date = new Date(d)
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`
}

/** Verifica si un slot (en minutos desde medianoche) choca con un bloqueo. */
function slotOverlapsBlock(slotMinutes: number, blocks: BlockItem[]): boolean {
  return blocks.some((b) => {
    const bStart = minutesOf(b.startTime)
    const bEnd = minutesOf(b.endTime)
    return slotMinutes >= bStart && slotMinutes < bEnd
  })
}

function AppointmentCard({
  appt,
  gridStart,
  slotMin,
  onClick,
  compact,
}: {
  appt: AppointmentItem
  gridStart: number
  slotMin: number
  onClick: () => void
  compact?: boolean
}) {
  const startMin = minutesOf(appt.startTime)
  const endMin = minutesOf(appt.endTime)
  const top = ((startMin - gridStart) / slotMin) * SLOT_HEIGHT
  const height = Math.max(((endMin - startMin) / slotMin) * SLOT_HEIGHT - 2, 24)
  const cls = `appt-${appt.status.toLowerCase()}`
  const patientName = `${appt.patient.firstName} ${appt.patient.lastName}`
  const isDark = appt.status === 'EN_CONSULTA' || appt.status === 'CANCELADA'

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={`absolute left-1 right-1 rounded-md px-2 py-1.5 text-left overflow-hidden ${cls} hover:shadow-md transition-shadow`}
      style={{ top, height }}
    >
      <p className={`text-xs font-semibold truncate ${isDark ? 'text-white' : ''}`}>
        {fmtTimeShort(appt.startTime)} {patientName}
      </p>
      {appt.serviceName && (
        <p className={`text-[10px] truncate ${isDark ? 'text-white/80' : 'text-muted-foreground'}`}>
          {compact ? `${fmtTimeShort(appt.startTime)}–${fmtTimeShort(appt.endTime)}` : appt.serviceName}
        </p>
      )}
    </button>
  )
}

function BlockCard({
  block,
  gridStart,
  slotMin,
  onClick,
}: {
  block: BlockItem
  gridStart: number
  slotMin: number
  onClick: () => void
}) {
  const startMin = minutesOf(block.startTime)
  const endMin = minutesOf(block.endTime)
  const top = ((startMin - gridStart) / slotMin) * SLOT_HEIGHT
  const height = Math.max(((endMin - startMin) / slotMin) * SLOT_HEIGHT - 2, 24)
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className="absolute left-1 right-1 rounded-md px-2 py-1.5 text-left appt-bloqueada hover:shadow-md transition-shadow"
      style={{ top, height }}
    >
      <p className="text-[11px] font-semibold truncate">
        {REASON_LABELS[block.reason] || block.reason}
      </p>
      {!block.fullDay && (
        <p className="text-[10px] truncate opacity-80">
          {fmtTimeShort(block.startTime)}–{fmtTimeShort(block.endTime)}
        </p>
      )}
    </button>
  )
}

export function AgendaGrid({
  view, date, data, isLoading, podologos, selectedPodologistId,
  onSlotClick, onAppointmentClick, onBlockClick,
}: Props) {
  const clinic = data?.clinic

  // Si hay un solo podólogo seleccionado, usar SU horario (si lo tiene configurado).
  // Si no, usar el de la clínica.
  const selectedPodologo = selectedPodologistId && selectedPodologistId !== 'all'
    ? podologos.find((p) => p.id === selectedPodologistId)
    : null

  const opening = selectedPodologo?.openingTime || clinic?.openingTime || '08:00'
  const closing = selectedPodologo?.closingTime || clinic?.closingTime || '20:00'
  const slotMin = selectedPodologo?.slotMinutes || clinic?.slotMinutes || 30

  const slots = useMemo(() => buildSlots(opening, closing, slotMin), [opening, closing, slotMin])
  const gridStart = slots.length > 0 ? slots[0].minutes : 480
  const totalSlots = slots.length

  const baseDate = new Date(date + 'T00:00:00.000Z')

  if (isLoading) {
    return (
      <div className="rounded-md border bg-background p-3">
        <div className="flex gap-2">
          <div className="w-16 space-y-2">
            {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-12 w-12" />)}
          </div>
          <div className="flex-1 space-y-2">
            {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        </div>
      </div>
    )
  }

  // ---- DAY VIEW ----
  if (view === 'day') {
    const isSinglePodologist = !!selectedPodologistId && selectedPodologistId !== 'all'
    const columns = isSinglePodologist
      ? podologos.filter((p) => p.id === selectedPodologistId)
      : podologos

    if (columns.length === 0) {
      return (
        <div className="rounded-md border bg-background p-8 text-center text-sm text-muted-foreground">
          No hay podólogos activos en esta clínica.
        </div>
      )
    }

    return (
      <div className="rounded-md border bg-background overflow-x-auto print:overflow-visible">
        <div className="min-w-fit print:min-w-0">
          {/* Header */}
          <div className="flex border-b sticky top-0 bg-background z-10 print:static">
            <div className="w-16 shrink-0 p-2 text-[10px] text-muted-foreground font-semibold uppercase">Hora</div>
            {columns.map((p) => (
              <div key={p.id} className="flex-1 min-w-[180px] p-2 border-l text-center">
                <p className="text-sm font-medium truncate">{p.name}</p>
                {p.specialty && <p className="text-[10px] text-muted-foreground truncate">{p.specialty}</p>}
              </div>
            ))}
          </div>

          {/* Body */}
          <div className="flex">
            {/* Time column */}
            <div className="w-16 shrink-0">
              {slots.map((s) => (
                <div key={s.time} className="border-b border-r px-1 py-1 text-[10px] text-muted-foreground text-right pr-2"
                  style={{ height: SLOT_HEIGHT }}>
                  {s.time}
                </div>
              ))}
            </div>

            {/* Podologist columns */}
            {columns.map((p) => {
              const appts = (data?.appointments || []).filter((a) => a.podologist?.id === p.id)
              const blocks = (data?.blocks || []).filter((b) => b.podologistId === p.id)
              const hasFullDayBlock = blocks.some((b) => b.fullDay)
              return (
                <div
                  key={p.id}
                  className="flex-1 min-w-[180px] border-l relative"
                  style={{ height: totalSlots * SLOT_HEIGHT }}
                >
                  {/* Slot grid (clickable solo si no hay bloqueo que lo cubra) */}
                  {slots.map((s) => {
                    const blocked = hasFullDayBlock || slotOverlapsBlock(s.minutes, blocks)
                    return (
                      <button
                        key={s.time}
                        onClick={() => { if (!blocked) onSlotClick(p.id, s.time) }}
                        disabled={blocked}
                        className={`block w-full border-b transition-colors text-left ${
                          blocked
                            ? 'bg-neutral-200/60 cursor-not-allowed'
                            : 'hover:bg-accent/40'
                        }`}
                        style={{ height: SLOT_HEIGHT }}
                      />
                    )
                  })}
                  {/* Blocks first (so they appear under appts) */}
                  {blocks.map((b) => (
                    <BlockCard key={b.id} block={b} gridStart={gridStart} slotMin={slotMin} onClick={() => onBlockClick(b)} />
                  ))}
                  {/* Appointments */}
                  {appts.map((a) => (
                    <AppointmentCard key={a.id} appt={a} gridStart={gridStart} slotMin={slotMin} onClick={() => onAppointmentClick(a)} />
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ---- WEEK VIEW ----
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i))

  return (
    <div className="rounded-md border bg-background overflow-x-auto print:overflow-visible">
      <div className="min-w-[900px] print:min-w-0">
        {/* Header */}
        <div className="flex border-b sticky top-0 bg-background z-10 print:static">
          <div className="w-16 shrink-0 p-2 text-[10px] text-muted-foreground font-semibold uppercase">Hora</div>
          {days.map((d) => {
            const isToday = isSameDay(d, new Date())
            return (
              <div key={d.toISOString()} className={`flex-1 p-2 border-l text-center ${isToday ? 'bg-primary/5' : ''}`}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {format(d, 'EEE', { locale: es })}
                </p>
                <p className={`text-sm font-semibold ${isToday ? 'text-primary' : ''}`}>
                  {format(d, 'd')}
                </p>
              </div>
            )
          })}
        </div>

        {/* Body */}
        <div className="flex">
          <div className="w-16 shrink-0">
            {slots.map((s) => (
              <div key={s.time} className="border-b border-r px-1 py-1 text-[10px] text-muted-foreground text-right pr-2"
                style={{ height: SLOT_HEIGHT }}>
                {s.time}
              </div>
            ))}
          </div>

          {days.map((d) => {
            const dayAppts = (data?.appointments || []).filter((a) => isSameDay(new Date(a.date), d))
            const dayBlocks = (data?.blocks || []).filter((b) => isSameDay(new Date(b.date), d))
            const hasFullDayBlock = dayBlocks.some((b) => b.fullDay)
            return (
              <div
                key={d.toISOString()}
                className="flex-1 border-l relative"
                style={{ height: totalSlots * SLOT_HEIGHT }}
              >
                {slots.map((s) => {
                  const blocked = hasFullDayBlock || slotOverlapsBlock(s.minutes, dayBlocks)
                  return (
                    <button
                      key={s.time}
                      onClick={() => { if (!blocked) onSlotClick('', s.time) }}
                      disabled={blocked}
                      className={`block w-full border-b transition-colors ${
                        blocked
                          ? 'bg-neutral-200/60 cursor-not-allowed'
                          : 'hover:bg-accent/40'
                      }`}
                      style={{ height: SLOT_HEIGHT }}
                    />
                  )
                })}
                {dayBlocks.map((b) => (
                  <BlockCard key={b.id} block={b} gridStart={gridStart} slotMin={slotMin} onClick={() => onBlockClick(b)} />
                ))}
                {dayAppts.map((a) => (
                  <AppointmentCard key={a.id} appt={a} gridStart={gridStart} slotMin={slotMin} onClick={() => onAppointmentClick(a)} compact />
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
