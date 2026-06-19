'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Search, UserPlus, Loader2, ChevronLeft } from 'lucide-react'
import type { PatientSearchResult } from './types'

type Props = {
  /** Called when a patient is selected from the search results */
  onSelect: (p: PatientSearchResult) => void
  /** Initial value (e.g. when editing) */
  initial?: PatientSearchResult | null
}

/**
 * Patient searcher with debounced search + inline "create new" form.
 * Hits GET /api/pacientes?q=...
 */
export function PatientSearcher({ onSelect, initial }: Props) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [selected, setSelected] = useState<PatientSearchResult | null>(initial ?? null)
  const [creatingNew, setCreatingNew] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // New-patient inline form state
  const [npFirst, setNpFirst] = useState('')
  const [npLast, setNpLast] = useState('')
  const [npPhone, setNpPhone] = useState('')
  const [savingNew, setSavingNew] = useState(false)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebounced(query), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const { data, isFetching } = useQuery({
    queryKey: ['pacientes-search', debounced],
    queryFn: () => fetch(`/api/pacientes?q=${encodeURIComponent(debounced)}&limit=20&global=1`).then((r) => r.json()),
    enabled: debounced.length > 0 && !selected,
  })

  const results: PatientSearchResult[] = Array.isArray(data?.data) ? data.data : []

  function pick(p: PatientSearchResult) {
    setSelected(p)
    onSelect(p)
    setQuery('')
  }

  function clear() {
    setSelected(null)
    setCreatingNew(false)
    setNpFirst(''); setNpLast(''); setNpPhone('')
    onSelect(null as any)
  }

  async function saveNew() {
    if (!npFirst.trim() || !npLast.trim() || !npPhone.trim()) return
    setSavingNew(true)
    try {
      const res = await fetch('/api/pacientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: npFirst, lastName: npLast, phone: npPhone }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'Error al crear paciente')
      }
      const created = await res.json()
      pick(created)
      setCreatingNew(false)
    } catch (e: any) {
      alert(e.message || 'Error al crear paciente')
    } finally {
      setSavingNew(false)
    }
  }

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {selected.firstName.charAt(0)}{selected.lastName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{selected.firstName} {selected.lastName}</p>
            <p className="text-xs text-muted-foreground truncate">
              Exp. {selected.expNumber}{selected.phone ? ` · ${selected.phone}` : ''}
            </p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={clear}>
          Cambiar
        </Button>
      </div>
    )
  }

  if (creatingNew) {
    return (
      <div className="space-y-2 rounded-md border p-3 bg-muted/20">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Nuevo paciente</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setCreatingNew(false)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Volver
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Nombre*</Label>
            <Input value={npFirst} onChange={(e) => setNpFirst(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Apellido*</Label>
            <Input value={npLast} onChange={(e) => setNpLast(e.target.value)} className="h-9" />
          </div>
        </div>
        <div>
          <Label className="text-xs">Teléfono*</Label>
          <Input value={npPhone} onChange={(e) => setNpPhone(e.target.value)} className="h-9" placeholder="662..." />
        </div>
        <Button
          type="button"
          size="sm"
          className="w-full"
          style={{ backgroundColor: '#0a3143' }}
          onClick={saveNew}
          disabled={savingNew || !npFirst.trim() || !npLast.trim() || !npPhone.trim()}
        >
          {savingNew ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear y seleccionar'}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs">Paciente*</Label>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, teléfono o expediente..."
          className="h-9 pl-8"
          autoFocus
        />
        {isFetching && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
      {query && results.length === 0 && !isFetching && (
        <div className="rounded-md border border-dashed p-3 text-center">
          <p className="text-sm text-muted-foreground">Sin resultados</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => setCreatingNew(true)}
          >
            <UserPlus className="h-4 w-4 mr-1" /> Crear nuevo paciente
          </Button>
        </div>
      )}
      {results.length > 0 && (
        <ScrollArea className="h-44 rounded-md border">
          <div className="divide-y">
            {results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => pick(p)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent text-left"
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                    {p.firstName.charAt(0)}{p.lastName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{p.firstName} {p.lastName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    Exp. {p.expNumber}{p.phone ? ` · ${p.phone}` : ''}
                  </p>
                </div>
                {p.riskLevel === 'ALTO' && <Badge variant="outline" className="text-red-700 border-red-300 text-[10px]">Riesgo</Badge>}
              </button>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
