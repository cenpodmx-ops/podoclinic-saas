import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad, effectiveClinic } from '@/lib/api'
import { startOfMonth, endOfMonth, parseISO } from 'date-fns'
import {
  createFacturapiInvoice,
  getFacturapiPdfUrl,
  getFacturapiXmlUrl,
  toFacturapiItem,
  ivaTypeForType,
  type FacturapiInvoiceBody,
} from '@/lib/facturapi'
import type { InvoiceItem, InvoiceStatus, IvaType, ItemType, ManualInvoiceItemInput } from '@/lib/invoice-types'

// ============================================================
// MÓDULO 04 — FACTURACIÓN
// GET  ?page=1&limit=20&from=&to=&patientId=&status=&all=1
//      → { data: InvoiceRow[], total, facturapiConfigured }
// POST body { consultationId } | { patientId, items, paymentMethod, useCfdi }
//      → genera la factura (timbrada si hay token, simulada si no)
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
  const status = sp.get('status')
  if (status && VALID_STATUS.includes(status as InvoiceStatus)) {
    where.status = status
  }

  // Filtro por mes/año (YYYY-MM)
  const month = sp.get('month') // YYYY-MM
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const base = parseISO(`${month}-01`)
    where.date = { gte: startOfMonth(base), lte: endOfMonth(base) }
  }

  const [rows, total, clinic] = await Promise.all([
    db.invoice.findMany({
      where,
      orderBy: { date: 'desc' },
      skip,
      take: limit,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, expNumber: true } },
        clinic: { select: { id: true, name: true } },
      },
    }),
    db.invoice.count({ where }),
    clinicId
      ? db.clinic.findUnique({ where: { id: clinicId }, select: { facturapiToken: true, facturapiOrgId: true } })
      : null,
  ])

  return ok({
    data: rows.map((r) => ({
      id: r.id,
      folio: r.folio,
      uuid: r.uuid,
      date: r.date,
      patientId: r.patientId,
      patientName: r.patient ? `${r.patient.firstName} ${r.patient.lastName}` : '—',
      expNumber: r.patient?.expNumber ?? null,
      total: r.total,
      subtotal: r.subtotal,
      iva: r.iva,
      status: r.status as InvoiceStatus,
      paymentMethod: r.paymentMethod,
      pdfUrl: r.pdfUrl,
      xmlUrl: r.xmlUrl,
      clinicId: r.clinicId,
      clinicName: r.clinic?.name,
      consultationId: r.consultationId,
    })),
    total,
    page,
    limit,
    facturapiConfigured: !!clinic?.facturapiOrgId || !!clinic?.facturapiToken,
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

  // ── Resolver clínica + configuración FacturAPI
  const clinic = await db.clinic.findUnique({ where: { id: clinicId } })
  if (!clinic) return bad('Clínica no encontrada', 404)
  // La API key es global (env); la organización es por sucursal.
  const apiKey = process.env.FACTURAPI_KEY?.trim() || clinic.facturapiToken?.trim() || ''
  const orgId = clinic.facturapiOrgId?.trim() || ''
  const isSimulation = !apiKey || !orgId

  // ── Series (opcional)
  let series: string | undefined
  if (clinic.facturapiSeries) {
    try {
      const parsed = JSON.parse(clinic.facturapiSeries) as Record<string, string>
      series = parsed.ingreso || parsed.I || parsed.default || undefined
    } catch {}
  }

  // ── FacturAPI call (si hay API key + orgId)
  let folio: string | null = null
  let uuid: string | null = null
  let pdfUrl: string | null = null
  let xmlUrl: string | null = null
  let status: InvoiceStatus = 'PENDIENTE'

  if (!isSimulation) {
    const facturapiItems = items.map(toFacturapiItem)
    const payload: FacturapiInvoiceBody = {
      customer: {
        legal_name: razonSocial,
        tax_id: rfc,
        tax_system: patient.regimenFiscal || undefined,
        email: emailFactura,
      },
      items: facturapiItems,
      payment_form: paymentForm || '01',
      use_cfdi: useCfdi || 'G03',
      type: 'I',
      ...(series ? { series } : {}),
    }

    let faResp
    try {
      faResp = await createFacturapiInvoice(apiKey, payload, orgId)
    } catch (e: any) {
      return bad(e?.message || 'Error al timbrar con FacturAPI', 502)
    }

    folio = faResp.series
      ? `${faResp.series}-${String(faResp.folio_number).padStart(6, '0')}`
      : String(faResp.folio_number)
    uuid = faResp.uuid || null
    status = 'TIMBRADA'

    // URLs firmadas para PDF y XML
    const [pdf, xml] = await Promise.all([
      getFacturapiPdfUrl(token!, faResp.id),
      getFacturapiXmlUrl(token!, faResp.id),
    ])
    pdfUrl = pdf || faResp.pdf_url || null
    xmlUrl = xml || faResp.xml_url || null

    // Guardar el ID interno de FacturAPI para futuras cancelaciones
    // (lo metemos en el campo uuid como prefijo; no es lo ideal pero
    // permite recuperar el ID para cancelar. Alternativa: agregar campo.)
    // Mejor: guardamos el ID en el campo uuid temporal y lo actualizamos
    // con el UUID SAT abajo. Para cancelación, usaremos el campo pdfUrl/xmlUrl
    // para derivar el ID si lo necesitamos — pero es más simple agregar
    // un campo extra. Por ahora, guardamos el ID en la posición final del uuid
    // separado por '|' si es necesario. Para no tocar el schema, guardamos
    // el FacturAPI ID en el folio como metadata adicional:
    // folio = "A-000001#fk_internal_id"
    // No, esto rompe el folio visible.
    //
    // Solución práctica: guardamos el FacturAPI ID en el campo uuid temporal
    // y luego lo reemplazamos por el UUID SAT. Para cancelación, podemos
    // buscar la factura en FacturAPI por UUID SAT usando su endpoint.
    // → GET /api/v1/invoices?uuid=<sat_uuid> devuelve el registro interno.
    //
    // Para simplificar, guardamos el ID interno en el campo xmlUrl como
    // prefijo "fa:<id>|" — pero eso rompe el XML público.
    //
    // Mejor: usar el campo uuid con formato "sat_uuid|fa_id" y parsear al
    // cancelar. Aceptable.
    if (uuid) {
      uuid = `${uuid}|${faResp.id}`
    } else {
      uuid = `|${faResp.id}`
    }
  }

  // ── Crear la factura en la BD
  const created = await db.invoice.create({
    data: {
      clinicId,
      patientId,
      consultationId,
      folio,
      uuid,
      itemsJson: JSON.stringify(items),
      subtotal: round2(subtotal),
      iva: round2(iva),
      total: round2(total),
      status,
      pdfUrl,
      xmlUrl,
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
