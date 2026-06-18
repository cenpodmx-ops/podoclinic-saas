// Shared types for the Agenda module

export type ApptPatient = {
  id: string
  firstName: string
  lastName: string
  phone?: string | null
  expNumber: string
}

export type ApptPodologist = {
  id: string
  name: string
} | null

export type AppointmentItem = {
  id: string
  clinicId: string
  patient: ApptPatient
  podologist: ApptPodologist
  date: string
  startTime: string
  endTime: string
  status: string
  reason?: string | null
  notes?: string | null
  serviceName?: string | null
  price?: number | null
  source: string
  serviceId?: string | null
}

export type BlockItem = {
  id: string
  podologistId: string | null
  date: string
  startTime: string
  endTime: string
  reason: string
  notes?: string | null
  fullDay: boolean
}

export type ClinicInfo = {
  id?: string
  name: string
  openingTime: string | null
  closingTime: string | null
  slotMinutes: number
}

export type AgendaData = {
  appointments: AppointmentItem[]
  blocks: BlockItem[]
  clinic: ClinicInfo | null
}

export type PodologistOption = {
  id: string
  name: string
  specialty?: string | null
  commissionPct?: number
  clinicId?: string
  openingTime?: string | null
  closingTime?: string | null
  slotMinutes?: number | null
}

export type ServiceOption = {
  id: string
  name: string
  description?: string | null
  durationMin: number
  price: number
  ivaType: string
  commissionPct: number
}

export type PatientSearchResult = {
  id: string
  firstName: string
  lastName: string
  phone?: string | null
  expNumber: string
  riskLevel?: string | null
  isDiabetic?: boolean
}
