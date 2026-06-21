'use client'

import { useMemo } from 'react'

// ============================================================
// PrescriptionLivePreview
// Vista previa fiel del HTML de impresión de receta.
// Recibe el diseño (PrescriptionDesign) y datos de ejemplo y
// renderiza el documento completo en escala 1:1 (escalonable vía
// CSS transform desde el padre).
// ============================================================

export type PrescriptionDesign = {
  // === EXISTENTES (mantener todos) ===
  logoPosition?: 'left' | 'center' | 'right'
  logoUrl?: string | 'auto' | 'none'
  fontFamily?: string
  fontFamilyCategory?: 'serif' | 'sans-serif' | 'system'
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
  logoSize?: number
  logoOpacity?: number
  watermarkEnabled?: boolean
  watermarkOpacity?: number
  watermarkSize?: number
  watermarkPosition?: 'center' | 'top-right' | 'bottom-right'
  watermarkText?: string
  showPatientInfo?: boolean
  showDoctorInfo?: boolean
  showDiagnosis?: boolean
  showMedications?: boolean
  showIndications?: boolean
  showSignature?: boolean
  doctorNameMode?: 'podologist' | 'fixed'
  doctorFixedName?: string

  // === NUEVOS: Datos del médico editables (override del podólogo) ===
  doctorCedula?: string         // cédula profesional manual
  doctorSpecialty?: string      // especialidad manual
  doctorPhone?: string          // teléfono de contacto del médico
  doctorAddress?: string        // dirección del consultorio

  // === NUEVOS: Plantilla predefinida ===
  template?: 'classic' | 'minimalist' | 'compact' | 'digital-qr' | 'institutional'

  // === NUEVOS: Estilo visual avanzado ===
  headerStyle?: 'modern' | 'classic' | 'compact'   // tipo de encabezado
  borderStyle?: 'rounded' | 'square' | 'none'      // bordes de tarjetas/secciones
  borderRadius?: number                              // radio del borde en px

  // === NUEVOS: Footer expandible ===
  showFooterAddress?: boolean
  showFooterHours?: boolean
  showFooterDigitalSign?: boolean
  showFooterFollowupMsg?: boolean
  footerFollowupMsg?: string                         // mensaje personalizado
  footerHours?: string                               // horario personalizado

  // === NUEVOS: Opciones de entrega ===
  prepareForPrint?: boolean
  sendPdfToPatient?: boolean
  showQrVerification?: boolean

  // === NUEVOS: Layout del header (solución al problema de logo) ===
  headerLayout?: 'logo-text' | 'text-only' | 'logo-only' | 'logo-top-text-bottom'
  logoContain?: boolean        // true = object-fit: contain + mix-blend-mode: multiply
  logoBgTransparent?: boolean  // true = mix-blend-mode: multiply sobre el logo
}

export type PreviewClinic = {
  name?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  logoUrl?: string | null
  rfc?: string | null
  razonSocial?: string | null
}

export type PreviewPatient = {
  firstName?: string
  lastName?: string
  name?: string
  expNumber?: string
  birthDate?: string | null
  sex?: string | null
  phone?: string | null
}

export type PreviewPodologist = {
  name?: string
  specialty?: string | null
  cedula?: string | null
  certNumber?: string | null
}

export type PreviewMedication = {
  name: string
  dose?: string
  via?: string
  duration?: string
}

export type PrescriptionPreviewData = {
  id?: string
  date: string
  diagnosis?: string | null
  medications: PreviewMedication[]
  indications?: string | null
  patient?: PreviewPatient | null
  podologist?: PreviewPodologist | null
  clinic?: PreviewClinic | null
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

function resolvePaperSize(paperSize?: string): { widthMm: string; heightMm: string; aspectRatio: number } {
  switch (paperSize) {
    case 'Letter':
      return { widthMm: '216mm', heightMm: '279mm', aspectRatio: 216 / 279 }
    case 'MediaCarta':
      return { widthMm: '140mm', heightMm: '216mm', aspectRatio: 140 / 216 }
    case 'A4':
    default:
      return { widthMm: '210mm', heightMm: '297mm', aspectRatio: 210 / 297 }
  }
}

function withAlpha(hex: string | undefined, alpha: number): string {
  if (!hex) return `rgba(10, 49, 67, ${alpha})`
  const m = hex.replace('#', '')
  if (m.length !== 6) return `rgba(10, 49, 67, ${alpha})`
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function calcAge(birth: string | null | undefined): number | null {
  if (!birth) return null
  const d = new Date(birth)
  if (isNaN(d.getTime())) return null
  const diff = Date.now() - d.getTime()
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000))
}

