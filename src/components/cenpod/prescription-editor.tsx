'use client'

import { useState, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Save, Printer, Upload, RotateCcw, Image as ImageIcon, ChevronDown,
  ZoomIn, ZoomOut, Maximize2, Smartphone, Palette, FileText, Settings2,
  UserCog, Type, Footprints, Check,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  PrescriptionLivePreview,
  type PrescriptionDesign,
  type PrescriptionPreviewData,
} from './prescription-preview'

// ============================================================
// PrescriptionEditor
// Editor visual del diseño de recetas con preview en vivo.
// Guarda en ClinicConfig.prescriptionDesign vía PATCH /api/config/plantillas.
// Sube logo vía POST /api/config/logo.
// Imprime una receta de prueba abriendo /api/recetas/test/print?design=...
// ============================================================

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

const SAMPLE_DATA: PrescriptionPreviewData = {
  id: 'PREVIEW-RX-0001',
  date: new Date().toISOString(),
  diagnosis: 'Onicomicosis en primer dedo del pie derecho',
  medications: [
    { name: 'Terbinafina 250 mg', dose: '1 tableta cada 24h', via: 'Oral', duration: '6 semanas' },
    { name: 'Crema ketoconazol 2%', dose: 'Aplicar 2 veces al día', via: 'Tópica', duration: '4 semanas' },
    { name: 'Ibuprofeno 400 mg', dose: '1 cada 8 horas', via: 'Oral', duration: '5 días' },
  ],
  indications: 'Reposo relativo, control en una semana, evitar humedad en pies, uso de calzado amplio y transpirable.',
  patient: {
    firstName: 'María',
    lastName: 'González Pérez',
    name: 'María González Pérez',
    expNumber: 'C1-00001',
    birthDate: '1980-05-15',
    sex: 'F',
    phone: '6621234567',
  },
  podologist: {
    name: 'Dr. Juan Carlos Méndez',
    specialty: 'Podología',
    cedula: '1234567',
    certNumber: 'CONPOD-456',
  },
  clinic: null, // se rellena desde useConfig
}

// ============================================================
// Plantillas predefinidas
// ============================================================

type TemplateKey = 'classic' | 'minimalist' | 'compact' | 'digital-qr' | 'institutional'

const TEMPLATES: { key: TemplateKey; name: string; description: string; swatch: string[]; patch: PrescriptionDesign }[] = [
  {
    key: 'classic',
    name: 'Clínica clásica',
    description: 'Serif elegante, bordes redondeados, encabezado clásico.',
    swatch: ['#0a3143', '#ffffff', '#888'],
    patch: {
      template: 'classic',
      fontFamily: "'Times New Roman', Georgia, serif",
      fontFamilyCategory: 'serif',
      primaryColor: '#0a3143',
      accentColor: '#0a3143',
      headerStyle: 'classic',
      borderStyle: 'rounded',
      borderRadius: 8,
      fontSize: 13,
      margins: 16,
      logoSize: 78,
      paperSize: 'A4',
      watermarkEnabled: false,
      showFooterAddress: true,
      showFooterHours: false,
      showFooterDigitalSign: false,
      showFooterFollowupMsg: false,
      showQrVerification: false,
    },
  },
  {
    key: 'minimalist',
    name: 'Minimalista premium',
    description: 'Sans-serif, sin bordes, máxima limpieza visual.',
    swatch: ['#1a1a1a', '#ffffff', '#ccc'],
    patch: {
      template: 'minimalist',
      fontFamily: "Arial, Helvetica, sans-serif",
      fontFamilyCategory: 'sans-serif',
      primaryColor: '#1a1a1a',
      accentColor: '#1a1a1a',
      headerStyle: 'modern',
      borderStyle: 'none',
      borderRadius: 0,
      fontSize: 12,
      margins: 16,
      logoSize: 64,
      paperSize: 'A4',
      watermarkEnabled: false,
      showFooterAddress: true,
      showFooterHours: false,
      showFooterDigitalSign: false,
      showFooterFollowupMsg: true,
    },
  },
  {
    key: 'compact',
    name: 'Compacta',
    description: 'Media carta, fuente pequeña, ahorra papel.',
    swatch: ['#2563eb', '#ffffff', '#aaa'],
    patch: {
      template: 'compact',
      fontFamily: "Arial, Helvetica, sans-serif",
      fontFamilyCategory: 'sans-serif',
      primaryColor: '#2563eb',
      accentColor: '#2563eb',
      headerStyle: 'compact',
      borderStyle: 'rounded',
      borderRadius: 6,
      fontSize: 11,
      margins: 12,
      logoSize: 56,
      paperSize: 'MediaCarta',
      watermarkEnabled: false,
      showFooterAddress: true,
      showFooterHours: false,
      showFooterDigitalSign: false,
      showFooterFollowupMsg: false,
      showQrVerification: false,
    },
  },
  {
    key: 'digital-qr',
    name: 'Digital con QR',
    description: 'Para envío por PDF, incluye QR de verificación.',
    swatch: ['#7c3aed', '#ffffff', '#bbb'],
    patch: {
      template: 'digital-qr',
      fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      fontFamilyCategory: 'system',
      primaryColor: '#7c3aed',
      accentColor: '#7c3aed',
      headerStyle: 'modern',
      borderStyle: 'rounded',
      borderRadius: 8,
      fontSize: 13,
      margins: 16,
      logoSize: 72,
      paperSize: 'A4',
      watermarkEnabled: false,
      showQrVerification: true,
      sendPdfToPatient: true,
      showFooterAddress: true,
      showFooterHours: false,
      showFooterDigitalSign: true,
      showFooterFollowupMsg: true,
    },
  },
  {
    key: 'institutional',
    name: 'Institucional',
    description: 'Para clínicas grandes, con horario y dirección.',
    swatch: ['#0a3143', '#f8f8f8', '#666'],
    patch: {
      template: 'institutional',
      fontFamily: "'Times New Roman', Georgia, serif",
      fontFamilyCategory: 'serif',
      primaryColor: '#0a3143',
      accentColor: '#0a3143',
      headerStyle: 'classic',
      borderStyle: 'square',
      borderRadius: 0,
      fontSize: 13,
      margins: 16,
      logoSize: 78,
      paperSize: 'A4',
      watermarkEnabled: false,
      showFooterAddress: true,
      showFooterHours: true,
      showFooterDigitalSign: false,
      showFooterFollowupMsg: false,
    },
  },
]

