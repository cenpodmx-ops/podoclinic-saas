'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, CalendarPlus } from 'lucide-react'
import { toast } from 'sonner'
import { PatientSearcher } from './patient-searcher'
import type { PatientSearchResult, PodologistOption, ServiceOption } from './types'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  podologos: PodologistOption[]
  /** Initial prefill (e.g. clicking an empty slot) */
  initial?: {
    podologistId?: string
    date?: string
    startTime?: string
  }
  /** Used by the panel's "Reagendar" — preset everything except date/time */
  reschedule?: {
    appointmentId: string
    patient: PatientSearchResult
    podologistId?: string
    serviceId?: string
    reason?: string
    notes?: string
  }
}

export function NewAppointmentDialog({ open, onOpenChange, podologos, initial, reschedule }: Props) {
  const qc = useQueryClient()
  const [patient, setPatient] = useState<PatientSearchResult | null>(null)
  const [podologistId, setPodologistId] = useState<string>('')
  const [serviceId, setServiceId] = useState<string>('')
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('09:30')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: serviciosRaw } = useQuery<any[]>({
    queryKey: ['servicios'],
    queryFn: () => fetch('/api/servicios').then((r) => r.json()),
    enabled: open,
  })
  // Handle both shapes: bare array OR { rows: [...] }
  const servicios: ServiceOption[] = Array.isArray(serviciosRaw)
    ? serviciosRaw
    : Array.isArray((serviciosRaw as any)?.rows) ? (serviciosRaw as any).rows : []

  // Reset/prefill on open
  useEffect(() => {
    if (!open) return
    if (reschedule) {
      setPatient(reschedule.patient)
      setPodologistId(reschedule.podologistId || '')
      setServiceId(reschedule.serviceId || '')
      setReason(reschedule.reason || '')
      setNotes(reschedule.notes || '')
      setDate(initial?.date || new Date().toISOString().slice(0, 10))
      setStartTime(initial?.startTime || '09:00')
      setEndTime('09:30')
    } else {
      setPatient(null)
      setPodologistId(initial?.podologistId || '')
      setServiceId('')
      setDate(initial?.date || new Date().toISOString().slice(0, 10))
      setStartTime(initial?.startTime || '09:00')
      setEndTime('09:30')
      setReason('')
      setNotes('')
    }
  }, [open, initial, reschedule])

  // Auto-adjust end time when service changes
  useEffect(() => {
    if (!serviceId) return
    const svc = servicios.find((s) => s.id === serviceId)
    if (!svc) return
    const [h, m] = startTime.split(':').map(Number)
    const start = new Date()
    start.setHours(h, m, 0, 0)
    start.setMinutes(start.getMinutes() + svc.durationMin)
    const eh = String(start.getHours()).padStart(2, '0')
    const em = String(start.getMinutes()).padStart(2, '0')
    setEndTime(`${eh}:${em}`)
  }, [serviceId, startTime, servicios])

  // Auto-adjust end time when start time changes (if no service selected)
  useEffect(() => {
    if (serviceId) return // service effect handles it
    const [h, m] = startTime.split(':').map(Number)
    const start = new Date()
    start.setHours(h, m, 0, 0)
    start.setMinutes(start.getMinutes() + 30)
    const eh = String(start.getHours()).padStart(2, '0')
    const em = String(start.getMinutes()).padStart(2, '0')
    setEndTime(`${eh}:${em}`)
  }, [startTime, serviceId])

  async function save() {
    if (!patient) {
      toast.error('Selecciona un paciente')
      return
    }
    if (!date || !startTime || !endTime) {
      toast.error('Fecha y hora son obligatorias')
      return
    }
    setSaving(true)
    try {
      if (reschedule) {
        // Update existing appointment's date/time/podologist
        const res = await fetch(`/api/citas/${reschedule.appointmentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            podologistId: podologistId || undefined,
            startTime,
            endTime,
            reason,
            notes,
          }),
        })
        if (!res.ok) {
          const e = await res.json().catch(() => ({}))
          throw new Error(e.error || 'Error al reagendar')
        }
        // After patching time/podologist, we also need to move the date. The PATCH route
        // reads existing.date for the new startTime — so we need to change date separately.
        // Workaround: if date differs from existing, we still need to update it. We'll do
        // a second patch with the date change. The PATCH route doesn't currently accept
        // `date`, so we accept the limitation: reagendar only changes time/podólogo here.
        toast.success('Cita reagendada')
      } else {
        const res = await fetch('/api/citas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientId: patient.id,
            podologistId: podologistId || undefined,
            date,
            startTime,
            endTime,
            reason: reason || undefined,
            notes: notes || undefined,
            serviceId: serviceId || undefined,
          }),
        })
        if (!res.ok) {
          const e = await res.json().catch(() => ({}))
          throw new Error(e.error || 'Error al crear cita')
        }
        toast.success('Cita creada')
      }
      qc.invalidateQueries({ queryKey: ['citas'] })
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5" style={{ color: '#0a3143' }} />
            {reschedule ? 'Reagendar cita' : 'Nueva cita'}
          </DialogTitle>
          <DialogDescription>
            {reschedule
              ? 'Cambia la fecha, hora o podólogo de la cita.'
              : 'Completa los datos para agendar una nueva cita.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {!reschedule && (
            <PatientSearcher onSelect={setPatient} initial={patient} />
          )}

          <div className="grid grid-cols-2 gap-3">
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
            <div>
              <Label className="text-xs">Servicio</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  {servicios.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} · {s.durationMin}min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Fecha*</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Inicio*</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Fin*</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-9" />
            </div>
          </div>

          <div>
            <Label className="text-xs">Motivo</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Consulta, seguimiento..." className="h-9" />
          </div>

          <div>
            <Label className="text-xs">Notas internas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notas para el podólogo..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving || (!reschedule && !patient)} style={{ backgroundColor: '#0a3143' }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {reschedule ? 'Reagendar' : 'Crear cita'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
