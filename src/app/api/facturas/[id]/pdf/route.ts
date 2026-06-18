import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, bad } from '@/lib/api'
import { format } from 'date-fns'
import type { InvoiceItem, InvoiceStatus, IvaType, ItemType } from '@/lib/invoice-types'

// ============================================================
// MÓDULO 04 — FACTURACIÓN
// GET /api/facturas/[id]/pdf
//   - Si la factura está timbrada y tiene pdfUrl → 302 redirect a la URL firmada.
//   - Si está en modo simulación → devuelve HTML imprimible (vía ?html=1
//     explícito o automáticamente cuando no hay pdfUrl).
// ============================================================

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)
  const { id } = await ctx.params

  const inv = await db.invoice.findUnique({
    where: { id },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, expNumber: true, rfc: true, razonSocial: true, regimenFiscal: true, cfdiUso: true, emailFactura: true, email: true, phone: true } },
      clinic: { select: { id: true, name: true, rfc: true, razonSocial: true, regimenFiscal: true, address: true, phone: true, email: true, logoUrl: true, facturapiToken: true } },
    },
  })
  if (!inv) return bad('Factura no encontrada', 404)
  if (user!.role !== 'SUPER' && inv.clinicId !== user!.clinicId) {
    return bad('Sin acceso a esta factura', 403)
  }

  // Si la factura está timbrada y tiene URL de PDF firmada → redirigir
  const forceHtml = req.nextUrl.searchParams.get('html') === '1'
  if (!forceHtml && inv.status === 'TIMBRADA' && inv.pdfUrl) {
    return new Response(null, {
      status: 302,
      headers: { Location: inv.pdfUrl },
    })
  }

  // Generar HTML imprimible (simulación o vista previa)
  let items: InvoiceItem[] = []
  try {
    items = JSON.parse(inv.itemsJson) as InvoiceItem[]
  } catch {}

  const html = buildInvoiceHtml({
    clinic: inv.clinic,
    patient: inv.patient,
    items,
    subtotal: inv.subtotal,
    iva: inv.iva,
    total: inv.total,
    folio: inv.folio || '—',
    uuid: inv.uuid || '',
    date: inv.date,
    status: inv.status as InvoiceStatus,
    paymentMethod: inv.paymentMethod,
    simulated: !inv.clinic?.facturapiToken || inv.status !== 'TIMBRADA',
  })

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

// ──────────────────────────────────────────────────────────
// Generador de HTML imprimible
// ──────────────────────────────────────────────────────────

