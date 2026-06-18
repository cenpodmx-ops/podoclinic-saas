// ============================================================
// MÓDULO 04 — FACTURACIÓN
// Helper de FacturAPI (server-side only — nunca importar en cliente).
// Documentación: https://docs.facturapi.io/api/
// Endpoint: POST https://www.facturapi.io/api/v1/invoices
// ============================================================

import type { InvoiceItem } from '@/lib/invoice-types'

const FACTURAPI_BASE = 'https://www.facturapi.io/v2'

/** Devuelve la API key de FacturAPI para operar (facturas) — sk_test_ o sk_live_. */
export function getFacturapiKey(): string {
  return process.env.FACTURAPI_KEY || ''
}

/** Devuelve la User Secret Key de FacturAPI para gestionar organizaciones — sk_user_. */
export function getFacturapiUserKey(): string {
  return process.env.FACTURAPI_USER_KEY || ''
}

/** ¿Está configurada la API key global de FacturAPI? */
export function isFacturapiConfigured(): boolean {
  return !!getFacturapiKey()
}

// ============================================================
// ORGANIZACIONES (una por sucursal — contiene los datos fiscales del emisor)
// En FacturAPI v2: POST /organizations crea con solo `name`.
// PUT /organizations/{id}/legal actualiza los datos fiscales.
// ============================================================

export type FacturapiOrganizationInput = {
  name: string // nombre corto de la organización
  legal_name: string // razón social
  tax_system: string // régimen fiscal (601, 626, etc.)
  address?: {
    street?: string
    exterior?: string
    interior?: string
    neighborhood?: string
    municipality?: string
    state?: string
    zip?: string
  }
}

export type FacturapiOrganization = {
  id: string
  name: string
  legal?: {
    name: string
    legal_name: string
    tax_id: string
    tax_system: string
    address?: Record<string, string>
  }
  is_production_ready: boolean
  pending_steps?: Array<{ type: string; description: string }>
  created_at: string
}

/** Crea una organización en FacturAPI (entidad emisora de la sucursal).
 *  Requiere la User Secret Key (sk_user_...). */
