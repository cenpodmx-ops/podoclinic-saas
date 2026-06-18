import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, bad } from '@/lib/api'
import { format } from 'date-fns'

// ============================================================
// MÓDULO 05 — RECETAS / [id] / print
// GET → HTML completo y standalone para abrir en ventana nueva y
//       llamar window.print(). El diseño se toma de
//       ClinicConfig.prescriptionDesign (JSON) con defaults limpios.
// ============================================================

type Medication = {
  name: string
  dose?: string
  via?: string
  duration?: string
  productId?: string
}

type PrescriptionDesign = {
  logoPosition?: 'left' | 'center' | 'right'
  logoUrl?: string | 'auto' | 'none'
  fontFamily?: string
  primaryColor?: string
  accentColor?: string
  showHeader?: boolean
  showFooter?: boolean
  showRxSymbol?: boolean
  signatureLabel?: string
  paperSize?: 'A4' | 'Letter'
  fontSize?: number
}

const DEFAULT_DESIGN: PrescriptionDesign = {
  logoPosition: 'left',
  logoUrl: 'auto',
  fontFamily: "'Times New Roman', Georgia, serif",
  primaryColor: '#0a3143',
  accentColor: '#0a3143',
  showHeader: true,
  showFooter: true,
  showRxSymbol: true,
  signatureLabel: 'Cédula profesional',
  paperSize: 'A4',
  fontSize: 13,
}

function safeParseMeds(s: string | null | undefined): Medication[] {
  if (!s) return []
  try {
    return JSON.parse(s) as Medication[]
  } catch {
    return []
  }
}

function parseDesign(s: string | null | undefined): PrescriptionDesign {
  if (!s) return DEFAULT_DESIGN
  try {
    const parsed = JSON.parse(s) as Partial<PrescriptionDesign>
    return { ...DEFAULT_DESIGN, ...parsed }
  } catch {
    return DEFAULT_DESIGN
  }
}

function calcAge(birthDate: Date | string | null): number | null {
  if (!birthDate) return null
  const d = typeof birthDate === 'string' ? new Date(birthDate) : birthDate
  if (isNaN(d.getTime())) return null
  const diff = Date.now() - d.getTime()
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000))
}

