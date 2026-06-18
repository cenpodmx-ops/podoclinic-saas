// Tipos compartidos del módulo de Facturación (Módulo 04)

export type ItemType = 'SERVICIO' | 'PRODUCTO' | 'MEDICAMENTO'
export type IvaType = 'IVA16' | 'IVA0' | 'EXENTO'
export type InvoiceStatus = 'PENDIENTE' | 'TIMBRADA' | 'CANCELADA'

export interface InvoiceItem {
  name: string
  qty: number
  price: number
  type: ItemType
  ivaType: IvaType
  productId?: string
  serviceId?: string
}

export interface InvoiceRow {
  id: string
  folio: string | null
  uuid: string | null
  date: string
  patientId: string | null
  patientName: string
  expNumber: string | null
  total: number
  subtotal: number
  iva: number
  status: InvoiceStatus
  paymentMethod: string | null
  pdfUrl: string | null
  xmlUrl: string | null
  clinicId: string
  clinicName?: string
  consultationId: string | null
}

export interface InvoiceFull extends InvoiceRow {
  itemsJson: string
  items: InvoiceItem[]
  patient: {
    id: string
    firstName: string
    lastName: string
    expNumber: string
    rfc?: string | null
    razonSocial?: string | null
    regimenFiscal?: string | null
    cfdiUso?: string | null
    emailFactura?: string | null
    email?: string | null
    phone?: string | null
  } | null
  clinic: {
    id: string
    name: string
    rfc?: string | null
    razonSocial?: string | null
    regimenFiscal?: string | null
    address?: string | null
    phone?: string | null
    email?: string | null
    logoUrl?: string | null
  }
}

export interface CitableConsultation {
  id: string
  date: string
  patientId: string
  patientName: string
  expNumber: string
  patientRfc: string | null
  patientPhone: string | null
  podologistId: string | null
  podologistName: string
  total: number
  hasInvoice: boolean
  itemsCount: number
  paymentMethod: string | null
}

export interface FacturasListResponse {
  data: InvoiceRow[]
  total: number
  page: number
  limit: number
  facturapiConfigured: boolean
}

export interface CitablesResponse {
  rows: CitableConsultation[]
  total: number
  page: number
  limit: number
}

export interface ResumenResponse {
  month: string
  totalFacturado: number
  totalSubtotal: number
  totalIva: number
  desgloseIva: {
    IVA16: { base: number; iva: number; total: number }
    IVA0: { base: number; iva: number; total: number }
    EXENTO: { base: number; iva: number; total: number }
  }
  countEmitidas: number
  countCanceladas: number
  countTimbradas: number
  countSimuladas: number
}

export interface CreateInvoiceResponse {
  id: string
  folio: string | null
  uuid: string | null
  date: string
  patient: { id: string; firstName: string; lastName: string; expNumber: string }
  items: InvoiceItem[]
  subtotal: number
  iva: number
  total: number
  status: InvoiceStatus
  pdfUrl: string | null
  xmlUrl: string | null
  paymentMethod: string | null
  simulated: boolean
}

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  PENDIENTE: 'Simulación',
  TIMBRADA: 'Timbrada',
  CANCELADA: 'Cancelada',
}

export const STATUS_BADGE_CLASSES: Record<InvoiceStatus, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-800 border-amber-300',
  TIMBRADA: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  CANCELADA: 'bg-red-100 text-red-700 border-red-300 line-through',
}

export const IVA_TYPE_OPTIONS: { value: IvaType; label: string }[] = [
  { value: 'IVA16', label: 'IVA 16%' },
  { value: 'IVA0', label: 'IVA 0%' },
  { value: 'EXENTO', label: 'Exento' },
]

export const ITEM_TYPE_OPTIONS: { value: ItemType; label: string }[] = [
  { value: 'SERVICIO', label: 'Servicio (consulta)' },
  { value: 'PRODUCTO', label: 'Producto' },
  { value: 'MEDICAMENTO', label: 'Medicamento' },
]

export const PAYMENT_FORM_OPTIONS = [
  { value: '01', label: '01 · Efectivo' },
  { value: '03', label: '03 · Transferencia' },
  { value: '04', label: '04 · Tarjeta de crédito' },
  { value: '28', label: '28 · Tarjeta de débito' },
  { value: '99', label: '99 · Por definir' },
] as const

export const USE_CFDI_OPTIONS = [
  { value: 'G01', label: 'G01 · Adquisición de mercancías' },
  { value: 'G02', label: 'G02 · Devoluciones / descuentos' },
  { value: 'G03', label: 'G03 · Gastos en general' },
  { value: 'D01', label: 'D01 · Honorarios médicos' },
  { value: 'D10', label: 'D10 · Pagos por servicios educativos' },
  { value: 'P01', label: 'P01 · Por definir' },
] as const

export const TAX_SYSTEM_OPTIONS = [
  { value: '601', label: '601 · General de Ley Personas Morales' },
  { value: '605', label: '605 · Sueldos y Salarios' },
  { value: '606', label: '606 · Arrendamiento' },
  { value: '610', label: '610 · Residentes en el Extranjero' },
  { value: '612', label: '612 · Personas Físicas con Actividades Empresariales y Profesionales' },
  { value: '616', label: '616 · Sin obligaciones fiscales' },
  { value: '621', label: '621 · Incorporación Fiscal' },
  { value: '626', label: '626 · Régimen Simplificado de Confianza' },
] as const
