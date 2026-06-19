import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, bad } from '@/lib/api'
import { fmtMoney, fmtDate, fmtDateTime, METHOD_LABELS } from '@/lib/format'

// ============================================================
// MÓDULO 15 — CIERRE Y APERTURA DE SUCURSAL
// GET /api/operaciones/[id]/pdf
// Devuelve HTML para reporte imprimible de cierre.
// 403 si PODOLOGIST
// ============================================================

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)
  const { id } = await ctx.params

  const op = await db.dailyOperation.findUnique({
    where: { id },
    include: { clinic: true },
  })
  if (!op) return bad('Operación no encontrada', 404)
  if (user!.role !== 'SUPER' && op.clinicId !== user!.clinicId) {
    return bad('No tienes acceso a esta operación', 403)
  }

  const summary = op.summaryJson ? safeParse(op.summaryJson) : null
  const ingresosByMethod = summary?.ingresos?.byMethod || {}
  const citas = summary?.citas || {}
  const clinicName = op.clinic?.name || 'CENPOD'
  const clinicPhone = op.clinic?.phone || ''
  const clinicAddress = op.clinic?.address || ''

  const title = op.type === 'CIERRE' ? 'REPORTE DE CIERRE DE SUCURSAL' : 'REPORTE DE APERTURA DE SUCURSAL'

  const diffClass =
    op.difference === null || op.difference === 0
      ? '#0a3143'
      : op.difference > 0
      ? '#15803d'
      : '#b91c1c'

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Reporte ${op.type} - ${fmtDate(op.date)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #111; margin: 0; }
  .report { max-width: 720px; margin: 0 auto; padding: 16px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0a3143; padding-bottom: 12px; margin-bottom: 16px; }
  .header .brand { font-size: 22px; font-weight: 800; color: #0a3143; letter-spacing: -0.3px; }
  .header .clinic { font-size: 13px; color: #444; margin-top: 4px; }
  .header .clinic-meta { font-size: 11px; color: #777; margin-top: 2px; }
  .header .meta { text-align: right; font-size: 12px; color: #555; }
  .title { font-size: 16px; font-weight: 700; text-transform: uppercase; color: #0a3143; margin: 12px 0 16px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
  .card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; background: #fafafa; }
  .card .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; }
  .card .value { font-size: 18px; font-weight: 700; color: #0a3143; margin-top: 2px; }
  .section { margin-top: 16px; }
  .section h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #444; margin: 0 0 6px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  table th, table td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #f0f0f0; }
  table th { font-weight: 600; color: #555; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; }
  table td.r, table th.r { text-align: right; font-variant-numeric: tabular-nums; }
  .totals { margin-top: 12px; background: #0a3143; color: #fff; border-radius: 6px; padding: 12px 16px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .totals .lbl { font-size: 10px; text-transform: uppercase; opacity: 0.8; }
  .totals .val { font-size: 18px; font-weight: 700; margin-top: 2px; }
  .signature { margin-top: 36px; display: grid; grid-template-columns: 1fr 1fr; gap: 36px; }
  .signature .line { border-top: 1.5px solid #333; padding-top: 6px; font-size: 11px; color: #555; text-align: center; }
  .incidencias { margin-top: 14px; border: 1px dashed #ccc; border-radius: 6px; padding: 10px; min-height: 40px; background: #fffbf5; font-size: 12px; color: #444; white-space: pre-wrap; }
  .footer { margin-top: 28px; border-top: 1px solid #eee; padding-top: 8px; font-size: 10px; color: #888; text-align: center; }
  @media print {
    .no-print { display: none !important; }
    .report { padding: 0; }
  }
</style>
</head>
<body>
<div class="report">
  <div class="header">
    <div>
      <div class="brand">${escapeHtml(clinicName)}</div>
      <div class="clinic">Reporte de operación diaria</div>
      ${clinicAddress ? `<div class="clinic-meta">${escapeHtml(clinicAddress)}</div>` : ''}
      ${clinicPhone ? `<div class="clinic-meta">Tel. ${escapeHtml(clinicPhone)}</div>` : ''}
    </div>
    <div class="meta">
      <div><strong>Fecha:</strong> ${fmtDate(op.date)}</div>
      <div><strong>Hora:</strong> ${fmtDateTime(op.createdAt).split(' ')[1]}</div>
      <div><strong>Responsable:</strong> ${escapeHtml(op.performedBy || '—')}</div>
      <div><strong>Tipo:</strong> ${op.type === 'CIERRE' ? 'Cierre' : 'Apertura'}</div>
    </div>
  </div>

  <div class="title">${title}</div>

  <div class="grid">
    <div class="card">
      <div class="label">Fondo de apertura</div>
      <div class="value">${fmtMoney(op.openingFund ?? 0)}</div>
    </div>
    <div class="card">
      <div class="label">Citas atendidas</div>
      <div class="value">${(citas.atendidas as number) ?? 0} <span style="font-size:11px;color:#666;font-weight:400">/ ${citas.total ?? 0}</span></div>
    </div>
  </div>

  <div class="section">
    <h3>Resumen de citas del día</h3>
    <table>
      <tr><th>Total citas</th><td class="r">${citas.total ?? 0}</td></tr>
      <tr><th>Atendidas (FINALIZADA)</th><td class="r">${citas.atendidas ?? 0}</td></tr>
      <tr><th>Canceladas</th><td class="r">${citas.canceladas ?? 0}</td></tr>
      <tr><th>No asistió</th><td class="r">${citas.noAsistio ?? 0}</td></tr>
      <tr><th>Pendientes</th><td class="r">${citas.pendientes ?? 0}</td></tr>
    </table>
  </div>

  <div class="section">
    <h3>Ingresos por método</h3>
    <table>
      <thead>
        <tr><th>Método</th><th class="r">Monto</th></tr>
      </thead>
      <tbody>
        ${Object.entries(ingresosByMethod)
          .filter(([, v]) => (v as number) > 0)
          .map(
            ([k, v]) =>
              `<tr><td>${METHOD_LABELS[k as keyof typeof METHOD_LABELS] || k}</td><td class="r">${fmtMoney(v as number)}</td></tr>`,
          )
          .join('') || '<tr><td colspan="2" style="color:#999">Sin ingresos</td></tr>'}
      </tbody>
      <tfoot>
        <tr><th>Total ingresos</th><td class="r">${fmtMoney(summary?.ingresos?.total ?? 0)}</td></tr>
      </tfoot>
    </table>
  </div>

  ${
    (summary as any)?.totalConsulta !== undefined || (summary as any)?.totalProductos !== undefined
      ? `
  <div class="section">
    <h3>Desglose por concepto</h3>
    <table>
      <thead>
        <tr><th>Concepto</th><th class="r">Monto</th></tr>
      </thead>
      <tbody>
        <tr><td>Total de consultas</td><td class="r">${fmtMoney((summary as any)?.totalConsulta ?? 0)}</td></tr>
        <tr><td>Total medicamentos/productos</td><td class="r">${fmtMoney((summary as any)?.totalProductos ?? 0)}</td></tr>
      </tbody>
      <tfoot>
        <tr><th>Total del día</th><td class="r">${fmtMoney(summary?.ingresos?.total ?? 0)}</td></tr>
      </tfoot>
    </table>
  </div>
  `
      : ''
  }

  ${
    Array.isArray((summary as any)?.byPodologo) && (summary as any).byPodologo.length > 0
      ? `
  <div class="section">
    <h3>Ingreso bruto por podólogo (sin descontar comisión)</h3>
    <table>
      <thead>
        <tr><th>Podólogo</th><th class="r">Consultas</th><th class="r">Ingreso bruto</th></tr>
      </thead>
      <tbody>
        ${(summary as any).byPodologo
          .map(
            (p: any) =>
              `<tr><td>${escapeHtml(p.name)}</td><td class="r">${p.consultas}</td><td class="r">${fmtMoney(p.total)}</td></tr>`,
          )
          .join('')}
      </tbody>
      <tfoot>
        <tr><th>Total</th><th class="r">${(summary as any).byPodologo.reduce((s: number, p: any) => s + p.consultas, 0)}</th><th class="r">${fmtMoney(
          (summary as any).byPodologo.reduce((s: number, p: any) => s + p.total, 0),
        )}</th></tr>
      </tfoot>
    </table>
  </div>
  `
      : ''
  }

  ${
    op.type === 'CIERRE'
      ? `
  <div class="totals">
    <div>
      <div class="lbl">Efectivo contado</div>
      <div class="val">${fmtMoney(op.closingCounted ?? 0)}</div>
    </div>
    <div>
      <div class="lbl">Efectivo esperado</div>
      <div class="val">${fmtMoney(op.closingExpected ?? 0)}</div>
    </div>
    <div>
      <div class="lbl">Diferencia</div>
      <div class="val" style="color:${diffClass === '#0a3143' ? '#fff' : diffClass === '#15803d' ? '#86efac' : '#fca5a5'}">${(op.difference ?? 0) >= 0 ? '+' : ''}${fmtMoney(op.difference ?? 0)}</div>
    </div>
  </div>

  <div class="section">
    <h3>Incidencias / Notas</h3>
    <div class="incidencias">${op.notes ? escapeHtml(op.notes) : 'Sin incidencias reportadas.'}</div>
  </div>

  <div class="signature">
    <div>
      <div class="line">Firma del responsable<br/>${escapeHtml(op.performedBy || '—')}</div>
    </div>
    <div>
      <div class="line">Firma del dueño / supervisor</div>
    </div>
  </div>

  ${
    op.signatureData
      ? `<div class="section"><h3>Firma capturada</h3><img src="${op.signatureData}" alt="firma" style="max-height:120px;border:1px solid #eee;border-radius:6px;padding:4px;background:#fff;" /></div>`
      : ''
  }
  `
      : ''
  }

  <div class="footer">
    Reporte generado el ${fmtDateTime(new Date())} · Sistema CENPOD
  </div>

  <div class="no-print" style="margin-top:24px;text-align:center;">
    <button onclick="window.print()" style="background:#0a3143;color:#fff;border:none;padding:10px 24px;font-size:14px;border-radius:6px;cursor:pointer;">Imprimir / Guardar PDF</button>
  </div>
</div>
</body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function safeParse(s: string): any {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
