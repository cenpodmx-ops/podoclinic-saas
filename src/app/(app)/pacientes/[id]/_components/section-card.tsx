'use client'

import { useState, type ReactNode } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { ChevronRight } from 'lucide-react'

/**
 * Sección colapsable reutilizable para el formulario grande de historia clínica.
 * Renderiza un header con título, ícono, número de sección opcional y badge,
 * y contenido colapsable.
 */
export function SectionCard({
  number,
  title,
  icon: Icon,
  badge,
  defaultOpen = false,
  children,
}: {
  number?: string
  title: string
  icon?: any
  badge?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 p-4 hover:bg-muted/40 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {number && (
            <span
              className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-bold"
              style={{ backgroundColor: '#0a3143' }}
            >
              {number}
            </span>
          )}
          {Icon && <Icon className="h-4 w-4 shrink-0" style={{ color: '#0a3143' }} />}
          <span className="font-semibold text-sm">{title}</span>
          {badge && (
            <Badge variant="outline" className="text-[10px]">
              {badge}
            </Badge>
          )}
        </div>
        <ChevronRight
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>
      {open && <div className="px-4 pb-4 pt-1 border-t space-y-3">{children}</div>}
    </div>
  )
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger }
