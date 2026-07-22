// ============================================================
// Funciones de fecha en zona horaria de Hermosillo (UTC-7)
// Necesarias porque Vercel ejecuta en UTC y las funciones de date-fns
// (startOfDay, endOfDay, etc.) usan la zona horaria del servidor.
// Esto causaba que cobros después de las 5 PM (00:00 UTC del día siguiente)
// se registraran en el día equivocado en caja y finanzas.
// ============================================================

/** Offset de Hermosillo en horas respecto a UTC (sin horario de verano). */
const HERMOSILLO_OFFSET = -7 // UTC-7

/**
 * Convierte un Date a la fecha "local" de Hermosillo.
 * Ej: 2026-07-22T00:13:00Z (UTC) → 2026-07-21T17:13:00 (Hermosillo)
 */
function toHermosillo(date: Date): Date {
  return new Date(date.getTime() + HERMOSILLO_OFFSET * 60 * 60 * 1000)
}

/**
 * Convierte una fecha "local" de Hermosillo de vuelta a UTC.
 */
function fromHermosillo(date: Date): Date {
  return new Date(date.getTime() - HERMOSILLO_OFFSET * 60 * 60 * 1000)
}

/**
 * Inicio del día (medianoche) en zona horaria de Hermosillo.
 * Ej: si son las 5:13 PM del 21 jul en Hermosillo (00:13 UTC del 22 jul),
 * esto devuelve 2026-07-21T00:00:00 en Hermosillo = 2026-07-21T07:00:00Z en UTC.
 */
export function startOfDayHermosillo(date: Date = new Date()): Date {
  const local = toHermosillo(date)
  const localMidnight = new Date(local.getFullYear(), local.getMonth(), local.getDate(), 0, 0, 0, 0)
  return fromHermosillo(localMidnight)
}

/**
 * Fin del día (23:59:59.999) en zona horaria de Hermosillo.
 */
export function endOfDayHermosillo(date: Date = new Date()): Date {
  const local = toHermosillo(date)
  const localEnd = new Date(local.getFullYear(), local.getMonth(), local.getDate(), 23, 59, 59, 999)
  return fromHermosillo(localEnd)
}

/**
 * Inicio de la semana (lunes) en zona horaria de Hermosillo.
 */
export function startOfWeekHermosillo(date: Date = new Date()): Date {
  const local = toHermosillo(date)
  const day = local.getDay() // 0 = domingo
  const diff = day === 0 ? -6 : 1 - day // lunes como primer día
  const monday = new Date(local.getFullYear(), local.getMonth(), local.getDate() + diff, 0, 0, 0, 0)
  return fromHermosillo(monday)
}

/**
 * Fin de la semana (domingo) en zona horaria de Hermosillo.
 */
export function endOfWeekHermosillo(date: Date = new Date()): Date {
  const start = startOfWeekHermosillo(date)
  return new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1)
}

/**
 * Inicio del mes en zona horaria de Hermosillo.
 */
export function startOfMonthHermosillo(date: Date = new Date()): Date {
  const local = toHermosillo(date)
  const localStart = new Date(local.getFullYear(), local.getMonth(), 1, 0, 0, 0, 0)
  return fromHermosillo(localStart)
}

/**
 * Fin del mes en zona horaria de Hermosillo.
 */
export function endOfMonthHermosillo(date: Date = new Date()): Date {
  const local = toHermosillo(date)
  const localEnd = new Date(local.getFullYear(), local.getMonth() + 1, 0, 23, 59, 59, 999)
  return fromHermosillo(localEnd)
}

/**
 * Inicio del año en zona horaria de Hermosillo.
 */
export function startOfYearHermosillo(date: Date = new Date()): Date {
  const local = toHermosillo(date)
  const localStart = new Date(local.getFullYear(), 0, 1, 0, 0, 0, 0)
  return fromHermosillo(localStart)
}

/**
 * Fin del año en zona horaria de Hermosillo.
 */
export function endOfYearHermosillo(date: Date = new Date()): Date {
  const local = toHermosillo(date)
  const localEnd = new Date(local.getFullYear(), 11, 31, 23, 59, 59, 999)
  return fromHermosillo(localEnd)
}

/**
 * Formatea una fecha como YYYY-MM-DD en zona horaria de Hermosillo.
 */
export function formatDateHermosillo(date: Date = new Date()): string {
  const local = toHermosillo(date)
  const y = local.getFullYear()
  const m = String(local.getMonth() + 1).padStart(2, '0')
  const d = String(local.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
