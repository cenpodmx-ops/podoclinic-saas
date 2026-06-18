// ============================================================
// MÓDULO 04 — FACTURACIÓN
// Helper de FacturAPI usando el SDK oficial (server-side only).
// Modelo: 1 organización por sucursal con su propia API key + CSD.
// ============================================================

import Facturapi from 'facturapi'

/** Devuelve la Master Secret Key (user key) para gestionar organizaciones. */
export function getFacturapiMasterKey(): string {
  return process.env.FACTURAPI_SECRET_KEY || ''
}

/** Crea un cliente admin de FacturAPI usando la master key (gestiona organizaciones). */
export function getFacturapiAdmin() {
  const key = getFacturapiMasterKey()
  if (!key) throw new Error('FACTURAPI_SECRET_KEY no configurada')
  return new Facturapi(key)
}

/** Crea un cliente de FacturAPI usando la API key de una sucursal específica (para facturar). */
export function getFacturapiClient(apiKey: string) {
  if (!apiKey) throw new Error('API key de la sucursal requerida')
  return new Facturapi(apiKey)
}

// ============================================================
// ORGANIZACIONES — gestionadas con la master key
// ============================================================

/** Crea una organización nueva en FacturAPI para una sucursal. */
export async function createOrganization(name: string) {
  const admin = getFacturapiAdmin()
  const org = await admin.organizations.create({ name })
  return org
}

/** Actualiza los datos legales (fiscales) de una organización. */
export async function updateOrganizationLegal(
  orgId: string,
  data: { name: string; legal_name: string; tax_system: string; zip: string },
) {
  const admin = getFacturapiAdmin()
  await admin.organizations.updateLegal(orgId, {
    name: data.name,
    legal_name: data.legal_name,
    tax_system: data.tax_system,
    address: { zip: data.zip },
  })
}

/** Sube los Certificados de Sello Digital (CSD) a una organización. */
export async function uploadCSD(
  orgId: string,
  cerBuffer: Buffer,
  keyBuffer: Buffer,
  password: string,
) {
  const admin = getFacturapiAdmin()
  await admin.organizations.uploadCertificate(orgId, cerBuffer, keyBuffer, password)
}

/**
 * Obtiene la API key de TEST de una organización. Si no existe, la crea.
 * Usa la master key (Basic auth).
 */
export async function getOrCreateOrganizationTestApiKey(orgId: string): Promise<string | null> {
  const masterKey = getFacturapiMasterKey()
  if (!masterKey) return null
  const authString = Buffer.from(`${masterKey}:`).toString('base64')
  const headers = {
    Authorization: `Basic ${authString}`,
    'Content-Type': 'application/json',
  }

  // 1. Intentar obtener la key existente
  try {
    const res = await fetch(`https://www.facturapi.io/v2/organizations/${orgId}/apikeys/test`, {
      method: 'GET',
      cache: 'no-store',
      headers,
    })
    if (res.ok) {
      const data = await res.json()
      if (data?.id) return data.id
    }
  } catch {
    // continuar a crear
  }

  // 2. Si no existe, crearla
  try {
    const res = await fetch(`https://www.facturapi.io/v2/organizations/${orgId}/apikeys`, {
      method: 'POST',
      cache: 'no-store',
      headers,
      body: JSON.stringify({ role: 'test' }),
    })
    if (res.ok) {
      const data = await res.json()
      return data.id || null
    }
  } catch {
    // ignore
  }

  return null
}

/** Obtiene una organización por ID (para verificar estado). */
export async function getOrganization(orgId: string) {
  const admin = getFacturapiAdmin()
  try {
    return await admin.organizations.retrieve(orgId)
  } catch {
    return null
  }
}

// ============================================================
// CLIENTES (receptores de las facturas — los pacientes)
// ============================================================

/** Crea un cliente en FacturAPI para un paciente.
 *  El tax_system siempre es '616' (Sin obligaciones fiscales) porque:
 *  - Funciona para RFCs genéricos (XAXX010101000)
 *  - Funciona para RFCs registrados como "sin obligaciones"
 *  - Si el paciente tiene un RFC real con régimen específico, FacturAPI validará
 *    contra el SAT y '616' será rechazado — en ese caso el paciente debe capturar
 *    su régimen correcto en su ficha y se usará ese.
 *
 *  address.zip es REQUERIDO por FacturAPI v2 — si no se proporciona, se usa '00000'.
 */
export async function createCustomer(
  apiKey: string,
  data: {
    legal_name: string
    tax_id: string
    tax_system?: string
    email?: string
    zip?: string
  },
) {
  const client = getFacturapiClient(apiKey)
  return await client.customers.create({
    legal_name: data.legal_name,
    tax_id: data.tax_id,
    // Siempre '616' a menos que el paciente tenga un régimen explícito Y válido
    tax_system: '616',
    // address requerido por FacturAPI v2 — siempre incluir zip
    address: { zip: data.zip || '00000' },
    email: data.email,
  })
}

// ============================================================
// FACTURAS
// ============================================================

