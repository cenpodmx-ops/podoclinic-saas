'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { toast } from 'sonner'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Star,
  Pencil,
  FileDown,
  Gauge,
  CheckCircle2,
  Calendar,
} from 'lucide-react'
import { fmtMoney, fmtDate } from '@/lib/format'
import { format, parseISO, subMonths } from 'date-fns'

type EvalRow = {
  podologistId: string
  name: string
  specialty: string | null
  photoUrl: string | null
  commissionPct: number
  period: string
  consultsDone: number
  consultsCancelled: number
  consultsNoShow: number
  cancellationRate: number
  revenue: number
  avgValue: number
  googleReviews: number
  goalConsults: number
  goalRevenue: number
  progressConsults: number
  progressRevenue: number
}

type Reporte = {
  podologist: {
    id: string
    name: string
    specialty: string | null
    cedula: string | null
    certNumber: string | null
    photoUrl: string | null
    commissionPct: number
  }
  clinic: { id: string; name: string }
  period: string
  periodLabel: string
  metrics: EvalRow
  trend: { period: string; consults: number; revenue: number }[]
  appointments: {
    id: string
    date: string
    startTime: string
    status: string
    patient: string
    exp: string | null
    serviceName: string | null
  }[]
  recentConsults: { id: string; date: string; total: number; paymentMethod: string | null }[]
}

