'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Loader2, Save, Eye, Printer, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { PatientSearcher } from './patient-searcher'
import { MedicationEditor, emptyMedication } from './medication-editor'
import { PrescriptionPrintPreview } from '@/components/cenpod/prescription-print'
import type { MedicationRow, PatientLite, PodologistLite, PrescriptionListItem } from '../_lib/types'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated?: (rx: PrescriptionListItem) => void
}

const SENTINEL_NONE = '__none'

export function PrescriptionFormDialog({ open, onOpenChange, onCreated }: Props) {
  const qc = useQueryClient()
  const [patient, setPatient] = useState<PatientLite | null>(null)
  const [podologistId, setPodologistId] = useState<string>(SENTINEL_NONE)
  const [diagnosis, setDiagnosis] = useState('')
  const [meds, setMeds] = useState<MedicationRow[]>([emptyMedication()])
  const [indications, setIndications] = useState('')
  const [tab, setTab] = useState<'form' | 'preview'>('form')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Load podólogos for the clinic
  const { data: podologos } = useQuery<PodologistLite[]>({
    queryKey: ['podologos-for-rx'],
    queryFn: () => fetch('/api/podologos').then((r) => r.json()),
    enabled: open,
  })

  // Load clinic config (for preview logo etc.)
  const { data: configData } = useQuery<any>({
    queryKey: ['config-for-rx'],
    queryFn: () => fetch('/api/config').then((r) => r.json()),
    enabled: open,
  })

  function reset() {
    setPatient(null)
    setPodologistId(SENTINEL_NONE)
    setDiagnosis('')
    setMeds([emptyMedication()])
    setIndications('')
    setTab('form')
    setErrors({})
  }

  function close() {
    reset()
    onOpenChange(false)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        patientId: patient?.id,
        podologistId: podologistId !== SENTINEL_NONE ? podologistId : undefined,
        diagnosis: diagnosis.trim() || undefined,
        medications: meds
          .filter((m) => m.name.trim())
          .map((m) => ({
            name: m.name.trim(),
            dose: m.dose.trim(),
            via: m.via,
            duration: m.duration.trim(),
            ...(m.productId ? { productId: m.productId } : {}),
          })),
        indications: indications.trim() || undefined,
      }
      const r = await fetch('/api/recetas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Error al guardar la receta')
      return j as PrescriptionListItem
    },
    onSuccess: (rx) => {
      toast.success('Receta guardada correctamente')
      qc.invalidateQueries({ queryKey: ['recetas'] })
      onCreated?.(rx)
      close()
    },
    onError: (e: Error) => {
      toast.error(e.message)
    },
  })

  function handleSave() {
    const errs: Record<string, string> = {}
    if (!patient) errs.patient = 'Selecciona un paciente'
    const validMeds = meds.filter((m) => m.name.trim())
    if (validMeds.length === 0) errs.meds = 'Agrega al menos un medicamento con nombre'
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      setTab('form')
      return
    }
    saveMutation.mutate()
  }

  // Preview data — build from current form state
  const previewData = {
    date: new Date().toISOString(),
    diagnosis: diagnosis.trim() || null,
    medications: meds
      .filter((m) => m.name.trim())
      .map((m) => ({ name: m.name, dose: m.dose, via: m.via, duration: m.duration, productId: m.productId })),
    indications: indications.trim() || null,
    patient: patient
      ? {
          id: patient.id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          name: `${patient.firstName} ${patient.lastName}`,
          expNumber: patient.expNumber,
          birthDate: patient.birthDate,
          sex: patient.sex,
          phone: patient.phone,
        }
      : null,
    podologist: podologos?.find((p) => p.id === podologistId) || null,
    clinic: configData?.clinic || null,
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Nueva receta
          </DialogTitle>
          <DialogDescription>
            Captura la receta dictada por el podólogo. Puedes seleccionar medicamentos del inventario o escribirlos libremente.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'form' | 'preview')}>
          <TabsList className="grid w-full grid-cols-2 max-w-xs">
            <TabsTrigger value="form" className="gap-1">
              <FileText className="h-3.5 w-3.5" /> Datos
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-1">
              <Eye className="h-3.5 w-3.5" /> Vista previa
            </TabsTrigger>
          </TabsList>

          <TabsContent value="form" className="mt-4 space-y-4">
            {/* Paciente */}
            <div className="space-y-1.5">
              <Label>Paciente *</Label>
              <PatientSearcher
                onSelect={setPatient}
                selected={patient}
                error={errors.patient}
              />
            </div>

            {/* Podólogo */}
            <div className="space-y-1.5">
              <Label>Podólogo (opcional)</Label>
              <Select value={podologistId} onValueChange={setPodologistId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el podólogo que dicta la receta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SENTINEL_NONE}>— Sin especificar —</SelectItem>
                  {podologos?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.specialty ? ` · ${p.specialty}` : ''}
                      {p.cedula ? ` · Céd. ${p.cedula}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Diagnóstico */}
            <div className="space-y-1.5">
              <Label htmlFor="rx-diagnosis">Diagnóstico (opcional)</Label>
              <Textarea
                id="rx-diagnosis"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="Ej. Onicomicosis en primer dedo del pie derecho"
                rows={2}
              />
            </div>

            {/* Medicamentos */}
            <MedicationEditor rows={meds} onChange={setMeds} error={errors.meds} />

            {/* Indicaciones */}
            <div className="space-y-1.5">
              <Label htmlFor="rx-indications">Indicaciones generales (opcional)</Label>
              <Textarea
                id="rx-indications"
                value={indications}
                onChange={(e) => setIndications(e.target.value)}
                placeholder="Reposo relativo, control en una semana, evitar humedad en pies…"
                rows={3}
              />
            </div>
          </TabsContent>

          <TabsContent value="preview" className="mt-4">
            {!patient ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                Selecciona un paciente en la pestaña "Datos" para ver la vista previa.
              </div>
            ) : (
              <div className="rounded-md bg-muted/30 p-4 max-h-[60vh] overflow-y-auto">
                <PrescriptionPrintPreview data={previewData} />
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 flex-col-reverse sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={close} disabled={saveMutation.isPending}>
            Cancelar
          </Button>
          <Button type="button" variant="outline" onClick={() => setTab('preview')}>
            <Eye className="h-4 w-4" /> Vista previa
          </Button>
          <Button type="button" onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Re-export for the success dialog
export type { PrescriptionListItem }

export function SuccessDialog({
  rx,
  open,
  onOpenChange,
}: {
  rx: PrescriptionListItem | null
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  if (!rx) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <FileText className="h-5 w-5" /> Receta guardada
          </DialogTitle>
          <DialogDescription>
            La receta se registró correctamente. ¿Qué deseas hacer ahora?
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border p-3 bg-muted/30 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Paciente:</span>
            <span className="font-medium">{rx.patient?.name || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Podólogo:</span>
            <span className="font-medium">{rx.podologist?.name || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Medicamentos:</span>
            <Badge variant="outline" className="text-xs">{rx.medications.length}</Badge>
          </div>
        </div>
        <DialogFooter className="gap-2 flex-col-reverse sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button onClick={() => openPrintWindow(rx.id)}>
            <Printer className="h-4 w-4" /> Imprimir / PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function openPrintWindow(id: string) {
  const w = window.open(`/api/recetas/${id}/print?print=1`, '_blank', 'width=900,height=1000')
  if (!w) {
    toast.error('Habilita las ventanas emergentes para imprimir la receta.')
    return
  }
}