/** Determina la estructura de impuestos según el tipo de IVA. */
export function determinarImpuestos(tipo: string) {
  const t = String(tipo || '').toLowerCase()
  if (t === '16' || t === 'iva16') {
    return [{ type: 'IVA' as const, rate: 0.16 }]
  }
  if (t === '0' || t === 'iva0') {
    return [{ type: 'IVA' as const, rate: 0 }]
  }
  // Exento — FacturAPI requiere rate: 0 + factor: 'Exento'
  return [{ type: 'IVA' as const, rate: 0, factor: 'Exento' as const }]
}

/** Map de ivaType del sistema → tipo para determinarImpuestos. */
export function ivaTypeToTaxType(ivaType: string): string {
  switch (ivaType) {
    case 'IVA16':
      return '16'
    case 'IVA0':
      return '0'
    case 'EXENTO':
    default:
      return 'exento'
  }
}

/** Devuelve el ivaType recomendado según el tipo de concepto. */
export function ivaTypeForType(type: string): string {
  if (type === 'MEDICAMENTO') return 'IVA0'
  if (type === 'PRODUCTO') return 'IVA16'
  return 'EXENTO' // SERVICIO por defecto (consulta médica)
}

/** Claves de producto SAT según el tipo de concepto. */
export const PRODUCT_KEYS: Record<string, string> = {
  SERVICIO: '85121600', // Servicios de médicos (consulta)
  MEDICAMENTO: '01010101', // Productos genéricos
  PRODUCTO: '01010101', // Productos genéricos
}

export type InvoiceItemInput = {
  description: string
  quantity: number
  price: number
  product_key?: string
  taxes_type: string // '16' | '0' | 'exento'
}

/** Crea una factura en FacturAPI usando la API key de la sucursal. */
export async function createInvoice(
  apiKey: string,
  params: {
    customerId: string
    items: InvoiceItemInput[]
    payment_form: string // '01' efectivo, '03' transferencia, '04' tarjeta, '28' otros
    use_cfdi?: string // G01, G03, P01, etc.
  },
) {
  const client = getFacturapiClient(apiKey)
  const facturapiItems = params.items.map((it) => ({
    quantity: it.quantity,
    product: {
      description: it.description,
      product_key: it.product_key || PRODUCT_KEYS.PRODUCTO,
      price: it.price,
      tax_included: true,
      taxes: determinarImpuestos(it.taxes_type),
    },
  }))

  return await client.invoices.create({
    customer: params.customerId,
    payment_form: params.payment_form,
    payment_method: 'PUE',
    use: params.use_cfdi || 'G03',
    items: facturapiItems,
  })
}

/** Cancela una factura en FacturAPI. */
export async function cancelInvoice(
  apiKey: string,
  facturapiId: string,
  motive: '01' | '02' | '03' | '04' = '02',
) {
  const client = getFacturapiClient(apiKey)
  await client.invoices.cancel(facturapiId, { motive })
}

/** Descarga el PDF de una factura como buffer. */
export async function downloadInvoicePdf(apiKey: string, facturapiId: string): Promise<Buffer> {
  const client = getFacturapiClient(apiKey)
  const stream = await client.invoices.downloadPdf(facturapiId)
  const chunks: Buffer[] = []
  for await (const chunk of stream as any) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

/** Descarga el XML de una factura como buffer. */
export async function downloadInvoiceXml(apiKey: string, facturapiId: string): Promise<Buffer> {
  const client = getFacturapiClient(apiKey)
  const stream = await client.invoices.downloadXml(facturapiId)
  const chunks: Buffer[] = []
  for await (const chunk of stream as any) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

// ============================================================
// CATÁLOGOS SAT (para selects en la UI)
// ============================================================

export const PAYMENT_FORM_OPTIONS = [
  { value: '01', label: '01 · Efectivo' },
  { value: '02', label: '02 · Cheque nominativo' },
  { value: '03', label: '03 · Transferencia electrónica de fondos' },
  { value: '04', label: '04 · Tarjeta de crédito' },
  { value: '28', label: '28 · Tarjeta de débito' },
  { value: '99', label: '99 · Por definir' },
] as const

export const USE_CFDI_OPTIONS = [
  { value: 'G01', label: 'G01 · Adquisición de mercancías' },
  { value: 'G03', label: 'G03 · Gastos en general' },
  { value: 'D01', label: 'D01 · Honorarios médicos, dentales y gastos hospitalarios' },
  { value: 'D02', label: 'D02 · Gastos médicos por incapacidad o discapacidad' },
  { value: 'P01', label: 'P01 · Por definir' },
] as const

export const TAX_SYSTEM_OPTIONS = [
  { value: '601', label: '601 · General de Ley Personas Morales' },
  { value: '612', label: '612 · Personas Físicas con Actividades Empresariales y Profesionales' },
  { value: '626', label: '626 · Régimen Simplificado de Confianza (RESICO)' },
  { value: '603', label: '603 · Personas Morales con Fines no Lucrativos' },
  { value: '608', label: '608 · Demás ingresos' },
  { value: '616', label: '616 · Sin obligaciones fiscales' },
] as const

/** Catálogo de motivos de cancelación. */
export const CANCEL_MOTIVES = [
  { value: '01', label: '01 · Comprobante emitido con errores con relación' },
  { value: '02', label: '02 · Comprobante emitido con errores sin relación' },
  { value: '03', label: '03 · No se llevó a cabo la operación' },
  { value: '04', label: '04 · Operación nominativa relacionada en la factura global' },
] as const
