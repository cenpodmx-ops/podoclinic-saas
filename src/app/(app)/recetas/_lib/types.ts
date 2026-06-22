export type MedicationInput = {
  name: string
  dose: string
  via: string
  duration: string
  indication?: string
  productId?: string
  vademecumId?: string
}

export type MedicationRow = MedicationInput & { _key: string }

export type PatientLite = {
  id: string
  firstName: string
  lastName: string
  expNumber: string
  phone: string | null
  birthDate: string | null
  sex: string | null
  isDiabetic: boolean
  allergies: string | null
  riskLevel: string | null
}

export type PodologistLite = {
  id: string
  name: string
  specialty: string | null
  cedula: string | null
}

export type ProductLite = {
  id: string
  name: string
  category: string
  stock: number
  salePrice: number
}

export type PrescriptionListItem = {
  id: string
  date: string
  diagnosis: string | null
  medications: MedicationInput[]
  indications: string | null
  patient: {
    id: string
    name: string
    expNumber: string
    birthDate: string | null
    sex: string | null
    phone: string | null
  } | null
  podologist: {
    id: string
    name: string
    specialty: string | null
    cedula: string | null
  } | null
  createdAt: string
}

export const VIA_OPTIONS = [
  'Oral',
  'Tópica',
  'Intravenosa',
  'Intramuscular',
  'Sublingual',
  'Otra',
] as const