function buildInvoiceHtml(opts: {
  clinic: any
  patient: any
  items: InvoiceItem[]
  subtotal: number
  iva: number
  total: number
  folio: string
  uuid: string
  date: Date
  status: InvoiceStatus
  paymentMethod: string | null
  simulated: boolean
}): string {
  const { clinic, patient, items, subtotal, iva, total, folio, uuid, date, status, paymentMethod, simulated } = opts
  const pacienteNombre = patient
    ? `${patient.firstName} ${patient.lastName}`
    : 'Paciente público general'
  const rfc = patient?.rfc || 'XAXX010101000'
  const razonSocial = patient?.razonSocial || pacienteNombre
  const regimenFiscal = patient?.regimenFiscal || '616'
  const cfdiUso = patient?.cfdiUso || 'G03'
  const emailFactura = patient?.emailFactura || patient?.email || ''
  const clinicRfc = clinic?.rfc || ''
  const clinicRazon = clinic?.razonSocial || clinic?.name || ''
  const clinicRegimen = clinic?.regimenFiscal || ''

  // Desglose IVA por tasa
  const byTasa: Record<string, { base: number; iva: number; label: string }> = {
    IVA16: { base: 0, iva: 0, label: 'IVA 16%' },
    IVA0: { base: 0, iva: 0, label: 'IVA 0%' },
    EXENTO: { base: 0, iva: 0, label: 'Exento' },
  }
  for (const it of items) {
    const tasa = it.ivaType as IvaType
    if (!byTasa[tasa]) continue
    const base = it.qty * it.price
    byTasa[tasa].base += base
    byTasa[tasa].iva += tasa === 'IVA16' ? base * 0.16 : 0
  }

  // SAT uuid (limpiar sufijo |fa_id)
  const satUuid = uuid ? uuid.split('|')[0] : ''

  const rows = items
    .map((it) => {
      const amount = it.qty * it.price
      const unitIva = it.ivaType === 'IVA16' ? it.price * 0.16 : 0
      return `
        <tr>
          <td class="clave">${PRODUCT_KEYS[it.type] || '41111501'}</td>
          <td>${escapeHtml(it.name)}</td>
          <td class="num">${it.qty}</td>
          <td class="clave">${it.ivaType === 'IVA16' ? '16' : it.ivaType === 'IVA0' ? '0' : 'Exento'}</td>
          <td class="num">$${money(it.price)}</td>
          <td class="num">$${money(unitIva)}</td>
          <td class="num">$${money(amount + (it.ivaType === 'IVA16' ? unitIva * it.qty : 0))}</td>
        </tr>`
    })
    .join('')

  const desgloseRows = Object.values(byTasa)
    .map((b) => `
      <tr>
        <td>${b.label}</td>
        <td class="num">$${money(b.base)}</td>
        <td class="num">$${money(b.iva)}</td>
      </tr>`)
    .join('')

  const logoHtml = clinic?.logoUrl
    ? `<img src="${escapeHtml(clinic.logoUrl)}" alt="${escapeHtml(clinic.name)}" />`
    : `<div class="brand-text">${escapeHtml(clinic?.name || 'CENPOD')}</div>`

  const statusLabel = status === 'TIMBRADA' ? 'TIMBRADA' : status === 'CANCELADA' ? 'CANCELADA' : 'BORRADOR / SIMULACIÓN'
  const watermark = status === 'CANCELADA' ? '<div class="watermark">CANCELADA</div>' : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Factura ${escapeHtml(folio)} — ${escapeHtml(clinic?.name || 'CENPOD')}</title>
<style>
  @page { size: letter; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #0a3143; margin: 0; padding: 18px; font-size: 12px; }
  .factura { max-width: 760px; margin: 0 auto; position: relative; }
  .watermark { position: absolute; top: 40%; left: 0; right: 0; text-align: center; font-size: 80px; color: rgba(220, 38, 38, 0.18); transform: rotate(-30deg); pointer-events: none; z-index: 0; font-weight: 900; letter-spacing: 8px; }
  .header { display: flex; justify-content: space-between; gap: 16px; padding-bottom: 14px; border-bottom: 2px solid #0a3143; margin-bottom: 14px; position: relative; z-index: 1; }
  .header .emisor { display: flex; gap: 14px; align-items: flex-start; }
  .header .emisor img { max-height: 70px; max-width: 200px; }
  .header .brand-text { font-size: 22px; font-weight: 800; color: #0a3143; }
  .header .emisor-info { font-size: 10.5px; line-height: 1.4; color: #475569; margin-top: 4px; }
  .header .doc { text-align: right; }
  .header .doc .tipo { font-size: 18px; font-weight: 800; letter-spacing: 1px; color: #0a3143; }
  .header .doc .folio { font-size: 13px; margin-top: 2px; }
  .header .doc .badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 10px; font-weight: 700; margin-top: 6px; letter-spacing: 0.5px; }
  .badge-timbrada { background: #dcfce7; color: #166534; }
  .badge-cancelada { background: #fee2e2; color: #991b1b; }
  .badge-pendiente { background: #fef3c7; color: #92400e; }
  .badge-simulacion { background: #f1f5f9; color: #475569; }

  .partes { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; position: relative; z-index: 1; }
  .parte { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; font-size: 10.5px; }
  .parte h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px 0; color: #64748b; }
  .parte .row { display: flex; justify-content: space-between; gap: 6px; padding: 1px 0; }
  .parte .row .k { color: #64748b; }
  .parte .row .v { font-weight: 600; text-align: right; }

  table.items { width: 100%; border-collapse: collapse; margin-bottom: 14px; position: relative; z-index: 1; }
  table.items th { background: #0a3143; color: #fff; padding: 6px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
  table.items td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; vertical-align: top; }
  table.items td.num, table.items th.num { text-align: right; }
  table.items td.clave, table.items th.clave { text-align: center; font-family: ui-monospace, monospace; font-size: 10px; color: #475569; }
  table.items tr:nth-child(even) td { background: #f8fafc; }

  .footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 14px; position: relative; z-index: 1; }
  .desglose { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; }
  .desglose h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px 0; color: #64748b; }
  .desglose table { width: 100%; border-collapse: collapse; }
  .desglose td { padding: 3px 4px; font-size: 11px; }
  .desglose td.num { text-align: right; }

  .totales { border: 2px solid #0a3143; border-radius: 6px; padding: 10px 12px; }
  .totales .row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; }
  .totales .row.total { border-top: 1px solid #cbd5e1; margin-top: 4px; padding-top: 7px; font-size: 15px; font-weight: 800; color: #0a3143; }

  .sat-info { margin-top: 16px; padding-top: 12px; border-top: 1px dashed #cbd5e1; font-size: 9.5px; color: #64748b; position: relative; z-index: 1; }
  .sat-info .uuid-box { background: #f1f5f9; padding: 6px 8px; border-radius: 4px; font-family: ui-monospace, monospace; word-break: break-all; margin-top: 4px; color: #0a3143; }

  .simulacion-banner { background: #fef3c7; border: 1px solid #fbbf24; color: #92400e; padding: 8px 12px; border-radius: 6px; font-size: 11px; margin-bottom: 14px; text-align: center; font-weight: 600; position: relative; z-index: 1; }

  .acciones { display: flex; gap: 8px; justify-content: flex-end; margin-top: 18px; position: relative; z-index: 1; }
  .acciones button { background: #0a3143; color: #fff; border: none; padding: 8px 16px; border-radius: 5px; font-size: 12px; font-weight: 600; cursor: pointer; }
  .acciones button.secondary { background: #fff; color: #0a3143; border: 1px solid #0a3143; }
  .acciones button:hover { opacity: 0.9; }

  @media print {
    body { padding: 0; font-size: 11px; }
    .acciones, .no-print { display: none !important; }
  }
</style>
</head>
<body>
  <div class="factura">
    ${watermark}
    ${simulated ? '<div class="simulacion-banner">⚠ MODO SIMULACIÓN — Esta no es una factura fiscal válida ante el SAT. Configure el token FacturAPI para timbrar.</div>' : ''}

    <div class="header">
      <div class="emisor">
        ${logoHtml}
        <div class="emisor-info">
          <div style="font-weight: 700; font-size: 13px; color: #0a3143;">${escapeHtml(clinicRazon || clinic?.name || '')}</div>
          ${clinicRfc ? `<div>RFC: <strong>${escapeHtml(clinicRfc)}</strong></div>` : ''}
          ${clinicRegimen ? `<div>Régimen: ${escapeHtml(clinicRegimen)}</div>` : ''}
          ${clinic?.address ? `<div>${escapeHtml(clinic.address)}</div>` : ''}
          ${clinic?.phone ? `<div>Tel: ${escapeHtml(clinic.phone)}</div>` : ''}
          ${clinic?.email ? `<div>${escapeHtml(clinic.email)}</div>` : ''}
        </div>
      </div>
      <div class="doc">
        <div class="tipo">FACTURA</div>
        <div class="folio">Folio: <strong>${escapeHtml(folio)}</strong></div>
        <div style="margin-top: 4px; font-size: 11px;">${format(date, 'dd/MM/yyyy HH:mm')}</div>
        <div class="badge ${status === 'TIMBRADA' ? 'badge-timbrada' : status === 'CANCELADA' ? 'badge-cancelada' : 'badge-pendiente'}">${statusLabel}</div>
        ${simulated ? '<div class="badge badge-simulacion" style="margin-top: 4px;">SIMULACIÓN</div>' : ''}
      </div>
    </div>

    <div class="partes">
      <div class="parte">
        <h3>Receptor</h3>
        <div class="row"><span class="k">Nombre / Razón social:</span><span class="v">${escapeHtml(razonSocial)}</span></div>
        <div class="row"><span class="k">RFC:</span><span class="v">${escapeHtml(rfc)}</span></div>
        ${regimenFiscal ? `<div class="row"><span class="k">Régimen fiscal:</span><span class="v">${escapeHtml(regimenFiscal)}</span></div>` : ''}
        <div class="row"><span class="k">Uso CFDI:</span><span class="v">${escapeHtml(cfdiUso)}</span></div>
        ${emailFactura ? `<div class="row"><span class="k">Email:</span><span class="v">${escapeHtml(emailFactura)}</span></div>` : ''}
      </div>
      <div class="parte">
        <h3>Detalles del comprobante</h3>
        <div class="row"><span class="k">Tipo:</span><span class="v">I — Ingreso</span></div>
        <div class="row"><span class="k">Versión:</span><span class="v">4.0</span></div>
        <div class="row"><span class="k">Moneda:</span><span class="v">MXN</span></div>
        <div class="row"><span class="k">Forma de pago:</span><span class="v">${escapeHtml(paymentMethod || '01')}</span></div>
        <div class="row"><span class="k">Método de pago:</span><span class="v">PUE — Pago en una sola exhibición</span></div>
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th class="clave">Clave</th>
          <th>Descripción</th>
          <th class="num">Cant.</th>
          <th class="clave">IVA</th>
          <th class="num">Precio unit.</th>
          <th class="num">IVA unit.</th>
          <th class="num">Importe</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:12px;">Sin items</td></tr>'}
      </tbody>
    </table>

    <div class="footer-grid">
      <div class="desglose">
        <h3>Desglose de impuestos</h3>
        <table>
          <thead>
            <tr><th>Tasa</th><th class="num">Base</th><th class="num">Impuesto</th></tr>
          </thead>
          <tbody>
            ${desgloseRows}
          </tbody>
        </table>
      </div>
      <div class="totales">
        <div class="row"><span>Subtotal:</span><span>$${money(subtotal)}</span></div>
        <div class="row"><span>IVA (16%):</span><span>$${money(iva)}</span></div>
        <div class="row total"><span>TOTAL:</span><span>$${money(total)} MXN</span></div>
      </div>
    </div>

    ${
      satUuid
        ? `<div class="sat-info">
            <div><strong>UUID SAT:</strong></div>
            <div class="uuid-box">${escapeHtml(satUuid)}</div>
            <div style="margin-top: 6px;">Este documento es una representación impresa de un CFDI 4.0 emitido vía FacturAPI.</div>
          </div>`
        : ''
    }

    <div class="acciones no-print">
      <button onClick="window.print()">Imprimir</button>
      <button class="secondary" onClick="window.close()">Cerrar</button>
    </div>
  </div>
</body>
</html>`
}

const PRODUCT_KEYS: Record<ItemType, string> = {
  SERVICIO: '82111501',
  MEDICAMENTO: '61102201',
  PRODUCTO: '41111501',
}

function money(n: number): string {
  return new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)
}

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
