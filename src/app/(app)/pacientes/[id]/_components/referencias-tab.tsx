'use client'

import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Loader2, FileText, Trash2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { fmtDate, fmtDateTime } from '@/lib/format'
import { SignaturePad, type SignaturePadHandle } from '@/components/cenpod/signature-pad'
import { ChipMultiSelect } from './chip-multi-select'
import { SERVICIOS_REFERENCIA, MOTIVOS_CLINICOS_REFERENCIA } from './constants'
import type { Patient, ReferralRow } from './types'

type FormState = {
  tipo: string
  motivoReferencia: string
  diagnosticoPresuntivo: string
  hallazgosRelevantes: string
  tratamientoRealizado: string
  motivoClinico: string[]
  servicioSugerido: string
  prioridad: string
  firmaData?: string
}

const EMPTY: FormState = {
  tipo: 'REFERENCIA',
  motivoReferencia: '',
  diagnosticoPresuntivo: '',
  hallazgosRelevantes: '',
  tratamientoRealizado: '',
  motivoClinico: [],
  servicioSugerido: 'MEDICINA_GENERAL',
  prioridad: 'ORDINARIA',
}

const PRIORIDAD_STYLE: Record<string, string> = {
  ORDINARIA: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  PREFERENTE: 'bg-amber-100 text-amber-800 border-amber-300',
  URGENTE: 'bg-red-600 text-white border-red-700',
}

const SERVICIO_LABEL: Record<string, string> = {
  MEDICINA_GENERAL: 'Medicina general',
  URGENCIAS: 'Urgencias',
  ANGIOLOGIA: 'Angiología',
  DERMATOLOGIA: 'Dermatología',
  TRAUMATOLOGIA: 'Traumatología',
  CIRUGIA: 'Cirugía',
  HERIDAS: 'Clínica de heridas',
  ENDOCRINOLOGIA: 'Endocrinología',
}

function tryParseArr(json?: string | null): string[] {
  if (!json) return []
  try {
    return JSON.parse(json)
  } catch {
    return []
  }
}

export function ReferenciasTab({ patient }: { patient: Patient }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const sigRef = useRef<SignaturePadHandle>(null)

  const { data, isPending: isLoading } = useQuery<ReferralRow[]>({
    queryKey: ['referencias', patient.id],
    queryFn: () =>
      fetch(`/api/referencias?patientId=${patient.id}`)
        .then((r) => r.json())
        .then((d) => d?.data || d || []),
    enabled: !!patient.id,
    retry: false,
  })

  const refs = data || patient.referrals || []

  function openNew() {
    setEditId(null)
    setForm(EMPTY)
    setOpen(true)
  }
  function openEdit(r: ReferralRow) {
    setEditId(r.id)
    setForm({
      tipo: r.tipo,
      motivoReferencia: r.motivoReferencia || '',
      diagnosticoPresuntivo: r.diagnosticoPresuntivo || '',
      hallazgosRelevantes: r.hallazgosRelevantes || '',
      tratamientoRealizado: r.tratamientoRealizado || '',
      motivoClinico: tryParseArr(r.motivoClinicoJson),
      servicioSugerido: r.servicioSugerido || 'MEDICINA_GENERAL',
      prioridad: r.prioridad,
      firmaData: r.firmaData || undefined,
    })
    setOpen(true)
  }

  async function save() {
    if (!form.motivoReferencia.trim()) {
      toast.error('Indica el motivo de la referencia')
      return
    }
    setSaving(true)
    try {
      const firma = sigRef.current?.getDataUrl() || form.firmaData || null
      const body = {
        ...form,
        motivoClinicoJson: JSON.stringify(form.motivoClinico),
        firmaData: firma,
      }
      const url = editId
        ? `/api/referencias/${editId}`
        : `/api/referencias?patientId=${patient.id}`
      const method = editId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'Error al guardar')
      }
      toast.success(editId ? 'Referencia actualizada' : 'Referencia generada')
      setOpen(false)
      qc.invalidateQueries({ queryKey: ['referencias', patient.id] })
      qc.invalidateQueries({ queryKey: ['paciente', patient.id] })
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove(r: ReferralRow) {
    if (!confirm('¿Eliminar esta referencia?')) return
    try {
      const res = await fetch(`/api/referencias/${r.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error')
      toast.success('Referencia eliminada')
      qc.invalidateQueries({ queryKey: ['referencias', patient.id] })
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{refs.length} referencia(s)</p>
        <Button size="sm" onClick={openNew} style={{ backgroundColor: '#0a3143' }}>
          <Plus className="h-4 w-4" /> Nueva referencia
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : refs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Sin referencias registradas.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {refs.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-3 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" style={{ color: '#0a3143' }} />
                    {r.tipo === 'REFERENCIA' ? 'Referencia' : 'Contrarreferencia'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {fmtDate(r.fecha)} · {r.motivoReferencia || 'Sin motivo'}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {r.servicioSugerido && (
                      <Badge variant="outline" className="text-[10px]">
                        {SERVICIO_LABEL[r.servicioSugerido] || r.servicioSugerido}
                      </Badge>
                    )}
                    <Badge variant="outline" className={`text-[10px] ${PRIORIDAD_STYLE[r.prioridad] || ''}`}>
                      {r.prioridad}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(r)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(r)} className="text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar referencia' : 'Nueva referencia'}</DialogTitle>
            <DialogDescription>
              Referencia / contrarreferencia según NOM-004 sección 22.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => set('tipo', v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REFERENCIA">Referencia</SelectItem>
                    <SelectItem value="CONTRARREFERENCIA">Contrarreferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridad</Label>
                <Select value={form.prioridad} onValueChange={(v) => set('prioridad', v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ORDINARIA">Ordinaria</SelectItem>
                    <SelectItem value="PREFERENTE">Preferente</SelectItem>
                    <SelectItem value="URGENTE">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Motivo de la referencia</Label>
              <Textarea
                rows={2}
                value={form.motivoReferencia}
                onChange={(e) => set('motivoReferencia', e.target.value)}
              />
            </div>

            <div>
              <Label>Diagnóstico presuntivo</Label>
              <Input
                value={form.diagnosticoPresuntivo}
                onChange={(e) => set('diagnosticoPresuntivo', e.target.value)}
              />
            </div>

            <div>
              <Label>Hallazgos relevantes</Label>
              <Textarea
                rows={2}
                value={form.hallazgosRelevantes}
                onChange={(e) => set('hallazgosRelevantes', e.target.value)}
              />
            </div>

            <div>
              <Label>Tratamiento realizado</Label>
              <Textarea
                rows={2}
                value={form.tratamientoRealizado}
                onChange={(e) => set('tratamientoRealizado', e.target.value)}
              />
            </div>

            <div>
              <Label>Motivo clínico</Label>
              <div className="mt-1">
                <ChipMultiSelect
                  options={MOTIVOS_CLINICOS_REFERENCIA}
                  selected={form.motivoClinico}
                  onChange={(arr) => set('motivoClinico', arr)}
                />
              </div>
            </div>

            <div>
              <Label>Servicio sugerido</Label>
              <Select
                value={form.servicioSugerido}
                onValueChange={(v) => set('servicioSugerido', v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICIOS_REFERENCIA.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SERVICIO_LABEL[s] || s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs uppercase">Firma del profesional</Label>
              <SignaturePad ref={sigRef} className="mt-1" />
              {form.firmaData && (
                <p className="text-[10px] text-muted-foreground">Ya existe firma guardada.</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving} style={{ backgroundColor: '#0a3143' }}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editId ? 'Guardar cambios' : 'Generar referencia'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
