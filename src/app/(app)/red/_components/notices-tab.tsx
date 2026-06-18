'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { useRed } from '@/components/cenpod/red-provider'
import {
  Megaphone,
  Search,
  Clock,
  Info,
  AlertTriangle,
  GraduationCap,
  CheckCheck,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { fmtDateTime } from '@/lib/format'
import { RedNoticeItem, NOTICE_TYPE_META } from './types'
import { NewNoticeDialog } from './new-notice-dialog'

const TYPE_ICON: Record<string, React.ElementType> = {
  INFO: Info,
  URGENTE: AlertTriangle,
  CAPACITACION: GraduationCap,
}

export function NoticesTab() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role as string | undefined
  const red = useRed()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (red) red.reset('notices')
  }, [red])

  const { data, isLoading, error } = useQuery<RedNoticeItem[]>({
    queryKey: ['red', 'avisos'],
    queryFn: async () => {
      const res = await fetch('/api/red/avisos', { credentials: 'include' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Error al cargar avisos')
      return json.data as RedNoticeItem[]
    },
    enabled: role !== 'PODOLOGIST',
  })

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/red/avisos/${id}/leer`, {
        method: 'POST',
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Error')
      return json.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['red', 'avisos'] })
    },
  })

  const handleExpand = (n: RedNoticeItem) => {
    if (expandedId === n.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(n.id)
    // Marcar como leído al expandir si no estaba leído
    if (n.reads.length === 0) {
      markRead.mutate(n.id)
    }
  }

  const filtered = (data || []).filter((n) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar avisos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        {role === 'SUPER' && (
          <Button onClick={() => setNewOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" /> Nuevo aviso
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{(error as Error)?.message}</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-30" />
            No hay avisos publicados
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => {
            const meta = NOTICE_TYPE_META[n.type] || NOTICE_TYPE_META.INFO
            const Icon = TYPE_ICON[n.type] || Info
            const isUnread = n.reads.length === 0
            const isExpanded = expandedId === n.id
            return (
              <Card
                key={n.id}
                className={`cursor-pointer hover:bg-accent/40 transition-colors ${isUnread ? 'border-l-4 ' + meta.dot.replace('bg-', 'border-l-') : ''}`}
                onClick={() => handleExpand(n)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 p-1.5 rounded-md ${meta.badge}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm ${isUnread ? 'font-bold' : 'font-medium'}`}>
                          {n.title}
                        </span>
                        <Badge className={meta.badge} variant="outline">
                          {meta.label}
                        </Badge>
                        {isUnread && (
                          <Badge variant="secondary" className="text-[10px] h-5 bg-[#0a3143] text-white">
                            Nuevo
                          </Badge>
                        )}
                        {n.reads.length > 0 && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <CheckCheck className="h-3 w-3" /> Leído
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                        <span className="font-medium">De: {n.fromClinic?.name || 'Matriz'}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {fmtDateTime(n.createdAt)}
                        </span>
                      </div>
                      {isExpanded ? (
                        <p className="text-sm whitespace-pre-wrap leading-relaxed mt-3 pt-3 border-t border-dashed">
                          {n.body}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.body}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <NewNoticeDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  )
}