function sexLabel(s: string | null | undefined): string {
  if (!s) return ''
  if (s === 'M') return 'Masculino'
  if (s === 'F') return 'Femenino'
  return 'Otro'
}

function formatDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  if (isNaN(date.getTime())) return '—'
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

export function PrescriptionLivePreview({
  design,
  data,
}: {
  design: PrescriptionDesign
  data: PrescriptionPreviewData
}) {
  const d = { ...DEFAULT_DESIGN, ...design }
  const paper = resolvePaperSize(d.paperSize)

  const fontFamily = resolveFontFamily(d)
  const primary = d.primaryColor!
  const accent = d.accentColor || primary
  const textColor = d.textColor!
  const bgColor = d.backgroundColor!
  const fontSize = d.fontSize!
  const lineHeight = d.lineHeight!
  const margins = d.margins!
  const logoSize = d.logoSize!
  const logoOpacity = (d.logoOpacity ?? 100) / 100

  const patient = data.patient
  const pod = data.podologist
  const clinic = data.clinic
  const folio = (data.id || 'PREVIEW00').slice(-8).toUpperCase()
  const patientName = patient?.name || (patient ? `${patient.firstName || ''} ${patient.lastName || ''}`.trim() : 'Paciente de ejemplo')
  const age = useMemo(() => calcAge(patient?.birthDate), [patient?.birthDate])

  // Datos del médico: usar override si está definido, sino el del podólogo
  const doctorNameMode = d.doctorNameMode || 'podologist'
  const doctorName = doctorNameMode === 'fixed' && d.doctorFixedName
    ? d.doctorFixedName
    : (pod?.name || 'Dr. Ejemplo Podólogo')
  const doctorCedula = d.doctorCedula || pod?.cedula || '1234567'
  const doctorSpecialty = d.doctorSpecialty || pod?.specialty || 'Podología'
  const doctorPhone = d.doctorPhone || clinic?.phone || ''
  const doctorAddress = d.doctorAddress || clinic?.address || ''
  const doctorCert = pod?.certNumber || ''

  // Resolve logo URL
  let logoUrl: string | null = null
  if (d.logoUrl === 'none') {
    logoUrl = null
  } else if (d.logoUrl && d.logoUrl !== 'auto') {
    logoUrl = d.logoUrl
  } else if (clinic?.logoUrl) {
    logoUrl = clinic.logoUrl
  }

  const showHeader = d.showHeader !== false
  const showFooter = d.showFooter !== false
  const showRx = d.showRxSymbol !== false
  const showPatientInfo = d.showPatientInfo !== false
  const showDoctorInfo = d.showDoctorInfo !== false
  const showDiagnosis = d.showDiagnosis !== false
  const showMedications = d.showMedications !== false
  const showIndications = d.showIndications !== false
  const showSignature = d.showSignature !== false
  const sigLabel = d.signatureLabel || 'Cédula profesional'

  const watermarkEnabled = d.watermarkEnabled === true
  const watermarkOpacity = (d.watermarkOpacity ?? 10) / 100
  const watermarkPosition = d.watermarkPosition || 'center'

  // Nuevos toggles
  const headerLayout = d.headerLayout || 'logo-text'
  const logoContain = d.logoContain === true
  const logoBgTransparent = d.logoBgTransparent === true
  const headerStyle = d.headerStyle || 'classic'
  const borderStyle = d.borderStyle || 'rounded'
  const borderRadius = d.borderRadius ?? (borderStyle === 'rounded' ? 8 : borderStyle === 'square' ? 0 : 0)
  const showFooterAddress = d.showFooterAddress !== false
  const showFooterHours = d.showFooterHours === true
  const showFooterDigitalSign = d.showFooterDigitalSign === true
  const showFooterFollowupMsg = d.showFooterFollowupMsg === true
  const footerFollowupMsg = d.footerFollowupMsg || 'Gracias por su confianza. ¡Que mejore pronto!'
  const footerHours = d.footerHours || 'Lun – Vie: 9:00 – 19:00 · Sáb: 9:00 – 14:00'
  const showQrVerification = d.showQrVerification === true

  const diagnosisText = data.diagnosis || 'Onicomicosis en primer dedo del pie derecho'
  const indicationsText = data.indications || 'Reposo relativo, control en una semana, evitar humedad en pies, uso de calzado amplio y transpirable.'
  const medications = data.medications && data.medications.length > 0
    ? data.medications
    : [
        { name: 'Terbinafina 250 mg', dose: '1 tableta cada 24h', via: 'Oral', duration: '6 semanas' },
        { name: 'Crema ketoconazol 2%', dose: 'Aplicar 2 veces al día', via: 'Tópica', duration: '4 semanas' },
      ]

  // CSS para bordes
  const cardBorder = borderStyle === 'none'
    ? { border: 'none' }
    : {
        border: `1px solid ${withAlpha(textColor, 0.10)}`,
        borderRadius: `${borderRadius}px`,
      }

  // Logo img style con mix-blend-mode si aplica
  const logoImgStyle: React.CSSProperties = {
    maxHeight: `calc(${logoSize}px * 0.42)`,
    maxWidth: `calc(${logoSize * 2.3}px * 0.42)`,
    height: 'auto',
    width: 'auto',
    objectFit: 'contain',
    opacity: logoOpacity,
    ...(logoContain ? { mixBlendMode: 'multiply' as const } : {}),
    ...(logoBgTransparent && !logoContain ? { mixBlendMode: 'multiply' as const } : {}),
  }

  // Header layout grid
  const headerGridStyle: React.CSSProperties = (() => {
    if (headerLayout === 'text-only') {
      return {
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '0.4em',
        justifyItems: d.logoPosition === 'center' ? 'center' : 'stretch',
        textAlign: d.logoPosition === 'center' ? 'center' as const : 'left' as const,
      }
    }
    if (headerLayout === 'logo-only') {
      return {
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '0.4em',
        justifyItems: d.logoPosition === 'center' ? 'center' : d.logoPosition === 'right' ? 'end' : 'start',
      }
    }
    if (headerLayout === 'logo-top-text-bottom') {
      return {
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '0.4em',
        justifyItems: 'center',
        textAlign: 'center' as const,
      }
    }
    // 'logo-text' (default)
    if (d.logoPosition === 'center') {
      return {
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '1em',
        justifyItems: 'center',
        textAlign: 'center' as const,
      }
    }
    return {
      display: 'grid',
      gridTemplateColumns: 'auto 1fr',
      gap: '1em',
      alignItems: 'center',
      textAlign: 'left' as const,
      ...(d.logoPosition === 'right' ? {
        gridTemplateColumns: '1fr auto',
        textAlign: 'right' as const,
      } : {}),
    }
  })()

  // Estilo del header según headerStyle
  const headerWrapperStyle: React.CSSProperties = (() => {
    if (headerStyle === 'modern') {
      return {
        background: primary,
        color: '#ffffff',
        padding: '1em 1.2em',
        borderRadius: `${borderRadius}px`,
        marginBottom: '0.8em',
      }
    }
    if (headerStyle === 'compact') {
      return {
        borderBottom: `2px solid ${primary}`,
        paddingBottom: '0.4em',
        marginBottom: '0.6em',
      }
    }
    // classic
    return {
      borderBottom: `2.5px solid ${primary}`,
      paddingBottom: '0.5em',
      marginBottom: '0.7em',
    }
  })()

  // Color del texto del header si es modern
  const headerTextPrimary = headerStyle === 'modern' ? '#ffffff' : primary
  const headerTextSub = headerStyle === 'modern' ? withAlpha('#ffffff', 0.85) : withAlpha(textColor, 0.70)

  // Build meta cells
  const metaCells: { label: string; value: string }[] = []
  if (showPatientInfo) {
    metaCells.push({ label: 'Paciente', value: patientName })
    metaCells.push({ label: 'Fecha', value: formatDate(data.date) })
    metaCells.push({ label: 'Expediente', value: patient?.expNumber || 'C1-00001' })
    metaCells.push({ label: 'Edad', value: age !== null ? `${age} años` : '45 años' })
    if (patient?.sex) metaCells.push({ label: 'Sexo', value: sexLabel(patient.sex) })
    if (patient?.phone) metaCells.push({ label: 'Teléfono', value: patient.phone })
  }
  if (showDoctorInfo) {
    metaCells.push({ label: 'Profesional', value: doctorName })
    if (doctorCedula) metaCells.push({ label: 'Cédula', value: doctorCedula })
    if (doctorSpecialty) metaCells.push({ label: 'Especialidad', value: doctorSpecialty })
  }

  // Footer pieces
  const footerPieces: React.ReactNode[] = []
  if (showFooterAddress && doctorAddress) {
    footerPieces.push(
      <div key="addr" style={{ fontSize: '0.78em' }}>📍 {doctorAddress}</div>
    )
  }
  if (showFooterHours) {
    footerPieces.push(
      <div key="hours" style={{ fontSize: '0.78em' }}>🕒 {footerHours}</div>
    )
  }
  if (showFooterDigitalSign) {
    footerPieces.push(
      <div key="digsign" style={{ fontSize: '0.7em', fontStyle: 'italic', color: withAlpha(textColor, 0.55) }}>
        ✓ Documento firmado digitalmente
      </div>
    )
  }
  if (showFooterFollowupMsg) {
    footerPieces.push(
      <div key="msg" style={{ fontSize: '0.78em', fontStyle: 'italic', color: primary }}>{footerFollowupMsg}</div>
    )
  }

  return (
    <div
      className="rx-live-preview-sheet"
      style={{
        width: '100%',
        aspectRatio: String(paper.aspectRatio),
        background: bgColor,
        color: textColor,
        fontFamily,
        fontSize: `calc(${fontSize}px * 0.42)`,
        lineHeight,
        padding: `calc(${margins}mm * 0.42)`,
        boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
        borderRadius: 4,
        overflow: 'hidden',
        position: 'relative',
        margin: '0 auto',
      }}
    >
      {/* Watermark */}
      {watermarkEnabled && (logoUrl || d.watermarkText) && (
        <div
          style={{
            position: 'absolute',
            opacity: watermarkOpacity,
            pointerEvents: 'none',
            zIndex: 0,
            ...(watermarkPosition === 'center' && {
              top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            }),
            ...(watermarkPosition === 'top-right' && {
              top: `calc(${margins}mm * 0.42)`, right: `calc(${margins}mm * 0.42)`,
              maxWidth: '30%',
            }),
            ...(watermarkPosition === 'bottom-right' && {
              bottom: `calc(${margins}mm * 0.42)`, right: `calc(${margins}mm * 0.42)`,
              maxWidth: '30%',
            }),
          }}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="" style={{ maxWidth: watermarkPosition === 'center' ? '60%' : '100%', maxHeight: watermarkPosition === 'center' ? '60%' : '120px', objectFit: 'contain' }} />
          ) : (
            <div style={{ fontSize: '5em', fontWeight: 800, color: primary, letterSpacing: '0.15em', opacity: 0.5 }}>
              {d.watermarkText || 'CONFIDENCIAL'}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        {showHeader && (
          <div style={headerWrapperStyle}>
            <div style={headerGridStyle}>
              {logoUrl && headerLayout !== 'text-only' && (
                <img src={logoUrl} alt="logo" style={logoImgStyle} />
              )}
              {headerLayout !== 'logo-only' && (
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <div style={{ fontSize: headerStyle === 'compact' ? '1.4em' : '1.7em', fontWeight: 700, color: headerTextPrimary, letterSpacing: '0.04em', lineHeight: 1.15 }}>
                    {clinic?.name || 'Clínica CENPOD'}
                  </div>
                  {clinic?.razonSocial && (
                    <div style={{ fontSize: '0.85em', color: headerTextSub, marginTop: '0.15em' }}>
                      {clinic.razonSocial}
                    </div>
                  )}
                  {doctorName && (
                    <div style={{ fontSize: '0.85em', color: headerTextSub, marginTop: '0.15em', fontWeight: 600 }}>
                      {doctorName}
                      {doctorSpecialty && ` · ${doctorSpecialty}`}
                      {doctorCedula && ` · Céd. ${doctorCedula}`}
                    </div>
                  )}
                  {(doctorAddress || clinic?.address) && (
                    <div style={{ fontSize: '0.78em', color: headerTextSub, marginTop: '0.05em' }}>
                      {doctorAddress || clinic?.address}
                    </div>
                  )}
                  <div style={{ fontSize: '0.78em', color: headerTextSub, marginTop: '0.05em' }}>
                    {doctorPhone && `Tel. ${doctorPhone}`}
                    {doctorPhone && clinic?.email && ' · '}
                    {clinic?.email}
                  </div>
                  {clinic?.rfc && (
                    <div style={{ fontSize: '0.78em', color: headerTextSub }}>
                      RFC: {clinic.rfc}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Title row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5em' }}>
          <div style={{ fontSize: '1.5em', fontWeight: 700, color: primary, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Receta Médica
          </div>
          <div style={{ fontSize: '0.75em', color: withAlpha(textColor, 0.55), fontFamily: "'Courier New', monospace" }}>
            Folio: {folio}
          </div>
        </div>

        {/* Meta grid */}
        {metaCells.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.2em 0.8em',
              padding: '0.5em 0.6em',
              background: withAlpha(accent, 0.06),
              borderLeft: `3px solid ${primary}`,
              ...cardBorder,
              marginBottom: '0.7em',
              fontSize: '0.95em',
            }}
          >
            {metaCells.map((c, i) => (
              <div key={i} style={{ lineHeight: 1.6 }}>
                <strong style={{ color: primary, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75em', letterSpacing: '0.06em', display: 'inline-block', minWidth: '4.5em' }}>
                  {c.label}
                </strong>{' '}
                {c.value}
              </div>
            ))}
          </div>
        )}

        {/* Diagnosis */}
        {showDiagnosis && diagnosisText && (
          <div style={{ marginTop: '0.7em' }}>
            <div style={{ fontSize: '0.78em', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', borderBottom: `1px solid ${withAlpha(primary, 0.18)}`, paddingBottom: '0.15em', marginBottom: '0.3em', color: primary }}>
              Diagnóstico
            </div>
            <div style={{ fontSize: '1em', lineHeight }}>{diagnosisText}</div>
          </div>
        )}

        {/* Rx symbol */}
        {showRx && (
          <div style={{ fontSize: '2.6em', color: primary, fontFamily: 'serif', lineHeight: 1, margin: '0.3em 0 0.2em', fontWeight: 700 }}>
            ℞
          </div>
        )}

        {/* Medications */}
        {showMedications && (
          <div style={{ marginTop: '0.7em' }}>
            <div style={{ fontSize: '0.78em', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', borderBottom: `1px solid ${withAlpha(primary, 0.18)}`, paddingBottom: '0.15em', marginBottom: '0.3em', color: primary }}>
              ℞ Prescripción
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.2em', fontSize: '0.95em' }}>
              <thead>
                <tr style={{ background: withAlpha(accent, 0.10) }}>
                  {['#', 'Medicamento', 'Dosis', 'Vía', 'Duración'].map((h) => (
                    <th key={h} style={{
                      border: `1px solid ${withAlpha(textColor, 0.10)}`,
                      padding: '0.25em 0.4em',
                      textAlign: h === '#' ? 'center' : 'left',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      fontSize: '0.72em',
                      letterSpacing: '0.08em',
                      color: primary,
                      width: h === '#' ? '1.6em' : undefined,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {medications.map((m, i) => (
                  <tr key={i} style={i % 2 === 1 ? { background: withAlpha(textColor, 0.025) } : undefined}>
                    <td style={{ border: `1px solid ${withAlpha(textColor, 0.10)}`, padding: '0.25em 0.4em', textAlign: 'center', color: withAlpha(textColor, 0.55) }}>{i + 1}</td>
                    <td style={{ border: `1px solid ${withAlpha(textColor, 0.10)}`, padding: '0.25em 0.4em', fontWeight: 600 }}>{m.name}</td>
                    <td style={{ border: `1px solid ${withAlpha(textColor, 0.10)}`, padding: '0.25em 0.4em' }}>{m.dose || '—'}</td>
                    <td style={{ border: `1px solid ${withAlpha(textColor, 0.10)}`, padding: '0.25em 0.4em' }}>{m.via || '—'}</td>
                    <td style={{ border: `1px solid ${withAlpha(textColor, 0.10)}`, padding: '0.25em 0.4em' }}>{m.duration || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Indications */}
        {showIndications && indicationsText && (
          <div style={{ marginTop: '0.7em' }}>
            <div style={{ fontSize: '0.78em', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', borderBottom: `1px solid ${withAlpha(primary, 0.18)}`, paddingBottom: '0.15em', marginBottom: '0.3em', color: primary }}>
              Indicaciones generales
            </div>
            <div style={{ fontSize: '1em', lineHeight, whiteSpace: 'pre-wrap', padding: '0.4em 0.5em', background: withAlpha(textColor, 0.03), ...cardBorder, borderLeft: `3px solid ${accent}` }}>
              {indicationsText}
            </div>
          </div>
        )}

        {/* QR verification */}
        {showQrVerification && (
          <div style={{ marginTop: '0.8em', display: 'flex', alignItems: 'center', gap: '0.8em', padding: '0.6em 0.7em', ...cardBorder, background: withAlpha(accent, 0.05) }}>
            {/* QR placeholder */}
            <div
              style={{
                width: 'calc(60px * 0.42)',
                height: 'calc(60px * 0.42)',
                background: '#fff',
                border: `1px solid ${withAlpha(textColor, 0.20)}`,
                display: 'grid',
                gridTemplateColumns: 'repeat(8, 1fr)',
                gridTemplateRows: 'repeat(8, 1fr)',
                padding: '2px',
                flexShrink: 0,
              }}
              aria-label="Código QR de verificación"
            >
              {Array.from({ length: 64 }).map((_, i) => {
                const seed = (i * 7 + folio.charCodeAt(0)) % 3 === 0
                return (
                  <div key={i} style={{ background: seed ? textColor : 'transparent' }} />
                )
              })}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.85em', fontWeight: 700, color: primary }}>Verifica tu receta</div>
              <div style={{ fontSize: '0.72em', color: withAlpha(textColor, 0.65), fontFamily: "'Courier New', monospace" }}>
                Folio: {folio}
              </div>
              <div style={{ fontSize: '0.7em', color: withAlpha(textColor, 0.55) }}>
                Escanea para validar autenticidad
              </div>
            </div>
          </div>
        )}

        {/* Signature */}
        {showSignature && (
          <div style={{ marginTop: '4em', textAlign: 'center' }}>
            <div style={{ borderTop: `1.5px solid ${textColor}`, width: '60%', margin: '0 auto 0.3em' }} />
            <div style={{ fontWeight: 700, fontSize: '1em', color: primary }}>{doctorName}</div>
            <div style={{ fontSize: '0.85em', color: withAlpha(textColor, 0.65), marginTop: '0.05em' }}>
              {doctorSpecialty}
              {doctorCedula && ` · Cédula: ${doctorCedula}`}
              {doctorCert && ` · Cert: ${doctorCert}`}
            </div>
            <div style={{ fontSize: '0.78em', color: withAlpha(textColor, 0.55), marginTop: '0.1em', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {sigLabel}
            </div>
          </div>
        )}

        {/* Footer */}
        {showFooter && footerPieces.length > 0 && (
          <div style={{ marginTop: '2em', borderTop: `1px solid ${withAlpha(textColor, 0.18)}`, paddingTop: '0.4em', display: 'flex', flexDirection: 'column', gap: '0.15em', color: withAlpha(textColor, 0.65) }}>
            {footerPieces}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72em', color: withAlpha(textColor, 0.45), marginTop: '0.2em' }}>
              <div>{clinic?.name || 'Clínica CENPOD'} · Receta {folio}</div>
              <div>Generada el {new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
