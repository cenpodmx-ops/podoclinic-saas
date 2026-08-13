'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowDownCircle, ArrowUpCircle, RefreshCcw } from 'lucide-react'
import { toast } from 'sonner'
import { fmtDateTime, fmtMoney } from '@/lib/format'
import { MOVEMENT_TYPE_LABELS, type Product, type StockMovement } from './types'

export function MovimientosDialog({
  open,
  onOpenChange,
  product,
  canEdit,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  product: Product | null
  canEdit: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span>Movimientos — {product?.name}</span>
            {product && (
              <Badge variant="outline" className="font-mono text-xs">
                Stock: {product.stock}
              </Badge>
            )}
            {product && product.stock <= product.minStock && (
              <Badge className="bg-red-100 text-red-700">Stock bajo</Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        {open && product && (
          <Body
            key={product.id}
            product={product}
            canEdit={canEdit}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function Body({
  product,
  canEdit,
  onClose,
}: {
  product: Product
  canEdit: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [type, setType] = useState<'ENTRADA' | 'AJUSTE'>('ENTRADA')
  const [quantity, setQuantity] = useState(1)
  const [reason, setReason] = useState('')
  const [cost, setCost] = useState<number | ''>('')
  const [supplier, setSupplier] = useState('')

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['movimientos', product.id],
    queryFn: () =>
      fetch(`/api/inventario/${product.id}/movimientos?limit=50`).then((r) => r.json()),
    enabled: !!product,
  })

  const movements: StockMovement[] = data?.data || []

  const addMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/api/inventario/${product.id}/movimientos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Error al registrar movimiento')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Movimiento registrado')
      qc.invalidateQueries({ queryKey: ['movimientos', product.id] })
      qc.invalidateQueries({ queryKey: ['inventario-list'] })
      qc.invalidateQueries({ queryKey: ['inventario-bajo'] })
      setReason('')
      setCost('')
      setQuantity(1)
    },
    onError: (e: any) => toast.error(e.message || 'Error'),
  })

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="rounded-lg border p-3 bg-muted/30">
          <h4 className="text-sm font-semibold mb-2">Registrar movimiento</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={type} onValueChange={(v: any) => setType(v)}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENTRADA">Entrada</SelectItem>
                  <SelectItem value="AJUSTE">Ajuste (+/-)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cantidad</Label>
              <Input
                type="number"
                min={type === 'ENTRADA' ? 1 : undefined}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value) || 0)}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Costo unit.</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0.00"
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Proveedor</Label>
              <Input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Opcional"
                className="h-8"
              />
            </div>
          </div>
          <div className="space-y-1 mt-2">
            <Label className="text-xs">Motivo / nota</Label>
            <Textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={type === 'ENTRADA' ? 'Ej. Compra a proveedor' : 'Ej. Merma por caducidad (-3) o ajuste de inventario físico'}
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="mt-2"
            style={{ backgroundColor: 'var(--primary)' }}
            disabled={addMutation.isPending || quantity === 0}
            onClick={() =>
              addMutation.mutate({
                type,
                quantity,
                reason: reason || undefined,
                cost: cost === '' ? undefined : Number(cost),
                supplier: supplier || undefined,
              })
            }
          >
            {addMutation.isPending ? 'Guardando...' : 'Registrar'}
          </Button>
          <p className="text-[10px] text-muted-foreground mt-1">
            {type === 'ENTRADA'
              ? 'Suma al stock actual.'
              : 'Ajuste: positivo suma, negativo resta. El stock nunca quedará negativo.'}
            {' '}Las salidas por venta/consulta se registran automáticamente.
          </p>
        </div>
      )}

      <div>
        <h4 className="text-sm font-semibold mb-2 flex items-center justify-between">
          <span>Historial</span>
          {isFetching && <span className="text-[10px] text-muted-foreground">Actualizando…</span>}
        </h4>
        <div className="max-h-80 overflow-y-auto rounded-md border">
          {isLoading ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : movements.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Sin movimientos registrados.
            </div>
          ) : (
            <div className="divide-y">
              {movements.map((m) => {
                const positive = m.type === 'ENTRADA' || (m.type === 'AJUSTE' && m.quantity > 0)
                const negative = m.type === 'SALIDA' || m.type === 'VENTA' || (m.type === 'AJUSTE' && m.quantity < 0)
                return (
                  <div key={m.id} className="p-2.5 flex items-center gap-2 text-sm">
                    {positive ? (
                      <ArrowUpCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : negative ? (
                      <ArrowDownCircle className="h-4 w-4 text-red-600 shrink-0" />
                    ) : (
                      <RefreshCcw className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">
                          {MOVEMENT_TYPE_LABELS[m.type] || m.type}
                        </Badge>
                        <span className="font-mono text-xs">
                          {m.quantity > 0 ? '+' : ''}{m.quantity}
                        </span>
                        {m.cost != null && (
                          <span className="text-[10px] text-muted-foreground">
                            Costo: {fmtMoney(m.cost)}
                          </span>
                        )}
                      </div>
                      {m.reason && (
                        <div className="text-xs text-muted-foreground line-clamp-1">{m.reason}</div>
                      )}
                      {m.supplier && (
                        <div className="text-[10px] text-muted-foreground">Prov: {m.supplier}</div>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground text-right shrink-0">
                      {fmtDateTime(m.createdAt)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cerrar</Button>
      </DialogFooter>
    </div>
  )
}
