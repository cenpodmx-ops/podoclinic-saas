import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { cancelFacturapiInvoice } from '@/lib/facturapi'
import type { InvoiceItem, InvoiceStatus } from '@/lib/invoice-types'

// ============================================================
// MÓDULO 04 — FACTURACIÓN
// GET    /api/facturas/[id]  → detalle completo
// PATCH  /api/facturas/[id]  → { action: 'cancel' } cancela la factura
// ============================================================

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)
  const { id } = await ctx.params

  const inv = await db.invoice.findUnique({
    where: { id },
    include: {
      patient: {
        select: {
          id: true, firstName: true, lastName: true, expNumber: true,
          rfc: true, razonSocial: true, regimenFiscal: true, cfdiUso: true,
          emailFactura: true, email: true, phone: true,
        },
      },
      clinic: {
        select: { id: true, name: true, rfc: true, razonSocial: true, regimenFiscal: true, address: true, phone: true, email: true, logoUrl: true },
      },
    },
  })

  if (!inv) return bad('Factura no encontrada', 404)
  if (user!.role !== 'SUPER' && inv.clinicId !== user!.clinicId) {
    return bad('Sin acceso a esta factura', 403)
  }

  let items: InvoiceItem[] = []
  try {
    items = JSON.parse(inv.itemsJson) as InvoiceItem[]
  } catch {}

  return ok({
    id: inv.id,
    folio: inv.folio,
    uuid: inv.uuid,
    date: inv.date,
    patientId: inv.patientId,
    patient: inv.patient,
    clinic: inv.clinic,
    itemsJson: inv.itemsJson,
    items,
    subtotal: inv.subtotal,
    iva: inv.iva,
    total: inv.total,
    status: inv.status as InvoiceStatus,
    paymentMethod: inv.paymentMethod,
    pdfUrl: inv.pdfUrl,
    xmlUrl: inv.xmlUrl,
    consultationId: inv.consultationId,
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt,
  })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  // Solo OWNER/SUPER pueden cancelar
  if (user!.role !== 'SUPER' && user!.role !== 'OWNER') {
    return bad('Solo el dueño puede cancelar facturas', 403)
  }
  const { id } = await ctx.params

  const body = await req.json().catch(() => null)
  if (!body || body.action !== 'cancel') {
    return bad('Acción inválida. Use { action: "cancel" }')
  }

  const inv = await db.invoice.findUnique({ where: { id }, include: { clinic: true } })
  if (!inv) return bad('Factura no encontrada', 404)
  if (user!.role !== 'SUPER' && inv.clinicId !== user!.clinicId) {
    return bad('Sin acceso a esta factura', 403)
  }
  if (inv.status === 'CANCELADA') return bad('La factura ya está cancelada', 409)
  if (inv.status === 'PENDIENTE') {
    // Simulada — simplemente marcar
    await db.invoice.update({ where: { id }, data: { status: 'CANCELADA' } })
    return ok({ id, status: 'CANCELADA' })
  }

  // Factura timbrada — cancelar en FacturAPI
  const token = inv.clinic?.facturapiToken?.trim()
  if (!token) {
    // No debería pasar, pero por si acaso
    await db.invoice.update({ where: { id }, data: { status: 'CANCELADA' } })
    return ok({ id, status: 'CANCELADA' })
  }

  // El uuid se guardó como "sat_uuid|fa_id"
  const parts = (inv.uuid || '').split('|')
  const faId = parts.length > 1 ? parts[1] : null
  if (!faId) {
    return bad('No se encontró el ID de FacturAPI para cancelar', 500)
  }

  const motive = (body.motive || '02') as '01' | '02' | '03' | '04'
  try {
    await cancelFacturapiInvoice(token, faId, motive)
  } catch (e: any) {
    return bad(e?.message || 'Error al cancelar en FacturAPI', 502)
  }

  await db.invoice.update({ where: { id }, data: { status: 'CANCELADA' } })

  return ok({ id, status: 'CANCELADA' })
}
