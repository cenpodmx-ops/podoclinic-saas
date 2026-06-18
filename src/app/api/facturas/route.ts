import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad, effectiveClinic } from '@/lib/api'
import { startOfMonth, endOfMonth, parseISO } from 'date-fns'
import {
  createCustomer,
  createInvoice,
  ivaTypeToTaxType,
  PRODUCT_KEYS,
  ivaTypeForType,
} from '@/lib/facturapi'
import type { InvoiceItem, InvoiceStatus, IvaType, ItemType, ManualInvoiceItemInput } from '@/lib/invoice-types'

// ============================================================
// MÓDULO 04 — FACTURACIÓN
// GET  ?page=1&limit=20&from=&to=&patientId=&status=&all=1
//      → { data: InvoiceRow[], total, facturapiConfigured }
// POST body { consultationId } | { patientId, items, paymentMethod, useCfdi }
//      → genera la factura (timbrada si hay API key, simulada si no)
// ============================================================

const VALID_STATUS: InvoiceStatus[] = ['PENDIENTE', 'TIMBRADA', 'CANCELADA']

export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const sp = req.nextUrl.searchParams
  const all = sp.get('all') || undefined
  const clinicId = effectiveClinic(user!, all)

  const page = Math.max(1, parseInt(sp.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') || '20')))
  const skip = (page - 1) * limit

  const where: any = {}
  if (clinicId) where.clinicId = clinicId
  if (sp.get('patientId')) where.patientId = sp.get('patientId')

  // Filtros de fecha
  const from = sp.get('from')
  const to = sp.get('to')
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = parseISO(from)
    if (to) where.date.lte = endOfMonth(parseISO(to))
  }

  // Filtro de status
  const statusFilter = sp.get('status')
  if (statusFilter && VALID_STATUS.includes(statusFilter as InvoiceStatus)) {
    where.status = statusFilter
  }

  // Filtro de mes/año
  const month = sp.get('month')
  if (month) {
    const [y, m] = month.split('-').map(Number)
    if (y && m) {
      const s = new Date(y, m - 1, 1)
      const e = endOfMonth(s)
      where.date = { gte: s, lte: e }
    }
  }

  const [rows, total, clinic] = await Promise.all([
    db.invoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: { date: 'desc' },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, expNumber: true } },
        clinic: { select: { id: true, name: true } },
      },
    }),
    db.invoice.count({ where }),
    clinicId
      ? db.clinic.findUnique({ where: { id: clinicId }, select: { facturapiToken: true } })
      : null,
  ])

  return ok({
    data: rows.map((r) => ({
      id: r.id,
      folio: r.folio,
      uuid: r.uuid,
      date: r.date,
      patient: r.patient,
      clinic: r.clinic,
      subtotal: r.subtotal,
      iva: r.iva,
      total: r.total,
      status: r.status,
      paymentMethod: r.paymentMethod,
      pdfUrl: r.pdfUrl,
      xmlUrl: r.xmlUrl,
    })),
    total,
    page,
    limit,
    facturapiConfigured: !!clinic?.facturapiToken,
  })
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')

  const clinicId = user!.clinicId
  if (!clinicId) return bad('Sin clínica asignada', 403)

  // ── Resolver items, paciente y método de pago según el origen
  let items: InvoiceItem[] = []
  let patientId: string | null = null
  let consultationId: string | null = null
  let paymentForm: string | null = null
  let useCfdi: string | null = null
  let paymentMethod: string | null = null

  if (body.consultationId) {
    // ── Caso A: factura desde una consulta
    const cons = await db.consultation.findUnique({
      where: { id: body.consultationId },
      include: {
        patient: true,
        appointment: { include: { clinic: true } },
      },
    })
    if (!cons) return bad('Consulta no encontrada', 404)
    if (user!.role !== 'SUPER' && cons.clinicId !== clinicId) return bad('Sin acceso a esta consulta', 403)

    // Validar que no tenga ya una factura asociada
    const existing = await db.invoice.findFirst({
      where: { consultationId: cons.id, status: { not: 'CANCELADA' } },
    })
    if (existing) return bad('Esta consulta ya tiene una factura emitida', 409)

    patientId = cons.patientId
    consultationId = cons.id
    paymentMethod = cons.paymentMethod || null

    // Construir items: Consulta + productos
    const rawItems = safeParseItems(cons.itemsJson)
    items = buildConsultationItems(cons.consultPrice, cons.discount, rawItems)

    useCfdi = body.useCfdi || cons.patient.cfdiUso || 'G03'
    paymentForm = body.paymentForm || mapPaymentMethodToForm(cons.paymentMethod) || '01'
  } else if (body.patientId && Array.isArray(body.items)) {
    // ── Caso B: factura manual (venta mostrador facturable)
    const patient = await db.patient.findUnique({ where: { id: body.patientId } })
    if (!patient) return bad('Paciente no encontrado', 404)
    if (user!.role !== 'SUPER' && patient.clinicId !== clinicId) return bad('Sin acceso a este paciente', 403)

    patientId = patient.id
    useCfdi = body.useCfdi || patient.cfdiUso || 'G03'
    paymentForm = body.paymentForm || '01'
    paymentMethod = body.paymentMethod || null

    const manualItems: ManualInvoiceItemInput[] = body.items
    if (manualItems.length === 0) return bad('Debe incluir al menos un item en la factura')
    items = manualItems.map((it) => ({
      name: String(it.name),
      qty: Math.max(1, Number(it.qty) || 1),
      price: Math.max(0, Number(it.price) || 0),
      type: (it.type || 'PRODUCTO') as ItemType,
      ivaType: (it.ivaType || ivaTypeForType(it.type || 'PRODUCTO')) as IvaType,
      productId: it.productId,
    }))
  } else {
    return bad('Body inválido: requiere consultationId o { patientId, items }')
  }

  // ── Validar datos fiscales del paciente
  if (!patientId) return bad('Paciente requerido')
  const patient = await db.patient.findUnique({ where: { id: patientId } })
  if (!patient) return bad('Paciente no encontrado', 404)

  const rfc = (patient.rfc || '').trim().toUpperCase()
  if (!rfc) return bad('Paciente sin datos fiscales (falta RFC)', 400)
  const razonSocial = (patient.razonSocial || `${patient.firstName} ${patient.lastName}`).trim()
  if (!razonSocial) return bad('Paciente sin razón social', 400)

  const emailFactura = (patient.emailFactura || patient.email || '').trim() || undefined

  // ── Calcular subtotal / iva / total
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0)
  const iva = items
    .filter((i) => i.ivaType === 'IVA16')
    .reduce((s, i) => s + i.qty * i.price * 0.16, 0)
  const total = subtotal + iva

  // ── Resolver clínica + API key de FacturAPI de la sucursal
  const clinic = await db.clinic.findUnique({ where: { id: clinicId } })
  if (!clinic) return bad('Clínica no encontrada', 404)
  const apiKey = clinic.facturapiToken?.trim() || ''
  const isSimulation = !apiKey

  // ── FacturAPI call (si hay API key)
  let folio: string | null = null
  let uuid: string | null = null
  let facturapiId: string | null = null
  let status: InvoiceStatus = 'PENDIENTE'

  if (!isSimulation) {
    try {
      // 1. Crear cliente (paciente) en FacturAPI
      const customer = await createCustomer(apiKey, {
        legal_name: razonSocial,
        tax_id: rfc,
        // Default '616' (Sin obligaciones fiscales) si el paciente no tiene régimen.
        // FacturAPI valida el régimen contra el RFC en el SAT.
        tax_system: patient.regimenFiscal || '616',
        email: emailFactura,
      })

      // 2. Construir items para FacturAPI
      const faItems = items.map((it) => ({
        description: it.name,
        quantity: it.qty,
        price: it.price,
        product_key: PRODUCT_KEYS[it.type] || PRODUCT_KEYS.PRODUCTO,
        taxes_type: ivaTypeToTaxType(it.ivaType),
      }))

      // 3. Crear la factura
      const faResp: any = await createInvoice(apiKey, {
        customerId: customer.id,
        items: faItems,
        payment_form: paymentForm || '01',
        use_cfdi: useCfdi || 'G03',
      })

      folio = faResp.series
        ? `${faResp.series}-${String(faResp.folio_number).padStart(6, '0')}`
        : String(faResp.folio_number || '')
      uuid = faResp.uuid || null
      facturapiId = faResp.id || null
      status = 'TIMBRADA'
    } catch (e: any) {
      console.error('[FACTURAS] error timbrando:', e)
      return bad(e?.message || 'Error al timbrar con FacturAPI', 502)
    }
  }

  // ── Crear la factura en la BD
  const created = await db.invoice.create({
    data: {
      clinicId,
      patientId,
      consultationId,
      folio,
      uuid: facturapiId ? `${uuid || ''}|${facturapiId}` : uuid,
      itemsJson: JSON.stringify(items),
      subtotal: round2(subtotal),
      iva: round2(iva),
      total: round2(total),
      status,
      pdfUrl: facturapiId ? `/api/facturas/${null}/pdf?faId=${facturapiId}` : null,
      xmlUrl: facturapiId ? `/api/facturas/${null}/xml?faId=${facturapiId}` : null,
      paymentMethod: paymentMethod || paymentForm,
    },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, expNumber: true } },
    },
  })

  return ok(
    {
      id: created.id,
      folio: created.folio,
      uuid: created.uuid,
      date: created.date,
      patient: created.patient,
      items,
      subtotal: created.subtotal,
      iva: created.iva,
      total: created.total,
      status: created.status,
      pdfUrl: created.pdfUrl,
      xmlUrl: created.xmlUrl,
      paymentMethod: created.paymentMethod,
      simulated: isSimulation,
    },
    201,
  )
}

