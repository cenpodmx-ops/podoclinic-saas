'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LineChart, Line, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { CalendarPlus, UserPlus, CalendarDays, DollarSign, Package, TrendingUp, Bell, Clock } from 'lucide-react'
import Link from 'next/link'
import { fmtMoney } from '@/lib/format'

export default function DashboardPage() {
  const { data, isPending } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => fetch('/api/dashboard').then((r) => r.json()),
  })

  if (isPending || !data) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  const k = data.kpis || {}
  const upcoming = data.upcoming || []
  const revenueSeries = data.revenueSeries || []
  const topServices = data.topServices || []
  const byPodologist = data.byPodologist || []
  // Defaults seguros para todos los KPIs
  const safeK = {
    citasHoy: k.citasHoy ?? 0,
    pendientes: k.pendientes ?? 0,
    confirmadas: k.confirmadas ?? 0,
    finalizadas: k.finalizadas ?? 0,
    canceladas: k.canceladas ?? 0,
    noAsistio: k.noAsistio ?? 0,
    ingresosHoy: k.ingresosHoy ?? 0,
    productosHoy: k.productosHoy ?? 0,
    pacientesNuevosHoy: k.pacientesNuevosHoy ?? 0,
    monthRevenue: k.monthRevenue ?? 0,
    monthAppts: k.monthAppts ?? 0,
    monthFinalized: k.monthFinalized ?? 0,
    unreadMessages: k.unreadMessages ?? 0,
  }
  const kpis = [
    { label: 'Citas hoy', value: safeK.citasHoy, sub: `${safeK.finalizadas} finalizadas`, icon: CalendarDays, color: 'text-blue-700 bg-blue-50' },
    { label: 'Ingresos hoy', value: fmtMoney(safeK.ingresosHoy), sub: `${fmtMoney(safeK.monthRevenue)} este mes`, icon: DollarSign, color: 'text-emerald-700 bg-emerald-50' },
    { label: 'Productos vendidos', value: safeK.productosHoy, sub: 'hoy en consultas', icon: Package, color: 'text-amber-700 bg-amber-50' },
    { label: 'Pacientes nuevos', value: safeK.pacientesNuevosHoy, sub: 'hoy', icon: UserPlus, color: 'text-purple-700 bg-purple-50' },
    { label: 'Pendientes', value: safeK.pendientes, sub: 'citas por confirmar', icon: Clock, color: 'text-orange-700 bg-orange-50' },
    { label: 'Confirmadas', value: safeK.confirmadas, sub: 'listas para hoy', icon: CalendarDays, color: 'text-emerald-700 bg-emerald-50' },
    { label: 'No asistió', value: safeK.noAsistio, sub: 'hoy', icon: CalendarDays, color: 'text-red-700 bg-red-50' },
    { label: 'Mensajes Red', value: safeK.unreadMessages, sub: 'sin leer', icon: Bell, color: 'text-slate-700 bg-slate-50' },
  ]

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {data.clinicName} · {new Date().toLocaleDateString('es-MX', { timeZone: 'America/Hermosillo', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/agenda?nueva=1">
            <Button size="sm" style={{ backgroundColor: '#0a3143' }}>
              <CalendarPlus className="h-4 w-4 mr-1" /> Nueva cita
            </Button>
          </Link>
          <Link href="/pacientes?nuevo=1">
            <Button size="sm" variant="outline">
              <UserPlus className="h-4 w-4 mr-1" /> Nuevo paciente
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.label} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    <p className="text-2xl font-bold mt-1">{kpi.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{kpi.sub}</p>
                  </div>
                  <div className={`p-2 rounded-lg ${kpi.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Ingresos últimos 30 días
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="date" fontSize={10} tick={{ fill: '#666' }} />
                  <YAxis fontSize={10} tick={{ fill: '#666' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmtMoney(v)} contentStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="total" stroke="#0a3143" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> Próximas 2 horas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {upcoming.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Sin citas próximas</p>
              )}
              {upcoming.map((u: any) => (
                <div key={u.id} className="flex items-center justify-between p-2 rounded border">
                  <div>
                    <p className="text-sm font-medium">{u.paciente}</p>
                    <p className="text-xs text-muted-foreground">{u.podologo}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono">{u.hora}</p>
                    <Badge variant="outline" className="text-[10px]">{u.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Servicios más vendidos del mes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topServices} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis type="number" fontSize={10} tick={{ fill: '#666' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" fontSize={10} width={100} tick={{ fill: '#666' }} />
                  <Tooltip formatter={(v: number) => fmtMoney(v)} contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="revenue" fill="#0a3143" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Citas de hoy por podólogo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {byPodologist.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Sin citas hoy</p>
              )}
              {byPodologist.map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2 rounded border">
                  <span className="text-sm font-medium">{p.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{p.done}/{p.total}</Badge>
                    <div className="w-24 h-2 bg-muted rounded overflow-hidden">
                      <div
                        className="h-full"
                        style={{ width: `${p.total ? (p.done / p.total) * 100 : 0}%`, backgroundColor: '#0a3143' }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
