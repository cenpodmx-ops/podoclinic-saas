'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Plus, Loader2, AlertTriangle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { fmtDate } from '@/lib/format'
import type { Patient, PatientFileRow } from './types'

const ZONAS = [
  { value: 'PIE_DERECHO', label: 'Pie derecho' },
  { value: 'PIE_IZQUIERDO', label: 'Pie izquierdo' },
  { value: 'AMBOS', label: 'Ambos' },
  { value: 'DEDOS', label: 'Dedos' },
  { value: 'TOBILLO', label: 'Tobillo' },
  { value: 'OTRO', label: 'Otro' },
]
const VISTAS = [
  { value: 'DORSAL', label: 'Dorsal' },
  { value: 'PLANTAR', label: 'Plantar' },
  { value: 'LATERAL', label: 'Lateral' },
  { value: 'MEDIAL', label: 'Medial' },
  { value: 'POSTERIOR', label: 'Posterior' },
  { value: 'ACERCAMIENTO', label: 'Acercamiento' },
]

export function FotografiasTab({ patient }: { patient: Patient }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(0)
  const [form, setForm] = useState({
    file: null as File | null,
    zonaAnatomica: 'PIE_DERECHO',
    vista: 'DORSAL',
    motivoFoto: '',
    relacionadoDiagnostico: '',
    autorizaUsoClinico: true,
    autorizaDocencia: false,
    permiteIdentificar: false,
  })

  const { data, isLoading } = useQuery<PatientFileRow[]>({
    queryKey: ['paciente-archivos', patient.id],
    queryFn: () =>
      fetch(`/api/pacientes/${patient.id}/archivos`)
        .then((r) => r.json())
        .then((d) => d?.data || d || []),
    enabled: !!patient.id,
  })

  const files = (data || patient.files || []).filter(
    (f) => f.type === 'FOTO_CLINICA' || f.type === 'FOTO',
  )

  async function upload() {
    if (!form.file) return toast.error('Selecciona una imagen')
    if (form.permiteIdentificar && !form.autorizaDocencia) {
      if (
        !confirm(
          'La foto permite identificar al paciente pero NO se autorizó uso para docencia. ¿Continuar?',
        )
      ) {
        return
      }
    }
    setSaving(true)
    setProgress(0)
    try {
      const fd = new FormData()
      fd.append('file', form.file)
      fd.append('type', 'FOTO_CLINICA')
      fd.append('zonaAnatomica', form.zonaAnatomica)
      fd.append('vista', form.vista)
      fd.append('motivoFoto', form.motivoFoto)
      fd.append('relacionadoDiagnostico', form.relacionadoDiagnostico)
      fd.append('autorizaUsoClinico', String(form.autorizaUsoClinico))
      fd.append('autorizaDocencia', String(form.autorizaDocencia))
      fd.append('permiteIdentificar', String(form.permiteIdentificar))

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', `/api/pacientes/${patient.id}/archivos`)
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else {
            try {
              const e = JSON.parse(xhr.responseText)
              reject(new Error(e.error || 'Error'))
            } catch {
              reject(new Error('Error'))
            }
          }
        }
        xhr.onerror = () => reject(new Error('Error de red'))
        xhr.send(fd)
      })
      toast.success('Foto subida')
      setOpen(false)
      setForm({
        ...form,
        file: null,
        motivoFoto: '',
        relacionadoDiagnostico: '',
      })
      qc.invalidateQueries({ queryKey: ['paciente-archivos', patient.id] })
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
      setTimeout(() => setProgress(0), 800)
    }
  }

  async function remove(f: PatientFileRow) {
    if (!confirm('¿Eliminar esta foto clínica?')) return
    try {
      const res = await fetch(`/api/pacientes/${patient.id}/archivos/${f.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Error')
      toast.success('Foto eliminada')
      qc.invalidateQueries({ queryKey: ['paciente-archivos', patient.id] })
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{files.length} foto(s) clínica(s)</p>
        <Button size="sm" onClick={() => setOpen(true)} style={{ backgroundColor: '#0a3143' }}>
          <Plus className="h-4 w-4" /> Subir foto
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      ) : files.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Sin fotografías clínicas.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {files.map((f) => (
            <Card key={f.id} className="overflow-hidden">
              <div className="aspect-square bg-muted">
                <img src={f.fileUrl} alt={f.name} className="w-full h-full object-cover" />
              </div>
              <CardContent className="p-2 space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-medium truncate">{fmtDate(f.createdAt)}</p>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-red-600"
                    onClick={() => remove(f)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {f.zonaAnatomica && (
                    <Badge variant="outline" className="text-[10px]">
                      {ZONAS.find((z) => z.value === f.zonaAnatomica)?.label || f.zonaAnatomica}
                    </Badge>
                  )}
                  {f.vista && (
                    <Badge variant="outline" className="text-[10px]">
                      {f.vista}
                    </Badge>
                  )}
                </div>
                {f.motivoFoto && (
                  <p className="text-[10px] text-muted-foreground truncate">{f.motivoFoto}</p>
                )}
                <div className="flex gap-1 flex-wrap">
                  {f.autorizaDocencia && (
                    <Badge variant="outline" className="text-[9px] text-emerald-700 border-emerald-300">
                      Docencia
                    </Badge>
                  )}
                  {f.permiteIdentificar && (
                    <Badge variant="outline" className="text-[9px] text-amber-700 border-amber-300">
                      Identificable
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Subir fotografía clínica</DialogTitle>
            <DialogDescription>
              Las fotografías forman parte del expediente NOM-004. Verifica los consentimientos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Imagen</Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Zona anatómica</Label>
                <Select
                  value={form.zonaAnatomica}
                  onValueChange={(v) => setForm({ ...form, zonaAnatomica: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ZONAS.map((z) => (
                      <SelectItem key={z.value} value={z.value}>
                        {z.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Vista</Label>
                <Select
                  value={form.vista}
                  onValueChange={(v) => setForm({ ...form, vista: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VISTAS.map((v) => (
                      <SelectItem key={v.value} value={v.value}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Motivo de la foto</Label>
              <Input
                value={form.motivoFoto}
                onChange={(e) => setForm({ ...form, motivoFoto: e.target.value })}
              />
            </div>
            <div>
              <Label>Relacionado con diagnóstico</Label>
              <Input
                value={form.relacionadoDiagnostico}
                onChange={(e) => setForm({ ...form, relacionadoDiagnostico: e.target.value })}
              />
            </div>
            <div className="space-y-2 rounded-md border p-3 bg-muted/30">
              <label className="flex items-center justify-between gap-2 text-sm cursor-pointer">
                <span>Autoriza uso clínico (expediente)</span>
                <Switch
                  checked={form.autorizaUsoClinico}
                  onCheckedChange={(c) => setForm({ ...form, autorizaUsoClinico: c })}
                />
              </label>
              <label className="flex items-center justify-between gap-2 text-sm cursor-pointer">
                <span>Autoriza uso para docencia / publicación</span>
                <Switch
                  checked={form.autorizaDocencia}
                  onCheckedChange={(c) => setForm({ ...form, autorizaDocencia: c })}
                />
              </label>
              <label className="flex items-center justify-between gap-2 text-sm cursor-pointer">
                <span>La foto permite identificar al paciente</span>
                <Switch
                  checked={form.permiteIdentificar}
                  onCheckedChange={(c) => setForm({ ...form, permiteIdentificar: c })}
                />
              </label>
              {form.permiteIdentificar && !form.autorizaDocencia && (
                <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-300 rounded p-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    La foto permite identificar al paciente pero no se autorizó uso para docencia.
                    Verifica con el paciente antes de continuar.
                  </span>
                </div>
              )}
            </div>
            {saving && (
              <div className="space-y-1">
                <div className="h-2 bg-muted rounded overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{ width: `${progress}%`, backgroundColor: '#0a3143' }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">{progress}%</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={upload} disabled={saving} style={{ backgroundColor: '#0a3143' }}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Subir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
