'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft,
  Check,
  Loader2,
  Package,
  Clock,
  X,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { fmtDateTime } from '@/lib/format'
import { OrderRow, ORDER_STATUS_META } from './types'

export function OrderDetail({
  orderId,
  onBack,
  isDistribuidoraView,
}: {
  orderId: string
  onBack: () => void
  /** true si el usuario es la distribuidora (toClinic) y puede actualizar el pedido */
  isDistribuidoraView: boolean
}) {
  const qc = useQueryClient()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role as string | undefined

  const [partialOpen, setPartialOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [partialItems, setPartialItems] = useState<Record<string, number>>({})

  const { data, isLoading, error } = useQuery<OrderRow>({
    queryKey: ['red', 'pedidos', orderId],
    queryFn: async () => {
      const res = await fetch(`/api/red/pedidos/${orderId}`, { credentials: 'include' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Error al cargar')
      return json.data as OrderRow
    },
  })

  const updateMut = useMutation({
    mutationFn: async (payload: {
      status: 'ACEPTADO' | 'PARCIAL' | 'RECHAZADO' | 'SURTIDO'
      items?: Array<{ id: string; suppliedQty: number }>
      rejectReason?: string
    }) => {
      const res = await fetch(`/api/red/pedidos/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Error al actualizar')
      return json.data as OrderRow
    },
    onSuccess: () => {
      toast.success('Pedido actualizado')
      qc.invalidateQueries({ queryKey: ['red', 'pedidos'] })
      qc.invalidateQueries({ queryKey: ['red', 'pedidos', orderId] })
      setPartialOpen(false)
      setRejectOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-48 w-full" />
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

  const meta = ORDER_STATUS_META[data.status] || ORDER_STATUS_META.PENDIENTE
  const canUpdate = isDistribuidoraView && data.status === 'PENDIENTE' && role !== 'PODOLOGIST'

  const openPartial = () => {
    const init: Record<string, number> = {}
    data.items.forEach((it) => {
      init[it.id] = it.requestedQty // default: surtir todo
    })
    setPartialItems(init)
    setPartialOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver
        </Button>
        {canUpdate && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => updateMut.mutate({ status: 'ACEPTADO' })} disabled={updateMut.isPending}>
              <Check className="h-4 w-4 mr-2" /> Aceptar
            </Button>
            <Button size="sm" variant="outline" onClick={openPartial} disabled={updateMut.isPending}>
              <Package className="h-4 w-4 mr-2" /> Surtir parcial
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)} disabled={updateMut.isPending}>
              <X className="h-4 w-4 mr-2" /> Rechazar
            </Button>
            <Button size="sm" onClick={() => updateMut.mutate({ status: 'SURTIDO' })} disabled={updateMut.isPending}>
              <Check className="h-4 w-4 mr-2" /> Marcar surtido
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Pedido
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={meta.badge} variant="outline">
                {meta.label}
              </Badge>
              {data.urgency === 'URGENTE' && (
                <Badge className="bg-red-100 text-red-800 border-red-300" variant="outline">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Urgente
                </Badge>
              )}
            </div>
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
        <CardContent className="pt-4 space-y-4">
          <div>
            <h4 className="text-sm font-semibold mb-2">Items ({data.items.length})</h4>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Producto</th>
                    <th className="text-right px-3 py-2 font-medium w-24">Solicitado</th>
                    <th className="text-right px-3 py-2 font-medium w-24">Surtido</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((it) => (
                    <tr key={it.id} className="border-t">
                      <td className="px-3 py-2">
                        <div className="font-medium">{it.name}</div>
                        {it.product?.code && (
                          <div className="text-xs text-muted-foreground">Código: {it.product.code}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">{it.requestedQty}</td>
                      <td className="px-3 py-2 text-right">
                        {it.suppliedQty > 0 ? (
                          <span className={it.suppliedQty < it.requestedQty ? 'text-orange-600 font-medium' : 'text-emerald-700 font-medium'}>
                            {it.suppliedQty}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {data.observations && (
            <div>
              <h4 className="text-sm font-semibold mb-1">Observaciones</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{data.observations}</p>
            </div>
          )}

          {data.rejectReason && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <h4 className="text-sm font-semibold text-red-800 mb-1">Motivo de rechazo</h4>
              <p className="text-sm text-red-700 whitespace-pre-wrap">{data.rejectReason}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Surtir parcial */}
      <Dialog open={partialOpen} onOpenChange={setPartialOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Surtir parcialmente</DialogTitle>
            <DialogDescription>
              Indica cuántas unidades se surten de cada item. Las cantidades pueden ser menores a las solicitadas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-[60vh] overflow-y-auto">
            {data.items.map((it) => (
              <div key={it.id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{it.name}</div>
                  <div className="text-xs text-muted-foreground">Solicitado: {it.requestedQty}</div>
                </div>
                <Input
                  type="number"
                  min={0}
                  max={it.requestedQty}
                  value={partialItems[it.id] ?? 0}
                  onChange={(e) =>
                    setPartialItems((prev) => ({ ...prev, [it.id]: Math.max(0, Number(e.target.value)) }))
                  }
                  className="w-24"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPartialOpen(false)} disabled={updateMut.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                updateMut.mutate({
                  status: 'PARCIAL',
                  items: data.items.map((it) => ({ id: it.id, suppliedQty: partialItems[it.id] ?? 0 })),
                })
              }
              disabled={updateMut.isPending}
            >
              {updateMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Package className="h-4 w-4 mr-2" />}
              Confirmar surtido parcial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Rechazar */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rechazar pedido</DialogTitle>
            <DialogDescription>Indica el motivo del rechazo (visible para la clínica solicitante).</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="reason">Motivo</Label>
            <Textarea
              id="reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Ej. Sin stock del producto X"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={updateMut.isPending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => updateMut.mutate({ status: 'RECHAZADO', rejectReason: rejectReason.trim() })}
              disabled={updateMut.isPending}
            >
              {updateMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <X className="h-4 w-4 mr-2" />}
              Rechazar pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
