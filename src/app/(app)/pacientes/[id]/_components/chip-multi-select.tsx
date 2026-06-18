'use client'

import { Badge } from '@/components/ui/badge'
import { Check, Plus } from 'lucide-react'

/**
 * Componente reutilizable para seleccionar múltiples opciones tipo chips.
 * Cada chip es un toggle: si está en el array, se remueve; si no, se agrega.
 */
export function ChipMultiSelect({
  options,
  selected,
  onChange,
  color = '#0a3143',
  size = 'md',
}: {
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
  color?: string
  size?: 'sm' | 'md'
}) {
  const toggle = (opt: string) => {
    if (selected.includes(opt)) onChange(selected.filter((s) => s !== opt))
    else onChange([...selected, opt])
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = selected.includes(opt)
        return (
          <button
            type="button"
            key={opt}
            onClick={() => toggle(opt)}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 ${size === 'sm' ? 'py-0.5 text-[11px]' : 'py-1 text-xs'} transition-colors ${
              active
                ? 'text-white border-transparent shadow-sm'
                : 'bg-background text-muted-foreground border-muted-foreground/30 hover:bg-muted/60'
            }`}
            style={active ? { backgroundColor: color, borderColor: color } : undefined}
          >
            {active ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            {opt}
          </button>
        )
      })}
    </div>
  )
}

/** Chip simple para mostrar items seleccionados en modo lectura. */
export function ChipList({
  items,
  emptyLabel = '—',
  color = '#0a3143',
}: {
  items?: string[] | null
  emptyLabel?: string
  color?: string
}) {
  if (!items || items.length === 0) {
    return <span className="text-sm text-muted-foreground">{emptyLabel}</span>
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => (
        <Badge key={it} variant="outline" style={{ color, borderColor: `${color}40` }}>
          {it}
        </Badge>
      ))}
    </div>
  )
}
