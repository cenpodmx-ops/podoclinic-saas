import { format, parseISO, startOfWeek, endOfWeek, addDays, startOfMonth, endOfMonth, startOfDay, endOfDay, isSameDay } from 'date-fns'

export { format, parseISO, addDays, isSameDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay }

export function todayRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

export function fmtMoney(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0)
}

export function fmtDate(d: Date | string) {
  // Si es string YYYY-MM-DD, extraer directamente sin convertir timezone
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
  }
  // Si es string ISO con tiempo, extraer la fecha sin convertir
  if (typeof d === 'string') {
    const match = d.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) return `${match[3]}/${match[2]}/${match[1]}`
  }
  const date = typeof d === 'string' ? new Date(d) : d
  return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`
}

export function fmtDateTime(d: Date | string) {
  // Extraer fecha y hora del ISO string sin convertir a timezone local.
  // Las fechas/horas se guardan como UTC, pero representan la hora local
  // del usuario, así que no debemos convertir (ver comentario en fmtTime).
  if (typeof d === 'string') {
    const match = d.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
    if (match) return `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]}`
  }
  const date = typeof d === 'string' ? new Date(d) : d
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = date.getUTCFullYear()
  const hh = String(date.getUTCHours()).padStart(2, '0')
  const min = String(date.getUTCMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

export function fmtTime(d: Date | string) {
  // Extraer la hora directamente del ISO string sin convertir a timezone local.
  // Las horas se guardan como UTC (ej. "08:00:00.000Z" representa las 8:00 AM
  // locales del usuario), así que NO debemos convertir a la zona horaria del
  // navegador (que mostraría "01:00" en Hermosillo UTC-7).
  if (typeof d === 'string') {
    const match = d.match(/T(\d{2}):(\d{2})/)
    if (match) return `${match[1]}:${match[2]}`
  }
  const date = typeof d === 'string' ? new Date(d) : d
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`
}

export function toInputDate(d: Date) {
  return format(d, 'yyyy-MM-dd')
}

export function toInputTime(d: Date) {
  return format(d, 'HH:mm')
}

export const STATUS_COLORS: Record<string, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-800 border-amber-300',
  CONFIRMADA: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  EN_CONSULTA: 'bg-blue-100 text-blue-800 border-blue-300',
  FINALIZADA: 'bg-slate-100 text-slate-700 border-slate-300',
  CANCELADA: 'bg-red-100 text-red-700 border-red-300 line-through',
  NO_ASISTIO: 'bg-orange-100 text-orange-800 border-orange-300',
  BLOQUEADA: 'bg-neutral-800 text-neutral-100 border-neutral-900',
}

export const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADA: 'Confirmada',
  EN_CONSULTA: 'En consulta',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
  NO_ASISTIO: 'No asistió',
  BLOQUEADA: 'Bloqueada',
}

export const METHOD_LABELS: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  DEBITO: 'Tarjeta de débito',
  CREDITO: 'Tarjeta de crédito',
  TRANSFERENCIA: 'Transferencia',
  TARJETA_DE_REGALO: 'Tarjeta de regalo',
  OTRO: 'Otro',
}