export async function createFacturapiOrganization(
  data: FacturapiOrganizationInput,
): Promise<FacturapiOrganization> {
  const key = getFacturapiUserKey()
  if (!key) throw new Error('FACTURAPI_USER_KEY no configurada (requerida para gestionar organizaciones)')

  // 1) Crear organización con solo `name`
  const createRes = await fetch(`${FACTURAPI_BASE}/organizations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ name: data.name }),
  })
  if (!createRes.ok) {
    let msg = `FacturAPI respondió ${createRes.status}`
    try {
      const err = await createRes.json()
      if (err?.message) msg = err.message
    } catch {}
    throw new Error(`FacturAPI crear organización: ${msg}`)
  }
  const created = (await createRes.json()) as FacturapiOrganization

  // 2) Actualizar datos fiscales con PUT /legal
  const legalBody: any = {
    name: data.name,
    legal_name: data.legal_name,
    tax_system: data.tax_system,
  }
  if (data.address) {
    legalBody.address = { ...data.address }
  }
  const legalRes = await fetch(`${FACTURAPI_BASE}/organizations/${created.id}/legal`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(legalBody),
  })
  if (!legalRes.ok) {
    // La organización se creó pero no se pudieron actualizar los datos fiscales
    // Devolvemos la organización igualmente — el usuario puede actualizar después
    return created
  }
  return (await legalRes.json()) as FacturapiOrganization
}

/** Actualiza los datos fiscales de una organización existente en FacturAPI.
 *  Requiere la User Secret Key. */
export async function updateFacturapiOrganization(
  orgId: string,
  data: Partial<FacturapiOrganizationInput>,
): Promise<FacturapiOrganization> {
  const key = getFacturapiUserKey()
  if (!key) throw new Error('FACTURAPI_USER_KEY no configurada')
  const legalBody: any = {}
  if (data.name) legalBody.name = data.name
  if (data.legal_name) legalBody.legal_name = data.legal_name
  if (data.tax_system) legalBody.tax_system = data.tax_system
  if (data.address) legalBody.address = { ...data.address }
  const res = await fetch(`${FACTURAPI_BASE}/organizations/${orgId}/legal`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(legalBody),
  })
  if (!res.ok) {
    let msg = `FacturAPI respondió ${res.status}`
    try {
      const err = await res.json()
      if (err?.message) msg = err.message
      if (err?.errors?.length) msg = err.errors.map((e: any) => e.message || JSON.stringify(e)).join('; ')
    } catch {}
    throw new Error(`FacturAPI actualizar organización: ${msg}`)
  }
  return (await res.json()) as FacturapiOrganization
}

/** Obtiene una organización por ID. Usa la User Key. */
export async function getFacturapiOrganization(orgId: string): Promise<FacturapiOrganization | null> {
  const key = getFacturapiUserKey()
  if (!key) return null
  try {
    const res = await fetch(`${FACTURAPI_BASE}/organizations/${orgId}`, {
      headers: { Authorization: `Bearer ${key}` },
    })
    if (!res.ok) return null
    return (await res.json()) as FacturapiOrganization
  } catch {
    return null
  }
}

/** Claves de producto SAT según el tipo de concepto. */
export const PRODUCT_KEYS: Record<string, string> = {
  SERVICIO: '82111501', // Servicios de médicos
  MEDICAMENTO: '61102201', // Medicamentos
  PRODUCTO: '41111501', // Productos farmacéuticos (default para productos)
}

/** Map de ivaType → taxability + impuestos. */
export function taxInfoFor(ivaType: string): {
  taxability: string
  taxes: Array<{ type: string; rate: number; factor: string }>
} {
  switch (ivaType) {
    case 'IVA16':
      return { taxability: '02', taxes: [{ type: 'IVA', rate: 0.16, factor: 'TASA' }] }
    case 'IVA0':
      return { taxability: '02', taxes: [{ type: 'IVA', rate: 0, factor: 'TASA' }] }
    case 'EXENTO':
    default:
      return { taxability: '01', taxes: [] }
  }
}

/** Devuelve el ivaType recomendado según el tipo de concepto. */
export function ivaTypeForType(type: string): string {
  if (type === 'MEDICAMENTO') return 'IVA0'
  if (type === 'PRODUCTO') return 'IVA16'
  return 'EXENTO' // SERVICIO por defecto (consulta médica)
}

/** Convierte un InvoiceItem local al formato de FacturAPI. */
export function toFacturapiItem(item: InvoiceItem) {
  const productKey = PRODUCT_KEYS[item.type] || PRODUCT_KEYS.PRODUCTO
  const { taxability, taxes } = taxInfoFor(item.ivaType)
  return {
    quantity: item.qty,
    discount: 0,
    product: {
      description: item.name,
      product_key: productKey,
      price: Number(item.price.toFixed(2)),
      tax_included: false,
      taxability,
      taxes,
    },
  }
}

export type FacturapiCustomer = {
  legal_name: string
  tax_id: string
  tax_system?: string
  email?: string
  address?: {
    street?: string
    exterior?: string
    interior?: string
    neighborhood?: string
    municipality?: string
    state?: string
    country?: string
    zip?: string
  }
}

export type FacturapiInvoiceBody = {
  customer: FacturapiCustomer
  items: ReturnType<typeof toFacturapiItem>[]
  payment_form: string // catálogo SAT: 01 efectivo, 03 transferencia, 04 tarjeta, 28 otros
  use_cfdi: string // G01, G03, P01, etc.
  series?: string
  type?: 'I' | 'E' | 'P' // I=ingreso, E=egreso, P=pago
  currency?: string
  exchange?: number
  date?: string
}

export type FacturapiInvoiceResponse = {
  id: string
  uuid: string
  folio_number: number
  series: string
  status: 'valid' | 'canceled' | 'pending'
  payment_form?: string
  use_cfdi?: string
  total: number
  subtotal: number
  // FacturAPI expone los archivos vía endpoints /pdf y /xml por separado
  // pero también devuelve la URL firmada en algunos casos.
  pdf_url?: string
  xml_url?: string
  created_at: string
}

/** Llama a FacturAPI para timbrar la factura usando la API key de la sucursal.
 *  La factura se emite a nombre de la organización dueña de la API key. */
export async function createFacturapiInvoice(
  token: string,
  body: FacturapiInvoiceBody,
): Promise<FacturapiInvoiceResponse> {
  const res = await fetch(`${FACTURAPI_BASE}/invoices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    let errMsg = `FacturAPI respondió ${res.status}`
    try {
      const err = await res.json()
      if (err?.message) errMsg = err.message
      if (err?.errors?.length) {
        errMsg = err.errors.map((e: any) => e.message || JSON.stringify(e)).join('; ')
      }
    } catch {
      try {
        const txt = await res.text()
        if (txt) errMsg = txt
      } catch {}
    }
    throw new Error(`FacturAPI: ${errMsg}`)
  }

  const data = (await res.json()) as FacturapiInvoiceResponse
  return data
}

