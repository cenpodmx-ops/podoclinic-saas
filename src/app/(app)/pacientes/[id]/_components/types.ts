// Tipos para el expediente del paciente
// El shape viene de GET /api/pacientes/[id]

export type ClinicInfo = {
  id: string
  name: string
  slug: string
}

export type PodologistInfo = {
  id: string
  name: string
} | null

export type AppointmentRow = {
  id: string
  date: string
  startTime: string
  endTime: string
  status: string
  reason: string | null
  notes: string | null
  serviceName: string | null
  price: number | null
  podologist: PodologistInfo
}

export type ConsultationRow = {
  id: string
  podologistId: string | null
  date: string
  reason: string | null
  referredBy: string | null
  diagnosis: string | null
  treatment: string | null
  notes: string | null
  consultPrice: number
  productsTotal: number
  discount: number
  total: number
  paymentMethod: string | null
  paid: boolean
  itemsJson: string
  followUpDays: number | null
  podologist: PodologistInfo
}

export type PrescriptionMedication = {
  name: string
  dose?: string
  via?: string
  duration?: string
}

export type PrescriptionRow = {
  id: string
  date: string
  diagnosis: string | null
  medicationsJson: string
  indications: string | null
  podologist: PodologistInfo
}

export type PatientFileRow = {
  id: string
  name: string
  type: string
  fileUrl: string
  mimeType: string
  sizeBytes: number
  createdAt: string
}

export type FollowUpRow = {
  id: string
  dueDate: string
  notes: string | null
  status: string
  whatsappSent: boolean
  createdAt: string
}

export type Patient = {
  id: string
  clinicId: string
  expNumber: string
  firstName: string
  lastName: string
  birthDate: string | null
  sex: string | null
  curp: string | null
  rfc: string | null
  address: string | null
  phone: string | null
  email: string | null
  razonSocial: string | null
  regimenFiscal: string | null
  cfdiUso: string | null
  emailFactura: string | null
  isDiabetic: boolean
  allergies: string | null
  currentMeds: string | null
  chronicConditions: string | null
  riskLevel: string | null
  antecedentsHereditary: string | null
  antecedentsPathologic: string | null
  antecedentsNonPathologic: string | null
  physicalExploration: string | null
  clinicalSummary: string | null
  generalNotes: string | null
  totalSpent: number
  createdAt: string
  updatedAt: string
  clinic: ClinicInfo
  appointments: AppointmentRow[]
  consultations: ConsultationRow[]
  prescriptions: PrescriptionRow[]
  files: PatientFileRow[]
  followUps: FollowUpRow[]
}
