// Tipos compartidos — Módulo 14 Seguimiento
export type FollowUpStatus = 'PENDIENTE' | 'CONTACTADO' | 'AGENDADO' | 'VENCIDO'

export type FollowUpRow = {
  id: string
  patient: {
    id: string
    firstName: string
    lastName: string
    phone: string | null
    expNumber: string
  }
  consultation: {
    id: string
    date: string
    diagnosis: string | null
    treatment: string | null
    podologist: { id: string; name: string } | null
  } | null
  dueDate: string
  dueDateLabel: string
  status: FollowUpStatus
  effectiveStatus: FollowUpStatus
  daysUntilDue: number
  notes: string | null
  whatsappSent: boolean
  createdAt: string
  isToday: boolean
  isOverdue: boolean
}

export type SeguimientoResponse = {
  total: number
  counts: {
    vencidos: number
    hoy: number
    proximos7: number
    futuros: number
    contactados: number
    agendados: number
  }
  buckets: {
    vencidos: FollowUpRow[]
    hoy: FollowUpRow[]
    proximos7: FollowUpRow[]
    futuros: FollowUpRow[]
    contactados: FollowUpRow[]
    agendados: FollowUpRow[]
  }
  rows: FollowUpRow[]
  generatedAt: string
}

export const STATUS_STYLE: Record<FollowUpStatus, { label: string; cls: string }> = {
  PENDIENTE: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  CONTACTADO: { label: 'Contactado', cls: 'bg-blue-100 text-blue-800 border-blue-300' },
  AGENDADO: { label: 'Agendado', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  VENCIDO: { label: 'Vencido', cls: 'bg-red-100 text-red-700 border-red-300' },
}