function esc(s: string | null | undefined): string {
  if (!s) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escMultiline(s: string | null | undefined): string {
  return esc(s).replace(/\n/g, '<br/>')
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') {
    return new Response('Acceso denegado', { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }

  const { id } = await ctx.params
  const rx = await db.prescription.findUnique({
    where: { id },
    include: {
      patient: {
        select: {
          id: true, firstName: true, lastName: true, expNumber: true,
          birthDate: true, sex: true, phone: true, address: true,
        },
      },
      podologist: {
        select: { id: true, name: true, specialty: true, cedula: true, certNumber: true },
      },
    },
  })
  if (!rx) {
    return new Response('Receta no encontrada', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }

  // Cross-clinic guard
  if (user!.role !== 'SUPER' && rx.clinicId !== user!.clinicId) {
    return new Response('No tienes acceso a esta receta', { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }

  // Prescription has clinicId but no `clinic` relation in schema — fetch separately.
  const [clinic, cfg] = await Promise.all([
    db.clinic.findUnique({
      where: { id: rx.clinicId },
      select: {
        id: true, name: true, address: true, phone: true, email: true,
        logoUrl: true, rfc: true, razonSocial: true,
      },
    }),
    db.clinicConfig.findUnique({
      where: { clinicId: rx.clinicId },
      select: { prescriptionDesign: true },
    }),
  ])

  const design = parseDesign(cfg?.prescriptionDesign)
  const meds = safeParseMeds(rx.medicationsJson)
  const age = calcAge(rx.patient?.birthDate ?? null)

  // Logo: 'auto' uses clinic.logoUrl; explicit URL overrides; 'none' hides
  let logoUrl = ''
  if (design.logoUrl === 'none') {
    logoUrl = ''
  } else if (design.logoUrl && design.logoUrl !== 'auto') {
    logoUrl = design.logoUrl
  } else if (clinic?.logoUrl) {
    logoUrl = clinic.logoUrl
  }

  // Convert relative URLs to absolute (needed for new window)
  if (logoUrl && logoUrl.startsWith('/')) {
    // We can't easily get host here; emit as-is, browsers in same origin resolve it.
  }

  const patientName = rx.patient ? `${rx.patient.firstName} ${rx.patient.lastName}` : '—'
  const podName = rx.podologist?.name || '—'
  const podCed = rx.podologist?.cedula || ''
  const podSpec = rx.podologist?.specialty || ''
  const podCert = rx.podologist?.certNumber || ''

  const align = design.logoPosition || 'left'
  const fontFamily = design.fontFamily || DEFAULT_DESIGN.fontFamily!
  const primary = design.primaryColor || DEFAULT_DESIGN.primaryColor!
  const accent = design.accentColor || primary
  const fontSize = design.fontSize || DEFAULT_DESIGN.fontSize!
  const paperSize = design.paperSize || 'A4'
  const showHeader = design.showHeader !== false
  const showFooter = design.showFooter !== false
  const showRx = design.showRxSymbol !== false
  const sigLabel = design.signatureLabel || 'Cédula profesional'

  const todayStr = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: undefined })
  const rxDateStr = format(new Date(rx.date), "dd/MM/yyyy")

  const logoHtml = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="logo" class="rx-logo"/>`
    : ''

  const headerInner = `
    <div class="rx-header-inner" style="text-align:${align};">
      ${logoHtml}
      <div class="rx-clinic-info">
        <div class="rx-clinic-name" style="color:${primary};">${esc(clinic?.name)}</div>
        ${clinic?.razonSocial ? `<div class="rx-clinic-sub">${esc(clinic.razonSocial)}</div>` : ''}
        ${clinic?.address ? `<div class="rx-clinic-line">${esc(clinic.address)}</div>` : ''}
        <div class="rx-clinic-line">
          ${clinic?.phone ? `Tel. ${esc(clinic.phone)}` : ''}
          ${clinic?.phone && clinic?.email ? ' · ' : ''}
          ${clinic?.email ? esc(clinic.email) : ''}
        </div>
        ${clinic?.rfc ? `<div class="rx-clinic-line">RFC: ${esc(clinic.rfc)}</div>` : ''}
      </div>
    </div>
  `

  const diagnosisHtml = rx.diagnosis
    ? `<div class="rx-section"><div class="rx-section-title" style="color:${primary};">Diagnóstico</div><div class="rx-section-body">${escMultiline(rx.diagnosis)}</div></div>`
    : ''

  // Medications table — clean grid
  const medsRowsHtml = meds.length === 0
    ? `<tr><td colspan="4" class="rx-empty">Sin medicamentos registrados.</td></tr>`
    : meds.map((m, i) => `
      <tr>
        <td class="rx-num">${i + 1}</td>
        <td class="rx-med-name">${esc(m.name)}</td>
        <td>${esc(m.dose) || '—'}</td>
        <td>${esc(m.via) || '—'}</td>
        <td>${esc(m.duration) || '—'}</td>
      </tr>
    `).join('')

  const medsHtml = `
    <div class="rx-section">
      <div class="rx-section-title" style="color:${primary};">℞ Prescripción</div>
      <table class="rx-meds-table">
        <thead>
          <tr style="background:${accent}1A;">
            <th class="rx-num">#</th>
            <th>Medicamento</th>
            <th>Dosis</th>
            <th>Vía</th>
            <th>Duración</th>
          </tr>
        </thead>
        <tbody>${medsRowsHtml}</tbody>
      </table>
    </div>
  `

  const indicationsHtml = rx.indications
    ? `<div class="rx-section"><div class="rx-section-title" style="color:${primary};">Indicaciones generales</div><div class="rx-section-body rx-indications">${escMultiline(rx.indications)}</div></div>`
    : ''

  const signatureHtml = `
    <div class="rx-signature">
      <div class="rx-sig-line"></div>
      <div class="rx-sig-name">${esc(podName)}</div>
      <div class="rx-sig-meta">
        ${podSpec ? esc(podSpec) : 'Podología'}
        ${podCed ? ` · Cédula: ${esc(podCed)}` : ''}
        ${podCert ? ` · Cert: ${esc(podCert)}` : ''}
      </div>
      <div class="rx-sig-label">${esc(sigLabel)}</div>
    </div>
  `

  const footerHtml = showFooter ? `
    <div class="rx-footer">
      <div>${esc(clinic?.name)} · Receta ${esc(rx.id.slice(-8).toUpperCase())}</div>
      <div>Generada el ${esc(todayStr)}</div>
    </div>
  ` : ''

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Receta — ${esc(patientName)} · ${esc(rxDateStr)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: ${fontFamily};
    color: #111;
    background: #f4f4f4;
    font-size: ${fontSize}px;
    line-height: 1.5;
  }
  .rx-sheet {
    width: ${paperSize === 'Letter' ? '216mm' : '210mm'};
    min-height: ${paperSize === 'Letter' ? '279mm' : '297mm'};
    margin: 16px auto;
    padding: 18mm 16mm 14mm;
    background: #fff;
    box-shadow: 0 4px 18px rgba(0,0,0,.08);
    position: relative;
  }
  .rx-header {
    border-bottom: 2.5px solid ${primary};
    padding-bottom: 10px;
    margin-bottom: 14px;
  }
  .rx-header-inner {
    display: flex;
    align-items: center;
    gap: 18px;
  }
  .rx-header-inner[style*="text-align:center"] {
    flex-direction: column;
    text-align: center;
  }
  .rx-header-inner[style*="text-align:right"] {
    flex-direction: row-reverse;
    text-align: right;
  }
  .rx-logo {
    max-height: 78px;
    max-width: 180px;
    object-fit: contain;
  }
  .rx-clinic-name {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 0.04em;
    line-height: 1.15;
  }
  .rx-clinic-sub {
    font-size: 12px;
    color: #555;
    margin-top: 2px;
  }
  .rx-clinic-line {
    font-size: 11.5px;
    color: #666;
    margin-top: 1px;
  }
  .rx-title-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 10px;
  }
  .rx-title {
    font-size: 20px;
    font-weight: 700;
    color: ${primary};
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .rx-folio {
    font-size: 11px;
    color: #888;
    font-family: 'Courier New', monospace;
  }
  .rx-meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 18px;
    padding: 10px 12px;
    background: ${accent}0F;
    border-left: 3px solid ${primary};
    border-radius: 4px;
    margin-bottom: 14px;
    font-size: 12.5px;
  }
  .rx-meta-grid > div { line-height: 1.6; }
  .rx-meta-grid strong {
    color: ${primary};
    font-weight: 600;
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.06em;
    display: inline-block;
    min-width: 78px;
  }
  .rx-section {
    margin-top: 14px;
  }
  .rx-section-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    border-bottom: 1px solid #ddd;
    padding-bottom: 3px;
    margin-bottom: 6px;
  }
  .rx-section-body {
    font-size: 13px;
    line-height: 1.55;
  }
  .rx-rx-symbol {
    font-size: 38px;
    color: ${primary};
    font-family: serif;
    line-height: 1;
    margin: 8px 0 4px;
    font-weight: 700;
  }
  .rx-meds-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 4px;
    font-size: 12.5px;
  }
  .rx-meds-table th,
  .rx-meds-table td {
    border: 1px solid #e0e0e0;
    padding: 6px 8px;
    text-align: left;
    vertical-align: top;
  }
  .rx-meds-table th {
    font-weight: 700;
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.08em;
    color: ${primary};
  }
  .rx-meds-table .rx-num {
    text-align: center;
    width: 28px;
    color: #777;
  }
  .rx-meds-table .rx-med-name {
    font-weight: 600;
    min-width: 38%;
  }
  .rx-meds-table tr:nth-child(even) td { background: #fafafa; }
  .rx-empty { text-align: center; color: #999; font-style: italic; padding: 14px; }
  .rx-indications {
    white-space: pre-wrap;
    padding: 8px 10px;
    background: #fafafa;
    border-radius: 4px;
    border-left: 3px solid ${accent};
  }
  .rx-signature {
    margin-top: 38mm;
    text-align: center;
  }
  .rx-sig-line {
    border-top: 1.5px solid #333;
    width: 260px;
    margin: 0 auto 6px;
  }
  .rx-sig-name {
    font-weight: 700;
    font-size: 13px;
    color: ${primary};
  }
  .rx-sig-meta {
    font-size: 11px;
    color: #555;
    margin-top: 1px;
  }
  .rx-sig-label {
    font-size: 10px;
    color: #999;
    margin-top: 2px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .rx-footer {
    position: absolute;
    bottom: 10mm;
    left: 16mm;
    right: 16mm;
    border-top: 1px solid #ddd;
    padding-top: 6px;
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: #888;
  }
  @media print {
    body { background: #fff; }
    .rx-sheet {
      width: auto;
      min-height: auto;
      margin: 0;
      padding: 0;
      box-shadow: none;
    }
    @page {
      size: ${paperSize};
      margin: 14mm 12mm 16mm;
    }
    .rx-footer { position: static; margin-top: 14mm; }
  }
  @media (max-width: 800px) {
    body { background: #fff; }
    .rx-sheet {
      width: 100%;
      min-height: auto;
      margin: 0;
      padding: 12px;
      box-shadow: none;
    }
    .rx-meta-grid { grid-template-columns: 1fr; }
    .rx-header-inner { flex-direction: column !important; text-align: center !important; }
  }
</style>
</head>
<body>
  <div class="rx-sheet">
    ${showHeader ? `<div class="rx-header">${headerInner}</div>` : ''}

    <div class="rx-title-row">
      <div class="rx-title">Receta Médica</div>
      <div class="rx-folio">Folio: ${esc(rx.id.slice(-8).toUpperCase())}</div>
    </div>

    <div class="rx-meta-grid">
      <div><strong>Paciente</strong> ${esc(patientName)}</div>
      <div><strong>Fecha</strong> ${esc(rxDateStr)}</div>
      <div><strong>Expediente</strong> ${esc(rx.patient?.expNumber || '—')}</div>
      <div><strong>Edad</strong> ${age !== null ? age + ' años' : '—'}</div>
      ${rx.patient?.sex ? `<div><strong>Sexo</strong> ${esc(rx.patient.sex === 'M' ? 'Masculino' : rx.patient.sex === 'F' ? 'Femenino' : 'Otro')}</div>` : ''}
      ${rx.patient?.phone ? `<div><strong>Teléfono</strong> ${esc(rx.patient.phone)}</div>` : ''}
      <div><strong>Podólogo</strong> ${esc(podName)}</div>
      ${podCed ? `<div><strong>Cédula</strong> ${esc(podCed)}</div>` : ''}
    </div>

    ${diagnosisHtml}

    ${showRx ? `<div class="rx-rx-symbol">℞</div>` : ''}

    ${medsHtml}

    ${indicationsHtml}

    ${signatureHtml}

    ${footerHtml}
  </div>

  <script>
    // Auto-print when opened in a popup window with ?print=1
    if (window.location.search.indexOf('print=1') !== -1) {
      window.onload = function () { setTimeout(function () { window.print(); }, 300); };
    }
  </script>
</body>
</html>`

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
    },
  })
}
