'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  FileText,
  Search,
  Printer,
  Download,
  XCircle,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  TrendingUp,
  CheckCircle2,
  XCircle as XIcon,
  Receipt,
} from 'lucide-react'
import { fmtMoney, fmtDate } from '@/lib/format'
import {
  STATUS_LABELS,
  STATUS_BADGE_CLASSES,
  type CitableConsultation,
  type FacturasListResponse,
  type CitablesResponse,
  type ResumenResponse,
  type InvoiceRow,
  type InvoiceStatus,
} from '../_lib/types'

interface TabPorFacturarProps {
  facturapiConfigured: boolean
  onFacturar: (c: CitableConsultation) => void
}

export function TabPorFacturar({ facturapiConfigured, onFacturar }: TabPorFacturarProps) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [podologo, setPodologo] = useState('all')
  const [paciente, setPaciente] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  const podologosQ = useQuery<{ rows: { id: string; name: string }[] }>({
    queryKey: ['podologos-list'],
    queryFn: async () => {
      const r = await fetch('/api/podologos')
      if (!r.ok) throw new Error('No se pudieron cargar los podólogos')
      return r.json()
    },
    staleTime: 60_000,
  })

  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  if (podologo !== 'all') params.set('podologo', podologo)
  if (paciente) params.set('paciente', paciente)
  params.set('page', String(page))
  params.set('limit', String(limit))

  const citablesQ = useQuery<CitablesResponse>({
    queryKey: ['facturas-citables', from, to, podologo, paciente, page],
    queryFn: async () => {
      const r = await fetch(`/api/facturas/citables?${params.toString()}`)
      if (!r.ok) throw new Error('No se pudieron cargar las consultas')
      return r.json()
    },
    staleTime: 0,
  })

  const totalPages = citablesQ.data ? Math.max(1, Math.ceil(citablesQ.data.total / limit)) : 1

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Podólogo</Label>
              <Select value={podologo} onValueChange={(v) => { setPodologo(v); setPage(1) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {(podologosQ.data?.rows || []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Paciente</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Buscar…"
                  value={paciente}
                  onChange={(e) => { setPaciente(e.target.value); setPage(1) }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Receipt className="h-4 w-4" style={{ color: '#0a3143' }} />
              Consultas por facturar
            </span>
            {citablesQ.data && (
              <span className="text-xs text-muted-foreground font-normal">
                {citablesQ.data.total} resultado(s)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {citablesQ.isLoading && <Skeleton className="h-32" />}
          {citablesQ.isError && (
            <div className="text-sm text-red-600 text-center py-8">
              Error al cargar las consultas. Intenta de nuevo.
            </div>
          )}
          {citablesQ.data && citablesQ.data.rows.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay consultas pendientes de facturar</p>
              <p className="text-xs mt-1">Las consultas finalizadas aparecerán aquí para generar su factura.</p>
            </div>
          )}
          {citablesQ.data && citablesQ.data.rows.length > 0 && (
            <>
              <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">Fecha</TableHead>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Podólogo</TableHead>
                      <TableHead className="text-center">Items</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {citablesQ.data.rows.map((c) => (
                      <TableRow key={c.id} className={c.patientRfc ? '' : 'bg-amber-50/50'}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(c.date), 'dd/MM/yyyy')}
                          <div className="text-[10px] text-muted-foreground">{format(new Date(c.date), 'HH:mm')}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{c.patientName}</div>
                          <div className="text-[11px] text-muted-foreground">Exp. {c.expNumber}</div>
                          {!c.patientRfc && (
                            <Badge variant="outline" className="mt-0.5 text-[10px] border-amber-300 bg-amber-100 text-amber-800">
                              Sin RFC
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{c.podologistName}</TableCell>
                        <TableCell className="text-center text-sm">{c.itemsCount}</TableCell>
                        <TableCell className="text-right font-semibold">{fmtMoney(c.total)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            style={{ backgroundColor: '#0a3143' }}
                            onClick={() => onFacturar(c)}
                          >
                            <FileText className="h-3.5 w-3.5 mr-1" /> Facturar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-end gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground">Página {page} de {totalPages}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {!facturapiConfigured && (
        <div className="text-xs text-amber-700 text-center">
          ⚠ Funcionando en modo simulación. Configura tu token FacturAPI en <a href="/config" className="underline">Configuración → FacturAPI</a>.
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// TAB HISTORIAL
// ──────────────────────────────────────────────────────────

interface TabHistorialProps {
  canCancel: boolean
}

export function TabHistorial({ canCancel }: TabHistorialProps) {
  const qc = useQueryClient()
  const [month, setMonth] = useState('') // YYYY-MM
  const [paciente, setPaciente] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const limit = 20
  const [cancelTarget, setCancelTarget] = useState<InvoiceRow | null>(null)

  const params = new URLSearchParams()
  if (month) params.set('month', month)
  if (paciente) params.set('patientId', paciente)
  if (status !== 'all') params.set('status', status)
  params.set('page', String(page))
  params.set('limit', String(limit))

  const listQ = useQuery<FacturasListResponse>({
    queryKey: ['facturas-list', month, paciente, status, page],
    queryFn: async () => {
      const r = await fetch(`/api/facturas?${params.toString()}`)
      if (!r.ok) throw new Error('No se pudieron cargar las facturas')
      return r.json()
    },
    staleTime: 0,
  })

  // Búsqueda por nombre de paciente — hacemos una búsqueda server-side?
  // Para simplicidad: dejamos como filtro opcional por ID exacto (raro en la UI).
  // En su lugar, haremos client-side filter cuando el input coincida con nombre.
  const filteredData = useMemo(() => {
    if (!listQ.data?.data) return []
    if (!paciente.trim()) return listQ.data.data
    const q = paciente.trim().toLowerCase()
    return listQ.data.data.filter((r) =>
      r.patientName.toLowerCase().includes(q) ||
      (r.expNumber || '').toLowerCase().includes(q) ||
      (r.folio || '').toLowerCase().includes(q),
    )
  }, [listQ.data, paciente])

  const totalPages = listQ.data ? Math.max(1, Math.ceil(listQ.data.total / limit)) : 1

  const cancelMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/facturas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', motive: '02' }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Error al cancelar')
      return data
    },
    onSuccess: () => {
      toast.success('Factura cancelada')
      setCancelTarget(null)
      qc.invalidateQueries({ queryKey: ['facturas-list'] })
      qc.invalidateQueries({ queryKey: ['facturas-resumen'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Mes</Label>
              <Input type="month" value={month} onChange={(e) => { setMonth(e.target.value); setPage(1) }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Folio, paciente, exp."
                  value={paciente}
                  onChange={(e) => setPaciente(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Estatus</Label>
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="TIMBRADA">Vigentes (timbradas)</SelectItem>
                  <SelectItem value="PENDIENTE">Simulación</SelectItem>
                  <SelectItem value="CANCELADA">Canceladas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4" style={{ color: '#0a3143' }} />
              Historial de facturas
            </span>
            {listQ.data && (
              <span className="text-xs text-muted-foreground font-normal">
                {listQ.data.total} factura(s) · {listQ.data.facturapiConfigured ? 'FacturAPI activo' : 'Simulación'}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {listQ.isLoading && <Skeleton className="h-32" />}
          {listQ.isError && (
            <div className="text-sm text-red-600 text-center py-8">Error al cargar las facturas.</div>
          )}
          {listQ.data && filteredData.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay facturas emitidas</p>
            </div>
          )}
          {listQ.data && filteredData.length > 0 && (
            <>
              <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">Folio</TableHead>
                      <TableHead className="w-28">Fecha</TableHead>
                      <TableHead>Paciente</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="text-right">IVA</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-center">Estatus</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((inv) => (
                      <TableRow key={inv.id} className={inv.status === 'CANCELADA' ? 'opacity-60' : ''}>
                        <TableCell className="font-mono text-xs">
                          {inv.folio || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{fmtDate(inv.date)}</TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{inv.patientName}</div>
                          {inv.expNumber && <div className="text-[11px] text-muted-foreground">Exp. {inv.expNumber}</div>}
                        </TableCell>
                        <TableCell className="text-right text-xs">{fmtMoney(inv.subtotal)}</TableCell>
                        <TableCell className="text-right text-xs">{fmtMoney(inv.iva)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmtMoney(inv.total)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE_CLASSES[inv.status as InvoiceStatus]}`}>
                            {STATUS_LABELS[inv.status as InvoiceStatus] || inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              asChild
                              title="Ver / descargar PDF"
                            >
                              <a
                                href={`/api/facturas/${inv.id}/pdf${inv.status !== 'TIMBRADA' ? '?html=1' : ''}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                            {inv.status === 'TIMBRADA' && inv.xmlUrl && (
                              <Button size="sm" variant="ghost" asChild title="Descargar XML">
                                <a href={inv.xmlUrl} target="_blank" rel="noreferrer">
                                  <FileText className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                            )}
                            {canCancel && inv.status !== 'CANCELADA' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700"
                                title="Cancelar factura"
                                onClick={() => setCancelTarget(inv)}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-end gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground">Página {page} de {totalPages}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar factura {cancelTarget?.folio || ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción <strong>no se puede deshacer</strong>. {cancelTarget?.status === 'TIMBRADA'
                ? 'Se cancelará ante el SAT vía FacturAPI.'
                : 'Se marcará como cancelada en el sistema.'}
              <br />
              Paciente: <strong>{cancelTarget?.patientName}</strong> · Total: <strong>{cancelTarget ? fmtMoney(cancelTarget.total) : ''}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, mantener</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => cancelTarget && cancelMut.mutate(cancelTarget.id)}
              disabled={cancelMut.isPending}
            >
              {cancelMut.isPending ? 'Cancelando…' : 'Sí, cancelar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// TAB RESUMEN MENSUAL
// ──────────────────────────────────────────────────────────

export function TabResumen() {
  const [month, setMonth] = useState(() => format(new Date(), 'yyyy-MM'))

  const resumenQ = useQuery<ResumenResponse>({
    queryKey: ['facturas-resumen', month],
    queryFn: async () => {
      const r = await fetch(`/api/facturas/resumen?month=${month}`)
      if (!r.ok) throw new Error('No se pudo cargar el resumen')
      return r.json()
    },
    staleTime: 0,
  })

  const monthLabel = useMemo(() => {
    const [y, m] = month.split('-')
    const d = new Date(Number(y), Number(m) - 1, 1)
    return format(d, 'MMMM yyyy')
  }, [month])

  const printSummary = () => {
    window.print()
  }

  return (
    <div className="space-y-4 factura-resumen-print">
      <Card className="shadow-sm no-print">
        <CardContent className="p-4 flex flex-wrap items-end gap-3 justify-between">
          <div className="space-y-1">
            <Label className="text-xs">Mes a resumir</Label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-48" />
          </div>
          <Button variant="outline" onClick={printSummary}>
            <Printer className="h-4 w-4 mr-2" /> Imprimir resumen
          </Button>
        </CardContent>
      </Card>

      {resumenQ.isLoading && <Skeleton className="h-64" />}
      {resumenQ.isError && (
        <Card className="shadow-sm"><CardContent className="p-6 text-center text-red-600 text-sm">Error al cargar el resumen.</CardContent></Card>
      )}
      {resumenQ.data && (
        <>
          <div className="print-only mb-4 hidden">
            <div className="text-2xl font-bold text-[#0a3143]">CENPOD</div>
            <div className="text-sm text-muted-foreground">Resumen mensual de facturación</div>
            <div className="text-base mt-2 capitalize">{monthLabel}</div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              title="Total facturado"
              value={fmtMoney(resumenQ.data.totalFacturado)}
              icon={<TrendingUp className="h-5 w-5" />}
              accent="#0a3143"
            />
            <KpiCard
              title="Subtotal"
              value={fmtMoney(resumenQ.data.totalSubtotal)}
              icon={<Receipt className="h-5 w-5" />}
              accent="#475569"
            />
            <KpiCard
              title="IVA recaudado"
              value={fmtMoney(resumenQ.data.totalIva)}
              icon={<CalendarDays className="h-5 w-5" />}
              accent="#0f766e"
            />
            <KpiCard
              title="Facturas emitidas"
              value={String(resumenQ.data.countEmitidas)}
              icon={<CheckCircle2 className="h-5 w-5" />}
              accent="#15803d"
              subtitle={`${resumenQ.data.countTimbradas} timbradas · ${resumenQ.data.countSimuladas} simulación`}
            />
          </div>

          {/* Desglose IVA */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Desglose de impuestos</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tasa de IVA</TableHead>
                    <TableHead className="text-right">Base gravable</TableHead>
                    <TableHead className="text-right">IVA</TableHead>
                    <TableHead className="text-right">Total + IVA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">IVA 16%</TableCell>
                    <TableCell className="text-right">{fmtMoney(resumenQ.data.desgloseIva.IVA16.base)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(resumenQ.data.desgloseIva.IVA16.iva)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmtMoney(resumenQ.data.desgloseIva.IVA16.total)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">IVA 0%</TableCell>
                    <TableCell className="text-right">{fmtMoney(resumenQ.data.desgloseIva.IVA0.base)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(resumenQ.data.desgloseIva.IVA0.iva)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmtMoney(resumenQ.data.desgloseIva.IVA0.total)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Exento</TableCell>
                    <TableCell className="text-right">{fmtMoney(resumenQ.data.desgloseIva.EXENTO.base)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(resumenQ.data.desgloseIva.EXENTO.iva)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmtMoney(resumenQ.data.desgloseIva.EXENTO.total)}</TableCell>
                  </TableRow>
                  <TableRow className="border-t-2 font-bold bg-muted/30">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right">{fmtMoney(resumenQ.data.totalSubtotal)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(resumenQ.data.totalIva)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(resumenQ.data.totalFacturado)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Canceladas */}
          <Card className="shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                  <XIcon className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Facturas canceladas en el periodo</div>
                  <div className="text-2xl font-bold text-red-700">{resumenQ.data.countCanceladas}</div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground text-right">
                <div>No se incluyen en los totales arriba</div>
                <div className="font-medium">Período: <span className="capitalize">{monthLabel}</span></div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function KpiCard({
  title,
  value,
  icon,
  accent,
  subtitle,
}: {
  title: string
  value: string
  icon: React.ReactNode
  accent: string
  subtitle?: string
}) {
  return (
    <Card className="shadow-sm border-l-4" style={{ borderLeftColor: accent }}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">{title}</div>
          <div style={{ color: accent }}>{icon}</div>
        </div>
        <div className="text-2xl font-bold" style={{ color: accent }}>{value}</div>
        {subtitle && <div className="text-[11px] text-muted-foreground mt-1">{subtitle}</div>}
      </CardContent>
    </Card>
  )
}
