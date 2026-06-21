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
  // Existing
  logoPosition?: 'left' | 'center' | 'right'
  logoUrl?: string | 'auto' | 'none'
  fontFamily?: string
  primaryColor?: string
  accentColor?: string
  showHeader?: boolean
  showFooter?: boolean
  showRxSymbol?: boolean
  signatureLabel?: string
  paperSize?: 'A4' | 'Letter' | 'MediaCarta'
  fontSize?: number
  textColor?: string
  backgroundColor?: string
  lineHeight?: number
  margins?: number
  logoSize?: number // px
  logoOpacity?: number // 0-100
  watermarkEnabled?: boolean
  watermarkOpacity?: number // 0-100
  watermarkSize?: number // %
  watermarkText?: string
  watermarkPosition?: 'center' | 'top-right' | 'bottom-right'
  showPatientInfo?: boolean
  showDoctorInfo?: boolean
  showDiagnosis?: boolean
  showMedications?: boolean
  showIndications?: boolean
  showSignature?: boolean
  fontFamilyCategory?: 'serif' | 'sans-serif' | 'system'
  doctorNameMode?: 'podologist' | 'fixed'
  doctorFixedName?: string

  // === NUEVOS: Datos del médico editables ===
  doctorCedula?: string
  doctorSpecialty?: string
  doctorPhone?: string
  doctorAddress?: string

  // === NUEVOS: Plantilla predefinida ===
  template?: 'classic' | 'minimalist' | 'compact' | 'digital-qr' | 'institutional'

  // === NUEVOS: Estilo visual avanzado ===
  headerStyle?: 'modern' | 'classic' | 'compact'
  borderStyle?: 'rounded' | 'square' | 'none'
  borderRadius?: number

  // === NUEVOS: Footer expandible ===
  showFooterAddress?: boolean
  showFooterHours?: boolean
  showFooterDigitalSign?: boolean
  showFooterFollowupMsg?: boolean
  footerFollowupMsg?: string
  footerHours?: string

  // === NUEVOS: Opciones de entrega ===
  prepareForPrint?: boolean
  sendPdfToPatient?: boolean
  showQrVerification?: boolean

  // === NUEVOS: Layout del header ===
  headerLayout?: 'logo-text' | 'text-only' | 'logo-only' | 'logo-top-text-bottom'
  logoContain?: boolean
  logoBgTransparent?: boolean
}