function applyTemplate(design: PrescriptionDesign, key: TemplateKey): PrescriptionDesign {
  const tpl = TEMPLATES.find((t) => t.key === key)
  if (!tpl) return design
  return { ...design, ...tpl.patch }
}

// ============================================================
// Componente principal
// ============================================================

export function PrescriptionEditor() {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Cargar configuración existente
  const { data: configData, isLoading } = useQuery<any>({
    queryKey: ['config'],
    queryFn: () => fetch('/api/config').then((r) => r.json()),
  })

  const clinic = configData?.clinic

  // Estado del diseño. Se inicializa una sola vez cuando llega la data.
  const [design, setDesign] = useState<PrescriptionDesign | null>(null)
  const [uploadedLogoUrl, setUploadedLogoUrl] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [mobilePreview, setMobilePreview] = useState(false)
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({
    1: true, 2: false, 3: true, 4: false, 5: false, 6: false,
  })

  // Inicializar diseño desde config (una sola vez)
  if (!isLoading && configData && !design) {
    let parsed: PrescriptionDesign = DEFAULT_DESIGN
    const raw = configData?.config?.prescriptionDesign
    if (raw) {
      try {
        parsed = { ...DEFAULT_DESIGN, ...(JSON.parse(raw) as Partial<PrescriptionDesign>) }
      } catch {
        parsed = DEFAULT_DESIGN
      }
    }
    // Si la clínica ya tiene logo, mostrarlo por defecto (logoUrl='auto')
    if (clinic?.logoUrl && parsed.logoUrl === undefined) {
      parsed.logoUrl = 'auto'
    }
    setDesign(parsed)
  }

  function update(patch: Partial<PrescriptionDesign>) {
    setDesign((d) => (d ? { ...d, ...patch } : d))
  }

  function toggleSection(idx: number) {
    setOpenSections((s) => ({ ...s, [idx]: !s[idx] }))
  }

  // Guardar diseño
  const saveMut = useMutation({
    mutationFn: async (body: PrescriptionDesign) => {
      const r = await fetch('/api/config/plantillas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prescriptionDesign: JSON.stringify(body) }),
      })
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e.error || 'Error al guardar')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('Diseño de receta guardado')
      qc.invalidateQueries({ queryKey: ['config'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // Subir logo
  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch('/api/config/logo', { method: 'POST', body: fd })
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e.error || 'Error al subir el logo')
      }
      return r.json() as Promise<{ url: string }>
    },
    onSuccess: (data) => {
      toast.success('Logo subido correctamente')
      setUploadedLogoUrl(data.url)
      update({ logoUrl: data.url })
      qc.invalidateQueries({ queryKey: ['config'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    uploadMut.mutate(f)
  }

  function handleReset() {
    if (!confirm('¿Restablecer el diseño a los valores por defecto? Se perderán los cambios no guardados.')) return
    setDesign({ ...DEFAULT_DESIGN, logoUrl: clinic?.logoUrl ? 'auto' : 'none' })
    toast.info('Diseño restablecido. Recuerda guardar.')
  }

  function handlePrintTest() {
    if (!design) return
    const html = buildTestPrintHtml(design, {
      ...SAMPLE_DATA,
      clinic: clinic || null,
    })
    const w = window.open('', '_blank', 'width=900,height=1000')
    if (!w) {
      toast.error('Habilita las ventanas emergentes para imprimir la prueba.')
      return
    }
    w.document.open()
    w.document.write(html)
    w.document.close()
    setTimeout(() => {
      try {
        w.focus()
        w.print()
      } catch {}
    }, 400)
  }

  if (isLoading || !design) {
    return <Skeleton className="h-96" />
  }

  // Resolve logo URL for preview
  const previewLogoUrl =
    design.logoUrl === 'none' ? null
      : design.logoUrl && design.logoUrl !== 'auto' ? design.logoUrl
      : clinic?.logoUrl || uploadedLogoUrl || null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Columna izquierda: 6 secciones numeradas y collapsibles */}
      <div className="space-y-3 lg:col-span-2">
        {/* SECCIÓN 1 — Plantilla de receta */}
        <SectionCard
          index={1}
          title="Plantilla de receta"
          icon={<FileText className="h-4 w-4" />}
          isOpen={!!openSections[1]}
          onToggle={() => toggleSection(1)}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TEMPLATES.map((tpl) => {
              const selected = (design.template || 'classic') === tpl.key
              return (
                <button
                  key={tpl.key}
                  type="button"
                  onClick={() => setDesign((d) => (d ? applyTemplate(d, tpl.key) : d))}
                  className={`relative text-left rounded-lg border p-3 transition-all hover:border-primary/60 hover:shadow-sm ${
                    selected ? 'border-primary ring-1 ring-primary/40 bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex gap-0.5">
                      {tpl.swatch.map((c, i) => (
                        <div key={i} className="w-3 h-3 rounded-sm border border-black/10" style={{ background: c }} />
                      ))}
                    </div>
                    {selected && (
                      <Badge className="ml-auto text-[9px] h-4 px-1" style={{ background: '#0a3143' }}>
                        <Check className="h-2.5 w-2.5 mr-0.5" /> Activa
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs font-semibold text-foreground">{tpl.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{tpl.description}</div>
                </button>
              )
            })}
          </div>
        </SectionCard>

        {/* SECCIÓN 2 — Tamaño y entrega */}
        <SectionCard
          index={2}
          title="Tamaño y entrega"
          icon={<Footprints className="h-4 w-4" />}
          isOpen={!!openSections[2]}
          onToggle={() => toggleSection(2)}
        >
          <div className="space-y-3">
            <div>
              <Label className="text-xs mb-1.5 block">Tamaño de papel</Label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { v: 'A4', label: 'A4', sub: '210×297' },
                  { v: 'MediaCarta', label: 'Media carta', sub: '140×216' },
                  { v: 'Letter', label: 'Carta', sub: '216×279' },
                ] as const).map((opt) => {
                  const selected = (design.paperSize || 'A4') === opt.v
                  return (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => update({ paperSize: opt.v })}
                      className={`rounded-md border p-2 text-center transition-all hover:border-primary/60 ${
                        selected ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border'
                      }`}
                    >
                      <div className="text-xs font-semibold">{opt.label}</div>
                      <div className="text-[9px] text-muted-foreground">{opt.sub}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <ToggleRow
                label="Preparar para impresión"
                hint="Optimiza márgenes y colores para impresora."
                value={design.prepareForPrint !== false}
                onChange={(v) => update({ prepareForPrint: v })}
              />
              <ToggleRow
                label="Enviar PDF al paciente"
                hint="Genera PDF descargable y envía por WhatsApp/correo."
                value={design.sendPdfToPatient === true}
                onChange={(v) => update({ sendPdfToPatient: v })}
              />
              <ToggleRow
                label="Mostrar QR de verificación"
                hint="Añade un código QR al final de la receta."
                value={design.showQrVerification === true}
                onChange={(v) => update({ showQrVerification: v })}
              />
            </div>

            <Separator />

            <SliderControl
              label="Márgenes"
              value={design.margins ?? 16}
              min={8}
              max={40}
              unit="mm"
              onChange={(v) => update({ margins: v })}
            />
          </div>
        </SectionCard>

        {/* SECCIÓN 3 — Cabecera profesional */}
        <SectionCard
          index={3}
          title="Cabecera profesional"
          icon={<UserCog className="h-4 w-4" />}
          isOpen={!!openSections[3]}
          onToggle={() => toggleSection(3)}
        >
          <div className="space-y-4">
            {/* Logo */}
            <div className="space-y-2">
              <Label className="text-xs">Logo</Label>
              <div className="flex items-start gap-3">
                <div className="w-20 h-20 rounded-md border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden shrink-0">
                  {previewLogoUrl ? (
                    <img
                      src={previewLogoUrl}
                      alt="logo"
                      className="max-w-full max-h-full object-contain"
                      style={{
                        ...(design.logoContain || design.logoBgTransparent ? { mixBlendMode: 'multiply' } : {}),
                      }}
                    />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadMut.isPending}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {uploadMut.isPending ? 'Subiendo…' : previewLogoUrl ? 'Cambiar' : 'Subir'}
                    </Button>
                    {previewLogoUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => update({ logoUrl: 'none' })}
                      >
                        Quitar
                      </Button>
                    )}
                  </div>
                  <ToggleRow
                    label="Fondo transparente"
                    hint="Mezcla el logo con el fondo (elimina bordes blancos)."
                    value={design.logoContain === true || design.logoBgTransparent === true}
                    onChange={(v) => update({ logoContain: v, logoBgTransparent: v })}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Datos del médico */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs">Datos del médico</Label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => update({ doctorNameMode: 'podologist' })}
                    className={`text-[10px] px-2 py-0.5 rounded ${design.doctorNameMode !== 'fixed' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                  >
                    Usar podólogo
                  </button>
                  <button
                    type="button"
                    onClick={() => update({ doctorNameMode: 'fixed' })}
                    className={`text-[10px] px-2 py-0.5 rounded ${design.doctorNameMode === 'fixed' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                  >
                    Nombre fijo
                  </button>
                </div>
              </div>
              {design.doctorNameMode === 'fixed' && (
                <Input
                  value={design.doctorFixedName || ''}
                  onChange={(e) => update({ doctorFixedName: e.target.value })}
                  placeholder="Nombre del responsable (ej. Dr. Juan Pérez)"
                  className="h-9"
                />
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Cédula profesional</Label>
                  <Input
                    value={design.doctorCedula || ''}
                    onChange={(e) => update({ doctorCedula: e.target.value })}
                    placeholder="Heredada del podólogo"
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Especialidad</Label>
                  <Input
                    value={design.doctorSpecialty || ''}
                    onChange={(e) => update({ doctorSpecialty: e.target.value })}
                    placeholder="Heredada del podólogo"
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Teléfono</Label>
                  <Input
                    value={design.doctorPhone || ''}
                    onChange={(e) => update({ doctorPhone: e.target.value })}
                    placeholder="Teléfono del consultorio"
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Dirección</Label>
                  <Input
                    value={design.doctorAddress || ''}
                    onChange={(e) => update({ doctorAddress: e.target.value })}
                    placeholder="Dirección del consultorio"
                    className="h-9"
                  />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Si dejas un campo vacío, se usará el valor del podólogo que receta.
              </p>
            </div>

            <Separator />

            {/* Alineación */}
            <div>
              <Label className="text-xs mb-1.5 block">Alineación del header</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['left', 'center', 'right'] as const).map((p) => {
                  const selected = (design.logoPosition || 'left') === p
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => update({ logoPosition: p })}
                      className={`rounded-md border p-2 text-center text-xs transition-all hover:border-primary/60 ${
                        selected ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border'
                      }`}
                    >
                      {p === 'left' ? 'Izquierda' : p === 'center' ? 'Centro' : 'Derecha'}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Layout del header */}
            <div>
              <Label className="text-xs mb-1.5 block">Layout del header</Label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { v: 'logo-text', label: 'Logo + texto' },
                  { v: 'text-only', label: 'Solo texto' },
                  { v: 'logo-only', label: 'Solo logo' },
                  { v: 'logo-top-text-bottom', label: 'Logo arriba / texto abajo' },
                ] as const).map((opt) => {
                  const selected = (design.headerLayout || 'logo-text') === opt.v
                  return (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => update({ headerLayout: opt.v })}
                      className={`rounded-md border p-2 text-center text-xs transition-all hover:border-primary/60 ${
                        selected ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SliderControl
                label="Tamaño del logo"
                value={design.logoSize ?? 78}
                min={40}
                max={200}
                unit="px"
                onChange={(v) => update({ logoSize: v })}
              />
              <SliderControl
                label="Opacidad del logo"
                value={design.logoOpacity ?? 100}
                min={10}
                max={100}
                unit="%"
                onChange={(v) => update({ logoOpacity: v })}
              />
            </div>
          </div>
        </SectionCard>

        {/* SECCIÓN 4 — Estilo visual */}
        <SectionCard
          index={4}
          title="Estilo visual"
          icon={<Palette className="h-4 w-4" />}
          isOpen={!!openSections[4]}
          onToggle={() => toggleSection(4)}
        >
          <div className="space-y-3">
            <ColorControl
              label="Color institucional"
              value={design.primaryColor || '#0a3143'}
              onChange={(v) => update({ primaryColor: v, accentColor: v })}
            />
            <ColorControl
              label="Color del texto"
              value={design.textColor || '#111111'}
              onChange={(v) => update({ textColor: v })}
            />
            <ColorControl
              label="Color de fondo"
              value={design.backgroundColor || '#ffffff'}
              onChange={(v) => update({ backgroundColor: v })}
            />
            <button
              type="button"
              onClick={() => update({ primaryColor: '#0a3143', accentColor: '#0a3143', textColor: '#111111', backgroundColor: '#ffffff' })}
              className="text-[10px] text-muted-foreground underline hover:text-foreground"
            >
              Restablecer colores CENPOD
            </button>

            <Separator />

            <div>
              <Label className="text-xs mb-1.5 block">Tipografía</Label>
              <Select
                value={design.fontFamilyCategory || 'serif'}
                onValueChange={(v) => {
                  const cat = v as 'serif' | 'sans-serif' | 'system'
                  const fam = cat === 'serif'
                    ? "'Times New Roman', Georgia, serif"
                    : cat === 'sans-serif'
                      ? 'Arial, Helvetica, sans-serif'
                      : "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                  update({ fontFamilyCategory: cat, fontFamily: fam })
                }}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="serif">Serif (Times / Georgia)</SelectItem>
                  <SelectItem value="sans-serif">Sans-serif (Arial / Helvetica)</SelectItem>
                  <SelectItem value="system">System (UI)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">Encabezado</Label>
                <Select
                  value={design.headerStyle || 'classic'}
                  onValueChange={(v) => update({ headerStyle: v as any })}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="classic">Clásico</SelectItem>
                    <SelectItem value="modern">Moderno</SelectItem>
                    <SelectItem value="compact">Compacto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Bordes</Label>
                <Select
                  value={design.borderStyle || 'rounded'}
                  onValueChange={(v) => update({ borderStyle: v as any, borderRadius: v === 'rounded' ? 8 : v === 'square' ? 0 : 0 })}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rounded">Redondeados</SelectItem>
                    <SelectItem value="square">Cuadrados</SelectItem>
                    <SelectItem value="none">Sin bordes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {design.borderStyle !== 'none' && (
              <SliderControl
                label="Radio del borde"
                value={design.borderRadius ?? 8}
                min={0}
                max={16}
                unit="px"
                onChange={(v) => update({ borderRadius: v })}
              />
            )}

            <SliderControl
              label="Tamaño de fuente"
              value={design.fontSize ?? 13}
              min={10}
              max={18}
              unit="px"
              onChange={(v) => update({ fontSize: v })}
            />

            <SliderControl
              label="Interlineado"
              value={Math.round((design.lineHeight ?? 1.5) * 10) / 10}
              min={12}
              max={20}
              step={1}
              unit=""
              transform={(v) => v / 10}
              onChange={(v) => update({ lineHeight: Math.round(v * 10) / 10 })}
            />

            <Separator />

            {/* Watermark */}
            <div className="space-y-2">
              <ToggleRow
                label="Marca de agua"
                value={design.watermarkEnabled === true}
                onChange={(v) => update({ watermarkEnabled: v })}
              />
              {design.watermarkEnabled && (
                <div className="space-y-3 pl-1 border-l-2 border-muted ml-1">
                  <SliderControl
                    label="Opacidad"
                    value={design.watermarkOpacity ?? 10}
                    min={5}
                    max={30}
                    unit="%"
                    onChange={(v) => update({ watermarkOpacity: v })}
                  />
                  <SliderControl
                    label="Tamaño"
                    value={design.watermarkSize ?? 60}
                    min={20}
                    max={100}
                    unit="%"
                    onChange={(v) => update({ watermarkSize: v })}
                  />
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Texto marca de agua (sin logo)</Label>
                    <Input
                      value={design.watermarkText || ''}
                      onChange={(e) => update({ watermarkText: e.target.value })}
                      placeholder="Ej: CONFIDENCIAL"
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Posición</Label>
                    <Select
                      value={design.watermarkPosition || 'center'}
                      onValueChange={(v) => update({ watermarkPosition: v as any })}
                    >
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="center">Centro</SelectItem>
                        <SelectItem value="top-right">Superior derecha</SelectItem>
                        <SelectItem value="bottom-right">Inferior derecha</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </SectionCard>

        {/* SECCIÓN 5 — Contenido clínico */}
        <SectionCard
          index={5}
          title="Contenido clínico"
          icon={<Type className="h-4 w-4" />}
          isOpen={!!openSections[5]}
          onToggle={() => toggleSection(5)}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <ToggleRow label="Encabezado clínica" value={design.showHeader !== false} onChange={(v) => update({ showHeader: v })} />
            <ToggleRow label="Datos del paciente" value={design.showPatientInfo !== false} onChange={(v) => update({ showPatientInfo: v })} />
            <ToggleRow label="Datos del médico" value={design.showDoctorInfo !== false} onChange={(v) => update({ showDoctorInfo: v })} />
            <ToggleRow label="Diagnóstico" value={design.showDiagnosis !== false} onChange={(v) => update({ showDiagnosis: v })} />
            <ToggleRow label="Símbolo ℞" value={design.showRxSymbol !== false} onChange={(v) => update({ showRxSymbol: v })} />
            <ToggleRow label="Tabla de medicamentos" value={design.showMedications !== false} onChange={(v) => update({ showMedications: v })} />
            <ToggleRow label="Indicaciones generales" value={design.showIndications !== false} onChange={(v) => update({ showIndications: v })} />
            <ToggleRow label="Línea de firma y sello" value={design.showSignature !== false} onChange={(v) => update({ showSignature: v })} />
          </div>

          <Separator className="my-3" />

          <div className="space-y-2">
            <Label className="text-xs">Etiqueta bajo la firma</Label>
            <Input
              value={design.signatureLabel || ''}
              onChange={(e) => update({ signatureLabel: e.target.value })}
              placeholder="Cédula profesional"
              className="h-9"
            />
            <p className="text-[10px] text-muted-foreground">
              Ejemplos: &ldquo;Cédula profesional&rdquo;, &ldquo;Matrícula&rdquo;, &ldquo;Certificación&rdquo;.
            </p>
          </div>
        </SectionCard>

        {/* SECCIÓN 6 — Pie de página */}
        <SectionCard
          index={6}
          title="Pie de página"
          icon={<Settings2 className="h-4 w-4" />}
          isOpen={!!openSections[6]}
          onToggle={() => toggleSection(6)}
        >
          <div className="space-y-2">
            <ToggleRow label="Dirección del consultorio" value={design.showFooterAddress !== false} onChange={(v) => update({ showFooterAddress: v })} />
            <ToggleRow label="Horario de atención" value={design.showFooterHours === true} onChange={(v) => update({ showFooterHours: v })} />
            <ToggleRow label="Firma digital" value={design.showFooterDigitalSign === true} onChange={(v) => update({ showFooterDigitalSign: v })} />
            <ToggleRow label="Mensaje de seguimiento" value={design.showFooterFollowupMsg === true} onChange={(v) => update({ showFooterFollowupMsg: v })} />

            {(design.showFooterHours || design.showFooterFollowupMsg) && (
              <>
                <Separator className="my-2" />
                {design.showFooterHours && (
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Horario</Label>
                    <Input
                      value={design.footerHours || ''}
                      onChange={(e) => update({ footerHours: e.target.value })}
                      placeholder="Lun – Vie: 9:00 – 19:00"
                      className="h-9"
                    />
                  </div>
                )}
                {design.showFooterFollowupMsg && (
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Mensaje de seguimiento</Label>
                    <Input
                      value={design.footerFollowupMsg || ''}
                      onChange={(e) => update({ footerFollowupMsg: e.target.value })}
                      placeholder="Gracias por su confianza."
                      className="h-9"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </SectionCard>

        {/* Acciones */}
        <div className="flex flex-wrap gap-2 justify-end pt-1">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" /> Restablecer
          </Button>
          <Button variant="outline" onClick={handlePrintTest}>
            <Printer className="h-4 w-4" /> Imprimir prueba
          </Button>
          <Button
            onClick={() => saveMut.mutate(design)}
            disabled={saveMut.isPending}
            style={{ backgroundColor: '#0a3143' }}
          >
            <Save className="h-4 w-4" />
            {saveMut.isPending ? 'Guardando…' : 'Guardar diseño'}
          </Button>
        </div>
      </div>

      {/* Columna derecha: preview en vivo */}
      <div className="lg:col-span-3">
        <div className="lg:sticky lg:top-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">Vista previa en vivo</CardTitle>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
                    title="Alejar"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </Button>
                  <button
                    type="button"
                    onClick={() => setZoom(1)}
                    className="text-xs font-mono px-2 py-1 rounded border bg-background hover:bg-accent min-w-[3rem]"
                    title="Restablecer zoom"
                  >
                    {Math.round(zoom * 100)}%
                  </button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
                    title="Acercar"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setZoom(1)}
                    title="Ajustar"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={mobilePreview ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setMobilePreview((v) => !v)}
                    title="Vista móvil"
                    style={mobilePreview ? { backgroundColor: '#0a3143' } : {}}
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-[10px]">
                  {design.paperSize === 'MediaCarta' ? 'Media carta' : design.paperSize === 'Letter' ? 'Carta' : 'A4'}
                </Badge>
                {design.template && (
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {TEMPLATES.find((t) => t.key === design.template)?.name || design.template}
                  </Badge>
                )}
                {design.showQrVerification && (
                  <Badge className="text-[10px] bg-emerald-100 text-emerald-700">QR ✓</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div
                className="bg-muted/40 rounded-md p-3 max-h-[80vh] overflow-auto"
                style={{ display: 'flex', justifyContent: 'center' }}
              >
                <div
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top center',
                    width: mobilePreview ? '380px' : '100%',
                    maxWidth: '100%',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  <PrescriptionLivePreview
                    design={design}
                    data={{ ...SAMPLE_DATA, clinic: clinic || null }}
                  />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 text-center">
                Vista previa con datos de ejemplo. La receta real usará los datos del paciente y la consulta.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────
//  Sub-componentes
// ───────────────────────────────────────────────────────────

function SectionCard({
  index,
  title,
  icon,
  isOpen,
  onToggle,
  children,
}: {
  index: number
  title: string
  icon: React.ReactNode
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/40 transition-colors"
        aria-expanded={isOpen}
      >
        <div
          className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0"
          style={{ background: '#0a3143', color: 'white' }}
        >
          {index}
        </div>
        <div className="flex items-center gap-2 flex-1">
          <span className="text-primary">{icon}</span>
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <div className="px-3 pb-3 pt-1">
          {children}
        </div>
      )}
    </Card>
  )
}

function SliderControl({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  transform,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit: string
  transform?: (v: number) => number
  onChange: (v: number) => void
}) {
  const displayValue = transform ? transform(value) : value
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs font-mono text-muted-foreground">
          {displayValue}
          {unit}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
      />
    </div>
  )
}

function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-xs flex-1">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 rounded border border-border cursor-pointer bg-transparent p-0.5"
          aria-label={label}
        />
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-20 font-mono text-xs"
        />
      </div>
    </div>
  )
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-md border p-2">
      <div className="flex-1 min-w-0">
        <div className="text-xs">{label}</div>
        {hint && <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{hint}</div>}
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  )
}

// ───────────────────────────────────────────────────────────
//  HTML para impresión de prueba
//  Genera el mismo HTML que /api/recetas/[id]/print pero con datos
//  de ejemplo y el diseño actual, sin necesidad de crear una receta.
// ───────────────────────────────────────────────────────────

function buildTestPrintHtml(design: PrescriptionDesign, data: PrescriptionPreviewData): string {
  const d = { ...DEFAULT_DESIGN, ...design }
  const primary = d.primaryColor!
  const accent = d.accentColor || primary
  const textColor = d.textColor!
  const bgColor = d.backgroundColor!
  const fontSize = d.fontSize!
  const lineHeight = d.lineHeight!
  const margins = d.margins!
  const logoSize = d.logoSize!
  const borderRadius = d.borderRadius ?? (d.borderStyle === 'rounded' ? 8 : 0)

  const paperSize = d.paperSize || 'A4'
  const paperCss = paperSize === 'Letter' ? 'Letter' : paperSize === 'MediaCarta' ? '140mm 216mm' : 'A4'
  const paperW = paperSize === 'Letter' ? '216mm' : paperSize === 'MediaCarta' ? '140mm' : '210mm'
  const paperH = paperSize === 'Letter' ? '279mm' : paperSize === 'MediaCarta' ? '216mm' : '297mm'

  const fontFamily =
    d.fontFamily ||
    (d.fontFamilyCategory === 'sans-serif'
      ? 'Arial, Helvetica, sans-serif'
      : d.fontFamilyCategory === 'system'
        ? "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
        : "'Times New Roman', Georgia, serif")

  const clinic = data.clinic
  const patient = data.patient
  const pod = data.podologist

  let logoUrl = ''
  if (d.logoUrl === 'none') logoUrl = ''
  else if (d.logoUrl && d.logoUrl !== 'auto') logoUrl = d.logoUrl
  else if (clinic?.logoUrl) logoUrl = clinic.logoUrl

  const patientName = patient?.name || (patient ? `${patient.firstName} ${patient.lastName}` : 'Paciente de ejemplo')
  const doctorNameMode = d.doctorNameMode || 'podologist'
  const doctorName = doctorNameMode === 'fixed' && d.doctorFixedName
    ? d.doctorFixedName
    : (pod?.name || 'Dr. Ejemplo')
  const doctorCedula = d.doctorCedula || pod?.cedula || '1234567'
  const doctorSpecialty = d.doctorSpecialty || pod?.specialty || 'Podología'
  const doctorPhone = d.doctorPhone || clinic?.phone || ''
  const doctorAddress = d.doctorAddress || clinic?.address || ''
  const doctorCert = pod?.certNumber || ''

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

  const headerLayout = d.headerLayout || 'logo-text'
  const headerStyle = d.headerStyle || 'classic'
  const borderStyle = d.borderStyle || 'rounded'
  const logoContain = d.logoContain === true
  const logoBgTransparent = d.logoBgTransparent === true
  const showFooterAddress = d.showFooterAddress !== false
  const showFooterHours = d.showFooterHours === true
  const showFooterDigitalSign = d.showFooterDigitalSign === true
  const showFooterFollowupMsg = d.showFooterFollowupMsg === true
  const footerFollowupMsg = d.footerFollowupMsg || 'Gracias por su confianza.'
  const footerHours = d.footerHours || 'Lun – Vie: 9:00 – 19:00'
  const showQrVerification = d.showQrVerification === true

  const wmEnabled = d.watermarkEnabled === true
  const wmOpacity = (d.watermarkOpacity ?? 10) / 100
  const wmPos = d.watermarkPosition || 'center'

  const metaCells: string[] = []
  if (showPatientInfo) {
    metaCells.push(`<div><strong>Paciente</strong> ${patientName}</div>`)
    metaCells.push(`<div><strong>Fecha</strong> ${new Date(data.date).toLocaleDateString('es-MX')}</div>`)
    metaCells.push(`<div><strong>Expediente</strong> ${patient?.expNumber || 'C1-00001'}</div>`)
    metaCells.push(`<div><strong>Edad</strong> 45 años</div>`)
  }
  if (showDoctorInfo) {
    metaCells.push(`<div><strong>Profesional</strong> ${doctorName}</div>`)
    if (doctorCedula) metaCells.push(`<div><strong>Cédula</strong> ${doctorCedula}</div>`)
    if (doctorSpecialty) metaCells.push(`<div><strong>Especialidad</strong> ${doctorSpecialty}</div>`)
  }

  const esc = (s: string | null | undefined) =>
    !s ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const meds = (data.medications && data.medications.length > 0 ? data.medications : [
    { name: 'Terbinafina 250 mg', dose: '1 tableta cada 24h', via: 'Oral', duration: '6 semanas' },
  ])

  const medsRows = meds.map((m, i) => `
    <tr>
      <td class="rx-num">${i + 1}</td>
      <td class="rx-med-name">${esc(m.name)}</td>
      <td>${esc(m.dose) || '—'}</td>
      <td>${esc(m.via) || '—'}</td>
      <td>${esc(m.duration) || '—'}</td>
    </tr>
  `).join('')

  // Logo con mix-blend-mode si aplica
  const logoBlendStyle = (logoContain || logoBgTransparent) ? 'mix-blend-mode: multiply;' : ''
  const logoHtml = logoUrl && headerLayout !== 'text-only'
    ? `<img src="${esc(logoUrl)}" alt="logo" class="rx-logo" style="opacity:${(d.logoOpacity ?? 100) / 100};${logoBlendStyle}"/>`
    : ''

  // Header layout
  let headerGridCss = ''
  if (headerLayout === 'text-only') {
    headerGridCss = `display:grid;grid-template-columns:1fr;gap:6px;justify-items:${d.logoPosition === 'center' ? 'center' : 'stretch'};text-align:${d.logoPosition === 'center' ? 'center' : 'left'};`
  } else if (headerLayout === 'logo-only') {
    headerGridCss = `display:grid;grid-template-columns:1fr;justify-items:${d.logoPosition === 'center' ? 'center' : d.logoPosition === 'right' ? 'end' : 'start'};`
  } else if (headerLayout === 'logo-top-text-bottom') {
    headerGridCss = `display:grid;grid-template-columns:1fr;gap:6px;justify-items:center;text-align:center;`
  } else {
    // logo-text
    if (d.logoPosition === 'center') {
      headerGridCss = `display:grid;grid-template-columns:1fr;gap:14px;justify-items:center;text-align:center;`
    } else if (d.logoPosition === 'right') {
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
    headerWrapperCss = `border-bottom:2.5px solid ${primary};padding-bottom:10px;margin-bottom:14px;`
  }
  const headerTextPrimary = headerStyle === 'modern' ? '#ffffff' : primary
  const headerTextSub = headerStyle === 'modern' ? 'rgba(255,255,255,0.85)' : 'rgba(17,17,17,0.70)'

  const headerInner = `
    <div style="${headerGridCss}">
      ${logoHtml}
      ${headerLayout !== 'logo-only' ? `
        <div class="rx-clinic-info" style="min-width:0;overflow:hidden;">
          <div class="rx-clinic-name" style="color:${headerTextPrimary};">${esc(clinic?.name || 'Clínica CENPOD')}</div>
          ${clinic?.razonSocial ? `<div class="rx-clinic-sub" style="color:${headerTextSub};">${esc(clinic.razonSocial)}</div>` : ''}
          ${doctorName ? `<div class="rx-clinic-line" style="color:${headerTextSub};font-weight:600;margin-top:2px;">${esc(doctorName)}${doctorSpecialty ? ` · ${esc(doctorSpecialty)}` : ''}${doctorCedula ? ` · Céd. ${esc(doctorCedula)}` : ''}</div>` : ''}
          ${doctorAddress ? `<div class="rx-clinic-line" style="color:${headerTextSub};">${esc(doctorAddress)}</div>` : ''}
          <div class="rx-clinic-line" style="color:${headerTextSub};">${doctorPhone ? `Tel. ${esc(doctorPhone)}` : ''}${doctorPhone && clinic?.email ? ' · ' : ''}${clinic?.email ? esc(clinic.email) : ''}</div>
          ${clinic?.rfc ? `<div class="rx-clinic-line" style="color:${headerTextSub};">RFC: ${esc(clinic.rfc)}</div>` : ''}
        </div>
      ` : ''}
    </div>
  `

  // Footer pieces
  const footerPieces: string[] = []
  if (showFooterAddress && doctorAddress) {
    footerPieces.push(`<div style="font-size:10px;">📍 ${esc(doctorAddress)}</div>`)
  }
  if (showFooterHours) {
    footerPieces.push(`<div style="font-size:10px;">🕒 ${esc(footerHours)}</div>`)
  }
  if (showFooterDigitalSign) {
    footerPieces.push(`<div style="font-size:9px;font-style:italic;color:#888;">✓ Documento firmado digitalmente</div>`)
  }
  if (showFooterFollowupMsg) {
    footerPieces.push(`<div style="font-size:10px;font-style:italic;color:${primary};">${esc(footerFollowupMsg)}</div>`)
  }

  const watermarkHtml = wmEnabled && (logoUrl || d.watermarkText)
    ? logoUrl
      ? `<div class="rx-watermark rx-wm-${wmPos}" style="opacity:${wmOpacity};"><img src="${esc(logoUrl)}" alt=""/></div>`
      : `<div class="rx-watermark rx-wm-${wmPos}" style="opacity:${wmOpacity};font-size:80px;font-weight:800;color:${primary};letter-spacing:0.15em;">${esc(d.watermarkText || 'CONFIDENCIAL')}</div>`
    : ''

  // QR placeholder HTML (CSS grid simulando un QR)
  const qrHtml = showQrVerification ? `
    <div style="margin-top:14px;display:flex;align-items:center;gap:12px;padding:10px 12px;border:${borderStyle === 'none' ? 'none' : `1px solid #e0e0e0`};border-radius:${borderRadius}px;background:${accent}0D;">
      <div style="width:60px;height:60px;background:#fff;border:1px solid #ccc;padding:3px;display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(8,1fr);">
        ${Array.from({ length: 64 }).map((_, i) => {
          const seed = (i * 7 + 65) % 3 === 0
          return `<div style="background:${seed ? textColor : 'transparent'};"></div>`
        }).join('')}
      </div>
      <div>
        <div style="font-size:11px;font-weight:700;color:${primary};">Verifica tu receta</div>
        <div style="font-size:9px;color:#666;font-family:'Courier New',monospace;">Folio: PRUEBA-0001</div>
        <div style="font-size:9px;color:#888;">Escanea para validar autenticidad</div>
      </div>
    </div>
  ` : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Receta de prueba</title>
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
    width: ${paperW};
    min-height: ${paperH};
    margin: 16px auto;
    padding: ${margins}mm;
    background: ${bgColor};
    box-shadow: 0 4px 18px rgba(0,0,0,.08);
    position: relative;
    overflow: hidden;
  }
  .rx-watermark { position: absolute; pointer-events: none; z-index: 0; display: flex; align-items: center; justify-content: center; }
  .rx-watermark img { object-fit: contain; }
  .rx-wm-center { top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; }
  .rx-wm-center img { max-width: ${d.watermarkSize ?? 60}%; max-height: ${d.watermarkSize ?? 60}%; }
  .rx-wm-top-right { top: ${margins}mm; right: ${margins}mm; }
  .rx-wm-top-right img { max-width: ${(d.watermarkSize ?? 60) * 2}px; max-height: ${(d.watermarkSize ?? 60) * 2}px; }
  .rx-wm-bottom-right { bottom: ${margins}mm; right: ${margins}mm; }
  .rx-wm-bottom-right img { max-width: ${(d.watermarkSize ?? 60) * 2}px; max-height: ${(d.watermarkSize ?? 60) * 2}px; }
  .rx-sheet > * { position: relative; z-index: 1; }
  .rx-logo { max-height: ${logoSize}px; max-width: ${Math.round(logoSize * 2.3)}px; object-fit: contain; }
  .rx-clinic-name { font-size: 22px; font-weight: 700; letter-spacing: 0.04em; line-height: 1.15; }
  .rx-clinic-sub { font-size: 12px; margin-top: 2px; }
  .rx-clinic-line { font-size: 11.5px; margin-top: 1px; }
  .rx-title-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
  .rx-title { font-size: 20px; font-weight: 700; color: ${primary}; letter-spacing: 0.1em; text-transform: uppercase; }
  .rx-folio { font-size: 11px; color: #888; font-family: 'Courier New', monospace; }
  .rx-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; padding: 10px 12px; background: ${accent}0F; border-left: 3px solid ${primary}; ${borderStyle === 'none' ? '' : `border-radius: ${borderRadius}px;`} margin-bottom: 14px; font-size: 12.5px; }
  .rx-meta-grid > div { line-height: 1.6; }
  .rx-meta-grid strong { color: ${primary}; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.06em; display: inline-block; min-width: 78px; }
  .rx-section { margin-top: 14px; }
  .rx-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; border-bottom: 1px solid #ddd; padding-bottom: 3px; margin-bottom: 6px; color: ${primary}; }
  .rx-section-body { font-size: 13px; line-height: ${lineHeight}; }
  .rx-rx-symbol { font-size: 38px; color: ${primary}; font-family: serif; line-height: 1; margin: 8px 0 4px; font-weight: 700; }
  .rx-meds-table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 12.5px; }
  .rx-meds-table th, .rx-meds-table td { border: 1px solid #e0e0e0; padding: 6px 8px; text-align: left; vertical-align: top; }
  .rx-meds-table th { font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 0.08em; color: ${primary}; }
  .rx-meds-table .rx-num { text-align: center; width: 28px; color: #777; }
  .rx-meds-table .rx-med-name { font-weight: 600; min-width: 38%; }
  .rx-meds-table tr:nth-child(even) td { background: #fafafa; }
  .rx-indications { white-space: pre-wrap; padding: 8px 10px; background: #fafafa; ${borderStyle === 'none' ? '' : `border-radius: ${borderRadius}px;`} border-left: 3px solid ${accent}; }
  .rx-signature { margin-top: 38mm; text-align: center; }
  .rx-sig-line { border-top: 1.5px solid ${textColor}; width: 260px; margin: 0 auto 6px; }
  .rx-sig-name { font-weight: 700; font-size: 13px; color: ${primary}; }
  .rx-sig-meta { font-size: 11px; color: #555; margin-top: 1px; }
  .rx-sig-label { font-size: 10px; color: #999; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.08em; }
  .rx-footer { position: absolute; bottom: ${Math.max(8, Math.round(margins / 2))}mm; left: ${margins}mm; right: ${margins}mm; border-top: 1px solid #ddd; padding-top: 6px; display: flex; flex-direction: column; gap: 2px; font-size: 10px; color: #888; }
  .rx-footer-bottom { display: flex; justify-content: space-between; font-size: 9px; color: #aaa; margin-top: 4px; }
  @media print {
    body { background: #fff; }
    .rx-sheet { width: auto; min-height: auto; margin: 0; padding: 0; box-shadow: none; }
    @page { size: ${paperCss}; margin: ${margins}mm; }
    .rx-footer { position: static; margin-top: 14mm; }
  }
</style>
</head>
<body>
  <div class="rx-sheet">
    ${watermarkHtml}
    ${showHeader ? `<div class="rx-header" style="${headerWrapperCss}">${headerInner}</div>` : ''}
    <div class="rx-title-row"><div class="rx-folio">Folio: PRUEBA-0001</div></div>
    ${metaCells.length > 0 ? `<div class="rx-meta-grid">${metaCells.join('')}</div>` : ''}
    ${showDiagnosis && data.diagnosis ? `<div class="rx-section"><div class="rx-section-title">Diagnóstico</div><div class="rx-section-body">${esc(data.diagnosis)}</div></div>` : ''}
    ${showRx ? `<div class="rx-rx-symbol">℞</div>` : ''}
    ${showMedications ? `<div class="rx-section"><div class="rx-section-title">Sugiero</div><table class="rx-meds-table"><thead><tr style="background:${accent}1A;"><th class="rx-num">#</th><th>Medicamento / Producto</th><th>Dosis</th><th>Vía</th><th>Duración</th></tr></thead><tbody>${medsRows}</tbody></table></div>` : ''}
    ${showIndications && data.indications ? `<div class="rx-section"><div class="rx-section-title">Indicaciones generales</div><div class="rx-section-body rx-indications">${esc(data.indications)}</div></div>` : ''}
    ${qrHtml}
    ${showSignature ? `<div class="rx-signature"><div class="rx-sig-line"></div><div class="rx-sig-name">${esc(doctorName)}</div><div class="rx-sig-meta">${esc(doctorSpecialty)}${doctorCedula ? ` · Cédula: ${esc(doctorCedula)}` : ''}${doctorCert ? ` · Cert: ${esc(doctorCert)}` : ''}</div><div class="rx-sig-label">${esc(sigLabel)}</div></div>` : ''}
    ${showFooter && footerPieces.length > 0 ? `<div class="rx-footer">${footerPieces.join('')}<div class="rx-footer-bottom"><div>${esc(clinic?.name || 'Clínica CENPOD')} · Receta de prueba</div><div>${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}</div></div></div>` : ''}
  </div>
</body>
</html>`
}
