'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  Search,
  ShoppingCart,
  FileSpreadsheet,
  AlertTriangle,
  History,
  PackageX,
  BookOpen,
} from 'lucide-react'
import { toast } from 'sonner'
import { fmtMoney } from '@/lib/format'
import { ProductFormDialog } from './_components/product-form-dialog'
import { MovimientosDialog } from './_components/movimientos-dialog'
import { ImportDialog } from './_components/import-dialog'
import { PosDialog } from './_components/pos-dialog'
import { VademecumTab } from './_components/vademecum-tab'
import {
  CATEGORIES,
  CATEGORY_LABELS,
  IVA_LABELS,
  type Product,
} from './_components/types'

const SENTINEL_ALL = '__all__'

export default function InventarioPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role as string | undefined
  const canEdit = role === 'SUPER' || role === 'OWNER'

  const qc = useQueryClient()

  // ── Filtros / paginación
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [category, setCategory] = useState<string>(SENTINEL_ALL)
  const [stockBajo, setStockBajo] = useState(false)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [tab, setTab] = useState<'productos' | 'vademecum'>('productos')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  // Cambiar un filtro → resetear a página 1 (sin useEffect, inline)
  function applyFilter<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v)
      setPage(1)
    }
  }

  // ── Lista paginada
  const queryParams = useMemo(() => {
    const p = new URLSearchParams()
    p.set('page', String(page))
    p.set('limit', String(limit))
    if (category !== SENTINEL_ALL) p.set('category', category)
    if (stockBajo) p.set('stockBajo', '1')
    if (includeInactive) p.set('includeInactive', '1')
    if (debouncedSearch) p.set('q', debouncedSearch) // también soporta búsqueda en el listado
    return p.toString()
  }, [page, limit, category, stockBajo, includeInactive, debouncedSearch])

  const { data, isPending: isLoading, isFetching } = useQuery({
    queryKey: ['inventario-list', queryParams],
    queryFn: () => fetch(`/api/inventario?${queryParams}`).then((r) => r.json()),
  })

  // ── Stock bajo (separate query para el banner)
  const { data: bajoData } = useQuery({
    queryKey: ['inventario-bajo'],
    queryFn: () => fetch(`/api/inventario?stockBajo=1&limit=100`).then((r) => r.json()),
    staleTime: 30_000,
  })
  const bajoProducts: Product[] = bajoData?.data || []

  // ── Dialogs
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [formSession, setFormSession] = useState(0)
  const [movimientosOpen, setMovimientosOpen] = useState(false)
  const [movProduct, setMovProduct] = useState<Product | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [posOpen, setPosOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const products: Product[] = data?.data || []
  const total = data?.total || 0
  const totalPages = Math.max(1, Math.ceil(total / limit))

  // ── Mutations
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = editing
        ? await fetch(`/api/inventario/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/inventario', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Error al guardar')
      return j
    },
    onSuccess: () => {
      toast.success(editing ? 'Producto actualizado' : 'Producto creado')
      qc.invalidateQueries({ queryKey: ['inventario-list'] })
      qc.invalidateQueries({ queryKey: ['inventario-bajo'] })
      setFormOpen(false)
      setEditing(null)
    },
    onError: (e: any) => toast.error(e.message || 'Error'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/inventario/${id}`, { method: 'DELETE' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Error al desactivar')
      return j
    },
    onSuccess: () => {
      toast.success('Producto desactivado')
      qc.invalidateQueries({ queryKey: ['inventario-list'] })
      qc.invalidateQueries({ queryKey: ['inventario-bajo'] })
      setDeleteId(null)
    },
    onError: (e: any) => toast.error(e.message || 'Error'),
  })

  function onNew() {
    setEditing(null)
    setFormSession((s) => s + 1)
    setFormOpen(true)
  }

  function onEdit(p: Product) {
    setEditing(p)
    setFormSession((s) => s + 1)
    setFormOpen(true)
  }

  function onMovimientos(p: Product) {
    setMovProduct(p)
    setMovimientosOpen(true)
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1500px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6" /> Inventario
          </h1>
          <p className="text-sm text-muted-foreground">
            Catálogo de productos, control de stock y venta de mostrador
          </p>
        </div>
        {tab === 'productos' && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => setPosOpen(true)}
              size="sm"
              variant="outline"
              style={{ bordercolor: 'var(--primary)', color: 'var(--primary)' }}
            >
              <ShoppingCart className="h-4 w-4 mr-1" /> Venta mostrador
            </Button>
            {canEdit && (
              <>
                <Button onClick={() => setImportOpen(true)} size="sm" variant="outline">
                  <FileSpreadsheet className="h-4 w-4 mr-1" /> Importar Excel
                </Button>
                <Button onClick={onNew} size="sm" style={{ backgroundColor: 'var(--primary)' }}>
                  <Plus className="h-4 w-4 mr-1" /> Nuevo producto
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Sub-pestañas: Productos / Vademécum */}
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="productos" className="flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" /> Productos
          </TabsTrigger>
          <TabsTrigger value="vademecum" className="flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> Vademécum
          </TabsTrigger>
        </TabsList>

        <TabsContent value="productos" className="mt-4 space-y-4">
          {/* Stock bajo alert */}
          {bajoProducts.length > 0 && (
            <Card className="border-red-300 bg-red-50">
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-red-800 text-sm">
                      {bajoProducts.length} producto(s) con stock bajo
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5 max-h-24 overflow-y-auto">
                      {bajoProducts.slice(0, 12).map((p) => (
                        <Badge
                          key={p.id}
                          variant="outline"
                          className="bg-white border-red-300 text-red-700 cursor-pointer hover:bg-red-100"
                          onClick={() => onMovimientos(p)}
                        >
                          {p.name} <span className="font-mono ml-1">({p.stock}/{p.minStock})</span>
                        </Badge>
                      ))}
                      {bajoProducts.length > 12 && (
                        <Badge variant="outline" className="bg-white border-red-300 text-red-700">
                          +{bajoProducts.length - 12} más
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

      {/* Toolbar */}
      <Card className="shadow-sm">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => applyFilter(setSearch)(e.target.value)}
                placeholder="Buscar por nombre, código o descripción..."
                className="pl-8"
              />
            </div>
            <Select value={category} onValueChange={applyFilter(setCategory)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={SENTINEL_ALL}>Todas las categorías</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Switch checked={stockBajo} onCheckedChange={applyFilter(setStockBajo)} />
              Stock bajo
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Switch checked={includeInactive} onCheckedChange={applyFilter(setIncludeInactive)} />
              Ver inactivos
            </label>
            <div className="text-xs text-muted-foreground ml-auto">
              {isFetching ? 'Cargando...' : `${total} producto(s)`}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <PackageX className="h-10 w-10 mx-auto mb-2 opacity-50" />
              No hay productos que coincidan con los filtros.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="w-32">Categoría</TableHead>
                    <TableHead className="w-28">Precio venta</TableHead>
                    <TableHead className="w-24">IVA</TableHead>
                    <TableHead className="w-24">Stock</TableHead>
                    <TableHead className="w-40">Proveedor</TableHead>
                    <TableHead className="w-24">Estado</TableHead>
                    <TableHead className="w-32 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => {
                    const low = p.stock <= p.minStock
                    return (
                      <TableRow
                        key={p.id}
                        className="cursor-pointer hover:bg-accent/40"
                        onClick={() => onEdit(p)}
                      >
                        <TableCell>
                          <div className="font-medium">{p.name}</div>
                          {p.code && (
                            <div className="text-[10px] text-muted-foreground font-mono">SKU: {p.code}</div>
                          )}
                          {p.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1">{p.description}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {CATEGORY_LABELS[p.category] || p.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{fmtMoney(p.salePrice)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">
                            {IVA_LABELS[p.ivaType] || p.ivaType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              low
                                ? 'bg-red-100 text-red-700 border-red-300'
                                : 'bg-emerald-100 text-emerald-700 border-emerald-300'
                            }
                          >
                            {p.stock}
                            {low && <span className="ml-1 text-[9px]">/ {p.minStock}</span>}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.supplier || '—'}
                        </TableCell>
                        <TableCell>
                          {p.active ? (
                            <Badge className="bg-emerald-100 text-emerald-700">Activo</Badge>
                          ) : (
                            <Badge variant="secondary">Inactivo</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => onMovimientos(p)}
                              title="Movimientos"
                            >
                              <History className="h-4 w-4" />
                            </Button>
                            {canEdit && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => onEdit(p)}
                                  title="Editar"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                {p.active && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-600"
                                    onClick={() => setDeleteId(p.id)}
                                    title="Desactivar"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-xs text-muted-foreground">
            Página {page} de {totalPages}
          </span>
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
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
        </TabsContent>

        <TabsContent value="vademecum" className="mt-4">
          <VademecumTab canEdit={canEdit} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ProductFormDialog
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditing(null) }}
        editing={editing}
        canEdit={canEdit}
        onSave={(d) => saveMutation.mutate(d)}
        saving={saveMutation.isPending}
        sessionKey={formSession}
      />

      <MovimientosDialog
        open={movimientosOpen}
        onOpenChange={setMovimientosOpen}
        product={movProduct}
        canEdit={canEdit}
      />

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <PosDialog open={posOpen} onOpenChange={setPosOpen} />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              El producto se marcará como inactivo y no aparecerá en búsquedas de venta. Podrás reactivarlo más tarde.
              Esta acción no elimina el producto del inventario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending ? 'Desactivando...' : 'Desactivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