// ── Helpers

function safeParseItems(s: string | null | undefined): Array<{ name: string; qty: number; price: number; type: ItemType; productId?: string; serviceId?: string }> {
  if (!s) return []
  try {
    const parsed = JSON.parse(s) as any[]
    return (parsed || []).map((p) => ({
      name: String(p.name || ''),
      qty: Number(p.qty) || 1,
      price: Number(p.price) || 0,
      type: (p.type === 'MEDICAMENTO' || p.type === 'SERVICIO' ? p.type : 'PRODUCTO') as ItemType,
      productId: p.productId,
      serviceId: p.serviceId,
    }))
  } catch {
    return []
  }
}

/** Construye los items de la factura a partir de la consulta, aplicando descuento proporcional. */
function buildConsultationItems(
  consultPrice: number,
  discount: number,
  rawItems: Array<{ name: string; qty: number; price: number; type: ItemType; productId?: string }>,
): InvoiceItem[] {
  const items: InvoiceItem[] = []

  if (consultPrice > 0) {
    items.push({
      name: 'Consulta médica podológica',
      qty: 1,
      price: consultPrice,
      type: 'SERVICIO',
      ivaType: 'EXENTO',
    })
  }

  for (const it of rawItems) {
    if (!it.name) continue
    items.push({
      name: it.name,
      qty: it.qty,
      price: it.price,
      type: it.type,
      ivaType: ivaTypeForType(it.type) as IvaType,
      productId: it.productId,
    })
  }

  // Aplicar descuento proporcionalmente para que los totales cuadren
  if (discount > 0 && items.length > 0) {
    const gross = items.reduce((s, i) => s + i.qty * i.price, 0)
    if (gross > 0) {
      const ratio = Math.max(0, 1 - discount / gross)
      for (const it of items) {
        it.price = round2(it.price * ratio)
      }
    }
  }

  return items
}

/** Mapea el método de pago interno (EFECTIVO/DEBITO/…) a la clave SAT payment_form. */
function mapPaymentMethodToForm(m?: string | null): string | null {
  if (!m) return null
  switch (m) {
    case 'EFECTIVO': return '01'
    case 'TRANSFERENCIA': return '03'
    case 'CREDITO': return '04'
    case 'DEBITO': return '28'
    default: return '99'
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
