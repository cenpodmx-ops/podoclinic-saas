// ============================================================
// MÓDULO 04 — FACTURACIÓN
// Tipos compartidos entre cliente y servidor.
// ============================================================

export type ItemType = 'SERVICIO' | 'PRODUCTO' | 'MEDICAMENTO'
export type IvaType = 'IVA16' | 'IVA0' | 'EXENTO'

/** Item genérico de factura (compatible con FacturAPI). */
export interface InvoiceItem {
  name: string
  qty: number
  price: number
  type: ItemType
  ivaType: IvaType
  productId?: string
  serviceId?: string
}

/** Status de la factura. */
export type InvoiceStatus = 'PENDIENTE' | 'TIMBRADA' | 'CANCELADA'

/** Item de factura desde el POST manual. */
export type ManualInvoiceItemInput = {
  name: string
  qty: number
  price: number
  ivaType: IvaType
  type: ItemType
  productId?: string
}

/** Datos fiscales del cliente (paciente). */
export interface FiscalData {
  rfc: string
  razonSocial: string
  regimenFiscal?: string | null
  cfdiUso: string
  emailFactura?: string | null
  phone?: string | null
}

/** Invoice lista para mostrar en la UI. */
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

/** Detalle completo de una factura. */
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

/** Consultation citable (finalizada sin factura). */
export interface CitableConsultation {
  id: string
  date: string
  patientId: string
  patientName: string
  expNumber: string
  podologistId: string | null
  podologistName: string
  total: number
  hasInvoice: boolean
  itemsCount: number
  paymentMethod: string | null
}

/** Body del POST /api/facturas. */
export type CreateInvoiceBody =
  | { consultationId: string; paymentForm?: string; useCfdi?: string }
  | {
      patientId: string
      items: ManualInvoiceItemInput[]
      paymentMethod: string
      useCfdi: string
      paymentForm?: string
    }
