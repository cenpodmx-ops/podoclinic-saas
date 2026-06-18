import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { cancelInvoice } from '@/lib/facturapi'

/**
 * GET /api/facturas/[id]
 * Devuelve el detalle de una factura.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const { id } = await params
  const inv = await db.invoice.findUnique({
    where: { id },
    include: { patient: true, clinic: true },
  })
  if (!inv) return bad('Factura no encontrada', 404)
  if (user!.role !== 'SUPER' && inv.clinicId !== user!.clinicId) return bad('Sin acceso', 403)

  // Parsear items
  let items: any[] = []
  try {
    items = JSON.parse(inv.itemsJson || '[]')
  } catch {}

  // Parsear facturapiId del uuid (formato: "sat_uuid|fa_id")
  const parts = (inv.uuid || '').split('|')
  const facturapiId = parts.length > 1 ? parts[1] : null

  return ok({
    id: inv.id,
    folio: inv.folio,
    uuid: parts[0] || null, // UUID SAT
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
    pdfUrl: facturapiId ? `/api/facturas/${inv.id}/pdf?faId=${facturapiId}` : inv.pdfUrl,
    xmlUrl: facturapiId ? `/api/facturas/${inv.id}/xml?faId=${facturapiId}` : inv.xmlUrl,
  })
}

/**
 * PATCH /api/facturas/[id]
 * Body: { action: 'cancel' } → cancela la factura ante el SAT vía FacturAPI.
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
    // Simulada — simplemente marcar
    await db.invoice.update({ where: { id }, data: { status: 'CANCELADA' } })
    return ok({ id, status: 'CANCELADA' })
  }

  // Factura timbrada — cancelar en FacturAPI usando la API key de la sucursal
  const token = inv.clinic?.facturapiToken?.trim()
  if (!token) {
    await db.invoice.update({ where: { id }, data: { status: 'CANCELADA' } })
    return ok({ id, status: 'CANCELADA' })
  }

  // El uuid se guardó como "sat_uuid|fa_id"
  const parts = (inv.uuid || '').split('|')
  const faId = parts.length > 1 ? parts[1] : null
  if (!faId) {
    return bad('No se encontró el ID de FacturAPI para cancelar', 500)
  }

  try {
    await cancelInvoice(token, faId)
    await db.invoice.update({ where: { id }, data: { status: 'CANCELADA' } })
    return ok({ id, status: 'CANCELADA' })
  } catch (e: any) {
    return bad(e?.message || 'Error al cancelar en FacturAPI', 502)
  }
}
