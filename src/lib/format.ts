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
  const date = typeof d === 'string' ? new Date(d) : d
  return format(date, 'dd/MM/yyyy')
}

export function fmtDateTime(d: Date | string) {
  const date = typeof d === 'string' ? new Date(d) : d
  return format(date, 'dd/MM/yyyy HH:mm')
}

export function fmtTime(d: Date | string) {
  const date = typeof d === 'string' ? new Date(d) : d
  return format(date, 'HH:mm')
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
  OTRO: 'Otro',
}
