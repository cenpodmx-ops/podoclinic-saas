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
import { Plus, Loader2, FileText, Trash2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { fmtDate, fmtDateTime } from '@/lib/format'
import { SignaturePad, type SignaturePadHandle } from '@/components/cenpod/signature-pad'
import { ChipMultiSelect } from './chip-multi-select'
import { RIESGOS_PROCEDIMIENTO } from './constants'
import type { Patient, ConsentRow } from './types'

type FormState = {
  procedimientoPropuesto: string
  diagnostico: string
  explicacion: string
  beneficios: string
  riesgos: string[]
  alternativas: string
  consecuenciasNoRealizar: string
  confirmacionPreguntas: boolean
  aceptacionVoluntaria: boolean
  firmaPaciente?: string
  firmaProfesional?: string
  firmaTestigo?: string
  firmaTutor?: string
}

const EMPTY: FormState = {
  procedimientoPropuesto: '',
  diagnostico: '',
  explicacion: '',
  beneficios: '',
  riesgos: [],
  alternativas: '',
  consecuenciasNoRealizar: '',
  confirmacionPreguntas: false,
  aceptacionVoluntaria: false,
}

export function ConsentimientosTab({ patient }: { patient: Patient }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [viewing, setViewing] = useState<ConsentRow | null>(null)
  const [saving, setSaving] = useState(false)
  const sigPacienteRef = useRef<SignaturePadHandle>(null)
  const sigProfRef = useRef<SignaturePadHandle>(null)
  const sigTestigoRef = useRef<SignaturePadHandle>(null)
  const sigTutorRef = useRef<SignaturePadHandle>(null)

  const { data, isPending: isLoading } = useQuery<ConsentRow[]>({
    queryKey: ['consentimientos', patient.id],
    queryFn: () =>
      fetch(`/api/consentimientos?patientId=${patient.id}`)
        .then((r) => r.json())
        .then((d) => d?.data || d || []),
    enabled: !!patient.id,
    retry: false,
  })

  const consents = data || patient.consents || []

  function openNew() {
    setEditId(null)
    setForm(EMPTY)
    setOpen(true)
  }

  function openEdit(c: ConsentRow) {
    setEditId(c.id)
    let riesgos: string[] = []
    try {
      riesgos = c.riesgosJson ? JSON.parse(c.riesgosJson) : []
    } catch {}
    setForm({
      procedimientoPropuesto: c.procedimientoPropuesto,
      diagnostico: c.diagnostico || '',
      explicacion: c.explicacion || '',
      beneficios: c.beneficios || '',
      riesgos,
      alternativas: c.alternativas || '',
      consecuenciasNoRealizar: c.consecuenciasNoRealizar || '',
      confirmacionPreguntas: c.confirmacionPreguntas,
      aceptacionVoluntaria: c.aceptacionVoluntaria,
      firmaPaciente: c.firmaPaciente || undefined,
      firmaProfesional: c.firmaProfesional || undefined,
      firmaTestigo: c.firmaTestigo || undefined,
      firmaTutor: c.firmaTutor || undefined,
    })
    setOpen(true)
  }

  async function save() {
    if (!form.procedimientoPropuesto.trim()) {
      toast.error('Indica el procedimiento propuesto')
      return
    }
    if (!form.aceptacionVoluntaria) {
      toast.error('Se requiere aceptación voluntaria del paciente')
      return
    }
    setSaving(true)
    try {
      const body = {
        ...form,
        firmaPaciente: sigPacienteRef.current?.getDataUrl() || form.firmaPaciente || null,
        firmaProfesional: sigProfRef.current?.getDataUrl() || form.firmaProfesional || null,
        firmaTestigo: sigTestigoRef.current?.getDataUrl() || form.firmaTestigo || null,
        firmaTutor: sigTutorRef.current?.getDataUrl() || form.firmaTutor || null,
        riesgosJson: JSON.stringify(form.riesgos),
      }
      const url = editId
        ? `/api/consentimientos/${editId}`
        : `/api/consentimientos?patientId=${patient.id}`
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
      toast.success(editId ? 'Consentimiento actualizado' : 'Consentimiento registrado')
      setOpen(false)
      qc.invalidateQueries({ queryKey: ['consentimientos', patient.id] })
      qc.invalidateQueries({ queryKey: ['paciente', patient.id] })
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove(c: ConsentRow) {
    if (!confirm(`¿Eliminar el consentimiento de "${c.procedimientoPropuesto}"?`)) return
    try {
      const res = await fetch(`/api/consentimientos/${c.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar')
      toast.success('Consentimiento eliminado')
      qc.invalidateQueries({ queryKey: ['consentimientos', patient.id] })
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {consents.length} consentimiento(s) registrado(s)
        </p>
        <Button size="sm" onClick={openNew} style={{ backgroundColor: '#0a3143' }}>
          <Plus className="h-4 w-4" /> Nuevo consentimiento
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : consents.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Sin consentimientos registrados.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {consents.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-3 flex items-start justify-between gap-2">
                <button className="text-left min-w-0 flex-1" onClick={() => setViewing(c)}>
                  <p className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" style={{ color: '#0a3143' }} />
                    {c.procedimientoPropuesto}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {fmtDate(c.fecha)} · {c.diagnostico || 'Sin diagnóstico'}
                  </p>
                  <div className="flex gap-1 mt-1">
                    {c.firmaPaciente && (
                      <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300">
                        Paciente firmó
                      </Badge>
                    )}
                    {c.firmaProfesional && (
                      <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300">
                        Profesional firmó
                      </Badge>
                    )}
                  </div>
                </button>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(c)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(c)} className="text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editId ? 'Editar consentimiento informado' : 'Nuevo consentimiento informado'}
            </DialogTitle>
            <DialogDescription>
              Documenta el consentimiento informado según NOM-004. Las firmas se capturan al final.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Procedimiento propuesto *</Label>
                <Input
                  value={form.procedimientoPropuesto}
                  onChange={(e) => set('procedimientoPropuesto', e.target.value)}
                />
              </div>
              <div>
                <Label>Diagnóstico</Label>
                <Input
                  value={form.diagnostico}
                  onChange={(e) => set('diagnostico', e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Explicación del procedimiento</Label>
              <Textarea
                rows={3}
                value={form.explicacion}
                onChange={(e) => set('explicacion', e.target.value)}
                placeholder="Describe el procedimiento paso a paso en lenguaje comprensible..."
              />
            </div>

            <div>
              <Label>Beneficios esperados</Label>
              <Textarea
                rows={2}
                value={form.beneficios}
                onChange={(e) => set('beneficios', e.target.value)}
              />
            </div>

            <div>
              <Label>Riesgos</Label>
              <div className="mt-1">
                <ChipMultiSelect
                  options={RIESGOS_PROCEDIMIENTO}
                  selected={form.riesgos}
                  onChange={(arr) => set('riesgos', arr)}
                />
              </div>
            </div>

            <div>
              <Label>Alternativas</Label>
              <Textarea
                rows={2}
                value={form.alternativas}
                onChange={(e) => set('alternativas', e.target.value)}
                placeholder="Otros tratamientos posibles..."
              />
            </div>

            <div>
              <Label>Consecuencias de no realizar el procedimiento</Label>
              <Textarea
                rows={2}
                value={form.consecuenciasNoRealizar}
                onChange={(e) => set('consecuenciasNoRealizar', e.target.value)}
              />
            </div>

            <div className="rounded-md border p-3 space-y-2 bg-muted/30">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch
                  checked={form.confirmacionPreguntas}
                  onCheckedChange={(c) => set('confirmacionPreguntas', c)}
                />
                El paciente tuvo la oportunidad de hacer preguntas y fueron resueltas
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch
                  checked={form.aceptacionVoluntaria}
                  onCheckedChange={(c) => set('aceptacionVoluntaria', c)}
                />
                El paciente acepta el procedimiento de manera voluntaria *
              </label>
            </div>

            {/* Firmas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase">Firma del paciente</Label>
                <SignaturePad ref={sigPacienteRef} className="mt-1" />
                {form.firmaPaciente && (
                  <p className="text-[10px] text-muted-foreground">Ya existe firma guardada.</p>
                )}
              </div>
              <div>
                <Label className="text-xs uppercase">Firma del profesional</Label>
                <SignaturePad ref={sigProfRef} className="mt-1" />
                {form.firmaProfesional && (
                  <p className="text-[10px] text-muted-foreground">Ya existe firma guardada.</p>
                )}
              </div>
              <div>
                <Label className="text-xs uppercase">Firma del testigo (opcional)</Label>
                <SignaturePad ref={sigTestigoRef} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs uppercase">Firma del tutor (menores)</Label>
                <SignaturePad ref={sigTutorRef} className="mt-1" />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving} style={{ backgroundColor: '#0a3143' }}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editId ? 'Guardar cambios' : 'Registrar consentimiento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View dialog */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Consentimiento informado</DialogTitle>
            <DialogDescription>
              {viewing && fmtDateTime(viewing.fecha)} · {viewing?.procedimientoPropuesto}
            </DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm">
              {viewing.diagnostico && (
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Diagnóstico</p>
                  <p>{viewing.diagnostico}</p>
                </div>
              )}
              {viewing.explicacion && (
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Explicación</p>
                  <p className="whitespace-pre-wrap">{viewing.explicacion}</p>
                </div>
              )}
              {viewing.beneficios && (
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Beneficios</p>
                  <p>{viewing.beneficios}</p>
                </div>
              )}
              {viewing.riesgosJson && (
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Riesgos</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(JSON.parse(viewing.riesgosJson) as string[]).map((r) => (
                      <Badge key={r} variant="outline" className="text-[10px]">
                        {r}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {viewing.alternativas && (
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Alternativas</p>
                  <p>{viewing.alternativas}</p>
                </div>
              )}
              {viewing.consecuenciasNoRealizar && (
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">
                    Consecuencias de no realizar
                  </p>
                  <p>{viewing.consecuenciasNoRealizar}</p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {viewing.firmaPaciente && (
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Firma paciente</p>
                    <img src={viewing.firmaPaciente} alt="" className="max-h-20 border rounded bg-white" />
                  </div>
                )}
                {viewing.firmaProfesional && (
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Firma profesional</p>
                    <img src={viewing.firmaProfesional} alt="" className="max-h-20 border rounded bg-white" />
                  </div>
                )}
                {viewing.firmaTestigo && (
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Firma testigo</p>
                    <img src={viewing.firmaTestigo} alt="" className="max-h-20 border rounded bg-white" />
                  </div>
                )}
                {viewing.firmaTutor && (
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Firma tutor</p>
                    <img src={viewing.firmaTutor} alt="" className="max-h-20 border rounded bg-white" />
                  </div>
                )}
              </div>
              <div className="flex gap-3 text-xs pt-2 border-t">
                <span>
                  Confirmación preguntas:{' '}
                  <strong>{viewing.confirmacionPreguntas ? 'Sí' : 'No'}</strong>
                </span>
                <span>
                  Aceptación voluntaria:{' '}
                  <strong>{viewing.aceptacionVoluntaria ? 'Sí' : 'No'}</strong>
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