export default function EvaluacionPage() {
  const [period, setPeriod] = useState(() => format(new Date(), 'yyyy-MM'))
  const [selectedPod, setSelectedPod] = useState<EvalRow | null>(null)
  const [editGoalsFor, setEditGoalsFor] = useState<EvalRow | null>(null)
  const [printReport, setPrintReport] = useState<Reporte | null>(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['evaluaciones', period],
    queryFn: async () => {
      const r = await fetch(`/api/evaluaciones?period=${period}`)
      if (!r.ok) throw new Error('Error al cargar evaluaciones')
      return r.json()
    },
  })

  const rows: EvalRow[] = data?.rows || []

  const shiftPeriod = (delta: number) => {
    const d = parseISO(`${period}-01`)
    setPeriod(format(subMonths(d, -delta), 'yyyy-MM'))
  }

  const comparativeData = useMemo(
    () =>
      rows.map((r) => ({
        name: r.name.split(' ')[0],
        ingresos: Math.round(r.revenue),
        consultas: r.consultsDone,
      })),
    [rows],
  )

  const openDetail = async (row: EvalRow) => {
    setSelectedPod(row)
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1500px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gauge className="h-6 w-6" style={{ color: '#0a3143' }} />
            Evaluación de Podólogos
          </h1>
          <p className="text-sm text-muted-foreground">
            Indicadores de desempeño por periodo mensual
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shiftPeriod(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 px-3 py-1.5 border rounded-md bg-background">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="border-0 p-0 h-auto w-[150px] focus-visible:ring-0"
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => shiftPeriod(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setPeriod(format(new Date(), 'yyyy-MM'))}>
            Hoy
          </Button>
        </div>
      </div>

      {/* KPIs globales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Podólogos activos"
          value={String(rows.length)}
          icon={Gauge}
          color="text-white"
          bg="#0a3143"
        />
        <KpiCard
          label="Consultas del periodo"
          value={String(rows.reduce((s, r) => s + r.consultsDone, 0))}
          icon={CheckCircle2}
          color="text-emerald-700 bg-emerald-50"
        />
        <KpiCard
          label="Ingresos del periodo"
          value={fmtMoney(rows.reduce((s, r) => s + r.revenue, 0))}
          icon={TrendingUp}
          color="text-amber-700 bg-amber-50"
        />
        <KpiCard
          label="Reseñas Google"
          value={String(rows.reduce((s, r) => s + r.googleReviews, 0))}
          icon={Star}
          color="text-purple-700 bg-purple-50"
        />
      </div>

      {/* Tabla principal */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Desempeño por podólogo · {period}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No hay podólogos activos en esta clínica para este periodo.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background">Podólogo</TableHead>
                    <TableHead className="text-center">Hechas</TableHead>
                    <TableHead className="text-center">Canceladas</TableHead>
                    <TableHead className="text-center">No asistió</TableHead>
                    <TableHead className="text-right">Ingresos</TableHead>
                    <TableHead className="text-right">Ticket prom.</TableHead>
                    <TableHead className="text-center">Reseñas</TableHead>
                    <TableHead className="min-w-[180px]">Meta consultas</TableHead>
                    <TableHead className="min-w-[180px]">Meta ingresos</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow
                      key={r.podologistId}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => openDetail(r)}
                    >
                      <TableCell className="sticky left-0 bg-background">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            {r.photoUrl ? (
                              <img src={r.photoUrl} alt={r.name} className="h-8 w-8 rounded-full object-cover" />
                            ) : (
                              <AvatarFallback className="text-xs" style={{ backgroundColor: '#0a3143', color: '#fff' }}>
                                {r.name.split(' ').slice(0, 2).map((s) => s[0]).join('')}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm">{r.name}</div>
                            {r.specialty && (
                              <div className="text-[10px] text-muted-foreground">{r.specialty}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-semibold">{r.consultsDone}</TableCell>
                      <TableCell className="text-center">
                        {r.consultsCancelled > 0 ? (
                          <Badge variant="outline" className="text-red-700 border-red-300">{r.consultsCancelled}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {r.consultsNoShow > 0 ? (
                          <Badge variant="outline" className="text-orange-700 border-orange-300">{r.consultsNoShow}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">{fmtMoney(r.revenue)}</TableCell>
                      <TableCell className="text-right text-sm">{fmtMoney(r.avgValue)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="gap-1">
                          <Star className="h-3 w-3 text-amber-500" />
                          {r.googleReviews}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <GoalBar value={r.progressConsults} current={r.consultsDone} goal={r.goalConsults} unit="" />
                      </TableCell>
                      <TableCell>
                        <GoalBar value={r.progressRevenue} current={r.revenue} goal={r.goalRevenue} unit="$" />
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditGoalsFor(r)}
                            title="Editar metas / reseñas"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setPrintReport(null); printReportFor(r, setPrintReport) }}
                            title="Descargar reporte PDF"
                          >
                            <FileDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chart comparativo */}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Comparativo de ingresos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparativeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="name" fontSize={11} tick={{ fill: '#666' }} />
                    <YAxis fontSize={10} tick={{ fill: '#666' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmtMoney(v)} contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="ingresos" name="Ingresos" fill="#0a3143" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Comparativo de consultas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparativeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="name" fontSize={11} tick={{ fill: '#666' }} />
                    <YAxis fontSize={10} tick={{ fill: '#666' }} allowDecimals={false} />
                    <Tooltip formatter={(v: number) => `${v} consultas`} contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="consultas" name="Consultas" fill="#15803d" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dialog: detalle del podólogo */}
      <PodologistDetailDialog
        pod={selectedPod}
        period={period}
        onClose={() => setSelectedPod(null)}
        onEditGoals={(p) => {
          setEditGoalsFor(p)
          setSelectedPod(null)
        }}
        onPrintReport={async (p) => {
          await printReportFor(p, setPrintReport)
          setSelectedPod(null)
        }}
      />

      {/* Dialog: editar metas */}
      <EditGoalsDialog
        pod={editGoalsFor}
        period={period}
        onClose={() => setEditGoalsFor(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ['evaluaciones', period] })
          setEditGoalsFor(null)
        }}
      />

      {/* Dialog: vista de impresión del reporte */}
      <ReportPrintDialog report={printReport} onClose={() => setPrintReport(null)} />
    </div>
  )
}

async function printReportFor(
  pod: EvalRow,
  setPrintReport: (r: Reporte | null) => void,
) {
  try {
    const r = await fetch(`/api/evaluaciones/reporte?podologistId=${pod.podologistId}&period=${pod.period}`)
    if (!r.ok) throw new Error('Error al cargar reporte')
    const data: Reporte = await r.json()
    setPrintReport(data)
  } catch (e: any) {
    toast.error(e.message || 'Error al cargar reporte')
  }
}

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
}: {
  label: string
  value: string
  icon: any
  color: string
  bg?: string
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold mt-1">{value}</p>
          </div>
          <div className={`p-2 rounded-lg ${color}`} style={bg ? { backgroundColor: bg } : undefined}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function GoalBar({
  value,
  current,
  goal,
  unit,
}: {
  value: number
  current: number
  goal: number
  unit: string
}) {
  const display = unit === '$' ? fmtMoney(current) : `${current}`
  const goalDisplay = unit === '$' ? fmtMoney(goal) : `${goal}`
  const color = value >= 100 ? '#15803d' : value >= 60 ? '#d97706' : '#dc2626'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="font-medium">{display}</span>
        <span className="text-muted-foreground">/ {goalDisplay}</span>
      </div>
      <div className="h-1.5 bg-muted rounded overflow-hidden">
        <div className="h-full transition-all" style={{ width: `${Math.min(100, value)}%`, backgroundColor: color }} />
      </div>
      <div className="text-[10px] text-right" style={{ color }}>
        {value}%
      </div>
    </div>
  )
}

function PodologistDetailDialog({
  pod,
  period,
  onClose,
  onEditGoals,
  onPrintReport,
}: {
  pod: EvalRow | null
  period: string
  onClose: () => void
  onEditGoals: (p: EvalRow) => void
  onPrintReport: (p: EvalRow) => void
}) {
  const { data: reporte, isLoading } = useQuery({
    queryKey: ['evaluacion-reporte', pod?.podologistId, period],
    queryFn: async () => {
      const r = await fetch(`/api/evaluaciones/reporte?podologistId=${pod!.podologistId}&period=${period}`)
      if (!r.ok) throw new Error('Error al cargar reporte')
      return r.json() as Promise<Reporte>
    },
    enabled: !!pod,
  })

  return (
    <Dialog open={!!pod} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {pod && (
              <>
                <Avatar className="h-9 w-9">
                  {pod.photoUrl ? (
                    <img src={pod.photoUrl} alt={pod.name} className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <AvatarFallback className="text-xs" style={{ backgroundColor: '#0a3143', color: '#fff' }}>
                      {pod.name.split(' ').slice(0, 2).map((s) => s[0]).join('')}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div>
                  <div>{pod.name}</div>
                  <div className="text-xs font-normal text-muted-foreground">
                    {pod.specialty || 'Podólogo'} · Periodo {period}
                  </div>
                </div>
              </>
            )}
          </DialogTitle>
          <DialogDescription>Detalle de desempeño mensual e histórico</DialogDescription>
        </DialogHeader>

        {isLoading || !reporte ? (
          <div className="space-y-2 py-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <MiniStat label="Consultas hechas" value={String(reporte.metrics.consultsDone)} />
              <MiniStat label="Ingresos" value={fmtMoney(reporte.metrics.revenue)} />
              <MiniStat label="Ticket promedio" value={fmtMoney(reporte.metrics.avgValue)} />
              <MiniStat label="Reseñas Google" value={String(reporte.metrics.googleReviews)} />
              <MiniStat label="Meta consultas" value={`${reporte.metrics.goalConsults}`} sub={`${reporte.metrics.progressConsults}%`} />
              <MiniStat label="Meta ingresos" value={fmtMoney(reporte.metrics.goalRevenue)} sub={`${reporte.metrics.progressRevenue}%`} />
              <MiniStat label="Cancelaciones" value={`${reporte.metrics.consultsCancelled}`} sub={`${reporte.metrics.cancellationRate}%`} />
              <MiniStat label="No asistió" value={`${reporte.metrics.consultsNoShow}`} />
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Tendencia últimos 6 meses
              </h4>
              <div className="h-48 border rounded-md p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={reporte.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="period" fontSize={10} tick={{ fill: '#666' }} />
                    <YAxis fontSize={10} tick={{ fill: '#666' }} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="consults" name="Consultas" stroke="#0a3143" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="revenue" name="Ingresos" stroke="#15803d" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Citas del periodo ({reporte.appointments.length})</h4>
              <div className="max-h-48 overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Servicio</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reporte.appointments.slice(0, 20).map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-xs">{fmtDate(a.date)}</TableCell>
                        <TableCell className="text-xs">{a.patient}</TableCell>
                        <TableCell className="text-xs">{a.serviceName || '—'}</TableCell>
                        <TableCell className="text-right text-xs">{a.status}</TableCell>
                      </TableRow>
                    ))}
                    {reporte.appointments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground text-sm">
                          Sin citas en este periodo
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => pod && onEditGoals(pod)}>
                <Pencil className="h-4 w-4 mr-1" /> Editar metas
              </Button>
              <Button size="sm" onClick={() => pod && onPrintReport(pod)} style={{ backgroundColor: '#0a3143' }}>
                <FileDown className="h-4 w-4 mr-1" /> Descargar reporte PDF
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border rounded-md p-2 bg-muted/30">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-sm font-bold mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  )
}

function EditGoalsDialog({
  pod,
  period,
  onClose,
  onSaved,
}: {
  pod: EvalRow | null
  period: string
  onClose: () => void
  onSaved: () => void
}) {
  const [googleReviews, setGoogleReviews] = useState('')
  const [goalConsults, setGoalConsults] = useState('')
  const [goalRevenue, setGoalRevenue] = useState('')
  const [saving, setSaving] = useState(false)

  // Reset al abrir
  useEffect(() => {
    if (pod) {
      setGoogleReviews(String(pod.googleReviews))
      setGoalConsults(pod.goalConsults ? String(pod.goalConsults) : '')
      setGoalRevenue(pod.goalRevenue ? String(pod.goalRevenue) : '')
    }
  }, [pod])

  const save = async () => {
    if (!pod) return
    setSaving(true)
    try {
      const r = await fetch(`/api/evaluaciones/${pod.podologistId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period,
          googleReviews: Number(googleReviews) || 0,
          goalConsults: goalConsults === '' ? null : Number(goalConsults),
          goalRevenue: goalRevenue === '' ? null : Number(goalRevenue),
        }),
      })
      if (!r.ok) {
        const e = await r.json()
        throw new Error(e.error || 'Error al guardar')
      }
      toast.success('Metas actualizadas')
      onSaved()
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!pod} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar metas · {pod?.name}</DialogTitle>
          <DialogDescription>
            Periodo {period}. Las metas se guardan a nivel del podólogo y se reutilizan en futuros periodos si no se sobreescriben.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Reseñas Google del periodo</Label>
            <Input
              type="number"
              min="0"
              value={googleReviews}
              onChange={(e) => setGoogleReviews(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <Label className="text-xs">Meta de consultas (mensual)</Label>
            <Input
              type="number"
              min="0"
              value={goalConsults}
              onChange={(e) => setGoalConsults(e.target.value)}
              placeholder="Ej. 80"
            />
          </div>
          <div>
            <Label className="text-xs">Meta de ingresos (mensual)</Label>
            <Input
              type="number"
              min="0"
              value={goalRevenue}
              onChange={(e) => setGoalRevenue(e.target.value)}
              placeholder="Ej. 50000"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Si vacío, se usa la meta del podólogo.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving} style={{ backgroundColor: '#0a3143' }}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReportPrintDialog({ report, onClose }: { report: Reporte | null; onClose: () => void }) {
  return (
    <Dialog open={!!report} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reporte de evaluación</DialogTitle>
          <DialogDescription>
            {report?.podologist.name} · {report?.period}
          </DialogDescription>
        </DialogHeader>
        {report && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <PrintStat label="Consultas hechas" value={String(report.metrics.consultsDone)} />
              <PrintStat label="Ingresos" value={fmtMoney(report.metrics.revenue)} />
              <PrintStat label="Ticket promedio" value={fmtMoney(report.metrics.avgValue)} />
              <PrintStat label="Canceladas" value={String(report.metrics.consultsCancelled)} />
              <PrintStat label="No asistió" value={String(report.metrics.consultsNoShow)} />
              <PrintStat label="Reseñas Google" value={String(report.metrics.googleReviews)} />
              <PrintStat label="Meta consultas" value={`${report.metrics.goalConsults} (${report.metrics.progressConsults}%)`} />
              <PrintStat label="Meta ingresos" value={`${fmtMoney(report.metrics.goalRevenue)} (${report.metrics.progressRevenue}%)`} />
              <PrintStat label="Tasa cancelación" value={`${report.metrics.cancellationRate}%`} />
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Tendencia (6 meses)</h4>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={report.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="period" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="consults" name="Consultas" stroke="#0a3143" strokeWidth={2} />
                    <Line type="monotone" dataKey="revenue" name="Ingresos" stroke="#15803d" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={onClose}>Cerrar</Button>
              <Button onClick={() => window.print()} style={{ backgroundColor: '#0a3143' }}>
                <FileDown className="h-4 w-4 mr-1" /> Imprimir / Guardar PDF
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function PrintStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-md p-2 bg-muted/30">
      <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
      <div className="text-sm font-bold mt-0.5">{value}</div>
    </div>
  )
}
