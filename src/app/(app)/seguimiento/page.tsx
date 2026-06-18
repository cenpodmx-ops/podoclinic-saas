'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  HeartPulse, MessageCircle, CheckCircle2, CalendarClock, ExternalLink,
  AlertTriangle, Clock, CalendarDays, Filter,
} from 'lucide-react'
import Link from 'next/link'
import { STATUS_STYLE, type FollowUpRow, type SeguimientoResponse } from './_components/types'
import { fmtDate } from '@/lib/format'

export default function SeguimientoPage() {
  const qc = useQueryClient()
  const filter = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('status') : null

  const { data, isLoading } = useQuery({
    queryKey: ['seguimiento'],
    queryFn: async () => {
      const r = await fetch('/api/seguimiento')
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e.error || 'Error al cargar seguimientos')
      }
      return r.json() as Promise<SeguimientoResponse>
    },
  })

  const patchStatus = useMutation({
    mutationFn: async ({ id, status, whatsappSent }: { id: string; status?: string; whatsappSent?: boolean }) => {
      const r = await fetch(`/api/seguimiento/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, whatsappSent }),
      })
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e.error || 'Error al actualizar')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('Seguimiento actualizado')
      qc.invalidateQueries({ queryKey: ['seguimiento'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const sendWhatsapp = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/seguimiento/${id}/whatsapp`)
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e.error || 'Error al generar WhatsApp')
      }
      return r.json()
    },
    onSuccess: (data) => {
      if (data.waUrl) {
        window.open(data.waUrl, '_blank', 'noopener,noreferrer')
        toast.success('Abriendo WhatsApp...')
      } else {
        toast.error('El paciente no tiene teléfono válido')
      }
      qc.invalidateQueries({ queryKey: ['seguimiento'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HeartPulse className="h-6 w-6" style={{ color: '#0a3143' }} />
            Seguimiento Post-Consulta
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pacientes que requieren contacto post-atención.
          </p>
        </div>
        {data && (
          <FilterLinks active={filter || '__all'} total={data.total} counts={data.counts} />
        )}
      </div>

      {isLoading || !data ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : data.total === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            <HeartPulse className="h-10 w-10 mx-auto mb-2 opacity-40" />
            No hay seguimientos pendientes. ¡Todo al día!
          </CardContent>
        </Card>
      ) : filter && filter !== '__all' ? (
        // Vista filtrada: mostrar solo rows que coincidan
        <BucketSection
          title={bucketTitle(filter)}
          icon={bucketIcon(filter)}
          rows={filteredRows(data, filter)}
          patchStatus={patchStatus}
          sendWhatsapp={sendWhatsapp}
          emptyText="No hay seguimientos en este filtro."
        />
      ) : (
        <>
          {/* KPIs rápidos */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            <KPI label="Vencidos" value={data.counts.vencidos} color="text-red-700 bg-red-50" icon={AlertTriangle} />
            <KPI label="Hoy" value={data.counts.hoy} color="text-amber-700 bg-amber-50" icon={Clock} />
            <KPI label="Próximos 7 días" value={data.counts.proximos7} color="text-blue-700 bg-blue-50" icon={CalendarDays} />
            <KPI label="Futuros" value={data.counts.futuros} color="text-slate-700 bg-slate-50" icon={CalendarClock} />
            <KPI label="Contactados" value={data.counts.contactados} color="text-purple-700 bg-purple-50" icon={CheckCircle2} />
            <KPI label="Agendados" value={data.counts.agendados} color="text-emerald-700 bg-emerald-50" icon={CalendarClock} />
          </div>

          {/* Buckets */}
          {data.buckets.vencidos.length > 0 && (
            <BucketSection
              title="Vencidos"
              icon={AlertTriangle}
              rows={data.buckets.vencidos}
              patchStatus={patchStatus}
              sendWhatsapp={sendWhatsapp}
              accent="red"
            />
          )}
          {data.buckets.hoy.length > 0 && (
            <BucketSection
              title="Hoy"
              icon={Clock}
              rows={data.buckets.hoy}
              patchStatus={patchStatus}
              sendWhatsapp={sendWhatsapp}
              accent="amber"
            />
          )}
          {data.buckets.proximos7.length > 0 && (
            <BucketSection
              title="Próximos 7 días"
              icon={CalendarDays}
              rows={data.buckets.proximos7}
              patchStatus={patchStatus}
              sendWhatsapp={sendWhatsapp}
            />
          )}
          {data.buckets.futuros.length > 0 && (
            <BucketSection
              title="Futuros"
              icon={CalendarClock}
              rows={data.buckets.futuros}
              patchStatus={patchStatus}
              sendWhatsapp={sendWhatsapp}
            />
          )}
          {data.buckets.contactados.length > 0 && (
            <BucketSection
              title="Contactados"
              icon={CheckCircle2}
              rows={data.buckets.contactados}
              patchStatus={patchStatus}
              sendWhatsapp={sendWhatsapp}
            />
          )}
          {data.buckets.agendados.length > 0 && (
            <BucketSection
              title="Agendados"
              icon={CalendarClock}
              rows={data.buckets.agendados}
              patchStatus={patchStatus}
              sendWhatsapp={sendWhatsapp}
            />
          )}
        </>
      )}
    </div>
  )
}

function FilterLinks({
  active, total, counts,
}: {
  active: string
  total: number
  counts: SeguimientoResponse['counts']
}) {
  const items = [
    { key: '__all', label: `Todos (${total})` },
    { key: 'vencidos', label: `Vencidos (${counts.vencidos})` },
    { key: 'hoy', label: `Hoy (${counts.hoy})` },
    { key: 'proximos7', label: `7 días (${counts.proximos7})` },
  ]
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Filter className="h-3.5 w-3.5 text-muted-foreground" />
      {items.map((it) => (
        <Link
          key={it.key}
          href={it.key === '__all' ? '/seguimiento' : `/seguimiento?status=${it.key}`}
          className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
            active === it.key
              ? 'border-primary text-primary-foreground'
              : 'border-border text-muted-foreground hover:bg-muted'
          }`}
          style={active === it.key ? { backgroundColor: '#0a3143', borderColor: '#0a3143' } : undefined}
        >
          {it.label}
        </Link>
      ))}
    </div>
  )
}

function KPI({
  label, value, color, icon: Icon,
}: {
  label: string
  value: number
  color: string
  icon: any
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground truncate">{label}</p>
            <p className="text-xl font-bold">{value}</p>
          </div>
          <div className={`p-1.5 rounded-lg ${color}`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function BucketSection({
  title, icon: Icon, rows, patchStatus, sendWhatsapp, accent, emptyText,
}: {
  title: string
  icon: any
  rows: FollowUpRow[]
  patchStatus: any
  sendWhatsapp: any
  accent?: 'red' | 'amber'
  emptyText?: string
}) {
  if (!rows.length && emptyText) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {emptyText}
        </CardContent>
      </Card>
    )
  }
  if (!rows.length) return null

  const headerColor =
    accent === 'red' ? 'text-red-700'
    : accent === 'amber' ? 'text-amber-700'
    : 'text-foreground'

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={`text-base flex items-center gap-2 ${headerColor}`}>
          <Icon className="h-4 w-4" />
          {title}
          <Badge variant="secondary" className="ml-1">{rows.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[70vh] overflow-y-auto">
        {rows.map((f) => (
          <FollowUpCard
            key={f.id}
            f={f}
            patchStatus={patchStatus}
            sendWhatsapp={sendWhatsapp}
          />
        ))}
      </CardContent>
    </Card>
  )
}

function FollowUpCard({
  f, patchStatus, sendWhatsapp,
}: {
  f: FollowUpRow
  patchStatus: any
  sendWhatsapp: any
}) {
  const st = STATUS_STYLE[f.effectiveStatus] || STATUS_STYLE.PENDIENTE
  const podologo = f.consultation?.podologist?.name
  const diagnosis = f.consultation?.diagnosis

  return (
    <div className="rounded-lg border p-3 hover:bg-muted/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        {/* Info paciente */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className={`p-2 rounded-md border ${st.cls} shrink-0`}>
            <HeartPulse className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/pacientes/${f.patient.id}`}
                className="font-medium hover:underline"
              >
                {f.patient.firstName} {f.patient.lastName}
              </Link>
              <Badge variant="outline" className="text-[10px]">{f.patient.expNumber}</Badge>
              <Badge variant="outline" className={`text-[10px] ${st.cls}`}>{st.label}</Badge>
              {f.whatsappSent && (
                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300">
                  <MessageCircle className="h-3 w-3 mr-0.5" /> WhatsApp enviado
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
              <div className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                Vence: <span className={f.isOverdue ? 'text-red-700 font-medium' : ''}>{f.dueDateLabel}</span>
                {f.isOverdue && (
                  <span className="text-red-700 font-medium">· vencido hace {Math.abs(f.daysUntilDue)} días</span>
                )}
                {f.isToday && !f.isOverdue && (
                  <span className="text-amber-700 font-medium">· hoy</span>
                )}
                {!f.isOverdue && !f.isToday && f.daysUntilDue > 0 && (
                  <span>· en {f.daysUntilDue} días</span>
                )}
              </div>
              {f.consultation && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Consulta: {fmtDate(f.consultation.date)}
                  {podologo && ` · ${podologo}`}
                </div>
              )}
              {diagnosis && (
                <div className="text-[11px] italic">“{diagnosis.slice(0, 120)}{diagnosis.length > 120 ? '…' : ''}”</div>
              )}
              {f.notes && (
                <div className="text-[11px] italic text-amber-800">Nota: {f.notes}</div>
              )}
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-col sm:flex-row gap-1 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => sendWhatsapp.mutate(f.id)}
            disabled={sendWhatsapp.isPending}
            title="Enviar WhatsApp con plantilla de seguimiento"
          >
            <MessageCircle className="h-3.5 w-3.5 mr-1" style={{ color: '#25D366' }} />
            <span className="hidden sm:inline">WhatsApp</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => patchStatus.mutate({ id: f.id, status: 'CONTACTADO' })}
            disabled={patchStatus.isPending}
            title="Marcar contactado"
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            <span className="hidden sm:inline">Contactado</span>
          </Button>
          <Button
            size="sm"
            onClick={() => patchStatus.mutate({ id: f.id, status: 'AGENDADO' })}
            disabled={patchStatus.isPending}
            style={{ backgroundColor: '#0a3143' }}
            title="Marcar agendado"
          >
            <CalendarClock className="h-3.5 w-3.5 mr-1" />
            <span className="hidden sm:inline">Agendado</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

// Helpers para la vista filtrada
function bucketTitle(filter: string): string {
  switch (filter) {
    case 'vencidos': return 'Vencidos'
    case 'hoy': return 'Hoy'
    case 'proximos7': return 'Próximos 7 días'
    case 'futuros': return 'Futuros'
    case 'contactados': return 'Contactados'
    case 'agendados': return 'Agendados'
    default: return 'Seguimientos'
  }
}

function bucketIcon(filter: string): any {
  switch (filter) {
    case 'vencidos': return AlertTriangle
    case 'hoy': return Clock
    case 'proximos7': return CalendarDays
    case 'futuros': return CalendarClock
    case 'contactados': return CheckCircle2
    case 'agendados': return CalendarClock
    default: return HeartPulse
  }
}

function filteredRows(data: SeguimientoResponse, filter: string): FollowUpRow[] {
  const b = data.buckets as any
  return b[filter] || []
}
