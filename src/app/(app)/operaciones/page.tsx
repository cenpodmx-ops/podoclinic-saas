'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import {
  DoorOpen,
  DoorClosed,
  Lock,
  Unlock,
  CalendarCheck,
  XCircle,
  TrendingUp,
  History,
  FileText,
  Send,
  Printer,
  CheckCircle2,
  AlertCircle,
  Wallet,
  CreditCard,
  ArrowLeftRight,
} from 'lucide-react'
import { fmtMoney, fmtDate, fmtDateTime, METHOD_LABELS } from '@/lib/format'
import { format, subDays } from 'date-fns'
import { SignaturePad, type SignaturePadHandle } from '@/components/cenpod/signature-pad'

type DailyOperation = {
  id: string
  clinicId: string
  date: string
  type: 'APERTURA' | 'CIERRE'
  openingFund: number | null
  closingCounted: number | null
  closingExpected: number | null
  difference: number | null
  notes: string | null
  signatureData: string | null
  summaryJson: string | null
  performedBy: string | null
  createdAt: string
}

type Summary = {
  citas: {
    total: number
    atendidas: number
    canceladas: number
    noAsistio: number
    pendientes: number
  }
  ingresos: {
    byMethod: Record<string, number>
    total: number
  }
  egresos: { total: number; efectivo: number }
  openingFund: number
  expectedCash: number
  cashSession: any
  totalEfectivo?: number
  totalTarjeta?: number
  totalTransferencia?: number
  totalConsulta?: number
  totalProductos?: number
  byPodologo?: Array<{ name: string; consultas: number; total: number }>
}

type OperacionesResponse = {
  date: string
  status: 'CERRADA' | 'ABIERTA' | 'CERRADA_SIN_ABRIR'
  apertura: DailyOperation | null
  cierre: DailyOperation | null
  cashSession: any
  summary: Summary
}

type HistorialRow = {
  date: string
  clinicName: string
  apertura?: DailyOperation
  cierre?: DailyOperation
}

