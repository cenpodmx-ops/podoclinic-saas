'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Megaphone } from 'lucide-react'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { RedNoticeItem, NOTICE_TYPE_META } from './types'

export function NewNoticeDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated?: (n: RedNoticeItem) => void
}) {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [type, setType] = useState<'INFO' | 'URGENTE' | 'CAPACITACION'>('INFO')
  const [toAll, setToAll] = useState(true)

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/red/avisos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: title.trim(), body: body.trim(), type, toAllClinics: toAll }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Error al publicar aviso')
      return json.data as RedNoticeItem
    },
    onSuccess: (n) => {
      toast.success('Aviso publicado')
      qc.invalidateQueries({ queryKey: ['red', 'avisos'] })
      setTitle('')
      setBody('')
      setType('INFO')
      setToAll(true)
      onOpenChange(false)
      onCreated?.(n)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const canSend = title.trim().length > 0 && body.trim().length > 0 && !createMut.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo aviso</DialogTitle>
          <DialogDescription>
            Publica un aviso a todas las clínicas del la cl.nica.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              disabled={createMut.isPending}
              placeholder="Título del aviso"
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo</Label>
            <RadioGroup
              value={type}
              onValueChange={(v) => setType(v as 'INFO' | 'URGENTE' | 'CAPACITACION')}
              className="grid grid-cols-3 gap-2"
              disabled={createMut.isPending}
            >
              {(['INFO', 'URGENTE', 'CAPACITACION'] as const).map((t) => {
                const meta = NOTICE_TYPE_META[t]
                return (
                  <Label
                    key={t}
                    htmlFor={`t-${t}`}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-sm ${
                      type === t ? meta.badge : 'border-input'
                    }`}
                  >
                    <RadioGroupItem id={`t-${t}`} value={t} />
                    {meta.label}
                  </Label>
                )
              })}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Mensaje</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              disabled={createMut.isPending}
              placeholder="Escribe el aviso..."
            />
          </div>

          <Label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={toAll}
              onChange={(e) => setToAll(e.target.checked)}
              disabled={createMut.isPending}
              className="accent-[#0a3143]"
            />
            Visible para todas las clínicas del grupo
          </Label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createMut.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => createMut.mutate()} disabled={!canSend}>
            {createMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Megaphone className="h-4 w-4 mr-2" />}
            Publicar aviso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
