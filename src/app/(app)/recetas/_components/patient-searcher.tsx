'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, UserCircle, AlertTriangle } from 'lucide-react'
import type { PatientLite } from '../_lib/types'

type PacientesResponse = {
  data: PatientLite[]
  total: number
}

export function PatientSearcher({
  onSelect,
  selected,
  error,
}: {
  onSelect: (p: PatientLite | null) => void
  selected: PatientLite | null
  error?: string
}) {
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  const { data, isLoading } = useQuery<PacientesResponse>({
    queryKey: ['pacientes-search', debounced],
    queryFn: () =>
      fetch(`/api/pacientes?q=${encodeURIComponent(debounced)}&limit=15&global=1`).then((r) => r.json()),
    enabled: debounced.length > 0,
  })

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  if (selected) {
    return (
      <div className="rounded-md border p-3 bg-muted/30 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-sm">
                {selected.firstName} {selected.lastName}
              </p>
              <p className="text-xs text-muted-foreground font-mono">{selected.expNumber}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Cambiar
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {selected.isDiabetic && (
            <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700 text-[10px]">
              <AlertTriangle className="h-3 w-3 mr-1" /> Diabético
            </Badge>
          )}
          {selected.allergies && (
            <Badge variant="outline" className="border-orange-300 bg-orange-50 text-orange-800 text-[10px]">
              Alergias: {selected.allergies}
            </Badge>
          )}
          {selected.riskLevel && (
            <Badge
              variant="outline"
              className={
                selected.riskLevel === 'ALTO'
                  ? 'border-red-300 bg-red-50 text-red-700 text-[10px]'
                  : selected.riskLevel === 'MEDIO'
                    ? 'border-amber-300 bg-amber-50 text-amber-800 text-[10px]'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-800 text-[10px]'
              }
            >
              Riesgo {selected.riskLevel}
            </Badge>
          )}
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar paciente por nombre, teléfono o expediente…"
          className="pl-9"
          aria-invalid={!!error}
        />
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      {open && debounced.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto rounded-md border bg-background shadow-lg">
          {isLoading ? (
            <div className="p-3 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : !data || data.data.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              No se encontraron pacientes.
            </div>
          ) : (
            <ul className="divide-y">
              {data.data.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(p)
                      setOpen(false)
                      setQ('')
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {p.firstName} {p.lastName}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">{p.expNumber}</span>
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-2 mt-0.5">
                      {p.phone && <span>{p.phone}</span>}
                      {p.isDiabetic && <span className="text-red-600">· Diabético</span>}
                      {p.allergies && <span className="text-orange-700">· Alergias</span>}
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
