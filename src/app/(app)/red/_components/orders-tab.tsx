'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { useRed } from '@/components/cenpod/red-provider'
import {
  Plus,
  Search,
  Clock,
  Package,
  AlertTriangle,
  Inbox as InboxIcon,
  Send as SendIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fmtDateTime } from '@/lib/format'
import { OrderRow, ORDER_STATUS_META } from './types'
import { NewOrderDialog } from './new-order-dialog'
import { OrderDetail } from './order-detail'

export function OrdersTab() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role as string | undefined
  const clinicId = (session?.user as any)?.clinicId as string | undefined
  const red = useRed()
  const qc = useQueryClient()
  const [box, setBox] = useState<'sent' | 'inbox'>('sent')
  const [search, setSearch] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Reset unread al ver pedidos
  useEffect(() => {
    if (red) red.reset('orders')
  }, [red])

  // ¿El usuario es la distribuidora? (puede ver "Recibidos")
  const { data: clinics } = useQuery<{ id: string; isDistributor: boolean }[]>({
    queryKey: ['red', 'my-clinic-is-distributor', clinicId],
    queryFn: async () => {
      // Aprovechamos el endpoint de clínicas para detectar distribuidoras
      const res = await fetch('/api/red/clinicas', { credentials: 'include' })
      const json = await res.json()
      return (json.data || []) as { id: string; isDistributor: boolean }[]
    },
    enabled: !!clinicId,
    staleTime: 120_000,
  })

  // ¿Mi clínica es la distribuidora? Para eso consulto mi propia clínica con /api/clinicas
  const { data: myClinic } = useQuery<{ isDistributor: boolean }>({
    queryKey: ['red', 'my-clinic', clinicId],
    queryFn: async () => {
      // Pequeño truco: si mi clínica aparece como distribuidora en /api/red/clinicas para SUPER,
      // aquí no la veo. Mejor consulta directa vía /api/clinicas (devuelve solo mi clínica si no soy SUPER).
      const res = await fetch('/api/clinicas', { credentials: 'include' })
      const json = await res.json()
      const arr = Array.isArray(json?.data) ? json.data : []
      const mine = arr.find((c: any) => c.id === clinicId)
      // Para SUPER /api/clinicas devuelve todas excepto distribuidoras, así que
      // si soy SUPER y tengo isDistributor=true, no apareceré — asumimos que SUPER no es distribuidora.
      return { isDistributor: !!mine?.isDistributor || role === 'SUPER' && false }
    },
    enabled: !!clinicId,
    staleTime: 120_000,
  })

  // El usuario es distribuidora si es SUPER o si su clínica lo es
  const isDistribuidora = role === 'SUPER' || !!myClinic?.isDistributor

  // Si no es distribuidora, forzar box=sent (derived value, sin useEffect)
  const effectiveBox = !isDistribuidora && box === 'inbox' ? 'sent' : box

  const { data, isLoading, error } = useQuery<OrderRow[]>({
    queryKey: ['red', 'pedidos', effectiveBox],
    queryFn: async () => {
      const res = await fetch(`/api/red/pedidos?box=${effectiveBox}`, { credentials: 'include' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Error al cargar pedidos')
      return json.data as OrderRow[]
    },
    enabled: role !== 'PODOLOGIST',
  })

  if (selectedId) {
    return (
      <OrderDetail
        orderId={selectedId}
        onBack={() => setSelectedId(null)}
        isDistribuidoraView={effectiveBox === 'inbox'}
      />
    )
  }

  const filtered = (data || []).filter((o) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      o.fromClinic?.name?.toLowerCase().includes(q) ||
      o.toClinic?.name?.toLowerCase().includes(q) ||
      o.items.some((it) => it.name.toLowerCase().includes(q))
    )
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Tabs value={box} onValueChange={(v) => setBox(v as 'sent' | 'inbox')}>
          <TabsList>
            <TabsTrigger value="sent" disabled={!isDistribuidora && false}>
              <SendIcon className="h-3 w-3 mr-1" /> Enviados
            </TabsTrigger>
            <TabsTrigger value="inbox" disabled={!isDistribuidora}>
              <InboxIcon className="h-3 w-3 mr-1" /> Recibidos
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar pedidos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <Button onClick={() => setNewOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" /> Nuevo pedido
        </Button>
      </div>

      {!isDistribuidora && effectiveBox === 'inbox' && (
        <p className="text-xs text-muted-foreground">Solo la distribuidora puede ver pedidos recibidos.</p>
      )}

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
            <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
            {effectiveBox === 'sent' ? 'No has enviado pedidos' : 'No hay pedidos recibidos'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => {
            const meta = ORDER_STATUS_META[o.status] || ORDER_STATUS_META.PENDIENTE
            const counterpart = effectiveBox === 'inbox' ? o.fromClinic : o.toClinic
            const totalItems = o.items.length
            const totalQty = o.items.reduce((s, it) => s + it.requestedQty, 0)
            return (
              <Card
                key={o.id}
                className="cursor-pointer hover:bg-accent/40 transition-colors"
                onClick={() => setSelectedId(o.id)}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="mt-0.5 p-1.5 rounded-md bg-[#0a3143]/10">
                    <Package className="h-4 w-4 text-[#0a3143]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {totalItems} {totalItems === 1 ? 'item' : 'items'} · {totalQty} unidades
                      </span>
                      <Badge className={meta.badge} variant="outline">
                        {meta.label}
                      </Badge>
                      {o.urgency === 'URGENTE' && (
                        <Badge className="bg-red-100 text-red-800 border-red-300" variant="outline">
                          <AlertTriangle className="h-3 w-3 mr-1" /> Urgente
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      <span className="font-medium">{effectiveBox === 'inbox' ? 'De' : 'Para'}:</span>{' '}
                      {counterpart?.name || '—'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {o.items.map((it) => it.name).join(', ')}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                    <Clock className="h-3 w-3" />
                    {fmtDateTime(o.createdAt)}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <NewOrderDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  )
}
