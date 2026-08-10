// Tipos compartidos del flujo de consulta (Módulo 02)

export type ItemType = 'SERVICIO' | 'PRODUCTO' | 'MEDICAMENTO'

export interface ConsultaItem {
  name: string
  qty: number
  price: number
  type: ItemType
  productId?: string
  serviceId?: string
  stock?: number // informativo, para mostrar en UI
}

export interface PatientSummary {
  id: string
  firstName: string
  lastName: string
  expNumber: string
  phone?: string | null
  isDiabetic: boolean
  allergies?: string | null
  currentMeds?: string | null
  chronicConditions?: string | null
  riskLevel?: string | null
  totalSpent: number
  sex?: string | null
  birthDate?: string | Date | null
}

export interface PodologistSummary {
  id: string
  name: string
  specialty?: string | null
}

export interface AppointmentSummary {
  id: string
  status: string
  date: string | Date
  startTime: string | Date
  endTime: string | Date
  reason?: string | null
  serviceName?: string | null
  serviceId?: string | null
  price?: number | null
}

export interface ConsultationFull {
  id: string
  date: string | Date
  reason?: string | null
  referredBy?: string | null
  diagnosis?: string | null
  treatment?: string | null
  notes?: string | null
  consultPrice: number
  productsTotal: number
  discount: number
  total: number
  paymentMethod?: string | null
  paid: boolean
  ticketPrinted?: boolean
  followUpDays?: number | null
  items: ConsultaItem[]
  createdAt: string | Date
}

export interface ConsultaApiResponse {
  appointment: AppointmentSummary
  patient: PatientSummary
  podologist: PodologistSummary | null
  consultation: ConsultationFull | null
}

export interface ClinicInfo {
  id: string
  name: string
  address?: string | null
  phone?: string | null
  email?: string | null
  logoUrl?: string | null
  rfc?: string | null
  razonSocial?: string | null
}

export interface ConfigResponse {
  clinic: ClinicInfo | null
  diagnosesList: string[]
}

export interface ServiceItem {
  id: string
  name: string
  description?: string | null
  durationMin: number
  price: number
  commissionPct: number
  ivaType: string
}

export interface ProductItem {
  id: string
  code?: string | null
  name: string
  category: string
  salePrice: number
  costPrice: number
  stock: number
  minStock: number
  ivaType: string
}

export interface AppointmentListItem {
  id: string
  status: string
  date: string | Date
  startTime: string | Date
  endTime: string | Date
  reason?: string | null
  serviceName?: string | null
  serviceId?: string | null
  price?: number | null
  patient: {
    id: string
    firstName: string
    lastName: string
    expNumber: string
    isDiabetic: boolean
    allergies?: string | null
    riskLevel?: string | null
  }
  podologist: { id: string; name: string } | null
  hasConsultation: boolean
  consultationPaid: boolean
}

export const REFERRED_BY_OPTIONS = [
  { value: 'NADIE', label: 'Nadie' },
  { value: 'PACIENTE', label: 'Otro paciente (referido)' },
  { value: 'MEDICO', label: 'Médico' },
  { value: 'REDES', label: 'Redes sociales' },
  { value: 'OTRO', label: 'Otro' },
] as const

export const PAYMENT_METHOD_OPTIONS = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'DEBITO', label: 'Tarjeta de débito' },
  { value: 'CREDITO', label: 'Tarjeta de crédito' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'TARJETA_DE_REGALO', label: 'Tarjeta de regalo' },
  { value: 'OTRO', label: 'Otro' },
] as const
