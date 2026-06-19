'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { useRed } from '@/components/cenpod/red-provider'
import { Plus, Mail, MailOpen, Search, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { fmtDateTime } from '@/lib/format'
import { RedMessageItem, MSG_STATUS_META } from './types'
import { NewMessageDialog } from './new-message-dialog'
import { MessageDetail } from './message-detail'

export function MessagesTab({ box }: { box: 'inbox' | 'sent' }) {
  const qc = useQueryClient()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role as string | undefined
  const red = useRed()
  const [search, setSearch] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Reset unread al entrar a inbox
  useEffect(() => {
    if (box === 'inbox' && red) red.reset('messages')
  }, [box, red])

  const { data, isLoading, error } = useQuery<RedMessageItem[]>({
    queryKey: ['red', 'mensajes', box],
    queryFn: async () => {
      const res = await fetch(`/api/red/mensajes?box=${box}`, { credentials: 'include' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Error al cargar')
      return json.data as RedMessageItem[]
    },
    enabled: role !== 'PODOLOGIST',
  })

  // Si está seleccionado, mostrar detalle
  if (selectedId) {
    return (
      <MessageDetail
        messageId={selectedId}
        onBack={() => setSelectedId(null)}
        onReplied={() => {
          qc.invalidateQueries({ queryKey: ['red', 'mensajes'] })
        }}
      />
    )
  }

  const filtered = (data || []).filter((m) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      m.subject.toLowerCase().includes(q) ||
      m.body.toLowerCase().includes(q) ||
      m.fromClinic?.name?.toLowerCase().includes(q) ||
      m.toClinic?.name?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar mensajes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button onClick={() => setNewOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" /> Nuevo mensaje
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{(error as Error)?.message}</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <Mail className="h-10 w-10 mx-auto mb-3 opacity-30" />
            {box === 'inbox' ? 'No tienes mensajes recibidos' : 'No has enviado mensajes'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => {
            const meta = MSG_STATUS_META[m.status] || MSG_STATUS_META.ABIERTO
            const isUnread = box === 'inbox' && !m.readAt
            const counterpart = box === 'inbox' ? m.fromClinic : m.toClinic
            return (
              <Card
                key={m.id}
                className={`cursor-pointer hover:bg-accent/40 transition-colors ${isUnread ? 'border-l-4 border-l-[#0a3143]' : ''}`}
                onClick={() => setSelectedId(m.id)}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="mt-0.5">
                    {isUnread ? (
                      <Mail className="h-5 w-5 text-[#0a3143]" />
                    ) : (
                      <MailOpen className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm ${isUnread ? 'font-bold' : 'font-medium'}`}>
                        {m.subject}
                      </span>
                      {isUnread && (
                        <Badge variant="secondary" className="text-[10px] h-5 bg-[#0a3143] text-white">
                          Nuevo
                        </Badge>
                      )}
                      <Badge className={meta.badge} variant="outline">
                        {meta.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                      <span className="font-medium">{box === 'inbox' ? 'De' : 'Para'}:</span>{' '}
                      {counterpart?.name || '—'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{m.body}</p>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                    <Clock className="h-3 w-3" />
                    {fmtDateTime(m.createdAt)}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <NewMessageDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  )
}
