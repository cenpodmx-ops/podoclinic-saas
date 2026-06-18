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
import { Save, Printer, Upload, RotateCcw, Image as ImageIcon } from 'lucide-react'
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
  watermarkPosition: 'center',
  showPatientInfo: true,
  showDoctorInfo: true,
  showDiagnosis: true,
  showMedications: true,
  showIndications: true,
  showSignature: true,
  doctorNameMode: 'podologist',
  doctorFixedName: '',
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
    // Abre una ventana con una receta de muestra usando el diseño actual.
    // Usamos una URL temporal que escribe el diseño en localStorage y luego
    // la página de print-test lo lee. Pero como solo tenemos /api/recetas/[id]/print,
    // usamos una alternativa: abrimos una ventana nueva y escribimos HTML inline
    // que simula la receta con el diseño actual.
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Columna izquierda: controles */}
      <div className="space-y-4">
        {/* Papel y logo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" /> Papel y logo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Logo upload */}
            <div className="space-y-2">
              <Label className="text-xs">Logo de la clínica</Label>
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadMut.isPending}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploadMut.isPending ? 'Subiendo…' : 'Subir logo'}
                </Button>
                {clinic?.logoUrl && (
                  <Badge className="bg-emerald-100 text-emerald-700 text-xs">✓ Logo subido</Badge>
                )}
              </div>
              {uploadedLogoUrl && (
                <Badge className="bg-emerald-100 text-emerald-700 text-xs">Logo nuevo subido ✓</Badge>
              )}
            </div>

            {/* Logo source */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Fuente del logo</Label>
                <Select
                  value={design.logoUrl === 'none' ? 'none' : design.logoUrl === 'auto' || !design.logoUrl ? 'auto' : 'custom'}
                  onValueChange={(v) => {
                    if (v === 'none') update({ logoUrl: 'none' })
                    else if (v === 'auto') update({ logoUrl: 'auto' })
                    else if (uploadedLogoUrl) update({ logoUrl: uploadedLogoUrl })
                    else update({ logoUrl: clinic?.logoUrl || 'auto' })
                  }}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automático (logo de la clínica)</SelectItem>
                    <SelectItem value="custom">Logo subido</SelectItem>
                    <SelectItem value="none">Sin logo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Posición del logo</Label>
                <Select value={design.logoPosition || 'left'} onValueChange={(v) => update({ logoPosition: v as any })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Izquierda</SelectItem>
                    <SelectItem value="center">Centro</SelectItem>
                    <SelectItem value="right">Derecha</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <SliderControl
              label="Tamaño del logo"
              value={design.logoSize ?? 78}
              min={40}
              max={400}
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

            <Separator />

            {/* Watermark */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Marca de agua (watermark)</Label>
                <Switch
                  checked={design.watermarkEnabled === true}
                  onCheckedChange={(v) => update({ watermarkEnabled: v })}
                />
              </div>
              {design.watermarkEnabled && (
                <>
                  <SliderControl
                    label="Opacidad watermark"
                    value={design.watermarkOpacity ?? 10}
                    min={5}
                    max={30}
                    unit="%"
                    onChange={(v) => update({ watermarkOpacity: v })}
                  />
                  <div>
                    <Label className="text-xs">Posición watermark</Label>
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
                </>
              )}
            </div>

            <Separator />

            {/* Paper size */}
            <div>
              <Label className="text-xs">Tamaño de papel</Label>
              <Select value={design.paperSize || 'A4'} onValueChange={(v) => update({ paperSize: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MediaCarta">Media carta (140 × 216 mm)</SelectItem>
                  <SelectItem value="Carta">Carta (216 × 279 mm)</SelectItem>
                  <SelectItem value="A4">A4 (210 × 297 mm)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <SliderControl
              label="Márgenes"
              value={design.margins ?? 16}
              min={10}
              max={40}
              unit="mm"
              onChange={(v) => update({ margins: v })}
            />
          </CardContent>
        </Card>

        {/* Colores */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Colores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ColorControl
              label="Color primario (encabezados, acentos)"
              value={design.primaryColor || '#0a3143'}
              onChange={(v) => update({ primaryColor: v, accentColor: v })}
            />
            <ColorControl
              label="Color de acento"
              value={design.accentColor || design.primaryColor || '#0a3143'}
              onChange={(v) => update({ accentColor: v })}
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
          </CardContent>
        </Card>

        {/* Tipografía */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tipografía</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Familia tipográfica</Label>
              <Select
                value={design.fontFamilyCategory || 'serif'}
                onValueChange={(v) => {
                  const cat = v as 'serif' | 'sans-serif' | 'system'
                  const fam = cat === 'serif'
                    ? "'Times New Roman', Georgia, serif"
                    : cat === 'sans-serif'
                      ? "Arial, Helvetica, sans-serif"
                      : "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
                  update({ fontFamilyCategory: cat, fontFamily: fam })
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="serif">Serif (Times / Georgia)</SelectItem>
                  <SelectItem value="sans-serif">Sans-serif (Arial / Helvetica)</SelectItem>
                  <SelectItem value="system">System (UI)</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
          </CardContent>
        </Card>

        {/* Layout */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Layout</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <ToggleRow label="Encabezado (datos clínica)" value={design.showHeader !== false} onChange={(v) => update({ showHeader: v })} />
              <ToggleRow label="Pie de página" value={design.showFooter !== false} onChange={(v) => update({ showFooter: v })} />
              <ToggleRow label="Símbolo ℞" value={design.showRxSymbol !== false} onChange={(v) => update({ showRxSymbol: v })} />
              <ToggleRow label="Info del paciente" value={design.showPatientInfo !== false} onChange={(v) => update({ showPatientInfo: v })} />
              <ToggleRow label="Info del doctor" value={design.showDoctorInfo !== false} onChange={(v) => update({ showDoctorInfo: v })} />
              <ToggleRow label="Diagnóstico" value={design.showDiagnosis !== false} onChange={(v) => update({ showDiagnosis: v })} />
              <ToggleRow label="Tabla de medicamentos o productos" value={design.showMedications !== false} onChange={(v) => update({ showMedications: v })} />
              <ToggleRow label="Indicaciones" value={design.showIndications !== false} onChange={(v) => update({ showIndications: v })} />
              <ToggleRow label="Línea de firma" value={design.showSignature !== false} onChange={(v) => update({ showSignature: v })} />
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Nombre del profesional en la receta</Label>
                <Select
                  value={design.doctorNameMode || 'podologist'}
                  onValueChange={(v) => update({ doctorNameMode: v as any })}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="podologist">Nombre del podólogo que receta</SelectItem>
                    <SelectItem value="fixed">Nombre fijo (responsable de la clínica)</SelectItem>
                  </SelectContent>
                </Select>
                {design.doctorNameMode === 'fixed' && (
                  <Input
                    value={design.doctorFixedName || ''}
                    onChange={(e) => update({ doctorFixedName: e.target.value })}
                    placeholder="Nombre del responsable"
                    className="h-9 mt-1"
                  />
                )}
                <p className="text-[10px] text-muted-foreground">
                  La cédula profesional siempre es la misma (se configura en Equipo → Podólogo).
                </p>
              </div>
              <Separator />
              <div className="space-y-1">
                <Label className="text-xs">Texto bajo la firma (etiqueta)</Label>
                <Input
                  value={design.signatureLabel || ''}
                  onChange={(e) => update({ signatureLabel: e.target.value })}
                  placeholder="Cédula profesional"
                  className="h-9"
                />
                <p className="text-[10px] text-muted-foreground">
                  Ejemplos: &ldquo;Cédula profesional&rdquo;, &ldquo;Número de certificación&rdquo;, &ldquo;Matrícula&rdquo;
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Acciones */}
        <div className="flex flex-wrap gap-2 justify-end">
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
      <div className="lg:sticky lg:top-4 self-start">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Vista previa en vivo</CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {design.paperSize === 'MediaCarta' ? 'Media carta' : design.paperSize === 'Letter' ? 'Carta' : 'A4'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/40 rounded-md p-3 max-h-[80vh] overflow-y-auto">
              <PrescriptionLivePreview
                design={design}
                data={{ ...SAMPLE_DATA, clinic: clinic || null }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              Esta es una vista previa con datos de ejemplo. La receta real usará los datos del paciente y la consulta.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────
//  Sub-componentes
// ───────────────────────────────────────────────────────────

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
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border p-2">
      <span className="text-xs">{label}</span>
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

  const paperSize = d.paperSize || 'A4'
  const paperCss = paperSize === 'Letter' ? 'Letter' : paperSize === 'MediaCarta' ? '140mm 216mm' : 'A4'
  const paperW = paperSize === 'Letter' ? '216mm' : paperSize === 'MediaCarta' ? '140mm' : '210mm'
  const paperH = paperSize === 'Letter' ? '279mm' : paperSize === 'MediaCarta' ? '216mm' : '297mm'

  const fontFamily =
    d.fontFamily ||
    (d.fontFamilyCategory === 'sans-serif'
      ? "Arial, Helvetica, sans-serif"
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
  // Doctor name: usar nombre fijo si está configurado, sino el del podólogo
  const doctorNameMode = d.doctorNameMode || 'podologist'
  const podName = doctorNameMode === 'fixed' && d.doctorFixedName
    ? d.doctorFixedName
    : (pod?.name || 'Dr. Ejemplo')
  const podCed = pod?.cedula || '1234567'
  const podSpec = pod?.specialty || 'Podología'
  const podCert = pod?.certNumber || ''

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
    metaCells.push(`<div><strong>Podólogo</strong> ${podName}</div>`)
    metaCells.push(`<div><strong>Cédula</strong> ${podCed}</div>`)
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

  const logoHtml = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="logo" class="rx-logo" style="opacity:${(d.logoOpacity ?? 100) / 100};"/>`
    : ''

  const watermarkHtml = wmEnabled && logoUrl
    ? `<div class="rx-watermark rx-wm-${wmPos}" style="opacity:${wmOpacity};"><img src="${esc(logoUrl)}" alt=""/></div>`
    : ''

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
  .rx-watermark { position: absolute; pointer-events: none; z-index: 0; }
  .rx-watermark img { max-width: 70%; max-height: 70%; object-fit: contain; }
  .rx-wm-center { top: 50%; left: 50%; transform: translate(-50%, -50%); }
  .rx-wm-top-right { top: ${margins}mm; right: ${margins}mm; max-width: 200px; }
  .rx-wm-top-right img { max-width: 200px; max-height: 200px; }
  .rx-wm-bottom-right { bottom: ${margins}mm; right: ${margins}mm; max-width: 200px; }
  .rx-wm-bottom-right img { max-width: 200px; max-height: 200px; }
  .rx-sheet > * { position: relative; z-index: 1; }
  .rx-header { border-bottom: 2.5px solid ${primary}; padding-bottom: 10px; margin-bottom: 14px; }
  .rx-header-inner { display: flex; align-items: center; gap: 18px; }
  .rx-header-inner.rx-pos-center { flex-direction: column; text-align: center; align-items: center; }
  .rx-header-inner.rx-pos-right { flex-direction: row-reverse; text-align: right; }
  .rx-logo { max-height: ${logoSize}px; max-width: ${Math.round(logoSize * 2.3)}px; object-fit: contain; }
  .rx-clinic-name { font-size: 22px; font-weight: 700; color: ${primary}; letter-spacing: 0.04em; line-height: 1.15; }
  .rx-clinic-sub { font-size: 12px; color: #555; margin-top: 2px; }
  .rx-clinic-line { font-size: 11.5px; color: #666; margin-top: 1px; }
  .rx-title-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
  .rx-title { font-size: 20px; font-weight: 700; color: ${primary}; letter-spacing: 0.1em; text-transform: uppercase; }
  .rx-folio { font-size: 11px; color: #888; font-family: 'Courier New', monospace; }
  .rx-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; padding: 10px 12px; background: ${accent}0F; border-left: 3px solid ${primary}; border-radius: 4px; margin-bottom: 14px; font-size: 12.5px; }
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
  .rx-indications { white-space: pre-wrap; padding: 8px 10px; background: #fafafa; border-radius: 4px; border-left: 3px solid ${accent}; }
  .rx-signature { margin-top: 38mm; text-align: center; }
  .rx-sig-line { border-top: 1.5px solid ${textColor}; width: 260px; margin: 0 auto 6px; }
  .rx-sig-name { font-weight: 700; font-size: 13px; color: ${primary}; }
  .rx-sig-meta { font-size: 11px; color: #555; margin-top: 1px; }
  .rx-sig-label { font-size: 10px; color: #999; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.08em; }
  .rx-footer { position: absolute; bottom: ${Math.max(8, Math.round(margins / 2))}mm; left: ${margins}mm; right: ${margins}mm; border-top: 1px solid #ddd; padding-top: 6px; display: flex; justify-content: space-between; font-size: 10px; color: #888; }
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
    ${showHeader ? `<div class="rx-header"><div class="rx-header-inner rx-pos-${d.logoPosition || 'left'}">${logoHtml}<div class="rx-clinic-info"><div class="rx-clinic-name">${esc(clinic?.name || 'Clínica CENPOD')}</div>${clinic?.address ? `<div class="rx-clinic-line">${esc(clinic.address)}</div>` : ''}<div class="rx-clinic-line">${clinic?.phone ? `Tel. ${esc(clinic.phone)}` : ''}</div></div></div></div>` : ''}
    <div class="rx-title-row"><div class="rx-title">Sugiero</div><div class="rx-folio">Folio: PRUEBA-0001</div></div>
    ${metaCells.length > 0 ? `<div class="rx-meta-grid">${metaCells.join('')}</div>` : ''}
    ${showDiagnosis && data.diagnosis ? `<div class="rx-section"><div class="rx-section-title">Diagnóstico</div><div class="rx-section-body">${esc(data.diagnosis)}</div></div>` : ''}
    ${showRx ? `<div class="rx-rx-symbol">℞</div>` : ''}
    ${showMedications ? `<div class="rx-section"><div class="rx-section-title">Medicamentos o productos</div><table class="rx-meds-table"><thead><tr style="background:${accent}1A;"><th class="rx-num">#</th><th>Medicamento / Producto</th><th>Dosis</th><th>Vía</th><th>Duración</th></tr></thead><tbody>${medsRows}</tbody></table></div>` : ''}
    ${showIndications && data.indications ? `<div class="rx-section"><div class="rx-section-title">Indicaciones generales</div><div class="rx-section-body rx-indications">${esc(data.indications)}</div></div>` : ''}
    ${showSignature ? `<div class="rx-signature"><div class="rx-sig-line"></div><div class="rx-sig-name">${esc(podName)}</div><div class="rx-sig-meta">${podSpec} · Cédula: ${podCed}${podCert ? ` · Cert: ${podCert}` : ''}</div><div class="rx-sig-label">${esc(sigLabel)}</div></div>` : ''}
    ${showFooter ? `<div class="rx-footer"><div>${esc(clinic?.name || 'Clínica CENPOD')} · Receta de prueba</div><div>${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}</div></div>` : ''}
  </div>
</body>
</html>`
}