/** Devuelve la URL del PDF firmado de una factura timbrada. */
export async function getFacturapiPdfUrl(
  token: string,
  facturapiId: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${FACTURAPI_BASE}/invoices/${facturapiId}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: 'manual',
    })
    // FacturAPI devuelve 302 con Location firmada
    const loc = res.headers.get('location')
    if (loc) return loc
    if (res.ok) {
      // Algunas respuestas retornan JSON con la URL
      const data = await res.json().catch(() => null)
      if (data?.url) return data.url
    }
    return null
  } catch {
    return null
  }
}

/** Devuelve la URL del XML firmado de una factura timbrada. */
export async function getFacturapiXmlUrl(
  token: string,
  facturapiId: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${FACTURAPI_BASE}/invoices/${facturapiId}/xml`, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: 'manual',
    })
    const loc = res.headers.get('location')
    if (loc) return loc
    if (res.ok) {
      const data = await res.json().catch(() => null)
      if (data?.url) return data.url
    }
    return null
  } catch {
    return null
  }
}

/**
 * Cancela una factura timbrada en FacturAPI.
 * Motivo: 01 = comprobante emitido con errores con relación, 02 = sin relación, 03 = no se realizó operación, 04 = operacion nominativa relacionada en la factura global.
 */
export async function cancelFacturapiInvoice(
  token: string,
  facturapiId: string,
  motive: '01' | '02' | '03' | '04' = '02',
  substitutionId?: string,
): Promise<void> {
  const body: Record<string, unknown> = { motive }
  if (motive === '01' && substitutionId) body.substitution = substitutionId

  const res = await fetch(`${FACTURAPI_BASE}/invoices/${facturapiId}/cancel`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    let errMsg = `FacturAPI cancel respondió ${res.status}`
    try {
      const err = await res.json()
      if (err?.message) errMsg = err.message
      if (err?.errors?.length) {
        errMsg = err.errors.map((e: any) => e.message || JSON.stringify(e)).join('; ')
      }
    } catch {}
    throw new Error(`FacturAPI cancel: ${errMsg}`)
  }
}

/** Catálogo de formas de pago SAT. */
export const PAYMENT_FORM_OPTIONS = [
  { value: '01', label: '01 · Efectivo' },
  { value: '02', label: '02 · Cheque nominativo' },
  { value: '03', label: '03 · Transferencia electrónica de fondos' },
  { value: '04', label: '04 · Tarjeta de crédito' },
  { value: '05', label: '05 · Monedero electrónico' },
  { value: '06', label: '06 · Dinero electrónico' },
  { value: '08', label: '08 · Vales de despensa' },
  { value: '12', label: '12 · Dación en pago' },
  { value: '13', label: '13 · Pago por subrogación' },
  { value: '14', label: '14 · Pago por consignación' },
  { value: '15', label: '15 · Condonación' },
  { value: '17', label: '17 · Compensación' },
  { value: '23', label: '23 · Novación' },
  { value: '24', label: '24 · Confusión' },
  { value: '25', label: '25 · Remisión de deuda' },
  { value: '26', label: '26 · Prescripción o caducidad' },
  { value: '27', label: '27 · A satisfacción del acreedor' },
  { value: '28', label: '28 · Tarjeta de débito' },
  { value: '29', label: '29 · Tarjeta de servicios' },
  { value: '30', label: '30 · Aplicación de anticipos' },
  { value: '31', label: '31 · Intermediario de pagos' },
  { value: '99', label: '99 · Por definir' },
] as const

/** Catálogo de usos de CFDI (versión 4.0) más comunes para pacientes. */
export const USE_CFDI_OPTIONS = [
  { value: 'G01', label: 'G01 · Adquisición de mercancías' },
  { value: 'G02', label: 'G02 · Devoluciones, descuentos o bonificaciones' },
  { value: 'G03', label: 'G03 · Gastos en general' },
  { value: 'I01', label: 'I01 · Construcciones' },
  { value: 'I02', label: 'I02 · Mobiliario y equipo de oficina' },
  { value: 'I04', label: 'I04 · Equpos de cómputo' },
  { value: 'I08', label: 'I08 · Otra maquinaria y equipo' },
  { value: 'D01', label: 'D01 · Honorarios médicos, dentales y gastos hospitalarios' },
  { value: 'D02', label: 'D02 · Gastos médicos por incapacidad o discapacidad' },
  { value: 'D04', label: 'D04 · Donativos' },
  { value: 'D05', label: 'D05 · Intereses reales efectivamente pagados' },
  { value: 'D10', label: 'D10 · Pagos por servicios educativos' },
  { value: 'P01', label: 'P01 · Por definir' },
] as const

/** Catálogo de regímenes fiscales SAT más comunes para personas físicas/morales. */
export const TAX_SYSTEM_OPTIONS = [
  { value: '601', label: '601 · General de Ley Personas Morales' },
  { value: '603', label: '603 · Personas Morales con Fines no Lucrativos' },
  { value: '605', label: '605 · Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { value: '606', label: '606 · Arrendamiento' },
  { value: '607', label: '607 · Régimen de Enajenación o Adquisición de Bienes' },
  { value: '608', label: '608 · Demás ingresos' },
  { value: '610', label: '610 · Residentes en el Extranjero sin Establecimiento Permanente en México' },
  { value: '611', label: '611 · Ingresos por Dividendos, Sociedades Mercantiles' },
  { value: '612', label: '612 · Personas Físicas con Actividades Empresariales y Profesionales' },
  { value: '614', label: '614 · Ingresos por intereses' },
  { value: '615', label: '615 · Régimen de los ingresos por obtención de premios' },
  { value: '616', label: '616 · Sin obligaciones fiscales' },
  { value: '621', label: '621 · Incorporación Fiscal' },
  { value: '622', label: '622 · Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras' },
  { value: '623', label: '623 · Opcional para Grupos de Sociedades' },
  { value: '624', label: '624 · Coordinados' },
  { value: '625', label: '625 · Hidrocarburos' },
  { value: '626', label: '626 · Régimen Simplificado de Confianza' },
] as const

/** Catálogo de motivos de cancelación. */
export const CANCEL_MOTIVES = [
  { value: '01', label: '01 · Comprobante emitido con errores con relación' },
  { value: '02', label: '02 · Comprobante emitido con errores sin relación' },
  { value: '03', label: '03 · No se llevó a cabo la operación' },
  { value: '04', label: '04 · Operación nominativa relacionada en la factura global' },
] as const
