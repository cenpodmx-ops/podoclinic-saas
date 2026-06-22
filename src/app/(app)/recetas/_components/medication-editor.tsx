'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Pill } from 'lucide-react'
import { VIA_OPTIONS, type MedicationRow, type ProductLite } from '../_lib/types'

let _keyCounter = 0
function newKey() {
  _keyCounter += 1
  return `m_${Date.now()}_${_keyCounter}`
}

export function emptyMedication(): MedicationRow {
  return { name: '', dose: '', via: 'Oral', duration: '', indication: '', _key: newKey() }
}

export function MedicationEditor({
  rows,
  onChange,
  error,
}: {
  rows: MedicationRow[]
  onChange: (rows: MedicationRow[]) => void
  error?: string
}) {
  function update(key: string, patch: Partial<MedicationRow>) {
    onChange(rows.map((r) => (r._key === key ? { ...r, ...patch } : r)))
  }
  function remove(key: string) {
    onChange(rows.filter((r) => r._key !== key))
  }
  function add() {
    onChange([...rows, emptyMedication()])
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Medicamentos</label>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-3.5 w-3.5" /> Agregar medicamento
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}

      {rows.length === 0 && (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          <Pill className="h-5 w-5 mx-auto mb-2 opacity-50" />
          No hay medicamentos. Agrega al menos uno para guardar la receta.
        </div>
      )}

      <div className="space-y-2">
        {rows.map((r) => (
          <MedicationRowCard
            key={r._key}
            row={r}
            onUpdate={(patch) => update(r._key, patch)}
            onRemove={() => remove(r._key)}
          />
        ))}
      </div>
    </div>
  )
}

function MedicationRowCard({
  row,
  onUpdate,
  onRemove,
}: {
  row: MedicationRow
  onUpdate: (patch: Partial<MedicationRow>) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-md border p-3 space-y-2 bg-card">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
          Medicamento
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-7 px-2 text-muted-foreground hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <ProductNameInput
        value={row.name}
        onChange={(name, productId, vademecumId) => onUpdate({ name, productId, vademecumId })}
        onSelectVademecum={(v) => onUpdate({
          name: v.name,
          dose: v.dose || row.dose,
          via: v.via || row.via,
          duration: v.defaultDuration || row.duration,
          indication: v.indication || row.indication,
          vademecumId: v.id,
          productId: undefined,
        })}
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Dosis</label>
          <Input
            value={row.dose}
            onChange={(e) => onUpdate({ dose: e.target.value })}
            placeholder="1 tableta cada 8 horas"
            className="h-9"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Vía</label>
          <Select value={row.via} onValueChange={(v) => onUpdate({ via: v })}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Vía" />
            </SelectTrigger>
            <SelectContent>
              {VIA_OPTIONS.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Duración</label>
          <Input
            value={row.duration}
            onChange={(e) => onUpdate({ duration: e.target.value })}
            placeholder="7 días"
            className="h-9"
          />
        </div>
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Indicación</label>
        <Input
          value={row.indication || ''}
          onChange={(e) => onUpdate({ indication: e.target.value })}
          placeholder="Indicación general (ej. Tomar con alimentos)"
          className="h-9"
        />
      </div>
    </div>
  )
}

type VademecumItem = {
  id: string
  name: string
  genericName?: string | null
  category?: string | null
  dose?: string | null
  via?: string | null
  defaultDuration?: string | null
  indication?: string | null
}

function ProductNameInput({
  value,
  onChange,
  onSelectVademecum,
}: {
  value: string
  onChange: (name: string, productId?: string, vademecumId?: string) => void
  onSelectVademecum: (v: VademecumItem) => void
}) {
  const [focused, setFocused] = useState(false)
  const [localValue, setLocalValue] = useState(value)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Búsqueda paralela en inventario y vademécum
  const { data: invData, isLoading: invLoading } = useQuery<{ rows: ProductLite[] }>({
    queryKey: ['inv-search', localValue.trim()],
    queryFn: () => fetch(`/api/inventario?q=${encodeURIComponent(localValue.trim())}`).then((r) => r.json()),
    enabled: localValue.trim().length > 0 && focused,
  })
  const { data: vadData, isLoading: vadLoading } = useQuery<{ data: VademecumItem[] }>({
    queryKey: ['vademecum-search', localValue.trim()],
    queryFn: () => fetch(`/api/vademecum?q=${encodeURIComponent(localValue.trim())}`).then((r) => r.json()),
    enabled: localValue.trim().length > 0 && focused,
  })

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const invRows = invData?.rows || []
  const vadRows = vadData?.data || []
  const hasAny = invRows.length > 0 || vadRows.length > 0
  const isLoading = invLoading || vadLoading
  const showSuggestions = focused && localValue.trim().length > 0 && (isLoading || hasAny)

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={localValue}
        onChange={(e) => {
          setLocalValue(e.target.value)
          onChange(e.target.value, undefined, undefined)
          setFocused(true)
        }}
        onFocus={() => setFocused(true)}
        placeholder="Nombre del medicamento — busca en vademécum e inventario"
        className="h-9"
      />
      {showSuggestions && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-md border bg-background shadow-lg">
          {isLoading ? (
            <div className="p-2 text-xs text-muted-foreground">Buscando…</div>
          ) : !hasAny ? (
            <div className="p-2 text-xs text-muted-foreground">
              Sin coincidencias. Puedes agregarlo manualmente o crearlo en Inventario → Vademécum.
            </div>
          ) : (
            <ul className="divide-y">
              {vadRows.length > 0 && (
                <li className="px-3 py-1 bg-emerald-50 text-[10px] uppercase tracking-wide text-emerald-800 font-semibold">
                  Vademécum (receta)
                </li>
              )}
              {vadRows.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setLocalValue(v.name)
                      onSelectVademecum(v)
                      setFocused(false)
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-muted/50 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{v.name}</span>
                      {v.category && (
                        <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300">
                          {v.category}
                        </Badge>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {v.genericName && <span>{v.genericName}</span>}
                      {v.genericName && (v.dose || v.via) && ' · '}
                      {v.dose && <span>{v.dose}</span>}
                      {v.dose && v.via && ' · '}
                      {v.via && <span>{v.via}</span>}
                    </div>
                    {v.indication && (
                      <div className="text-[10px] text-emerald-700 mt-0.5 italic">
                        ℹ {v.indication}
                      </div>
                    )}
                  </button>
                </li>
              ))}
              {invRows.length > 0 && (
                <li className="px-3 py-1 bg-blue-50 text-[10px] uppercase tracking-wide text-blue-800 font-semibold">
                  Inventario (se cobra en caja)
                </li>
              )}
              {invRows.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setLocalValue(p.name)
                      onChange(p.name, p.id, undefined)
                      setFocused(false)
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-muted/50 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{p.name}</span>
                      <Badge
                        variant="outline"
                        className={
                          p.stock <= 0
                            ? 'text-red-600 border-red-300 text-[10px]'
                            : p.stock <= 5
                              ? 'text-amber-700 border-amber-300 text-[10px]'
                              : 'text-emerald-700 border-emerald-300 text-[10px]'
                        }
                      >
                        Stock: {p.stock}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {p.category} · {p.salePrice > 0 ? `$${p.salePrice.toFixed(2)}` : 'Sin precio'}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
