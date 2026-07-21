'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import type { AppointmentItem, PodologistOption, ServiceOption } from './types'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  appointment: AppointmentItem | null
  podologos: PodologistOption[]
}

export function EditAppointmentDialog({ open, onOpenChange, appointment, podologos }: Props) {
  const qc = useQueryClient()
  const [podologistId, setPodologistId] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('09:45')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: serviciosRaw } = useQuery<any[]>({
    queryKey: ['servicios'],
    queryFn: () => fetch('/api/servicios').then((r) => r.json()),
    enabled: open,
  })
  const servicios: ServiceOption[] = Array.isArray(serviciosRaw)
    ? serviciosRaw
    : Array.isArray((serviciosRaw as any)?.rows) ? (serviciosRaw as any).rows : []

  useEffect(() => {
    if (!open || !appointment) return
    setPodologistId(appointment.podologist?.id || '')
    // Extraer HH:MM del ISO string SIN convertir a timezone local
    const extractTime = (iso: string) => {
      const m = iso?.match?.(/T(\d{2}):(\d{2})/)
      return m ? `${m[1]}:${m[2]}` : '09:00'
    }
    setStartTime(extractTime(appointment.startTime))
    setEndTime(extractTime(appointment.endTime))
    setReason(appointment.reason || '')
    setNotes(appointment.notes || '')
  }, [open, appointment])

  async function save() {
    if (!appointment) return
    setSaving(true)
    try {
      const res = await fetch(`/api/citas/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          podologistId: podologistId || null,
          startTime,
          endTime,
          reason,
          notes,
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'Error al guardar')
      }
      toast.success('Cita actualizada')
      qc.invalidateQueries({ queryKey: ['citas'] })
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e.message || 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" /> Editar cita
          </DialogTitle>
          <DialogDescription>
            {appointment?.patient.firstName} {appointment?.patient.lastName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Podólogo</Label>
            <Select value={podologistId} onValueChange={setPodologistId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
              <SelectContent>
                {podologos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Inicio</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Fin</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-9" />
            </div>
          </div>

          <div>
            <Label className="text-xs">Motivo</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving} style={{ backgroundColor: '#0a3143' }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
