'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  CheckCheck,
  Loader2,
  Mail,
  MailOpen,
  Send,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { fmtDateTime } from '@/lib/format'
import { RedMessageDetail, RedMessageItem, MSG_STATUS_META } from './types'
import { NewMessageDialog } from './new-message-dialog'

export function MessageDetail({
  messageId,
  onBack,
  onReplied,
}: {
  messageId: string
  onBack: () => void
  onReplied?: () => void
}) {
  const qc = useQueryClient()
  const [replyOpen, setReplyOpen] = useState(false)

  const { data, isLoading, error } = useQuery<RedMessageDetail>({
    queryKey: ['red', 'mensajes', messageId],
    queryFn: async () => {
      const res = await fetch(`/api/red/mensajes/${messageId}`, { credentials: 'include' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Error al cargar')
      return json.data as RedMessageDetail
    },
  })

  const statusMut = useMutation({
    mutationFn: async (status: 'ABIERTO' | 'RESUELTO') => {
      const res = await fetch(`/api/red/mensajes/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Error al actualizar')
      return json.data as RedMessageItem
    },
    onSuccess: () => {
      toast.success('Estado actualizado')
      qc.invalidateQueries({ queryKey: ['red', 'mensajes'] })
      qc.invalidateQueries({ queryKey: ['red', 'mensajes', messageId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver
        </Button>
        <p className="text-sm text-muted-foreground">{(error as Error)?.message || 'No encontrado'}</p>
      </div>
    )
  }

  const meta = MSG_STATUS_META[data.status] || MSG_STATUS_META.ABIERTO

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver
        </Button>
        <div className="flex items-center gap-2">
          {data.status === 'ABIERTO' ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => statusMut.mutate('RESUELTO')}
              disabled={statusMut.isPending}
            >
              {statusMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCheck className="h-4 w-4 mr-2" />}
              Marcar resuelto
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => statusMut.mutate('ABIERTO')}
              disabled={statusMut.isPending}
            >
              Reabrir
            </Button>
          )}
          <Button size="sm" onClick={() => setReplyOpen(true)}>
            <Send className="h-4 w-4 mr-2" /> Responder
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-lg">{data.subject}</CardTitle>
            <Badge className={meta.badge} variant="outline">
              {meta.label}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            <span>
              <span className="font-medium">De:</span> {data.fromClinic?.name || '—'}
            </span>
            <span>
              <span className="font-medium">Para:</span> {data.toClinic?.name || '—'}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {fmtDateTime(data.createdAt)}
            </span>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4">
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{data.body}</p>
        </CardContent>
      </Card>

      {data.thread && data.thread.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Hilo ({data.thread.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.thread.map((m) => (
              <div key={m.id} className="border-l-2 border-muted pl-3 py-1">
                <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                  {m.readAt ? <MailOpen className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                  <span className="font-medium">{m.fromClinic?.name}</span>
                  <span>·</span>
                  <span>{fmtDateTime(m.createdAt)}</span>
                </div>
                <div className="text-sm font-medium mt-0.5">{m.subject}</div>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-1">{m.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <NewMessageDialog
        open={replyOpen}
        onOpenChange={setReplyOpen}
        initialToClinicId={data.fromClinicId || undefined}
        onCreated={() => {
          onReplied?.()
        }}
      />
    </div>
  )
}
