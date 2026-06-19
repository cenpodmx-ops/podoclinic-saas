'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, Plus, X, Package2 } from 'lucide-react'
import type { ProductItem, ConsultaItem } from '../_lib/types'

interface Props {
  items: ConsultaItem[]
  onChange: (items: ConsultaItem[]) => void
}

export function ProductAdder({ items, onChange }: Props) {
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250)
    return () => clearTimeout(t)
  }, [q])

  const { data, isFetching } = useQuery({
    queryKey: ['inventario-search', debounced],
    queryFn: () => fetch(`/api/inventario?q=${encodeURIComponent(debounced)}`).then((r) => r.json()),
    enabled: debounced.length > 0,
    staleTime: 30_000,
  })

  const results: ProductItem[] = data?.rows || []

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function addProduct(p: ProductItem) {
    const existing = items.find((i) => i.productId === p.id)
    if (existing) {
      // ya existe → incrementar qty
      onChange(items.map((i) => (i.productId === p.id ? { ...i, qty: i.qty + 1 } : i)))
    } else {
      onChange([
        ...items,
        {
          name: p.name,
          qty: 1,
          price: p.salePrice,
          type: p.category === 'MEDICAMENTO' ? 'MEDICAMENTO' : 'PRODUCTO',
          productId: p.id,
          stock: p.stock,
        },
      ])
    }
    setQ('')
    setOpen(false)
  }

  function removeItem(idx: number) {
    onChange(items.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, patch: Partial<ConsultaItem>) {
    onChange(items.map((i, j) => (j === idx ? { ...i, ...patch } : i)))
  }

  return (
    <div className="space-y-3">
      {/* Buscador */}
      <div className="relative" ref={boxRef}>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            placeholder="Buscar producto o medicamento por nombre..."
            className="pl-8"
          />
        </div>

        {open && q.length > 0 && (
          <div className="absolute z-30 mt-1 w-full bg-background border rounded-md shadow-lg max-h-72 overflow-y-auto">
            {isFetching && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Buscando…</div>
            )}
            {!isFetching && results.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Sin resultados</div>
            )}
            {!isFetching &&
              results.map((p) => {
                const outOfStock = p.stock <= 0
                const low = !outOfStock && p.stock <= p.minStock
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addProduct(p)}
                    disabled={outOfStock}
                    className="w-full text-left px-3 py-2 hover:bg-accent flex items-center justify-between gap-2 disabled:opacity-50 disabled:cursor-not-allowed border-b last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Package2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium truncate">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className="text-[10px] h-4 px-1">
                          {p.category}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          ${p.salePrice.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={`text-xs font-mono ${
                          outOfStock ? 'text-red-600' : low ? 'text-orange-600' : 'text-muted-foreground'
                        }`}
                      >
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

      {/* Lista de items agregados */}
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground border border-dashed rounded-md p-4 text-center">
          No hay productos o medicamentos agregados.
        </div>
      ) : (
        <div className="rounded-md border divide-y">
          {items.map((it, idx) => {
            const subtotal = it.qty * it.price
            const lowStock = typeof it.stock === 'number' && it.qty > it.stock!
            return (
              <div key={idx} className="p-2.5 flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium truncate">{it.name}</span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1">
                      {it.type === 'MEDICAMENTO' ? 'Med' : 'Prod'}
                    </Badge>
                    {typeof it.stock === 'number' && (
                      <span
                        className={`text-[10px] ${
                          lowStock ? 'text-red-600 font-semibold' : 'text-muted-foreground'
                        }`}
                      >
                        Stock: {it.stock}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Cant.</span>
                  <Input
                    type="number"
                    min={1}
                    value={it.qty}
                    onChange={(e) => updateItem(idx, { qty: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="h-7 w-14 text-center"
                  />
                  <span className="text-xs text-muted-foreground">×</span>
                  <span className="text-xs font-mono w-16 text-right">${it.price.toFixed(2)}</span>
                  <span className="text-xs text-muted-foreground">=</span>
                  <span className="text-sm font-bold w-20 text-right">${subtotal.toFixed(2)}</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => removeItem(idx)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
