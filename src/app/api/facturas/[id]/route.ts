import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { cancelInvoice, downloadInvoicePdf, downloadInvoiceXml } from '@/lib/facturapi'

/**
 * GET /api/facturas/[id]
 *   Sin query params → devuelve detalle JSON de la factura
 *   ?format=pdf      → descarga el PDF desde FacturAPI
 *   ?format=xml      → descarga el XML desde FacturAPI
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const { id } = await params
  const format = req.nextUrl.searchParams.get('format')

  const inv = await db.invoice.findUnique({
    where: { id },
    include: { patient: true, clinic: true },
  })
  if (!inv) return bad('Factura no encontrada', 404)
  if (user!.role !== 'SUPER' && inv.clinicId !== user!.clinicId) return bad('Sin acceso', 403)

  // Parsear facturapiId del uuid (formato: "sat_uuid|fa_id")
  const parts = (inv.uuid || '').split('|')
  const facturapiId = parts.length > 1 ? parts[1] : null

  // ── Descarga de PDF
  if (format === 'pdf') {
    if (!facturapiId) return bad('Esta factura no tiene ID de FacturAPI (es simulada)', 400)
    const token = inv.clinic?.facturapiToken?.trim()
    if (!token) return bad('Sucursal sin API key de FacturAPI', 400)
    try {
      const pdfBuffer = await downloadInvoicePdf(token, facturapiId)
      return new NextResponse(pdfBuffer as any, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="factura-${inv.folio || id}.pdf"`,
          'Content-Length': String(pdfBuffer.length),
          'Cache-Control': 'no-store',
        },
      })
    } catch (e: any) {
      console.error('[FACTURAS] error descargando PDF:', e)
      return bad(e?.message || 'Error al descargar PDF', 502)
    }
  }

  // ── Descarga de XML
  if (format === 'xml') {
    if (!facturapiId) return bad('Esta factura no tiene ID de FacturAPI (es simulada)', 400)
    const token = inv.clinic?.facturapiToken?.trim()
    if (!token) return bad('Sucursal sin API key de FacturAPI', 400)
    try {
      const xmlBuffer = await downloadInvoiceXml(token, facturapiId)
      return new NextResponse(xmlBuffer as any, {
        headers: {
          'Content-Type': 'application/xml',
          'Content-Disposition': `attachment; filename="factura-${inv.folio || id}.xml"`,
          'Content-Length': String(xmlBuffer.length),
          'Cache-Control': 'no-store',
        },
      })
    } catch (e: any) {
      console.error('[FACTURAS] error descargando XML:', e)
      return bad(e?.message || 'Error al descargar XML', 502)
    }
  }

  // ── Detalle JSON (default)
  let items: any[] = []
  try {
    items = JSON.parse(inv.itemsJson || '[]')
  } catch {}

  return ok({
    id: inv.id,
    folio: inv.folio,
    uuid: parts[0] || null,
    facturapiId,
    date: inv.date,
    patient: inv.patient,
    clinic: inv.clinic,
    items,
    subtotal: inv.subtotal,
    iva: inv.iva,
    total: inv.total,
    status: inv.status,
    paymentMethod: inv.paymentMethod,
    pdfUrl: facturapiId ? `/api/facturas/${inv.id}?format=pdf` : null,
    xmlUrl: facturapiId ? `/api/facturas/${inv.id}?format=xml` : null,
  })
}

/**
 * PATCH /api/facturas/[id]
 * Body: { action: 'cancel' } → cancela la factura ante el SAT.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)
  if (user!.role === 'RECEPTION') return bad('Solo el Dueño o Súper Dueño pueden cancelar facturas', 403)

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body || body.action !== 'cancel') return bad('Acción inválida')

  const inv = await db.invoice.findUnique({
    where: { id },
    include: { clinic: true },
  })
  if (!inv) return bad('Factura no encontrada', 404)
  if (user!.role !== 'SUPER' && inv.clinicId !== user!.clinicId) return bad('Sin acceso', 403)
  if (inv.status === 'CANCELADA') return bad('La factura ya está cancelada', 400)
  if (inv.status === 'PENDIENTE') {
    await db.invoice.update({ where: { id }, data: { status: 'CANCELADA' } })
    return ok({ id, status: 'CANCELADA' })
  }

  const token = inv.clinic?.facturapiToken?.trim()
  if (!token) {
    await db.invoice.update({ where: { id }, data: { status: 'CANCELADA' } })
    return ok({ id, status: 'CANCELADA' })
  }

  const parts = (inv.uuid || '').split('|')
  const faId = parts.length > 1 ? parts[1] : null
  if (!faId) return bad('No se encontró el ID de FacturAPI para cancelar', 500)

  try {
    await cancelInvoice(token, faId)
    await db.invoice.update({ where: { id }, data: { status: 'CANCELADA' } })
    return ok({ id, status: 'CANCELADA' })
  } catch (e: any) {
    return bad(e?.message || 'Error al cancelar en FacturAPI', 502)
  }
}
