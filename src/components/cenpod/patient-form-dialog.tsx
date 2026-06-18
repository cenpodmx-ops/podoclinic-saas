'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChevronDown, Loader2, Plus, Pencil } from 'lucide-react'
import { toast } from 'sonner'

export type PatientFormValues = {
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  email?: string | null
  birthDate?: string | null
  sex?: string | null
  curp?: string | null
  rfc?: string | null
  address?: string | null
  razonSocial?: string | null
  regimenFiscal?: string | null
  cfdiUso?: string | null
  emailFactura?: string | null
  isDiabetic?: boolean | null
  allergies?: string | null
  currentMeds?: string | null
  chronicConditions?: string | null
  riskLevel?: string | null
  generalNotes?: string | null
}

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** Si se pasa, es edición; si no, es alta. Acepta cualquier forma parcial. */
  patient?: Partial<PatientFormValues> & { id?: string } | null
  onSaved?: (p: { id: string }) => void
}

const REGIMENES = [
  '601 - General de Ley Personas Morales',
  '603 - Personas Morales con Fines no Lucrativos',
  '605 - Sueldos y Salarios e Ingresos por Asimilados a Salarios',
  '606 - Arrendamiento',
  '607 - Régimen de Enajenación o Adquisición de Bienes',
  '610 - Residentes en el Extranjero sin Establecimiento Permanente en México',
  '611 - Ingresos por Dividendos y en General por los Distribuidos',
  '612 - Personas Físicas con Actividades Empresariales y Profesionales',
  '614 - Ingresos por Intereses',
  '615 - Régimen de los Ingresos por Obtención de Premios',
  '616 - Sin obligaciones fiscales',
  '621 - Incorporación Fiscal',
  '622 - Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras',
  '623 - Opcional para Grupos de Sociedades',
  '624 - Coordinados',
  '625 - Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas',
  '626 - Régimen Simplificado de Confianza',
]

const CFDI_USOS = [
  'G01 - Adquisición de mercancías',
  'G02 - Devoluciones, descuentos o bonificaciones',
  'G03 - Gastos en general',
  'I01 - Por suscripción',
  'I02 - Compra de equipo de cómputo',
  'I03 - Compra de software',
  'I04 - Compra de servicios de telecomunicaciones',
  'I05 - Compra de servicios de preparación de alimentos',
  'I06 - Compra de útiles y materiales de oficina',
  'I07 - Compra de servicios de impresión',
  'I08 - Compra de servicios de transporte',
  'P01 - Por definir',
]

const SEX_OPTIONS = [
  { value: 'M', label: 'Mujer' },
  { value: 'H', label: 'Hombre' },
  { value: 'O', label: 'Otro / Prefiere no decir' },
]

const RISK_OPTIONS = [
  { value: 'BAJO', label: 'Bajo', color: 'text-emerald-700' },
  { value: 'MEDIO', label: 'Medio', color: 'text-amber-700' },
  { value: 'ALTO', label: 'Alto', color: 'text-red-700' },
]

