'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Pencil, Trash2, BookOpen, Search, Pill, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import { ImportVademecumDialog } from './import-vademecum-dialog'

// ============================================================
// VademecumTab
// Sub-pestaña dentro de Inventario para gestionar el catálogo
// de medicamentos del vademécum (recetario).
// Diferente al inventario: estos medicamentos NO se cobran en
// caja, son solo para autocompletar recetas.
// ============================================================

const SENTINEL_ALL = '__all'

const CATEGORIES = [
  'Analgésico',
  'Antibiótico',
  'Antifúngico',
  'Antiinflamatorio',
  'Antialérgico',
  'Corticosteroide',
  'Vitamina/Suplemento',
  'Antiparasitario',
  'Antiviral',
  'Cardiovascular',
  'Dermatológico',
  'Gastrointestinal',
  'Otros',
]

const VIA_OPTIONS = ['Oral', 'Tópica', 'Intravenosa', 'Intramuscular', 'Sublingual', 'Inhalatoria', 'Ótica', 'Oftálmica']

type VademecumItem = {
  id: string
  name: string
  genericName?: string | null
  category?: string | null
  dose?: string | null
  via?: string | null
  defaultDuration?: string | null
  indication?: string | null
  notes?: string | null
  active: boolean
  createdAt: string
}

const EMPTY_FORM = {
  name: '',
  genericName: '',
  category: '',
  dose: '',
  via: '',
  defaultDuration: '',
  indication: '',
  notes: '',
  active: true,
}

