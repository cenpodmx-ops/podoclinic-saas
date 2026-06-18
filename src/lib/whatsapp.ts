// ============================================================
// Helpers de WhatsApp (Módulos CRM + Seguimiento)
// Construye URLs wa.me con código de país MX (+52) cuando aplica
// y reemplaza variables {{nombre_paciente}}, {{fecha}}, etc.
// ============================================================

/** Asume +52 (MX) si el teléfono es local de 10 dígitos. Quita espacios/guiones/prefijo +. */
export function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null
  let s = String(raw).trim()
  // Quitar todo lo que no sea dígito
  s = s.replace(/[^\d]/g, '')
  if (!s) return null
  // Si ya trae código de país +52, dejarlo
  if (s.startsWith('52') && s.length >= 12) return s
  // Si es 10 dígitos (nacional MX), anteponer 52
  if (s.length === 10) return `52${s}`
  // Si viene con 1 (prefijo US +52) o 0 adelante, igual normalizar
  if (s.length === 11 && s.startsWith('1')) return `52${s.slice(1)}`
  return s
}

/** Construye una URL wa.me con el texto codificado. Si el teléfono es inválido, devuelve null. */
export function waUrl(rawPhone?: string | null, text?: string): string | null {
  const phone = normalizePhone(rawPhone)
  if (!phone) return null
  const base = `https://wa.me/${phone}`
  if (!text) return base
  return `${base}?text=${encodeURIComponent(text)}`
}

/** Reemplaza {{variables}} en una plantilla. Ignora las que no apliquen. */
export function fillTemplate(
  tpl: string,
  vars: Record<string, string | undefined | null>,
): string {
  return tpl.replace(/\{\{\s*([\w_]+)\s*\}\}/g, (_m, key) => {
    const v = vars[key]
    return v === undefined || v === null ? '' : String(v)
  })
}

/** Plantillas por defecto si la clínica no las configura. */
export const DEFAULT_TEMPLATES: Record<string, string> = {
  tplConfirm: 'Hola {{nombre_paciente}}, te confirmamos tu cita en {{clinica}} el {{fecha}} a las {{hora}} con el/la Dr(a). {{podologo}}. Gracias.',
  tplReminder: 'Hola {{nombre_paciente}}, este es un recordatorio de tu cita en {{clinica}} mañana {{fecha}} a las {{hora}}. ¿Confirmas tu asistencia?',
  tplGoogleReview: 'Hola {{nombre_paciente}}, gracias por tu visita a {{clinica}}. Nos encantaría que dejaras tu reseña: {{link_reserva}}',
  tplBirthday: '¡Feliz cumpleaños {{nombre_paciente}}! 🎂 Todo el equipo de {{clinica}} te desea un excelente día. Visítanos pronto, tenemos un detalle para ti.',
  tplInactive: 'Hola {{nombre_paciente}}, hace tiempo no nos visitas en {{clinica}}. Tu salud podológica es importante. Agenda tu próxima cita: {{link_reserva}}',
  tplFollowUp: 'Hola {{nombre_paciente}}, fue un gusto atenderte en {{clinica}} con el/la Dr(a). {{podologo}}. ¿Cómo te has sentido? Si requieres algo, escríbenos. Agenda: {{link_reserva}}',
}

export type TemplateKey = keyof typeof DEFAULT_TEMPLATES