export function PatientFormDialog({ open, onOpenChange, patient, onSaved }: Props) {
  const isEdit = !!patient?.id
  const [saving, setSaving] = useState(false)
  const [fiscalOpen, setFiscalOpen] = useState(false)
  const [form, setForm] = useState<PatientFormValues>({})

  useEffect(() => {
    if (open) {
      setForm({
        firstName: patient?.firstName || '',
        lastName: patient?.lastName || '',
        phone: patient?.phone || '',
        email: patient?.email || '',
        birthDate: patient?.birthDate ? patient.birthDate.slice(0, 10) : '',
        sex: patient?.sex || '',
        curp: patient?.curp || '',
        rfc: patient?.rfc || '',
        address: patient?.address || '',
        razonSocial: patient?.razonSocial || '',
        regimenFiscal: patient?.regimenFiscal || '',
        cfdiUso: patient?.cfdiUso || '',
        emailFactura: patient?.emailFactura || '',
        isDiabetic: !!patient?.isDiabetic,
        allergies: patient?.allergies || '',
        currentMeds: patient?.currentMeds || '',
        chronicConditions: patient?.chronicConditions || '',
        riskLevel: patient?.riskLevel || '',
        generalNotes: patient?.generalNotes || '',
      })
      // Si ya tiene datos fiscales, abre por defecto
      setFiscalOpen(
        !!(patient?.razonSocial || patient?.rfc || patient?.regimenFiscal || patient?.cfdiUso),
      )
    }
  }, [open, patient])

  const set = (k: keyof PatientFormValues, v: any) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.firstName?.trim()) return toast.error('Nombre obligatorio')
    if (!form.lastName?.trim()) return toast.error('Apellido obligatorio')
    if (!form.phone?.trim()) return toast.error('Teléfono obligatorio')

    setSaving(true)
    try {
      const url = isEdit ? `/api/pacientes/${patient!.id}` : '/api/pacientes'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al guardar')
      toast.success(isEdit ? 'Paciente actualizado' : 'Paciente creado')
      onSaved?.({ id: data.id })
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isEdit ? 'Editar paciente' : 'Nuevo paciente'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Actualiza los datos del paciente y su expediente.'
              : 'Captura los datos para dar de alta un nuevo paciente.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Datos personales */}
          <section className="space-y-3">
            <h4 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Datos personales
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Nombre(s) *</Label>
                <Input value={form.firstName || ''} onChange={(e) => set('firstName', e.target.value)} />
              </div>
              <div>
                <Label>Apellido(s) *</Label>
                <Input value={form.lastName || ''} onChange={(e) => set('lastName', e.target.value)} />
              </div>
              <div>
                <Label>Teléfono *</Label>
                <Input value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} placeholder="6621234567" />
              </div>
              <div>
                <Label>Correo</Label>
                <Input type="email" value={form.email || ''} onChange={(e) => set('email', e.target.value)} />
              </div>
              <div>
                <Label>Fecha de nacimiento</Label>
                <Input type="date" value={form.birthDate || ''} onChange={(e) => set('birthDate', e.target.value)} />
              </div>
              <div>
                <Label>Sexo</Label>
                <Select value={form.sex || ''} onValueChange={(v) => set('sex', v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SEX_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>CURP</Label>
                <Input
                  value={form.curp || ''}
                  onChange={(e) => set('curp', e.target.value.toUpperCase())}
                  placeholder="XXXX000000XXXXXX00"
                  maxLength={18}
                />
              </div>
              <div>
                <Label>RFC</Label>
                <Input
                  value={form.rfc || ''}
                  onChange={(e) => set('rfc', e.target.value.toUpperCase())}
                  placeholder="XXXX000000XX0"
                  maxLength={13}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Dirección</Label>
                <Input value={form.address || ''} onChange={(e) => set('address', e.target.value)} />
              </div>
            </div>
          </section>

          {/* Datos fiscales (colapsable) */}
          <Collapsible open={fiscalOpen} onOpenChange={setFiscalOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between px-2 text-muted-foreground">
                <span className="text-xs uppercase tracking-wider font-semibold">Datos fiscales (opcional)</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${fiscalOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Label>Razón social</Label>
                  <Input value={form.razonSocial || ''} onChange={(e) => set('razonSocial', e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Régimen fiscal</Label>
                  <Select value={form.regimenFiscal || ''} onValueChange={(v) => set('regimenFiscal', v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona..." />
                    </SelectTrigger>
                    <SelectContent>
                      {REGIMENES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label>Uso CFDI</Label>
                  <Select value={form.cfdiUso || ''} onValueChange={(v) => set('cfdiUso', v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CFDI_USOS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label>Correo para factura</Label>
                  <Input type="email" value={form.emailFactura || ''} onChange={(e) => set('emailFactura', e.target.value)} />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Alertas de salud */}
          <section className="space-y-3 rounded-md border border-red-200 bg-red-50/50 p-3 dark:border-red-900/50 dark:bg-red-950/20">
            <h4 className="text-xs uppercase tracking-wider font-semibold text-red-700 dark:text-red-400">
              Alertas de salud
            </h4>
            <div className="flex items-center justify-between gap-2 rounded-md bg-white p-2 dark:bg-background/60">
              <div>
                <Label className="cursor-pointer">Paciente diabético</Label>
                <p className="text-xs text-muted-foreground">Marcar para mostrar alerta visible en el expediente.</p>
              </div>
              <Switch checked={!!form.isDiabetic} onCheckedChange={(v) => set('isDiabetic', v)} />
            </div>
            <div>
              <Label>Alergias</Label>
              <Textarea
                value={form.allergies || ''}
                onChange={(e) => set('allergies', e.target.value)}
                placeholder="Penicilina, látex, mariscos..."
                rows={2}
              />
            </div>
            <div>
              <Label>Medicamentos actuales</Label>
              <Textarea
                value={form.currentMeds || ''}
                onChange={(e) => set('currentMeds', e.target.value)}
                placeholder="Metformina 500mg, Losartán 50mg..."
                rows={2}
              />
            </div>
            <div>
              <Label>Enfermedades crónicas</Label>
              <Textarea
                value={form.chronicConditions || ''}
                onChange={(e) => set('chronicConditions', e.target.value)}
                placeholder="Hipertensión, diabetes tipo 2..."
                rows={2}
              />
            </div>
            <div>
              <Label>Nivel de riesgo podológico</Label>
              <Select value={form.riskLevel || ''} onValueChange={(v) => set('riskLevel', v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona..." />
                </SelectTrigger>
                <SelectContent>
                  {RISK_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <span className={r.color}>{r.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          {/* Notas */}
          <section className="space-y-3">
            <h4 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Notas generales
            </h4>
            <Textarea
              value={form.generalNotes || ''}
              onChange={(e) => set('generalNotes', e.target.value)}
              placeholder="Observaciones, preferencias del paciente, antecedentes relevantes..."
              rows={3}
            />
          </section>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving} style={{ backgroundColor: '#0a3143' }}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Guardar cambios' : 'Crear paciente'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
