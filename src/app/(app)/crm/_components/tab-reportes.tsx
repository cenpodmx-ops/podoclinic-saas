'use client'

import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  TrendingUp, Users, Repeat, Megaphone, AlertTriangle, UserPlus,
} from 'lucide-react'
import type { ReporteResponse } from './types'

export function TabReportes() {
  const { data, isLoading } = useQuery({
    queryKey: ['crm-reportes'],
    queryFn: async () => {
      const r = await fetch('/api/crm/reportes?months=6')
      if (!r.ok) throw new Error('Error al cargar reportes')
      return r.json() as Promise<ReporteResponse>
    },
  })

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
        <Skeleton className="h-64 lg:col-span-3" />
      </div>
    )
  }

  const kpis = [
    {
      label: 'Retención',
      value: `${data.retencionRate}%`,
      sub: `${data.recurrentesPeriodo} de ${data.activosPeriodo} activos`,
      icon: Repeat,
      color: 'text-emerald-700 bg-emerald-50',
    },
    {
      label: 'Pacientes activos',
      value: data.activosPeriodo,
      sub: `últimos ${data.period.months} meses`,
      icon: Users,
      color: 'text-blue-700 bg-blue-50',
    },
    {
      label: 'Nuevos del periodo',
      value: data.nuevosPeriodo,
      sub: `${data.nuevosHoy} hoy`,
      icon: UserPlus,
      color: 'text-purple-700 bg-purple-50',
    },
    {
      label: 'Efectividad campañas',
      value: `${data.efectividadCampana}%`,
      sub: `${data.leads.agendados} de ${data.leads.total} leads`,
      icon: Megaphone,
      color: 'text-amber-700 bg-amber-50',
    },
    {
      label: 'Riesgo abandono',
      value: data.riesgoAbandono,
      sub: 'pacientes en riesgo',
      icon: AlertTriangle,
      color: 'text-red-700 bg-red-50',
    },
    {
      label: 'Total pacientes',
      value: data.totalPacientes,
      sub: 'en la base',
      icon: TrendingUp,
      color: 'text-slate-700 bg-slate-50',
    },
  ]

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.label} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{kpi.label}</p>
                    <p className="text-2xl font-bold mt-1">{kpi.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 truncate">{kpi.sub}</p>
                  </div>
                  <div className={`p-2 rounded-lg shrink-0 ${kpi.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Gráfica nuevos vs recurrentes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Nuevos vs Recurrentes (últimos {data.period.months} meses)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byMonth} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255,255,255,0.95)',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="nuevos" name="Nuevos" fill="#0a3143" radius={[4, 4, 0, 0]} />
                <Bar dataKey="recurrentes" name="Recurrentes" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Leads pipeline */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">Leads totales</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.leads.total}</p>
            <p className="text-xs text-muted-foreground mt-1">acumulados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Contactados</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.leads.contactados}</p>
            <p className="text-xs text-muted-foreground mt-1">en gestión</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Agendados</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.leads.agendados}</p>
            <p className="text-xs text-muted-foreground mt-1">convertidos a pacientes</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