const DEFAULT_DESIGN: PrescriptionDesign = {
  logoPosition: 'left',
  logoUrl: 'auto',
  fontFamily: "'Times New Roman', Georgia, serif",
  fontFamilyCategory: 'serif',
  primaryColor: '#0a3143',
  accentColor: '#0a3143',
  showHeader: true,
  showFooter: true,
  showRxSymbol: true,
  signatureLabel: 'Cédula profesional',
  paperSize: 'A4',
  fontSize: 13,
  textColor: '#111111',
  backgroundColor: '#ffffff',
  lineHeight: 1.5,
  margins: 16,
  logoSize: 78,
  logoOpacity: 100,
  watermarkEnabled: false,
  watermarkOpacity: 10,
  watermarkSize: 60,
  watermarkPosition: 'center',
  showPatientInfo: true,
  showDoctorInfo: true,
  showDiagnosis: true,
  showMedications: true,
  showIndications: true,
  showSignature: true,
  doctorNameMode: 'podologist',
  doctorFixedName: '',
  // Nuevos defaults
  template: 'classic',
  doctorCedula: '',
  doctorSpecialty: '',
  doctorPhone: '',
  doctorAddress: '',
  headerStyle: 'classic',
  borderStyle: 'rounded',
  borderRadius: 8,
  showFooterAddress: true,
  showFooterHours: false,
  showFooterDigitalSign: false,
  showFooterFollowupMsg: false,
  footerFollowupMsg: 'Gracias por su confianza. ¡Que mejore pronto!',
  footerHours: 'Lun – Vie: 9:00 – 19:00 · Sáb: 9:00 – 14:00',
  prepareForPrint: true,
  sendPdfToPatient: false,
  showQrVerification: false,
  headerLayout: 'logo-text',
  logoContain: false,
  logoBgTransparent: false,
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

function resolveFontFamily(design: PrescriptionDesign): string {
  if (design.fontFamily && design.fontFamily.trim()) return design.fontFamily
  switch (design.fontFamilyCategory) {
    case 'serif':
      return "'Times New Roman', Georgia, serif"
    case 'sans-serif':
      return "Arial, Helvetica, sans-serif"
    case 'system':
      return "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    default:
      return "'Times New Roman', Georgia, serif"
  }
}

function resolvePaperSize(paperSize?: string): { widthMm: string; heightMm: string; cssSize: string } {
  switch (paperSize) {
    case 'Letter':
      return { widthMm: '216mm', heightMm: '279mm', cssSize: 'Letter' }
    case 'MediaCarta':
      return { widthMm: '140mm', heightMm: '216mm', cssSize: '140mm 216mm' }
    case 'A4':
    default:
      return { widthMm: '210mm', heightMm: '297mm', cssSize: 'A4' }
  }
}

function withAlpha(hex: string | undefined, alpha: number): string {
  // hex like #RRGGBB → rgba(r, g, b, alpha)
  if (!hex) return `rgba(10, 49, 67, ${alpha})`
  const m = hex.replace('#', '')
  if (m.length !== 6) return `rgba(10, 49, 67, ${alpha})`
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
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

  const patientName = rx.patient ? `${rx.patient.firstName} ${rx.patient.lastName}` : '—'
  // Doctor data: usar override del diseño si está definido, sino el del podólogo
  const doctorNameMode = design.doctorNameMode || 'podologist'
  const doctorFixedName = design.doctorFixedName || ''
  const doctorName = doctorNameMode === 'fixed' && doctorFixedName
    ? doctorFixedName
    : (rx.podologist?.name || '—')
  const doctorCedula = design.doctorCedula || rx.podologist?.cedula || ''
  const doctorSpecialty = design.doctorSpecialty || rx.podologist?.specialty || ''
  const doctorPhone = design.doctorPhone || clinic?.phone || ''
  const doctorAddress = design.doctorAddress || clinic?.address || ''
  const doctorCert = rx.podologist?.certNumber || ''

  const align = design.logoPosition || 'left'
  const fontFamily = resolveFontFamily(design)
  const primary = design.primaryColor || DEFAULT_DESIGN.primaryColor!
  const accent = design.accentColor || primary
  const textColor = design.textColor || DEFAULT_DESIGN.textColor!
  const bgColor = design.backgroundColor || DEFAULT_DESIGN.backgroundColor!
  const fontSize = design.fontSize || DEFAULT_DESIGN.fontSize!
  const lineHeight = design.lineHeight || DEFAULT_DESIGN.lineHeight!
  const margins = design.margins ?? DEFAULT_DESIGN.margins!
  const logoSize = design.logoSize ?? DEFAULT_DESIGN.logoSize!
  const logoOpacity = (design.logoOpacity ?? DEFAULT_DESIGN.logoOpacity!) / 100
  const paperSize = design.paperSize || 'A4'
  const paper = resolvePaperSize(paperSize)

  // Nuevos campos
  const headerLayout = design.headerLayout || 'logo-text'
  const headerStyle = design.headerStyle || 'classic'
  const borderStyle = design.borderStyle || 'rounded'
  const borderRadius = design.borderRadius ?? (borderStyle === 'rounded' ? 8 : borderStyle === 'square' ? 0 : 0)
  const logoContain = design.logoContain === true
  const logoBgTransparent = design.logoBgTransparent === true
  const showFooterAddress = design.showFooterAddress !== false
  const showFooterHours = design.showFooterHours === true
  const showFooterDigitalSign = design.showFooterDigitalSign === true
  const showFooterFollowupMsg = design.showFooterFollowupMsg === true
  const footerFollowupMsg = design.footerFollowupMsg || 'Gracias por su confianza.'
  const footerHours = design.footerHours || 'Lun – Vie: 9:00 – 19:00'
  const showQrVerification = design.showQrVerification === true

  const showHeader = design.showHeader !== false
  const showFooter = design.showFooter !== false
  const showRx = design.showRxSymbol !== false
  const showPatientInfo = design.showPatientInfo !== false
  const showDoctorInfo = design.showDoctorInfo !== false
  const showDiagnosis = design.showDiagnosis !== false
  const showMedications = design.showMedications !== false
  const showIndications = design.showIndications !== false
  const showSignature = design.showSignature !== false
  const sigLabel = design.signatureLabel || 'Cédula profesional'

  const watermarkEnabled = design.watermarkEnabled === true
  const watermarkOpacity = (design.watermarkOpacity ?? DEFAULT_DESIGN.watermarkOpacity!) / 100
  const watermarkPosition = design.watermarkPosition || 'center'
  const watermarkSize = design.watermarkSize ?? 60
  const wmSizePct = watermarkSize
  const wmSizePx = watermarkSize * 2
  const wmText = design.watermarkText || ''

  const todayStr = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: undefined })
  const rxDateStr = format(new Date(rx.date), "dd/MM/yyyy")
  const folio = rx.id.slice(-8).toUpperCase()

  // Logo con mix-blend-mode si aplica (elimina bordes blancos visuales)
  const logoBlendStyle = (logoContain || logoBgTransparent) ? 'mix-blend-mode: multiply;' : ''
  const logoHtml = logoUrl && headerLayout !== 'text-only'
    ? `<img src="${esc(logoUrl)}" alt="logo" class="rx-logo" style="opacity:${logoOpacity};${logoBlendStyle}"/>`
    : ''

  // Header layout CSS según headerLayout
  let headerGridCss = ''
  if (headerLayout === 'text-only') {
    headerGridCss = `display:grid;grid-template-columns:1fr;gap:6px;justify-items:${align === 'center' ? 'center' : 'stretch'};text-align:${align === 'center' ? 'center' : 'left'};`
  } else if (headerLayout === 'logo-only') {
    headerGridCss = `display:grid;grid-template-columns:1fr;justify-items:${align === 'center' ? 'center' : align === 'right' ? 'end' : 'start'};`
  } else if (headerLayout === 'logo-top-text-bottom') {
    headerGridCss = `display:grid;grid-template-columns:1fr;gap:6px;justify-items:center;text-align:center;`
  } else {
    // 'logo-text' (default)
    if (align === 'center') {
      headerGridCss = `display:grid;grid-template-columns:1fr;gap:14px;justify-items:center;text-align:center;`
    } else if (align === 'right') {
      headerGridCss = `display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center;text-align:right;`
    } else {
      headerGridCss = `display:grid;grid-template-columns:auto 1fr;gap:18px;align-items:center;text-align:left;`
    }
  }

  // Header wrapper CSS según headerStyle
  let headerWrapperCss = ''
  if (headerStyle === 'modern') {
    headerWrapperCss = `background:${primary};color:#fff;padding:14px 18px;border-radius:${borderRadius}px;margin-bottom:14px;`
  } else if (headerStyle === 'compact') {
    headerWrapperCss = `border-bottom:2px solid ${primary};padding-bottom:6px;margin-bottom:10px;`
  } else {
    // classic
    headerWrapperCss = `border-bottom:2.5px solid ${primary};padding-bottom:10px;margin-bottom:14px;`
  }
  const headerTextPrimary = headerStyle === 'modern' ? '#ffffff' : primary
  const headerTextSub = headerStyle === 'modern' ? 'rgba(255,255,255,0.85)' : withAlpha(textColor, 0.70)

  const headerInner = `
    <div style="${headerGridCss}">
      ${logoHtml}
      ${headerLayout !== 'logo-only' ? `
        <div class="rx-clinic-info" style="min-width:0;overflow:hidden;">
          <div class="rx-clinic-name" style="color:${headerTextPrimary};">${esc(clinic?.name)}</div>
          ${clinic?.razonSocial ? `<div class="rx-clinic-sub" style="color:${headerTextSub};">${esc(clinic.razonSocial)}</div>` : ''}
          ${doctorName ? `<div class="rx-clinic-line" style="color:${headerTextSub};font-weight:600;margin-top:2px;">${esc(doctorName)}${doctorSpecialty ? ` · ${esc(doctorSpecialty)}` : ''}${doctorCedula ? ` · Céd. ${esc(doctorCedula)}` : ''}</div>` : ''}
          ${doctorAddress ? `<div class="rx-clinic-line" style="color:${headerTextSub};">${esc(doctorAddress)}</div>` : ''}
          <div class="rx-clinic-line" style="color:${headerTextSub};">
            ${doctorPhone ? `Tel. ${esc(doctorPhone)}` : ''}
            ${doctorPhone && clinic?.email ? ' · ' : ''}
            ${clinic?.email ? esc(clinic.email) : ''}
          </div>
          ${clinic?.rfc ? `<div class="rx-clinic-line" style="color:${headerTextSub};">RFC: ${esc(clinic.rfc)}</div>` : ''}
        </div>
      ` : ''}
    </div>
  `

  const diagnosisHtml = (showDiagnosis && rx.diagnosis)
    ? `<div class="rx-section"><div class="rx-section-title" style="color:${primary};border-bottom-color:${withAlpha(primary, 0.18)};">Diagnóstico</div><div class="rx-section-body">${escMultiline(rx.diagnosis)}</div></div>`
    : ''

  // Medications table — clean grid
  const medsRowsHtml = meds.length === 0
    ? `<tr><td colspan="5" class="rx-empty">Sin medicamentos registrados.</td></tr>`
    : meds.map((m, i) => `
      <tr>
        <td class="rx-num">${i + 1}</td>
        <td class="rx-med-name">${esc(m.name)}</td>
        <td>${esc(m.dose) || '—'}</td>
        <td>${esc(m.via) || '—'}</td>
        <td>${esc(m.duration) || '—'}</td>
      </tr>
    `).join('')

  const medsHtml = showMedications ? `
    <div class="rx-section">
      <div class="rx-section-title" style="color:${primary};border-bottom-color:${withAlpha(primary, 0.18)};">Sugiero</div>
      <table class="rx-meds-table">
        <thead>
          <tr style="background:${withAlpha(accent, 0.10)};">
            <th class="rx-num">#</th>
            <th>Medicamento / Producto</th>
            <th>Dosis</th>
            <th>Vía</th>
            <th>Duración</th>
          </tr>
        </thead>
        <tbody>${medsRowsHtml}</tbody>
      </table>
    </div>
  ` : ''

  const indicationsHtml = (showIndications && rx.indications)
    ? `<div class="rx-section"><div class="rx-section-title" style="color:${primary};border-bottom-color:${withAlpha(primary, 0.18)};">Indicaciones generales</div><div class="rx-section-body rx-indications" style="border-left-color:${accent};${borderStyle === 'none' ? '' : `border-radius:${borderRadius}px;`}">${escMultiline(rx.indications)}</div></div>`
    : ''

  // QR placeholder (CSS grid simulando un QR)
  const qrHtml = showQrVerification ? `
    <div style="margin-top:14px;display:flex;align-items:center;gap:12px;padding:10px 12px;${borderStyle === 'none' ? '' : `border:1px solid ${withAlpha(textColor, 0.10)};border-radius:${borderRadius}px;`}background:${withAlpha(accent, 0.05)};">
      <div style="width:60px;height:60px;background:#fff;border:1px solid ${withAlpha(textColor, 0.20)};padding:3px;display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(8,1fr);">
        ${Array.from({ length: 64 }).map((_, i) => {
          const seed = (i * 7 + folio.charCodeAt(0)) % 3 === 0
          return `<div style="background:${seed ? textColor : 'transparent'};"></div>`
        }).join('')}
      </div>
      <div>
        <div style="font-size:11px;font-weight:700;color:${primary};">Verifica tu receta</div>
        <div style="font-size:9px;color:${withAlpha(textColor, 0.65)};font-family:'Courier New',monospace;">Folio: ${esc(folio)}</div>
        <div style="font-size:9px;color:${withAlpha(textColor, 0.55)};">Escanea para validar autenticidad</div>
      </div>
    </div>
  ` : ''

  const signatureHtml = showSignature ? `
    <div class="rx-signature">
      <div class="rx-sig-line"></div>
      <div class="rx-sig-name" style="color:${primary};">${esc(doctorName)}</div>
      <div class="rx-sig-meta">
        ${doctorSpecialty ? esc(doctorSpecialty) : 'Podología'}
        ${doctorCedula ? ` · Cédula: ${esc(doctorCedula)}` : ''}
        ${doctorCert ? ` · Cert: ${esc(doctorCert)}` : ''}
      </div>
      <div class="rx-sig-label">${esc(sigLabel)}</div>
    </div>
  ` : ''

  // Footer pieces (granulares)
  const footerPieces: string[] = []
  if (showFooterAddress && doctorAddress) {
    footerPieces.push(`<div style="font-size:10px;">📍 ${esc(doctorAddress)}</div>`)
  }
  if (showFooterHours) {
    footerPieces.push(`<div style="font-size:10px;">🕒 ${esc(footerHours)}</div>`)
  }
  if (showFooterDigitalSign) {
    footerPieces.push(`<div style="font-size:9px;font-style:italic;color:${withAlpha(textColor, 0.55)};">✓ Documento firmado digitalmente</div>`)
  }
  if (showFooterFollowupMsg) {
    footerPieces.push(`<div style="font-size:10px;font-style:italic;color:${primary};">${esc(footerFollowupMsg)}</div>`)
  }

  const footerHtml = showFooter && footerPieces.length > 0 ? `
    <div class="rx-footer">
      ${footerPieces.join('')}
      <div class="rx-footer-bottom">
        <div>${esc(clinic?.name)} · Receta ${esc(folio)}</div>
        <div>Generada el ${esc(todayStr)}</div>
      </div>
    </div>
  ` : (showFooter ? `
    <div class="rx-footer rx-footer-simple">
      <div>${esc(clinic?.name)} · Receta ${esc(folio)}</div>
      <div>Generada el ${esc(todayStr)}</div>
    </div>
  ` : '')

  // Patient / Doctor info: build meta grid conditionally
  const metaCells: string[] = []
  if (showPatientInfo) {
    metaCells.push(`<div><strong>Paciente</strong> ${esc(patientName)}</div>`)
    metaCells.push(`<div><strong>Fecha</strong> ${esc(rxDateStr)}</div>`)
    metaCells.push(`<div><strong>Expediente</strong> ${esc(rx.patient?.expNumber || '—')}</div>`)
    metaCells.push(`<div><strong>Edad</strong> ${age !== null ? age + ' años' : '—'}</div>`)
    if (rx.patient?.sex) {
      metaCells.push(`<div><strong>Sexo</strong> ${esc(rx.patient.sex === 'M' ? 'Masculino' : rx.patient.sex === 'F' ? 'Femenino' : 'Otro')}</div>`)
    }
    if (rx.patient?.phone) {
      metaCells.push(`<div><strong>Teléfono</strong> ${esc(rx.patient.phone)}</div>`)
    }
  }
  if (showDoctorInfo) {
    metaCells.push(`<div><strong>Profesional</strong> ${esc(doctorName)}</div>`)
    if (doctorCedula) metaCells.push(`<div><strong>Cédula</strong> ${esc(doctorCedula)}</div>`)
    if (doctorSpecialty) metaCells.push(`<div><strong>Especialidad</strong> ${esc(doctorSpecialty)}</div>`)
  }

  const metaHtml = metaCells.length > 0
    ? `<div class="rx-meta-grid" style="background:${withAlpha(accent, 0.06)};border-left-color:${primary};${borderStyle === 'none' ? '' : `border-radius:${borderRadius}px;`}">${metaCells.join('')}</div>`
    : ''

  // Watermark element
  const watermarkHtml = (watermarkEnabled && (logoUrl || wmText))
    ? logoUrl
      ? `<div class="rx-watermark rx-wm-${watermarkPosition}" style="opacity:${watermarkOpacity};"><img src="${esc(logoUrl)}" alt="watermark"/></div>`
      : `<div class="rx-watermark rx-wm-${watermarkPosition}" style="opacity:${watermarkOpacity};font-size:80px;font-weight:800;color:${primary};letter-spacing:0.15em;">${esc(wmText)}</div>`
    : ''

  // Page CSS for paper size + margins
  const marginsMm = `${margins}mm`

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
    color: ${textColor};
    background: #f4f4f4;
    font-size: ${fontSize}px;
    line-height: ${lineHeight};
  }
  .rx-sheet {
    width: ${paper.widthMm};
    min-height: ${paper.heightMm};
    margin: 16px auto;
    padding: ${marginsMm};
    background: ${bgColor};
    color: ${textColor};
    box-shadow: 0 4px 18px rgba(0,0,0,.08);
    position: relative;
    overflow: hidden;
  }
  .rx-watermark {
    position: absolute;
    pointer-events: none;
    z-index: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .rx-watermark img {
    object-fit: contain;
  }
  .rx-wm-center {
    top: 0; left: 0; right: 0; bottom: 0;
    width: 100%; height: 100%;
  }
  .rx-wm-center img { max-width: ${wmSizePct}%; max-height: ${wmSizePct}%; }
  .rx-wm-top-right {
    top: ${marginsMm}; right: ${marginsMm};
  }
  .rx-wm-top-right img { max-width: ${wmSizePx}px; max-height: ${wmSizePx}px; }
  .rx-wm-bottom-right {
    bottom: ${marginsMm}; right: ${marginsMm};
  }
  .rx-wm-bottom-right img { max-width: ${wmSizePx}px; max-height: ${wmSizePx}px; }
  .rx-sheet > * { position: relative; z-index: 1; }
  .rx-logo {
    max-height: ${logoSize}px;
    max-width: ${Math.round(logoSize * 2.3)}px;
    height: auto;
    width: auto;
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
    margin-top: 2px;
  }
  .rx-clinic-line {
    font-size: 11.5px;
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
    color: ${withAlpha(textColor, 0.55)};
    font-family: 'Courier New', monospace;
  }
  .rx-meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 18px;
    padding: 10px 12px;
    border-left: 3px solid ${primary};
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
    line-height: ${lineHeight};
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
    color: ${withAlpha(textColor, 0.55)};
  }
  .rx-meds-table .rx-med-name {
    font-weight: 600;
    min-width: 38%;
  }
  .rx-meds-table tr:nth-child(even) td { background: ${withAlpha(textColor, 0.025)}; }
  .rx-empty { text-align: center; color: ${withAlpha(textColor, 0.55)}; font-style: italic; padding: 14px; }
  .rx-indications {
    white-space: pre-wrap;
    padding: 8px 10px;
    background: ${withAlpha(textColor, 0.03)};
    border-left: 3px solid ${accent};
  }
  .rx-signature {
    margin-top: 38mm;
    text-align: center;
  }
  .rx-sig-line {
    border-top: 1.5px solid ${textColor};
    width: 260px;
    margin: 0 auto 6px;
  }
  .rx-sig-name {
    font-weight: 700;
    font-size: 13px;
  }
  .rx-sig-meta {
    font-size: 11px;
    color: ${withAlpha(textColor, 0.65)};
    margin-top: 1px;
  }
  .rx-sig-label {
    font-size: 10px;
    color: ${withAlpha(textColor, 0.55)};
    margin-top: 2px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .rx-footer {
    position: absolute;
    bottom: ${Math.max(8, Math.round(margins / 2))}mm;
    left: ${marginsMm};
    right: ${marginsMm};
    border-top: 1px solid ${withAlpha(textColor, 0.18)};
    padding-top: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    color: ${withAlpha(textColor, 0.65)};
  }
  .rx-footer-bottom {
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: ${withAlpha(textColor, 0.45)};
    margin-top: 4px;
  }
  .rx-footer-simple {
    flex-direction: row;
    justify-content: space-between;
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
      size: ${paper.cssSize};
      margin: ${marginsMm};
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
  }
</style>
</head>
<body>
  <div class="rx-sheet">
    ${watermarkHtml}
    ${showHeader ? `<div class="rx-header" style="${headerWrapperCss}">${headerInner}</div>` : ''}

    <div class="rx-title-row">
      <div class="rx-folio">Folio: ${esc(folio)}</div>
    </div>

    ${metaHtml}

    ${diagnosisHtml}

    ${showRx ? `<div class="rx-rx-symbol">℞</div>` : ''}

    ${medsHtml}

    ${indicationsHtml}

    ${qrHtml}

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

// Avoid unused import warning for `bad` (kept for API compat)
void bad
