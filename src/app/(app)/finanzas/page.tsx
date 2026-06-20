'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Banknote,
  CreditCard,
  ArrowRightLeft,
  Printer,
  FileBarChart,
  Stethoscope,
  Package,
  DollarSign,
  Calendar,
  ShieldAlert,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { format, parseISO, subDays } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { fmtMoney } from '@/lib/format'
import { canAccessFinanceClient } from './_components/access'
import type { FinanzasDashboard, ComisionesResponse, Period, ReporteResponse } from './_components/types'
import { ReporteView } from './_components/reporte-view'

const BRAND = '#0a3143'
const COLORS = ['#0a3143', '#0e7490', '#0891b2', '#0d9488', '#15803d', '#65a30d', '#ca8a04', '#dc2626']

const PERIOD_OPTIONS: Array<{ value: Period; label: string }> = [
  { value: 'dia', label: 'Día' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
  { value: 'año', label: 'Año' },
]

const REPORT_TYPES: Array<{ value: string; label: string; icon: any }> = [
  { value: 'citas', label: 'Citas', icon: Calendar },
  { value: 'inventario', label: 'Inventario', icon: Package },
  { value: 'comisiones', label: 'Comisiones', icon: Stethoscope },
  { value: 'ingresos', label: 'Ingresos y Egresos', icon: DollarSign },
]

export default function FinanzasPage() {
  const { data: session } = useSession()
  const user = session?.user as any

  // ── Sin acceso: RECEPTION o PODOLOGIST no entran
  if (!canAccessFinanceClient(user)) {
    return (
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
        <Card className="max-w-md mx-auto shadow-sm">
          <CardContent className="p-12 text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <ShieldAlert className="h-7 w-7 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Sin acceso</h2>
            <p className="text-sm text-muted-foreground">
              El módulo de Finanzas está disponible solo para <strong>Dueño</strong> y{' '}
              <strong>Súper Dueño</strong>. Si crees que es un error, contacta a tu administrador.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <FinanzasContent />
}

function FinanzasContent() {
  const qc = useQueryClient()
  const { data: session } = useSession()
  const user = session?.user as any

  const [period, setPeriod] = useState<Period>('mes')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  // Comisiones: rango = mes actual por defecto
  const today = new Date()
  const [comisionFrom, setComisionFrom] = useState(format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd'))
  const [comisionTo, setComisionTo] = useState(format(new Date(today.getFullYear(), today.getMonth() + 1, 0), 'yyyy-MM-dd'))

  // Reporte activo
  const [reporteOpen, setReporteOpen] = useState(false)
  const [reporteType, setReporteType] = useState<string | null>(null)

  // ── Dashboard
  const dashQ = useQuery<FinanzasDashboard>({
    queryKey: ['finanzas-dashboard', period, from, to],
    queryFn: async () => {
      const params = new URLSearchParams({ period })
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const r = await fetch(`/api/finanzas?${params.toString()}`)
      if (!r.ok) throw new Error('No se pudo cargar el dashboard')
      return r.json()
    },
    staleTime: 60_000,
  })

  // ── Comisiones
  const comisionesQ = useQuery<ComisionesResponse>({
    queryKey: ['finanzas-comisiones', comisionFrom, comisionTo],
    queryFn: async () => {
      const params = new URLSearchParams({ from: comisionFrom, to: comisionTo })
      const r = await fetch(`/api/finanzas/comisiones?${params.toString()}`)
      if (!r.ok) throw new Error('No se pudo cargar comisiones')
      return r.json()
    },
    staleTime: 60_000,
  })

  // ── Reportes
  const reporteQ = useQuery<ReporteResponse>({
    queryKey: ['finanzas-reporte', reporteType, from, to],
    queryFn: async () => {
      const params = new URLSearchParams({ type: reporteType! })
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const r = await fetch(`/api/finanzas/reportes?${params.toString()}`)
      if (!r.ok) throw new Error('No se pudo generar el reporte')
      return r.json()
    },
    enabled: !!reporteType,
    staleTime: 60_000,
  })

  // ── Configuración de la clínica (para encabezado del reporte)
  const configQ = useQuery<any>({
    queryKey: ['config-clinica'],
    queryFn: async () => {
      const r = await fetch('/api/config')
      if (!r.ok) throw new Error('No se pudo cargar configuración')
      return r.json()
    },
    staleTime: 60_000,
  })

  const openReporte = (type: string) => {
    setReporteType(type)
    setReporteOpen(true)
  }

  const applyPeriod = (p: Period) => {
    setPeriod(p)
    // Reset custom range when selecting a preset period
    setFrom('')
    setTo('')
  }

  const applyCustomRange = () => {
    if (from && to) {
      // when custom range is set, period is informational only
      setPeriod('mes')
      qc.invalidateQueries({ queryKey: ['finanzas-dashboard'] })
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" style={{ color: BRAND }} /> Finanzas
          </h1>
          <p className="text-sm text-muted-foreground">
            Análisis financiero, comisiones y reportes · {user?.clinicName || 'CENPOD'}
          </p>
        </div>
      </header>

      {/* Selector de periodo */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Periodo</Label>
              <div className="flex gap-1 bg-muted rounded-md p-1">
                {PERIOD_OPTIONS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => applyPeriod(p.value)}
                    className={`px-3 py-1.5 text-sm rounded transition-colors ${
                      period === p.value && !from
                        ? 'bg-background shadow-sm font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    style={period === p.value && !from ? { color: BRAND } : undefined}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Desde</Label>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Hasta</Label>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-40"
                />
              </div>
              <Button variant="outline" size="sm" onClick={applyCustomRange} disabled={!from || !to}>
                Aplicar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {dashQ.isPending || !dashQ.data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-80" />
        </div>
      ) : (
        <FinanzasDashboardView data={dashQ.data} />
      )}

      {/* Tabs: Comisiones / Reportes */}
      <Tabs defaultValue="comisiones">
        <TabsList>
          <TabsTrigger value="comisiones">
            <Stethoscope className="h-4 w-4 mr-1" /> Comisiones
          </TabsTrigger>
          <TabsTrigger value="reportes">
            <FileBarChart className="h-4 w-4 mr-1" /> Reportes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comisiones" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <CardTitle className="text-base">Comisiones por podólogo</CardTitle>
                <div className="flex items-end gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Desde</Label>
                    <Input
                      type="date"
                      value={comisionFrom}
                      onChange={(e) => setComisionFrom(e.target.value)}
                      className="w-40"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Hasta</Label>
                    <Input
                      type="date"
                      value={comisionTo}
                      onChange={(e) => setComisionTo(e.target.value)}
                      className="w-40"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {comisionesQ.isPending || !comisionesQ.data ? (
                <Skeleton className="h-64 m-4" />
              ) : (
                <>
                  <div className="max-h-[420px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow>
                          <TableHead>Podólogo</TableHead>
                          <TableHead className="text-right">Consultas</TableHead>
                          <TableHead className="text-right">Total generado</TableHead>
                          <TableHead className="text-right">% Comisión</TableHead>
                          <TableHead className="text-right">Monto a pagar</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comisionesQ.data.rows.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                              Sin consultas pagadas en el periodo
                            </TableCell>
                          </TableRow>
                        )}
                        {comisionesQ.data.rows.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{r.name}</TableCell>
                            <TableCell className="text-right">{r.consultCount}</TableCell>
                            <TableCell className="text-right">{fmtMoney(r.totalGenerated)}</TableCell>
                            <TableCell className="text-right">{r.commissionPct}%</TableCell>
                            <TableCell className="text-right font-semibold" style={{ color: BRAND }}>
                              {fmtMoney(r.commissionAmount)}
                            </TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      {comisionesQ.data.rows.length > 0 && (
                        <tfoot>
                          <TableRow className="bg-muted/50 font-semibold">
                            <TableCell>TOTAL</TableCell>
                            <TableCell className="text-right">{comisionesQ.data.total.consultCount}</TableCell>
                            <TableCell className="text-right">{fmtMoney(comisionesQ.data.total.totalGenerated)}</TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-right" style={{ color: BRAND }}>
                              {fmtMoney(comisionesQ.data.total.commissionAmount)}
                            </TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        </tfoot>
                      )}
                    </Table>
                  </div>
                  <div className="p-3 border-t flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openReporte('comisiones')}
                    >
                      <Printer className="h-4 w-4 mr-1" /> Imprimir reporte
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reportes" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {REPORT_TYPES.map((r) => {
              const Icon = r.icon
              return (
                <Card key={r.value} className="shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => openReporte(r.value)}>
                  <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                    <div className="p-3 rounded-full" style={{ backgroundColor: 'rgba(10, 49, 67, 0.08)' }}>
                      <Icon className="h-6 w-6" style={{ color: BRAND }} />
                    </div>
                    <h3 className="font-medium text-sm">{r.label}</h3>
                    <Button size="sm" variant="outline" className="mt-1 w-full">
                      <FileBarChart className="h-3 w-3 mr-1" /> Generar
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
          <Card className="shadow-sm bg-muted/30">
            <CardContent className="p-4 text-sm text-muted-foreground">
              <p className="flex items-start gap-2">
                <Printer className="h-4 w-4 mt-0.5 shrink-0" />
                Los reportes se abren en una vista imprimible. Usa <kbd className="px-1 py-0.5 bg-background border rounded text-xs">Ctrl/Cmd + P</kbd> o el botón imprimir para exportar a PDF.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Diálogo: Reporte imprimible */}
      <Dialog open={reporteOpen} onOpenChange={setReporteOpen}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-4 pb-2 sticky top-0 bg-background z-10 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle>{reporteQ.data?.title || 'Reporte'}</DialogTitle>
              <Button size="sm" variant="outline" onClick={() => window.print()} disabled={!reporteQ.data}>
                <Printer className="h-4 w-4 mr-1" /> Imprimir
              </Button>
            </div>
          </DialogHeader>
          <div className="p-2">
            {reporteQ.isPending && <Skeleton className="h-96 m-4" />}
            {reporteQ.data && (
              <ReporteView
                data={reporteQ.data}
                clinicName={configQ.data?.clinic?.name || user?.clinicName || 'CENPOD'}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================
// Dashboard view con KPIs y charts
// ============================================================

function FinanzasDashboardView({ data }: { data: FinanzasDashboard }) {
  const { totals, byMethod, byPodologist, topServices, dailySeries, comparison } = data

  const pctBadge = (pct: number, inverse = false) => {
    const isUp = pct >= 0
    const isGood = inverse ? !isUp : isUp
    const color = isGood ? 'text-emerald-700 bg-emerald-100' : 'text-red-700 bg-red-100'
    return (
      <Badge variant="outline" className={`text-[10px] ${color}`}>
        {isUp ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
        {Math.abs(pct).toFixed(1)}% vs anterior
      </Badge>
    )
  }

  // Series para gráficos
  const methodPieData = [
    { name: 'Efectivo', value: byMethod.EFECTIVO },
    { name: 'Tarjeta', value: byMethod.TARJETA },
    { name: 'Transferencia', value: byMethod.TRANSFERENCIA },
    { name: 'Otro', value: byMethod.OTRO },
  ].filter((d) => d.value > 0)

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Ingresos"
          value={fmtMoney(totals.ingresos)}
          icon={TrendingUp}
          color="text-emerald-700 bg-emerald-50"
          badge={pctBadge(comparison.ingresosPct)}
        />
        <KpiCard
          label="Egresos"
          value={fmtMoney(totals.egresos)}
          icon={TrendingDown}
          color="text-red-700 bg-red-50"
          badge={pctBadge(comparison.egresosPct, true)}
        />
        <KpiCard
          label="Neto"
          value={fmtMoney(totals.neto)}
          icon={Wallet}
          color="text-[#0a3143] bg-[#0a3143]/10"
          badge={pctBadge(comparison.netoPct)}
        />
        <KpiCard
          label="Ingresos prev."
          value={fmtMoney(comparison.prevIngresos)}
          icon={BarChart3}
          color="text-slate-700 bg-slate-100"
          badge={<Badge variant="outline" className="text-[10px]">Periodo anterior</Badge>}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Ingresos vs Egresos — área chart */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Ingresos vs Egresos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailySeries}>
                  <defs>
                    <linearGradient id="gIng" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gEgr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="date" fontSize={10} tick={{ fill: '#666' }} />
                  <YAxis fontSize={10} tick={{ fill: '#666' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmtMoney(v)} contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area
                    type="monotone"
                    dataKey="ingresos"
                    name="Ingresos"
                    stroke="#16a34a"
                    fill="url(#gIng)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="egresos"
                    name="Egresos"
                    stroke="#dc2626"
                    fill="url(#gEgr)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Ingresos por método — pie */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Ingresos por método
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {methodPieData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Sin datos
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={methodPieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={40}
                      paddingAngle={2}
                      dataKey="value"
                      label={(e: any) => `${e.name}: ${fmtMoney(e.value)}`}
                      labelLine={false}
                      fontSize={10}
                    >
                      {methodPieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmtMoney(v)} contentStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts segunda fila */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Por podólogo */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Stethoscope className="h-4 w-4" /> Ingresos por podólogo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {byPodologist.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Sin datos en el periodo
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byPodologist}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="name" fontSize={10} tick={{ fill: '#666' }} />
                    <YAxis fontSize={10} tick={{ fill: '#666' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmtMoney(v)} contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="revenue" name="Ingresos" fill={BRAND} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top servicios */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileBarChart className="h-4 w-4" /> Top servicios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {topServices.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Sin servicios en el periodo
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topServices} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis type="number" fontSize={10} tick={{ fill: '#666' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" fontSize={10} width={120} tick={{ fill: '#666' }} />
                    <Tooltip formatter={(v: number) => fmtMoney(v)} contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="revenue" name="Ingresos" fill="#0891b2" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Desglose por método y categoría de egresos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Detalle por método</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <MethodRow icon={Banknote} label="Efectivo" value={byMethod.EFECTIVO} total={totals.ingresos} />
            <MethodRow icon={CreditCard} label="Tarjeta (débito + crédito)" value={byMethod.TARJETA} total={totals.ingresos} />
            <MethodRow icon={ArrowRightLeft} label="Transferencia" value={byMethod.TRANSFERENCIA} total={totals.ingresos} />
            <MethodRow icon={Wallet} label="Otro" value={byMethod.OTRO} total={totals.ingresos} />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Egresos por categoría</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(totals.egresosByCategory).length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">Sin egresos en el periodo</div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {Object.entries(totals.egresosByCategory)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, val]) => (
                    <div key={cat} className="flex items-center justify-between p-2 rounded border">
                      <span className="text-sm font-medium">{cat}</span>
                      <span className="text-sm font-semibold text-red-700">{fmtMoney(val)}</span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  badge,
}: {
  label: string
  value: string
  icon: any
  color: string
  badge?: React.ReactNode
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold truncate">{value}</p>
            {badge}
          </div>
          <div className={`p-2 rounded-lg ${color} shrink-0`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function MethodRow({
  icon: Icon,
  label,
  value,
  total,
}: {
  icon: any
  label: string
  value: number
  total: number
}) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-sm">
          <span>{label}</span>
          <span className="font-semibold">{fmtMoney(value)}</span>
        </div>
        <div className="h-1.5 bg-muted rounded overflow-hidden mt-1">
          <div className="h-full" style={{ width: `${pct}%`, backgroundColor: BRAND }} />
        </div>
      </div>
    </div>
  )
}
