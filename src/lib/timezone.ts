// ============================================================
// PodoClinic SaaS — Funciones de fecha con zona horaria dinámica
// Acepta cualquier zona IANA (ej: 'America/Mexico_City').
// Wrappers *Hermosillo() mantenidos por compatibilidad.
// ============================================================

const DEFAULT_TZ = 'America/Hermosillo'

/** Obtiene el offset en ms de una zona IANA para una fecha (maneja DST). */
function getTimezoneOffsetMs(date: Date, timezone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
  const parts = dtf.formatToParts(date)
  const map: Record<string, string> = {}
  for (const p of parts) { if (p.type !== 'literal') map[p.type] = p.value }
  const asUTC = Date.UTC(
    Number(map.year), Number(map.month) - 1, Number(map.day),
    Number(map.hour === '24' ? '0' : map.hour), Number(map.minute), Number(map.second)
  )
  return asUTC - date.getTime()
}

function toLocal(date: Date, timezone: string = DEFAULT_TZ): Date {
  return new Date(date.getTime() + getTimezoneOffsetMs(date, timezone))
}
function fromLocal(date: Date, timezone: string = DEFAULT_TZ): Date {
  return new Date(date.getTime() - getTimezoneOffsetMs(date, timezone))
}

// === FUNCIONES CORE (timezone dinámico) ===
export function startOfDay(date: Date = new Date(), timezone: string = DEFAULT_TZ): Date {
  const local = toLocal(date, timezone)
  return fromLocal(new Date(local.getFullYear(), local.getMonth(), local.getDate(), 0, 0, 0, 0), timezone)
}
export function endOfDay(date: Date = new Date(), timezone: string = DEFAULT_TZ): Date {
  const local = toLocal(date, timezone)
  return fromLocal(new Date(local.getFullYear(), local.getMonth(), local.getDate(), 23, 59, 59, 999), timezone)
}
export function startOfWeek(date: Date = new Date(), timezone: string = DEFAULT_TZ): Date {
  const local = toLocal(date, timezone)
  const day = local.getDay()
  const diff = day === 0 ? -6 : 1 - day
  return fromLocal(new Date(local.getFullYear(), local.getMonth(), local.getDate() + diff, 0, 0, 0, 0), timezone)
}
export function endOfWeek(date: Date = new Date(), timezone: string = DEFAULT_TZ): Date {
  return new Date(startOfWeek(date, timezone).getTime() + 7 * 24 * 60 * 60 * 1000 - 1)
}
export function startOfMonth(date: Date = new Date(), timezone: string = DEFAULT_TZ): Date {
  const local = toLocal(date, timezone)
  return fromLocal(new Date(local.getFullYear(), local.getMonth(), 1, 0, 0, 0, 0), timezone)
}
export function endOfMonth(date: Date = new Date(), timezone: string = DEFAULT_TZ): Date {
  const local = toLocal(date, timezone)
  return fromLocal(new Date(local.getFullYear(), local.getMonth() + 1, 0, 23, 59, 59, 999), timezone)
}
export function startOfYear(date: Date = new Date(), timezone: string = DEFAULT_TZ): Date {
  const local = toLocal(date, timezone)
  return fromLocal(new Date(local.getFullYear(), 0, 1, 0, 0, 0, 0), timezone)
}
export function endOfYear(date: Date = new Date(), timezone: string = DEFAULT_TZ): Date {
  const local = toLocal(date, timezone)
  return fromLocal(new Date(local.getFullYear(), 11, 31, 23, 59, 59, 999), timezone)
}
export function formatDate(date: Date = new Date(), timezone: string = DEFAULT_TZ): string {
  const local = toLocal(date, timezone)
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`
}

// === WRAPPERS DE COMPATIBILIDAD ===
export function startOfDayHermosillo(date: Date = new Date()): Date { return startOfDay(date, 'America/Hermosillo') }
export function endOfDayHermosillo(date: Date = new Date()): Date { return endOfDay(date, 'America/Hermosillo') }
export function startOfWeekHermosillo(date: Date = new Date()): Date { return startOfWeek(date, 'America/Hermosillo') }
export function endOfWeekHermosillo(date: Date = new Date()): Date { return endOfWeek(date, 'America/Hermosillo') }
export function startOfMonthHermosillo(date: Date = new Date()): Date { return startOfMonth(date, 'America/Hermosillo') }
export function endOfMonthHermosillo(date: Date = new Date()): Date { return endOfMonth(date, 'America/Hermosillo') }
export function startOfYearHermosillo(date: Date = new Date()): Date { return startOfYear(date, 'America/Hermosillo') }
export function endOfYearHermosillo(date: Date = new Date()): Date { return endOfYear(date, 'America/Hermosillo') }
export function formatDateHermosillo(date: Date = new Date()): string { return formatDate(date, 'America/Hermosillo') }

// ============================================================
// Helpers para convertir un string YYYY-MM-DD a rangos UTC.
// Hay DOS convenciones diferentes dependiendo del campo de la BD:
//
// 1. Campo `date` (citas, consultas, operaciones, cashSession):
//    Se guarda como medianoche UTC del día calendario.
//    Ej: '2026-07-24' → 2026-07-24T00:00:00.000Z (start)
//                       2026-07-24T23:59:59.999Z (end)
//
// 2. Campo `createdAt` (movimientos, pacientes, etc.):
//    Se guarda como timestamp real UTC.
//    Para un día calendario de Hermosillo (UTC-7), el rango es:
//    Ej: '2026-07-24' → 2026-07-24T07:00:00.000Z (00:00 Hermosillo)
//                       2026-07-25T06:59:59.999Z (23:59:59 Hermosillo)
// ============================================================

/**
 * Inicio del día (medianoche UTC) para un string YYYY-MM-DD.
 * Usar para filtrar campos `date` (citas, consultas, operaciones).
 */
export function dateFieldStart(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00.000Z')
}

/**
 * Fin del día (23:59:59.999 UTC) para un string YYYY-MM-DD.
 * Usar para filtrar campos `date` (citas, consultas, operaciones).
 */
export function dateFieldEnd(dateStr: string): Date {
  return new Date(dateStr + 'T23:59:59.999Z')
}

/**
 * Inicio del día local (00:00 en la zona horaria de la clínica) para un string YYYY-MM-DD.
 * Calcula el offset dinámicamente según la zona horaria.
 * Usar para filtrar campos `createdAt` (movimientos, pacientes).
 */
export function createdAtFieldStart(dateStr: string, timezone: string = DEFAULT_TZ): Date {
  const date = new Date(dateStr + 'T00:00:00.000Z')
  const offsetMs = getTimezoneOffsetMs(date, timezone)
  return new Date(date.getTime() - offsetMs)
}

/**
 * Fin del día local (23:59:59.999 en la zona horaria de la clínica) para un string YYYY-MM-DD.
 * Calcula el offset dinámicamente según la zona horaria.
 * Usar para filtrar campos `createdAt` (movimientos, pacientes).
 */
export function createdAtFieldEnd(dateStr: string, timezone: string = DEFAULT_TZ): Date {
  const start = createdAtFieldStart(dateStr, timezone)
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1)
}
