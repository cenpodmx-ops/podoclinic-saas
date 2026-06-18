'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ClinicRef, RedMessageItem } from './types'
import { useRedClinics } from './use-red-clinics'

export function NewMessageDialog({
  open,
  onOpenChange,
  onCreated,
  initialToClinicId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated?: (msg: RedMessageItem) => void
  initialToClinicId?: string
}) {
  const qc = useQueryClient()
  const { data: clinics, isLoading } = useRedClinics()

  const [toClinicId, setToClinicId] = useState<string>(initialToClinicId || '')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/red/mensajes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ toClinicId, subject: subject.trim(), body: body.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Error al enviar')
      return json.data as RedMessageItem
    },
    onSuccess: (msg) => {
      toast.success('Mensaje enviado')
      qc.invalidateQueries({ queryKey: ['red', 'mensajes'] })
      setSubject('')
      setBody('')
      setToClinicId(initialToClinicId || '')
      onOpenChange(false)
      onCreated?.(msg)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const canSend = !!toClinicId && subject.trim().length > 0 && body.trim().length > 0 && !createMut.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo mensaje</DialogTitle>
          <DialogDescription>Envía un mensaje a otra clínica del grupo CENPOD.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Para</Label>
            <Select value={toClinicId} onValueChange={setToClinicId} disabled={isLoading || createMut.isPending}>
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? 'Cargando clínicas...' : 'Selecciona destinatario'} />
              </SelectTrigger>
              <SelectContent>
                {(clinics || []).map((c: ClinicRef) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.isDistributor ? ' (Distribuidora)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Asunto</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              disabled={createMut.isPending}
              placeholder="Asunto del mensaje"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Mensaje</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              disabled={createMut.isPending}
              placeholder="Escribe tu mensaje..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createMut.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => createMut.mutate()} disabled={!canSend}>
            {createMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
