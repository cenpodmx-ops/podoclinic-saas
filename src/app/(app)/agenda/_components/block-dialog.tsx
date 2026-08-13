'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Loader2, Ban } from 'lucide-react'
import { toast } from 'sonner'
import type { PodologistOption } from './types'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  podologos: PodologistOption[]
  /** Default date when opening */
  defaultDate: string
}

const REASONS = [
  { value: 'VACACIONES', label: 'Vacaciones' },
  { value: 'CAPACITACION', label: 'Capacitación' },
  { value: 'INCAPACIDAD', label: 'Incapacidad' },
  { value: 'OTRO', label: 'Otro' },
]

export function BlockDialog({ open, onOpenChange, podologos, defaultDate }: Props) {
  const qc = useQueryClient()
  const [podologistId, setPodologistId] = useState('')
  const [date, setDate] = useState(defaultDate)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('13:00')
  const [fullDay, setFullDay] = useState(false)
  const [reason, setReason] = useState('VACACIONES')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setDate(defaultDate)
      setPodologistId(podologos[0]?.id || '')
      setFullDay(false)
      setReason('VACACIONES')
      setNotes('')
    }
  }, [open, defaultDate, podologos])

  async function save() {
    if (!podologistId) {
      toast.error('Selecciona un podólogo')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/bloqueos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          podologistId,
          date,
          startTime: fullDay ? undefined : startTime,
          endTime: fullDay ? undefined : endTime,
          reason,
          notes: notes || undefined,
          fullDay,
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'Error al crear bloqueo')
      }
      toast.success('Bloqueo creado')
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
            <Ban className="h-4 w-4" style={{ color: 'var(--primary)' }} /> Bloquear horario
          </DialogTitle>
          <DialogDescription>
            Marca un rango horario como no disponible para un podólogo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Podólogo*</Label>
            <Select value={podologistId} onValueChange={setPodologistId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecciona..." /></SelectTrigger>
              <SelectContent>
                {podologos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Fecha*</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3 bg-muted/20">
            <div>
              <p className="text-sm font-medium">Día completo</p>
              <p className="text-xs text-muted-foreground">Bloquea de 00:00 a 23:59</p>
            </div>
            <Switch checked={fullDay} onCheckedChange={setFullDay} />
          </div>

          {!fullDay && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Inicio</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Fin</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-9" />
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs">Motivo*</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Detalles opcionales..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving} style={{ backgroundColor: 'var(--primary)' }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Crear bloqueo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