export default function OperacionesPage() {
  const [tab, setTab] = useState<'hoy' | 'historial'>('hoy')
  const [cierreOpen, setCierreOpen] = useState(false)
  const [historialRange, setHistorialRange] = useState(() => ({
    from: format(new Date(new Date().getTime() - 7*60*60*1000 - 30*24*60*60*1000), 'yyyy-MM-dd'),
    to: format(new Date(new Date().getTime() - 7*60*60*1000), 'yyyy-MM-dd'),
  }))
  const qc = useQueryClient()

  const { data: op, isLoading } = useQuery({
    queryKey: ['operaciones-hoy'],
    queryFn: async () => {
      const r = await fetch('/api/operaciones')
      if (!r.ok) throw new Error('Error al cargar operaciones')
      return r.json() as Promise<OperacionesResponse>
    },
    refetchInterval: 30_000, // refresh every 30s for live summary
  })

  const { data: historialData, isLoading: historialLoading } = useQuery({
    queryKey: ['operaciones-historial', historialRange],
    queryFn: async () => {
      const r = await fetch(`/api/operaciones/historial?from=${historialRange.from}&to=${historialRange.to}`)
      if (!r.ok) throw new Error('Error al cargar historial')
      return r.json() as Promise<{ rows: HistorialRow[]; total: number }>
    },
    enabled: tab === 'historial',
  })

  const abrirMutation = useMutation({
    mutationFn: async (body: { openingFund: number; notes?: string }) => {
      const r = await fetch('/api/operaciones/apertura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const e = await r.json()
        throw new Error(e.error || 'Error al abrir sucursal')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('Sucursal abierta')
      qc.invalidateQueries({ queryKey: ['operaciones-hoy'] })
      qc.refetchQueries({ queryKey: ['operaciones-hoy'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1300px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <DoorOpen className="h-6 w-6" style={{ color: '#0a3143' }} />
          Cierre y Apertura de Sucursal
        </h1>
        <p className="text-sm text-muted-foreground">
          Apertura y corte diario de caja · {op?.date || '—'}
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'hoy' | 'historial')}>
        <TabsList>
          <TabsTrigger value="hoy"><DoorOpen className="h-4 w-4 mr-1" /> Hoy</TabsTrigger>
          <TabsTrigger value="historial"><History className="h-4 w-4 mr-1" /> Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="hoy" className="space-y-4">
          {isLoading || !op ? (
            <div className="space-y-3">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <>
              <StatusCard op={op} onAbrir={(openingFund, notes) => abrirMutation.mutate({ openingFund, notes })} onCerrar={() => setCierreOpen(true)} saving={abrirMutation.isPending} />

              {op.status === 'ABIERTA' && <LiveSummary op={op} onCerrar={() => setCierreOpen(true)} />}

              {op.cierre && <CierreReportCard cierre={op.cierre} summary={op.summary} />}
            </>
          )}
        </TabsContent>

        <TabsContent value="historial" className="space-y-4">
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <Label className="text-xs">Desde</Label>
                  <Input
                    type="date"
                    value={historialRange.from}
                    onChange={(e) => setHistorialRange((r) => ({ ...r, from: e.target.value }))}
                    className="w-44"
                  />
                </div>
                <div>
                  <Label className="text-xs">Hasta</Label>
                  <Input
                    type="date"
                    value={historialRange.to}
                    onChange={(e) => setHistorialRange((r) => ({ ...r, to: e.target.value }))}
                    className="w-44"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setHistorialRange({ from: format(new Date(new Date().getTime() - 7*60*60*1000 - 7*24*60*60*1000), 'yyyy-MM-dd'), to: format(new Date(new Date().getTime() - 7*60*60*1000), 'yyyy-MM-dd') })}
                >
                  Última semana
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setHistorialRange({ from: format(new Date(new Date().getTime() - 7*60*60*1000 - 30*24*60*60*1000), 'yyyy-MM-dd'), to: format(new Date(new Date().getTime() - 7*60*60*1000), 'yyyy-MM-dd') })}
                >
                  Últimos 30 días
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Historial de cierres y aperturas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {historialLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !historialData?.rows.length ? (
                <div className="p-12 text-center text-sm text-muted-foreground">
                  Sin operaciones en este rango.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Sucursal</TableHead>
                        <TableHead>Responsable</TableHead>
                        <TableHead className="text-right">Fondo apertura</TableHead>
                        <TableHead className="text-right">Contado</TableHead>
                        <TableHead className="text-right">Esperado</TableHead>
                        <TableHead className="text-right">Diferencia</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historialData.rows.map((row) => (
                        <HistorialRowItem key={row.date} row={row} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CierreDialog
        open={cierreOpen}
        onClose={() => setCierreOpen(false)}
        expectedCash={op?.summary.expectedCash ?? 0}
        onClosed={(cierreId) => {
          setCierreOpen(false)
          qc.invalidateQueries({ queryKey: ['operaciones-hoy'] })
          // Abrir reporte imprimible
          window.open(`/api/operaciones/${cierreId}/pdf`, '_blank')
        }}
      />
    </div>
  )
}

function StatusCard({
  op,
  onAbrir,
  onCerrar,
  saving,
}: {
  op: OperacionesResponse
  onAbrir: (openingFund: number, notes?: string) => void
  onCerrar: () => void
  saving: boolean
}) {
  const [openingFund, setOpeningFund] = useState('0')
  const [notes, setNotes] = useState('')

  if (op.status === 'CERRADA_SIN_ABRIR') {
    return (
      <Card className="shadow-sm border-2 border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Unlock className="h-5 w-5 text-amber-600" />
            Sucursal cerrada · abre para registrar operaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Fondo de apertura (MXN)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={openingFund}
                onChange={(e) => setOpeningFund(e.target.value)}
                className="text-lg font-semibold"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Efectivo inicial en caja al abrir.
              </p>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Notas de apertura (opcional)</Label>
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej. Faltó una llave, retraso de 15 min…"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              size="lg"
              disabled={saving}
              onClick={() => onAbrir(Number(openingFund) || 0, notes || undefined)}
              style={{ backgroundColor: '#0a3143' }}
            >
              <Unlock className="h-4 w-4 mr-2" /> Abrir sucursal
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (op.status === 'ABIERTA') {
    return (
      <Card className="shadow-sm border-emerald-300 bg-emerald-50/50">
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-emerald-100">
              <DoorOpen className="h-6 w-6 text-emerald-700" />
            </div>
            <div>
              <h3 className="font-semibold text-emerald-900">Sucursal abierta</h3>
              <p className="text-xs text-emerald-700">
                Abierta por <strong>{op.apertura?.performedBy || '—'}</strong> · Fondo {fmtMoney(op.apertura?.openingFund ?? 0)} · {op.apertura && new Date(new Date(op.apertura.createdAt).getTime() - 7 * 60 * 60 * 1000).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          <Button
            size="lg"
            variant="destructive"
            onClick={onCerrar}
          >
            <Lock className="h-4 w-4 mr-2" /> Cerrar sucursal
          </Button>
        </CardContent>
      </Card>
    )
  }

  // CERRADA
  return (
    <Card className="shadow-sm border-slate-300">
      <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-full bg-slate-200">
            <DoorClosed className="h-6 w-6 text-slate-700" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Sucursal cerrada por hoy</h3>
            <p className="text-xs text-slate-700">
              Cerrada por <strong>{op.cierre?.performedBy || '—'}</strong> · {op.cierre && new Date(new Date(op.cierre.createdAt).getTime() - 7 * 60 * 60 * 1000).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {op.cierre && op.cierre.difference !== null && op.cierre.difference !== 0 && (() => {
                const diff = op.cierre!.difference!
                return (
                  <span className={`ml-2 font-semibold ${diff > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    Diferencia: {diff > 0 ? '+' : ''}{fmtMoney(diff)}
                  </span>
                )
              })()}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => op.cierre && window.open(`/api/operaciones/${op.cierre.id}/pdf`, '_blank')}
          >
            <Printer className="h-4 w-4 mr-1" /> Ver reporte
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function LiveSummary({ op, onCerrar }: { op: OperacionesResponse; onCerrar: () => void }) {
  const s = op.summary
  const methods = Object.entries(s.ingresos.byMethod).filter(([, v]) => (v as number) > 0)

  return (
    <>
      <Alert className="border-blue-300 bg-blue-50">
        <AlertCircle className="h-4 w-4 text-blue-700" />
        <AlertTitle className="text-blue-900">Resumen en vivo</AlertTitle>
        <AlertDescription className="text-blue-800">
          Actualizado automáticamente cada 30s. Cifras al momento.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Citas hoy" value={String(s.citas.total)} sub={`${s.citas.atendidas} atendidas`} icon={CalendarCheck} color="#0a3143" />
        <KpiCard label="Atendidas" value={String(s.citas.atendidas)} sub={`${s.citas.pendientes} pendientes`} icon={CheckCircle2} color="#15803d" />
        <KpiCard label="Canceladas" value={String(s.citas.canceladas + s.citas.noAsistio)} sub={`${s.citas.canceladas} canc · ${s.citas.noAsistio} no show`} icon={XCircle} color="#dc2626" />
        <KpiCard label="Ingresos totales" value={fmtMoney(s.ingresos.total)} sub={`${fmtMoney(s.egresos.total)} egresos`} icon={TrendingUp} color="#d97706" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ingresos por método</CardTitle>
          </CardHeader>
          <CardContent>
            {methods.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sin ingresos registrados todavía.</p>
            ) : (
              <div className="space-y-2">
                {methods.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-sm">{METHOD_LABELS[k as keyof typeof METHOD_LABELS] || k}</span>
                    <span className="font-semibold text-sm">{fmtMoney(v as number)}</span>
                  </div>
                ))}
                <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                  <span>Total</span>
                  <span>{fmtMoney(s.ingresos.total)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Caja efectivo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Fondo apertura</span>
                <span className="font-medium">{fmtMoney(s.openingFund)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">+ Ingresos efectivo</span>
                <span className="font-medium text-emerald-700">{fmtMoney(s.ingresos.byMethod.EFECTIVO || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">− Egresos efectivo</span>
                <span className="font-medium text-red-700">{fmtMoney(s.egresos.efectivo)}</span>
              </div>
              <div className="border-t pt-2 mt-2 flex justify-between items-center">
                <span className="font-semibold">Efectivo esperado</span>
                <span className="text-xl font-bold" style={{ color: '#0a3143' }}>{fmtMoney(s.expectedCash)}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Esta es la cantidad que debes contar al cerrar.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Desglose por concepto y por podólogo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Desglose por concepto */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Desglose por concepto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total de consultas</span>
                <span className="font-semibold text-emerald-700">{fmtMoney(s.totalConsulta ?? 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total medicamentos/productos</span>
                <span className="font-semibold text-amber-700">{fmtMoney(s.totalProductos ?? 0)}</span>
              </div>
              <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                <span>Total del día</span>
                <span style={{ color: '#0a3143' }}>{fmtMoney(s.ingresos.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ingreso bruto por podólogo */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ingreso bruto por podólogo</CardTitle>
          </CardHeader>
          <CardContent>
            {(!s.byPodologo || s.byPodologo.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sin consultas pagadas hoy.</p>
            ) : (
              <div className="space-y-2">
                {s.byPodologo.map((p, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="font-medium">{p.name}</span>
                    <div className="text-right">
                      <div className="font-semibold" style={{ color: '#0a3143' }}>{fmtMoney(p.total)}</div>
                      <div className="text-[10px] text-muted-foreground">{p.consultas} consulta(s)</div>
                    </div>
                  </div>
                ))}
                <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                  <span>Total</span>
                  <span>{fmtMoney(s.byPodologo.reduce((sum, p) => sum + p.total, 0))}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resumen de métodos simplificado */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Total efectivo" value={fmtMoney(s.totalEfectivo ?? 0)} sub="ingresos en efectivo" icon={Wallet} color="#059669" />
        <KpiCard label="Total tarjeta" value={fmtMoney(s.totalTarjeta ?? 0)} sub="débito + crédito" icon={CreditCard} color="#2563eb" />
        <KpiCard label="Total transferencia" value={fmtMoney(s.totalTransferencia ?? 0)} sub="transferencias" icon={ArrowLeftRight} color="#7c3aed" />
      </div>

      <div className="flex justify-end">
        <Button size="lg" variant="destructive" onClick={onCerrar}>
          <Lock className="h-4 w-4 mr-2" /> Cerrar sucursal
        </Button>
      </div>
    </>
  )
}

function CierreReportCard({ cierre, summary }: { cierre: DailyOperation; summary: Summary }) {
  const diff = cierre.difference ?? 0
  const diffColor = diff === 0 ? 'text-slate-700' : diff > 0 ? 'text-emerald-700' : 'text-red-700'
  const [waOpen, setWaOpen] = useState(false)

  // Construir mensaje WhatsApp con todos los desgloses
  const podMsg = (summary.byPodologo || [])
    .map(p => `  ${p.name}: ${fmtMoney(p.total)} (${p.consultas} consulta${p.consultas !== 1 ? 's' : ''})`)
    .join('\n')

  const message = `*Cierre de Sucursal CENPOD*
Fecha: ${fmtDate(cierre.date)}
Responsable: ${cierre.performedBy || '—'}

*Citas:*
• Atendidas: ${summary.citas.atendidas}/${summary.citas.total}
• Canceladas: ${summary.citas.canceladas}
• No asistió: ${summary.citas.noAsistio}

*Desglose de ingresos:*
• Total del día: ${fmtMoney(summary.ingresos.total)}
• Efectivo: ${fmtMoney(summary.totalEfectivo ?? 0)}
• Tarjeta: ${fmtMoney(summary.totalTarjeta ?? 0)}
• Transferencia: ${fmtMoney(summary.totalTransferencia ?? 0)}

*Por concepto:*
• Consultas: ${fmtMoney(summary.totalConsulta ?? 0)}
• Medicamentos/Productos: ${fmtMoney(summary.totalProductos ?? 0)}

*Ingreso bruto por podólogo:*
${podMsg || '  Sin consultas pagadas'}

*Caja:*
• Efectivo esperado: ${fmtMoney(cierre.closingExpected ?? 0)}
• Efectivo contado: ${fmtMoney(cierre.closingCounted ?? 0)}
• Diferencia: ${diff >= 0 ? '+' : ''}${fmtMoney(diff)}

${cierre.notes ? `*Incidencias:* ${cierre.notes}` : 'Sin incidencias.'}`

  function openWhatsApp(phone: string) {
    const cleaned = phone.replace(/[^0-9]/g, '')
    const fullPhone = cleaned.length === 10 ? `52${cleaned}` : cleaned
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`, '_blank')
  }

  return (
    <>
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" /> Reporte de cierre · {fmtDate(cierre.date)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* KPIs principales */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Stat label="Fondo apertura" value={fmtMoney(cierre.openingFund ?? summary.openingFund ?? 0)} />
          <Stat label="Total del día" value={fmtMoney(summary.ingresos.total)} />
          <Stat label="Efectivo contado" value={fmtMoney(cierre.closingCounted ?? 0)} />
          <Stat label="Efectivo esperado" value={fmtMoney(cierre.closingExpected ?? 0)} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Stat label="Citas atendidas" value={`${summary.citas.atendidas} / ${summary.citas.total}`} />
          <Stat label="Canceladas" value={`${summary.citas.canceladas}`} />
          <Stat label="No asistió" value={`${summary.citas.noAsistio}`} />
          <Stat label="Diferencia" value={`${diff >= 0 ? '+' : ''}${fmtMoney(diff)}`} className={diffColor} highlight />
        </div>

        {/* Desglose por método de pago */}
        <div className="border rounded-md p-3 space-y-1.5">
          <div className="text-[10px] uppercase text-muted-foreground mb-1 font-semibold">Ingresos por método</div>
          <div className="flex justify-between text-sm"><span>Efectivo</span><span className="font-semibold text-emerald-700">{fmtMoney(summary.totalEfectivo ?? 0)}</span></div>
          <div className="flex justify-between text-sm"><span>Tarjeta (débito + crédito)</span><span className="font-semibold text-blue-700">{fmtMoney(summary.totalTarjeta ?? 0)}</span></div>
          <div className="flex justify-between text-sm"><span>Transferencia</span><span className="font-semibold text-purple-700">{fmtMoney(summary.totalTransferencia ?? 0)}</span></div>
          <div className="border-t pt-1.5 mt-1.5 flex justify-between font-bold text-sm"><span>Total</span><span>{fmtMoney(summary.ingresos.total)}</span></div>
        </div>

        {/* Desglose por concepto */}
        <div className="border rounded-md p-3 space-y-1.5">
          <div className="text-[10px] uppercase text-muted-foreground mb-1 font-semibold">Desglose por concepto</div>
          <div className="flex justify-between text-sm"><span>Total de consultas</span><span className="font-semibold text-emerald-700">{fmtMoney(summary.totalConsulta ?? 0)}</span></div>
          <div className="flex justify-between text-sm"><span>Total medicamentos/productos</span><span className="font-semibold text-amber-700">{fmtMoney(summary.totalProductos ?? 0)}</span></div>
        </div>

        {/* Ingreso bruto por podólogo */}
        <div className="border rounded-md p-3 space-y-1.5">
          <div className="text-[10px] uppercase text-muted-foreground mb-1 font-semibold">Ingreso bruto por podólogo (sin descontar comisión)</div>
          {(summary.byPodologo || []).length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin consultas pagadas.</p>
          ) : (
            <>
              {summary.byPodologo!.map((p, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="font-medium">{p.name}</span>
                  <div className="text-right">
                    <span className="font-semibold" style={{ color: '#0a3143' }}>{fmtMoney(p.total)}</span>
                    <span className="text-[10px] text-muted-foreground ml-2">{p.consultas} consulta(s)</span>
                  </div>
                </div>
              ))}
              <div className="border-t pt-1.5 mt-1.5 flex justify-between font-bold text-sm">
                <span>Total</span>
                <span>{fmtMoney(summary.byPodologo!.reduce((sum, p) => sum + p.total, 0))}</span>
              </div>
            </>
          )}
        </div>

        {cierre.notes && (
          <div className="border rounded-md p-3 bg-amber-50">
            <div className="text-[10px] uppercase text-amber-700 mb-1">Incidencias</div>
            <div className="text-sm whitespace-pre-wrap">{cierre.notes}</div>
          </div>
        )}

        {cierre.signatureData && (
          <div>
            <div className="text-[10px] uppercase text-muted-foreground mb-1">Firma del responsable</div>
            <img src={cierre.signatureData} alt="Firma" className="max-h-24 border rounded bg-white p-1" />
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => window.open(`/api/operaciones/${cierre.id}/pdf`, '_blank')}>
            <Printer className="h-4 w-4 mr-1" /> Imprimir / PDF
          </Button>
          <Button style={{ backgroundColor: '#25D366' }} onClick={() => setWaOpen(true)}>
            <Send className="h-4 w-4 mr-1" /> Enviar por WhatsApp
          </Button>
        </div>
      </CardContent>
    </Card>

    <WhatsAppDialog
      open={waOpen}
      onOpenChange={setWaOpen}
      onSend={openWhatsApp}
    />
    </>
  )
}

// ===== Dialog de WhatsApp con contactos guardados =====
type WaContact = { name: string; phone: string }

function WhatsAppDialog({
  open,
  onOpenChange,
  onSend,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSend: (phone: string) => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [contacts, setContacts] = useState<WaContact[]>([])

  // Cargar contactos guardados al montar
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cenpod_wa_contacts')
      if (saved) {
        const parsed = JSON.parse(saved) as WaContact[]
        // Usar setContacts fuera del effect body para evitar cascada de renders
        setTimeout(() => setContacts(parsed), 0)
      }
    } catch {}
  }, [])

  function saveContact() {
    const cleaned = phone.replace(/[^0-9]/g, '')
    if (cleaned.length < 10) {
      toast.error('Teléfono inválido (mínimo 10 dígitos)')
      return
    }
    const newContact: WaContact = { name: name || 'Sin nombre', phone: cleaned }
    const updated = [...contacts.filter((c) => c.phone !== cleaned), newContact]
    setContacts(updated)
    localStorage.setItem('cenpod_wa_contacts', JSON.stringify(updated))
    setName('')
    setPhone('')
    toast.success('Contacto guardado')
  }

  function deleteContact(phone: string) {
    const updated = contacts.filter((c) => c.phone !== phone)
    setContacts(updated)
    localStorage.setItem('cenpod_wa_contacts', JSON.stringify(updated))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar por WhatsApp</DialogTitle>
          <DialogDescription>
            Selecciona un contacto guardado o agrega uno nuevo. Se abrirá WhatsApp con el mensaje del cierre.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Contactos guardados */}
          {contacts.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Contactos guardados</Label>
              {contacts.map((c) => (
                <div key={c.phone} className="flex items-center justify-between rounded-md border p-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.phone}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => { onSend(c.phone); onOpenChange(false) }}>
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => deleteContact(c.phone)}>
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="border-t pt-3 space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">Agregar nuevo contacto</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                placeholder="Teléfono (10 dígitos)"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">Se agrega +52 automáticamente si son 10 dígitos.</p>
          </div>
        </div>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {phone.replace(/[^0-9]/g, '').length >= 10 && (
            <Button variant="outline" onClick={saveContact}>
              Guardar contacto
            </Button>
          )}
          <Button
            style={{ backgroundColor: '#25D366' }}
            disabled={phone.replace(/[^0-9]/g, '').length < 10}
            onClick={() => { onSend(phone); onOpenChange(false) }}
          >
            <Send className="h-4 w-4 mr-1" /> Abrir WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function HistorialRowItem({ row }: { row: HistorialRow }) {
  const cierre = row.cierre
  const apertura = row.apertura
  const diff = cierre?.difference ?? null
  const diffColor = diff === null ? 'text-slate-500' : diff === 0 ? 'text-slate-700' : diff > 0 ? 'text-emerald-700' : 'text-red-700'

  return (
    <TableRow className="cursor-pointer hover:bg-muted/40" onClick={() => cierre && window.open(`/api/operaciones/${cierre.id}/pdf`, '_blank')}>
      <TableCell className="font-medium">{fmtDate(row.date)}</TableCell>
      <TableCell className="text-xs">{row.clinicName}</TableCell>
      <TableCell className="text-xs">{cierre?.performedBy || apertura?.performedBy || '—'}</TableCell>
      <TableCell className="text-right">{apertura ? fmtMoney(apertura.openingFund ?? 0) : '—'}</TableCell>
      <TableCell className="text-right">{cierre ? fmtMoney(cierre.closingCounted ?? 0) : '—'}</TableCell>
      <TableCell className="text-right">{cierre ? fmtMoney(cierre.closingExpected ?? 0) : '—'}</TableCell>
      <TableCell className={`text-right font-semibold ${diffColor}`}>
        {diff === null ? '—' : `${diff > 0 ? '+' : ''}${fmtMoney(diff)}`}
      </TableCell>
      <TableCell className="text-center">
        {cierre ? (
          <Badge variant="outline" className="bg-slate-100">Cerrada</Badge>
        ) : apertura ? (
          <Badge variant="outline" className="bg-emerald-100 text-emerald-700">Solo apertura</Badge>
        ) : (
          <Badge variant="outline">—</Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        {cierre && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              window.open(`/api/operaciones/${cierre.id}/pdf`, '_blank')
            }}
          >
            <FileText className="h-3.5 w-3.5" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}

function CierreDialog({
  open,
  onClose,
  expectedCash,
  onClosed,
}: {
  open: boolean
  onClose: () => void
  expectedCash: number
  onClosed: (cierreId: string) => void
}) {
  const [countedCash, setCountedCash] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const sigRef = useRef<SignaturePadHandle>(null)

  // Reset form on open
  useEffect(() => {
    if (open) {
      setCountedCash('')
      setNotes('')
      sigRef.current?.clear()
    }
  }, [open])

  const difference = (Number(countedCash) || 0) - expectedCash
  const diffColor = difference === 0 ? 'text-slate-700' : difference > 0 ? 'text-emerald-700' : 'text-red-700'

  const submit = async () => {
    if (countedCash === '' || isNaN(Number(countedCash))) {
      toast.error('Ingresa el efectivo contado')
      return
    }
    setSaving(true)
    try {
      const signatureData = sigRef.current?.getDataUrl() || null
      const r = await fetch('/api/operaciones/cierre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countedCash: Number(countedCash),
          notes: notes || undefined,
          signatureData,
        }),
      })
      if (!r.ok) {
        const e = await r.json()
        throw new Error(e.error || 'Error al cerrar')
      }
      const data = await r.json()
      toast.success('Sucursal cerrada')
      // Reset
      setCountedCash('')
      setNotes('')
      sigRef.current?.clear()
      onClosed(data.cierre.id)
    } catch (e: any) {
      toast.error(e.message || 'Error al cerrar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-red-700" /> Cerrar sucursal
          </DialogTitle>
          <DialogDescription>
            Confirma el efectivo contado, incidencias y firma. Se generará un reporte imprimible.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Efectivo esperado</Label>
              <div className="px-3 py-2 border rounded-md bg-muted/40 font-semibold" style={{ color: '#0a3143' }}>
                {fmtMoney(expectedCash)}
              </div>
            </div>
            <div>
              <Label className="text-xs">Efectivo contado *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={countedCash}
                onChange={(e) => setCountedCash(e.target.value)}
                placeholder="0.00"
                className="text-lg font-semibold"
              />
            </div>
          </div>

          <div className="flex items-center justify-between border rounded-md p-3 bg-muted/30">
            <span className="text-sm font-medium">Diferencia</span>
            <span className={`text-xl font-bold ${diffColor}`}>
              {difference >= 0 ? '+' : ''}{fmtMoney(difference)}
            </span>
          </div>

          <div>
            <Label className="text-xs">Incidencias / Notas</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anomalías, faltantes, observaciones del día…"
            />
          </div>

          <div>
            <Label className="text-xs">Firma del responsable</Label>
            <SignaturePad ref={sigRef} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="destructive" onClick={submit} disabled={saving}>
            {saving ? 'Cerrando…' : 'Confirmar cierre'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: string
  sub?: string
  icon: any
  color: string
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold mt-0.5">{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="p-2 rounded-lg text-white" style={{ backgroundColor: color }}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Stat({
  label,
  value,
  className,
  highlight,
}: {
  label: string
  value: string
  className?: string
  highlight?: boolean
}) {
  return (
    <div className={`border rounded-md p-2 bg-muted/30 ${highlight ? 'border-2' : ''}`}>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={`text-sm font-bold mt-0.5 ${className || ''}`}>{value}</div>
    </div>
  )
}
