'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileText, Search, Plus, Printer, Eye, Pill, CalendarRange, Eraser } from 'lucide-react'
import { toast } from 'sonner'
import { fmtDate } from '@/lib/format'
import type { PrescriptionListItem } from './_lib/types'
import { PrescriptionFormDialog, SuccessDialog, openPrintWindow } from './_components/prescription-form-dialog'
import { PrescriptionViewDialog } from './_components/prescription-view-dialog'

const SENTINEL_ALL = '__all'

type ListResponse = {
  data: PrescriptionListItem[]
  total: number
  page: number
  limit: number
}

export default function RecetasPage() {
  const qc = useQueryClient()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role as string | undefined
  const canDelete = role === 'SUPER' || role === 'OWNER'

  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  const [formOpen, setFormOpen] = useState(false)
  const [viewId, setViewId] = useState<string | null>(null)
  const [viewOpen, setViewOpen] = useState(false)
  const [createdRx, setCreatedRx] = useState<PrescriptionListItem | null>(null)
  const [successOpen, setSuccessOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [search])

  const queryKey = useMemo(
    () => ['recetas', debounced, from, to, page, limit],
    [debounced, from, to, page, limit],
  )

  const { data, isLoading, isError, error } = useQuery<ListResponse>({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      })
      if (debounced) params.set('q', debounced)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      return fetch(`/api/recetas?${params.toString()}`).then((r) => {
        if (!r.ok) throw new Error('Error al cargar recetas')
        return r.json()
      })
    },
  })

  function clearFilters() {
    setSearch('')
    setFrom('')
    setTo('')
    setPage(1)
  }

  function handleView(id: string) {
    setViewId(id)
    setViewOpen(true)
  }

  function handlePrint(id: string) {
    openPrintWindow(id)
  }

  function refresh() {
    qc.invalidateQueries({ queryKey: ['recetas'] })
  }

  const total = data?.total || 0
  const pages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" /> Recetas
          </h1>
          <p className="text-sm text-muted-foreground">
            Captura, consulta e imprime recetas médicas de tus pacientes.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" /> Nueva receta
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1 mb-1">
                <Search className="h-3 w-3" /> Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por paciente, expediente o diagnóstico…"
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1 mb-1">
                <CalendarRange className="h-3 w-3" /> Desde
              </label>
              <Input
                type="date"
                value={from}
                onChange={(e) => { setFrom(e.target.value); setPage(1) }}
                className="h-9"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1 mb-1">
                <CalendarRange className="h-3 w-3" /> Hasta
              </label>
              <Input
                type="date"
                value={to}
                onChange={(e) => { setTo(e.target.value); setPage(1) }}
                className="h-9"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              {isLoading ? 'Cargando…' : `${total} receta${total === 1 ? '' : 's'} encontrada${total === 1 ? '' : 's'}`}
            </div>
            {(search || from || to) && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8">
                <Eraser className="h-3.5 w-3.5" /> Limpiar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table (desktop) / Cards (mobile) */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : isError ? (
            <div className="p-8 text-center text-sm text-red-600">
              Error al cargar las recetas: {(error as Error).message}
            </div>
          ) : !data || data.data.length === 0 ? (
            <EmptyState onCreate={() => setFormOpen(true)} />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">Fecha</TableHead>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Podólogo</TableHead>
                      <TableHead>Diagnóstico</TableHead>
                      <TableHead className="w-28 text-center">Meds</TableHead>
                      <TableHead className="w-44 text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.data.map((rx) => (
                      <TableRow key={rx.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => handleView(rx.id)}>
                        <TableCell className="font-mono text-xs">{fmtDate(rx.date)}</TableCell>
                        <TableCell>
                          <div className="font-medium">{rx.patient?.name || '—'}</div>
                          <div className="text-xs text-muted-foreground font-mono">{rx.patient?.expNumber}</div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{rx.podologist?.name || '—'}</span>
                          {rx.podologist?.cedula && (
                            <span className="block text-xs text-muted-foreground">Céd. {rx.podologist.cedula}</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <span className="text-sm line-clamp-2">
                            {rx.diagnosis || <span className="text-muted-foreground italic">Sin diagnóstico</span>}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs">
                            <Pill className="h-3 w-3 mr-1" />
                            {rx.medications.length}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleView(rx.id)} title="Ver">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handlePrint(rx.id)} title="Imprimir / PDF">
                              <Printer className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y">
                {data.data.map((rx) => (
                  <button
                    key={rx.id}
                    onClick={() => handleView(rx.id)}
                    className="w-full text-left p-3 hover:bg-muted/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-sm">{rx.patient?.name || '—'}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {rx.patient?.expNumber} · {fmtDate(rx.date)}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        <Pill className="h-3 w-3 mr-1" /> {rx.medications.length}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {rx.podologist?.name || 'Sin podólogo'}
                    </div>
                    {rx.diagnosis && (
                      <div className="text-xs mt-1 line-clamp-2">{rx.diagnosis}</div>
                    )}
                    <div className="flex gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="outline" className="h-7" onClick={() => handlePrint(rx.id)}>
                        <Printer className="h-3 w-3" /> Imprimir
                      </Button>
                    </div>
                  </button>
                ))}
              </div>

              {/* Pagination */}
              {pages > 1 && (
                <div className="flex items-center justify-between gap-2 p-3 border-t">
                  <div className="text-xs text-muted-foreground">
                    Página {page} de {pages}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= pages}
                      onClick={() => setPage((p) => Math.min(pages, p + 1))}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <PrescriptionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onCreated={(rx) => {
          setCreatedRx(rx)
          setSuccessOpen(true)
        }}
      />
      <SuccessDialog rx={createdRx} open={successOpen} onOpenChange={setSuccessOpen} />
      <PrescriptionViewDialog
        rxId={viewId}
        open={viewOpen}
        onOpenChange={setViewOpen}
        canDelete={canDelete}
        onDeleted={refresh}
      />
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="p-10 text-center">
      <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
      <h3 className="font-medium text-muted-foreground">No hay recetas registradas</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-4">
        Captura la primera receta del módulo para comenzar.
      </p>
      <Button onClick={onCreate}>
        <Plus className="h-4 w-4" /> Nueva receta
      </Button>
    </div>
  )
}
