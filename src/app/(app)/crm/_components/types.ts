// ============================================================
// Tipos compartidos — Módulo CRM (Módulo 08)
// ============================================================

export type SegmentType =
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

export type SegmentPatient = {
  id: string
  firstName: string
  lastName: string
  phone: string | null
  birthDate: string | null
  isDiabetic: boolean
  riskLevel: string | null
  createdAt: string
  lastVisit: string | null
  daysSinceVisit: number | null
}

export type SegmentResponse = {
  segment: SegmentType
  count: number
  generatedAt: string
  patients: SegmentPatient[]
}

export type Lead = {
  id: string
  name: string
  phone: string | null
  email: string | null
  interest: string | null
  status: 'NUEVO' | 'CONTACTADO' | 'AGENDADO' | 'PERDIDO'
  notes: string | null
  patientId: string | null
  patient: { id: string; firstName: string; lastName: string; expNumber: string } | null
  createdAt: string
  updatedAt: string
  waUrl: string | null
}

export type CampanaRecipient = {
  patientId: string
  name: string
  firstName: string
  lastName: string
  phone: string | null
  message: string
  waUrl: string | null
}

export type CampanaResponse = {
  segment: SegmentType
  templateKey: string
  count: number
  clinica: string
  generatedAt: string
  recipients: CampanaRecipient[]
}

export type ReporteResponse = {
  period: { months: number; start: string; end: string }
  retencionRate: number
  activosPeriodo: number
  nuevosPeriodo: number
  recurrentesPeriodo: number
  totalPacientes: number
  nuevosHoy: number
  byMonth: { month: string; nuevos: number; recurrentes: number }[]
  efectividadCampana: number
  leads: { total: number; contactados: number; agendados: number }
  riesgoAbandono: number
  generatedAt: string
}

export const SEGMENT_LABELS: Record<SegmentType, { label: string; desc: string; tplKey: 'tplInactive' | 'tplBirthday' | 'tplFollowUp' | 'tplReminder' }> = {
  INACTIVOS_30: { label: 'Inactivos 30 días', desc: 'Sin visita hace más de 30 días', tplKey: 'tplInactive' },
  INACTIVOS_60: { label: 'Inactivos 60 días', desc: 'Sin visita hace más de 60 días', tplKey: 'tplInactive' },
  INACTIVOS_90: { label: 'Inactivos 90 días', desc: 'Sin visita hace más de 90 días', tplKey: 'tplInactive' },
  INACTIVOS_180: { label: 'Inactivos 180 días', desc: 'Sin visita hace más de 180 días', tplKey: 'tplInactive' },
  CUMPLEANOS_MES: { label: 'Cumpleaños del mes', desc: 'Cumplen años este mes', tplKey: 'tplBirthday' },
  CUMPLEANOS_SEMANA: { label: 'Cumpleaños de la semana', desc: 'Cumplen años esta semana', tplKey: 'tplBirthday' },
  CUMPLEANOS_HOY: { label: 'Cumpleaños de hoy', desc: 'Cumplen años hoy', tplKey: 'tplBirthday' },
  DIABETICOS: { label: 'Diabéticos', desc: 'Pacientes con diabetes', tplKey: 'tplFollowUp' },
  NUEVOS_MES: { label: 'Nuevos del mes', desc: 'Pacientes nuevos este mes', tplKey: 'tplFollowUp' },
  RIESGO_ABANDONO: { label: 'Riesgo de abandono', desc: '>90 días sin visita + diabético o riesgo alto', tplKey: 'tplInactive' },
}

export const LEAD_STATUS_LABELS: Record<string, string> = {
  NUEVO: 'Nuevo',
  CONTACTADO: 'Contactado',
  AGENDADO: 'Agendado',
  PERDIDO: 'Perdido',
}

export const LEAD_STATUS_STYLE: Record<string, string> = {
  NUEVO: 'bg-amber-100 text-amber-800 border-amber-300',
  CONTACTADO: 'bg-blue-100 text-blue-800 border-blue-300',
  AGENDADO: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  PERDIDO: 'bg-red-100 text-red-700 border-red-300',
}
