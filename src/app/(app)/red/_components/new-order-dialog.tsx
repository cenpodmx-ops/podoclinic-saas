'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Send, Plus, Trash2, Search, Package } from 'lucide-react'
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
import { OrderRow, ProductRow } from './types'
import { useRedClinics } from './use-red-clinics'

type DraftItem = {
  key: string
  productId: string | null
  name: string
  requestedQty: number
}

export function NewOrderDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated?: (o: OrderRow) => void
}) {
  const qc = useQueryClient()
  const { data: clinics } = useRedClinics()

  // Auto-seleccionar la distribuidora si existe
  const distribuidora = (clinics || []).find((c) => c.isDistributor)
  const [toClinicId, setToClinicId] = useState<string>('')
  const [urgency, setUrgency] = useState<'NORMAL' | 'URGENTE'>('NORMAL')
  const [observations, setObservations] = useState('')
  const [items, setItems] = useState<DraftItem[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!toClinicId && distribuidora) setToClinicId(distribuidora.id)
  }, [distribuidora, toClinicId])

  // Buscar productos de la distribuidora seleccionada
  const { data: products } = useQuery<ProductRow[]>({
    queryKey: ['red', 'inventario', toClinicId, search],
    queryFn: async () => {
      const qs = new URLSearchParams({ clinicId: toClinicId })
      if (search) qs.set('q', search)
      const res = await fetch(`/api/red/inventario?${qs.toString()}`, { credentials: 'include' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Error')
      return (json.data || []) as ProductRow[]
    },
    enabled: !!toClinicId && open,
    staleTime: 30_000,
  })

  const addItem = (p?: ProductRow) => {
    const key = Math.random().toString(36).slice(2, 9)
    if (p) {
      // Evitar duplicados
      if (items.some((it) => it.productId === p.id)) {
        toast.info('Ese producto ya está en la lista')
        return
      }
      setItems((prev) => [...prev, { key, productId: p.id, name: p.name, requestedQty: 1 }])
    } else {
      setItems((prev) => [...prev, { key, productId: null, name: '', requestedQty: 1 }])
    }
  }

  const removeItem = (key: string) => setItems((prev) => prev.filter((it) => it.key !== key))
  const updateItem = (key: string, patch: Partial<DraftItem>) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)))

  const createMut = useMutation({
    mutationFn: async () => {
      const cleanItems = items
        .filter((it) => it.name.trim() && it.requestedQty > 0)
        .map((it) => ({
          productId: it.productId,
          name: it.name.trim(),
          requestedQty: Number(it.requestedQty),
        }))
      if (cleanItems.length === 0) throw new Error('Agrega al menos un item válido')

      const res = await fetch('/api/red/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          toClinicId,
          items: cleanItems,
          urgency,
          observations: observations.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Error al crear pedido')
      return json.data as OrderRow
    },
    onSuccess: (o) => {
      toast.success('Pedido enviado a la distribuidora')
      qc.invalidateQueries({ queryKey: ['red', 'pedidos'] })
      setItems([])
      setObservations('')
      setUrgency('NORMAL')
      onOpenChange(false)
      onCreated?.(o)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const canSend = !!toClinicId && items.length > 0 && !createMut.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo pedido</DialogTitle>
          <DialogDescription>
            Pide insumos a la distribuidora CENPOD. Puedes seleccionar productos del catálogo o agregar items libres.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Distribuidora</Label>
              <select
                value={toClinicId}
                onChange={(e) => setToClinicId(e.target.value)}
                disabled={createMut.isPending}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Selecciona...</option>
                {(clinics || [])
                  .filter((c) => c.isDistributor)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Urgencia</Label>
              <RadioGroup
                value={urgency}
                onValueChange={(v) => setUrgency(v as 'NORMAL' | 'URGENTE')}
                className="flex gap-2"
                disabled={createMut.isPending}
              >
                <Label className={`flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer text-sm ${urgency === 'NORMAL' ? 'bg-amber-50 border-amber-300 text-amber-800' : ''}`}>
                  <RadioGroupItem value="NORMAL" /> Normal
                </Label>
                <Label className={`flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer text-sm ${urgency === 'URGENTE' ? 'bg-red-50 border-red-300 text-red-800' : ''}`}>
                  <RadioGroupItem value="URGENTE" /> Urgente
                </Label>
              </RadioGroup>
            </div>
          </div>

          {/* Buscador de productos */}
          {toClinicId && (
            <div className="space-y-2">
              <Label>Buscar en catálogo de la distribuidora</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nombre o código..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                  disabled={createMut.isPending}
                />
              </div>
              {(products || []).length > 0 && (
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  {(products || []).slice(0, 30).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addItem(p)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent/50 border-b last:border-b-0 flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <Package className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{p.name}</span>
                        {p.code && <span className="text-xs text-muted-foreground">({p.code})</span>}
                      </span>
                      <span className="text-xs text-muted-foreground">Stock: {p.stock}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Items del pedido */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Items del pedido</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => addItem()} disabled={createMut.isPending}>
                <Plus className="h-3 w-3 mr-1" /> Item libre
              </Button>
            </div>

            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center border border-dashed rounded-md">
                No hay items. Busca en el catálogo o agrega un item libre.
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((it) => (
                  <div key={it.key} className="flex items-center gap-2">
                    <Input
                      value={it.name}
                      onChange={(e) => updateItem(it.key, { name: e.target.value, productId: null })}
                      placeholder="Nombre del producto"
                      className="flex-1"
                      disabled={createMut.isPending}
                    />
                    <Input
                      type="number"
                      min={1}
                      value={it.requestedQty}
                      onChange={(e) => updateItem(it.key, { requestedQty: Number(e.target.value) })}
                      className="w-20"
                      disabled={createMut.isPending}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeItem(it.key)}
                      disabled={createMut.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="obs">Observaciones</Label>
            <Textarea
              id="obs"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={2}
              disabled={createMut.isPending}
              placeholder="Notas para la distribuidora..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createMut.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => createMut.mutate()} disabled={!canSend}>
            {createMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Re-export para evitar warning de unused
export type { ClinicRef, OrderRow }
export { Badge }