export function VademecumTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>(SENTINEL_ALL)
  const [includeInactive, setIncludeInactive] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<VademecumItem | null>(null)
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<VademecumItem | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const queryParams = new URLSearchParams()
  if (debouncedSearch) queryParams.set('q', debouncedSearch)
  if (categoryFilter !== SENTINEL_ALL) queryParams.set('category', categoryFilter)
  if (includeInactive) queryParams.set('includeInactive', '1')

  const { data, isLoading } = useQuery<{ data: VademecumItem[]; total: number }>({
    queryKey: ['vademecum', debouncedSearch, categoryFilter, includeInactive],
    queryFn: () => fetch(`/api/vademecum?${queryParams.toString()}`).then((r) => r.json()),
  })

  const items = data?.data || []

  const saveMutation = useMutation({
    mutationFn: async (body: any) => {
      const url = editing ? `/api/vademecum/${editing.id}` : '/api/vademecum'
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'Error al guardar')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success(editing ? 'Medicamento actualizado' : 'Medicamento agregado al vademécum')
      qc.invalidateQueries({ queryKey: ['vademecum'] })
      setDialogOpen(false)
      setEditing(null)
      setForm(EMPTY_FORM)
    },
    onError: (e: any) => toast.error(e.message || 'Error al guardar'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/vademecum/${id}`, { method: 'DELETE' }).then((r) => r.json()),
    onSuccess: () => {
      toast.success('Medicamento desactivado')
      qc.invalidateQueries({ queryKey: ['vademecum'] })
      setDeleteTarget(null)
    },
  })

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(item: VademecumItem) {
    setEditing(item)
    setForm({
      name: item.name,
      genericName: item.genericName || '',
      category: item.category || '',
      dose: item.dose || '',
      via: item.via || '',
      defaultDuration: item.defaultDuration || '',
      indication: item.indication || '',
      notes: item.notes || '',
      active: item.active,
    })
    setDialogOpen(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('El nombre es obligatorio')
      return
    }
    saveMutation.mutate(form)
  }

  return (
    <div className="space-y-4">
      {/* Header con descripción */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-md bg-emerald-100 flex items-center justify-center shrink-0">
            <BookOpen className="h-5 w-5 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Vademécum (Recetario)</h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Catálogo de medicamentos para recetas. Al escribir el nombre en una receta, se autocompletan
              la dosis, vía, duración e indicación. Estos medicamentos <strong>NO se cobran en caja</strong> —
              son solo para agilizar la captura de recetas.
            </p>
          </div>
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setImportOpen(true)} size="sm" variant="outline">
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Importar Excel
            </Button>
            <Button onClick={openNew} size="sm" style={{ backgroundColor: '#0a3143' }}>
              <Plus className="h-4 w-4 mr-1" /> Nuevo medicamento
            </Button>
          </div>
        )}
      </div>

      {/* Filtros */}
      <Card className="shadow-sm">
        <CardContent className="p-3 flex flex-wrap items-end gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o nombre genérico..."
              className="pl-9"
            />
          </div>
          <div className="w-48">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SENTINEL_ALL}>Todas las categorías</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={includeInactive} onCheckedChange={setIncludeInactive} />
            Inactivos
          </label>
          <div className="text-sm text-muted-foreground ml-auto">
            {isLoading ? 'Cargando…' : `${items.length} medicamento${items.length === 1 ? '' : 's'}`}
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center">
              <Pill className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm text-muted-foreground mb-1">No hay medicamentos en el vademécum.</p>
              <p className="text-xs text-muted-foreground">
                Agrega medicamentos aquí para que aparezcan como sugerencias al hacer recetas.
              </p>
              {canEdit && (
                <Button onClick={openNew} size="sm" className="mt-4" style={{ backgroundColor: '#0a3143' }}>
                  <Plus className="h-4 w-4 mr-1" /> Agregar primer medicamento
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-auto max-h-[600px]">
              <Table className="min-w-[900px]" wrapperClassName="min-w-[900px]">
                <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
                  <TableRow>
                    <TableHead className="w-[280px] whitespace-nowrap">Nombre</TableHead>
                    <TableHead className="whitespace-nowrap">Categoría</TableHead>
                    <TableHead className="w-32 whitespace-nowrap">Dosis</TableHead>
                    <TableHead className="w-28 whitespace-nowrap">Vía</TableHead>
                    <TableHead className="w-32 whitespace-nowrap">Duración</TableHead>
                    <TableHead className="min-w-[280px]">Indicación</TableHead>
                    <TableHead className="w-24 whitespace-nowrap">Estado</TableHead>
                    {canEdit && <TableHead className="w-24 text-right whitespace-nowrap">Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} className={!item.active ? 'opacity-50' : ''}>
                      <TableCell>
                        <div className="font-medium">{item.name}</div>
                        {item.genericName && (
                          <div className="text-xs text-muted-foreground italic">{item.genericName}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.category && (
                          <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300">
                            {item.category}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{item.dose || '—'}</TableCell>
                      <TableCell className="text-sm">{item.via || '—'}</TableCell>
                      <TableCell className="text-sm">{item.defaultDuration || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs">
                        {item.indication ? (
                          <span className="line-clamp-2">{item.indication}</span>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.active ? 'default' : 'secondary'} className="text-[10px]">
                          {item.active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openEdit(item)}
                              className="h-8 w-8"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setDeleteTarget(item)}
                              className="h-8 w-8 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de creación/edición */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar medicamento' : 'Nuevo medicamento del vademécum'}</DialogTitle>
            <DialogDescription>
              Los medicamentos del vademécum se usan para autocompletar recetas. No aparecen en caja ni en inventario.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nombre comercial *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej. Amoxicilina 500mg"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Nombre genérico</Label>
                <Input
                  value={form.genericName}
                  onChange={(e) => setForm({ ...form, genericName: e.target.value })}
                  placeholder="Ej. Amoxicilina"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Categoría</Label>
                <Select
                  value={form.category || SENTINEL_ALL}
                  onValueChange={(v) => setForm({ ...form, category: v === SENTINEL_ALL ? '' : v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SENTINEL_ALL}>— Sin categoría —</SelectItem>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Dosis sugerida</Label>
                <Input
                  value={form.dose}
                  onChange={(e) => setForm({ ...form, dose: e.target.value })}
                  placeholder="Ej. 500 mg"
                />
              </div>
              <div className="space-y-1">
                <Label>Vía</Label>
                <Select
                  value={form.via || SENTINEL_ALL}
                  onValueChange={(v) => setForm({ ...form, via: v === SENTINEL_ALL ? '' : v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SENTINEL_ALL}>— Sin vía —</SelectItem>
                    {VIA_OPTIONS.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Duración sugerida</Label>
              <Input
                value={form.defaultDuration}
                onChange={(e) => setForm({ ...form, defaultDuration: e.target.value })}
                placeholder="Ej. 7 días, 2 semanas, 1 mes..."
              />
            </div>

            <div className="space-y-1">
              <Label>Indicación general (se autocompleta en la receta)</Label>
              <Textarea
                rows={3}
                value={form.indication}
                onChange={(e) => setForm({ ...form, indication: e.target.value })}
                placeholder="Ej. Tomar 1 tableta cada 8 horas con alimentos, completar todo el tratamiento."
              />
              <p className="text-xs text-muted-foreground">
                Esta indicación se pegará automáticamente cuando seleccionas este medicamento en una receta.
              </p>
            </div>

            <div className="space-y-1">
              <Label>Notas internas</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Contraindicaciones, advertencias, interacciones..."
              />
            </div>

            {editing && (
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.active}
                  onCheckedChange={(v) => setForm({ ...form, active: v })}
                />
                Activo (aparece en las sugerencias de recetas)
              </label>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} style={{ backgroundColor: '#0a3143' }}>
                {saveMutation.isPending ? 'Guardando...' : editing ? 'Guardar cambios' : 'Agregar al vademécum'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Importar Excel */}
      <ImportVademecumDialog open={importOpen} onOpenChange={setImportOpen} />

      {/* Confirmar desactivar */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              El medicamento dejará de aparecer en las sugerencias de recetas, pero las recetas ya creadas
              con este medicamento no se verán afectadas. Puedes reactivarlo después.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
