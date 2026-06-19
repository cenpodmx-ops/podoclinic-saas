'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Plus, X, ShoppingCart, Printer, Package2 } from 'lucide-react'
import { toast } from 'sonner'
import { fmtMoney } from '@/lib/format'
import { format } from 'date-fns'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type CartItem, type VentaMostradorResponse } from './types'

type SearchHit = {
  id: string
  name: string
  category: string
  salePrice: number
  stock: number
  minStock: number
  ivaType: string
}

export function PosDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  // Ticket shown in separate dialog after sale
  const [ticket, setTicket] = useState<VentaMostradorResponse | null>(null)

  function handleClose() {
    setTicket(null)
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open && !ticket} onOpenChange={(v) => { if (!v) handleClose() }}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" /> Venta de mostrador
            </DialogTitle>
          </DialogHeader>
          {open && !ticket && (
            <PosBody key={`pos-${open}`} onClose={handleClose} onTicket={setTicket} />
          )}
        </DialogContent>
      </Dialog>

      {/* Ticket dialog */}
      <Dialog open={!!ticket} onOpenChange={(v) => { if (!v) handleClose() }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-4 w-4" /> Ticket de venta
            </DialogTitle>
          </DialogHeader>
          {ticket && <TicketView data={ticket} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => window.print()}>Imprimir</Button>
            <Button onClick={handleClose} style={{ backgroundColor: '#0a3143' }}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function PosBody({
  onClose,
  onTicket,
}: {
  onClose: () => void
  onTicket: (t: VentaMostradorResponse) => void
}) {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState<string>('EFECTIVO')
  const [descontarStock, setDescontarStock] = useState(true)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250)
    return () => clearTimeout(t)
  }, [q])

  const { data, isFetching } = useQuery({
    queryKey: ['inventario-pos-search', debounced],
    queryFn: () => fetch(`/api/inventario?q=${encodeURIComponent(debounced)}`).then((r) => r.json()),
    enabled: debounced.length > 0,
    staleTime: 15_000,
  })

  const results: SearchHit[] = data?.rows || []

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function addToCart(p: SearchHit) {
    setCart((c) => {
      const existing = c.find((i) => i.productId === p.id)
      if (existing) {
        if (existing.qty + 1 > p.stock) {
          toast.error(`Solo hay ${p.stock} en stock`)
          return c
        }
        return c.map((i) => i.productId === p.id
          ? { ...i, qty: i.qty + 1, subtotal: (i.qty + 1) * i.price, ivaAmount: calcIva(i.ivaType, (i.qty + 1) * i.price) }
          : i)
      }
      const subtotal = p.salePrice
      return [
        ...c,
        {
          productId: p.id,
          name: p.name,
          category: p.category,
          ivaType: p.ivaType,
          qty: 1,
          price: p.salePrice,
          stock: p.stock,
          subtotal,
          ivaAmount: calcIva(p.ivaType, subtotal),
        },
      ]
    })
    setQ('')
    setDropdownOpen(false)
  }

  function updateQty(productId: string, qty: number) {
    setCart((c) => c.map((i) => {
      if (i.productId !== productId) return i
      const newQty = Math.max(1, qty)
      if (descontarStock && newQty > i.stock) {
        toast.error(`Solo hay ${i.stock} en stock`)
        return i
      }
      return { ...i, qty: newQty, subtotal: newQty * i.price, ivaAmount: calcIva(i.ivaType, newQty * i.price) }
    }))
  }

  function removeItem(productId: string) {
    setCart((c) => c.filter((i) => i.productId !== productId))
  }

  const subtotal = cart.reduce((s, i) => s + i.subtotal, 0)
  const ivaTotal = cart.reduce((s, i) => s + i.ivaAmount, 0)
  const total = subtotal + ivaTotal

  const ventaMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/ventas-mostrador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map((i) => ({ productId: i.productId, qty: i.qty })),
          paymentMethod,
          descontarStock,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Error al procesar la venta')
      return j as VentaMostradorResponse
    },
    onSuccess: (data) => {
      toast.success(`Venta #${data.ticketId} procesada · ${fmtMoney(data.total)}`)
      onTicket(data)
      setCart([])
      setQ('')
      qc.invalidateQueries({ queryKey: ['inventario-list'] })
      qc.invalidateQueries({ queryKey: ['inventario-bajo'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (e: any) => toast.error(e.message || 'Error'),
  })

  return (
    <div className="space-y-4">
      {/* Buscador de productos */}
      <div className="relative" ref={boxRef}>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => { setQ(e.target.value); setDropdownOpen(true) }}
            onFocus={() => setDropdownOpen(true)}
            placeholder="Buscar producto por nombre o código..."
            className="pl-8"
          />
        </div>
        {dropdownOpen && q.length > 0 && (
          <div className="absolute z-30 mt-1 w-full bg-background border rounded-md shadow-lg max-h-72 overflow-y-auto">
            {isFetching && <div className="px-3 py-2 text-xs text-muted-foreground">Buscando…</div>}
            {!isFetching && results.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Sin resultados</div>
            )}
            {!isFetching && results.map((p) => {
              const outOfStock = p.stock <= 0
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addToCart(p)}
                  disabled={outOfStock && descontarStock}
                  className="w-full text-left px-3 py-2 hover:bg-accent flex items-center justify-between gap-2 disabled:opacity-50 disabled:cursor-not-allowed border-b last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Package2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium truncate">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-[10px] h-4 px-1">{p.category}</Badge>
                      <span className="text-[10px] text-muted-foreground">{fmtMoney(p.salePrice)}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-xs font-mono ${outOfStock ? 'text-red-600' : p.stock <= p.minStock ? 'text-orange-600' : 'text-muted-foreground'}`}>
                      Stock: {p.stock}
                    </div>
                    {!outOfStock && <Plus className="h-3 w-3 ml-auto mt-0.5 text-emerald-600" />}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Carrito */}
      {cart.length === 0 ? (
        <div className="text-xs text-muted-foreground border border-dashed rounded-md p-6 text-center">
          No hay productos en el carrito. Busca arriba para agregar.
        </div>
      ) : (
        <div className="rounded-md border divide-y">
          {cart.map((it) => (
            <div key={it.productId} className="p-2.5 flex items-center gap-2 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-medium truncate">{it.name}</span>
                  <Badge variant="outline" className="text-[10px] h-4 px-1">{it.category}</Badge>
                  <span className="text-[10px] text-muted-foreground">Stock: {it.stock}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => updateQty(it.productId, it.qty - 1)}
                  disabled={it.qty <= 1}
                >−</Button>
                <Input
                  type="number"
                  min={1}
                  value={it.qty}
                  onChange={(e) => updateQty(it.productId, parseInt(e.target.value) || 1)}
                  className="h-7 w-14 text-center"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => updateQty(it.productId, it.qty + 1)}
                  disabled={descontarStock && it.qty >= it.stock}
                >+</Button>
                <span className="text-xs text-muted-foreground">×</span>
                <span className="text-xs font-mono w-20 text-right">{fmtMoney(it.price)}</span>
                <span className="text-xs text-muted-foreground">=</span>
                <span className="text-sm font-bold w-24 text-right">{fmtMoney(it.subtotal)}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => removeItem(it.productId)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pago */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Método de pago</Label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="flex items-center gap-2 text-sm cursor-pointer h-9 leading-9">
            <input
              type="checkbox"
              checked={descontarStock}
              onChange={(e) => setDescontarStock(e.target.checked)}
              className="h-4 w-4"
            />
            Descontar stock
          </Label>
        </div>
      </div>

      {/* Totales */}
      <div className="rounded-md border p-3 bg-muted/30 space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-mono">{fmtMoney(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">IVA</span>
          <span className="font-mono">{fmtMoney(ivaTotal)}</span>
        </div>
        <div className="flex justify-between text-base font-bold pt-1 border-t">
          <span>TOTAL</span>
          <span className="font-mono">{fmtMoney(total)}</span>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button
          disabled={cart.length === 0 || ventaMutation.isPending}
          onClick={() => ventaMutation.mutate()}
          style={{ backgroundColor: '#0a3143' }}
        >
          {ventaMutation.isPending ? 'Procesando...' : `Cobrar ${fmtMoney(total)}`}
        </Button>
      </DialogFooter>
    </div>
  )
}

function calcIva(ivaType: string, subtotal: number) {
  if (ivaType === 'IVA16') return subtotal * 0.16
  return 0
}

function TicketView({ data }: { data: VentaMostradorResponse }) {
  const clinic = data.clinic
  return (
    <div className="ticket-print mx-auto">
      <div className="ticket-header">
        {clinic?.logoUrl && <img src={clinic.logoUrl} alt={clinic.name} />}
        <div style={{ fontWeight: 700, fontSize: 14 }}>{clinic?.name || 'CENPOD'}</div>
        {clinic?.address && <div>{clinic.address}</div>}
        {clinic?.phone && <div>Tel: {clinic.phone}</div>}
      </div>
      <div className="ticket-row">
        <span>Folio:</span>
        <span style={{ fontWeight: 700 }}>{data.ticketId}</span>
      </div>
      <div className="ticket-row">
        <span>Fecha:</span>
        <span>{format(new Date(data.date), 'dd/MM/yyyy HH:mm')}</span>
      </div>
      <div className="ticket-row">
        <span>Cajero:</span>
        <span>{data.cashier?.name}</span>
      </div>
      <div className="ticket-row">
        <span>Tipo:</span>
        <span>Venta de mostrador</span>
      </div>

      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th style={{ textAlign: 'center' }}>Cant.</th>
            <th style={{ textAlign: 'right' }}>Importe</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((it, i) => (
            <tr key={i}>
              <td>{it.name}</td>
              <td style={{ textAlign: 'center' }}>{it.qty}</td>
              <td style={{ textAlign: 'right' }}>${it.subtotal.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ticket-totals">
        <div className="ticket-row">
          <span>Subtotal:</span>
          <span>${data.subtotal.toFixed(2)}</span>
        </div>
        <div className="ticket-row">
          <span>IVA:</span>
          <span>${data.ivaTotal.toFixed(2)}</span>
        </div>
        <div className="ticket-row" style={{ fontWeight: 700, fontSize: 14, marginTop: 4 }}>
          <span>TOTAL:</span>
          <span>${data.total.toFixed(2)}</span>
        </div>
        <div className="ticket-row" style={{ marginTop: 4 }}>
          <span>Método de pago:</span>
          <span>{PAYMENT_METHOD_LABELS[data.paymentMethod] || data.paymentMethod}</span>
        </div>
      </div>

      <div className="ticket-footer">
        <div style={{ fontWeight: 700 }}>¡Gracias por su compra!</div>
        <div style={{ marginTop: 2 }}>CENPOD · Salud podológica</div>
      </div>
    </div>
  )
}
