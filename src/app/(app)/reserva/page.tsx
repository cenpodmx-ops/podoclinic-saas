'use client'

import { useQuery } from '@tanstack/react-query'
import { useSyncExternalStore, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Copy,
  ExternalLink,
  QrCode,
  Link2,
  CalendarCheck,
  Clock,
  CheckCircle2,
  Globe,
  Building2,
} from 'lucide-react'

const BRAND = 'var(--primary)'

type ClinicOption = { id: string; name: string; slug: string }

export default function ReservaConfigPage() {
  const { data: clinicsData, isLoading: clinicsLoading } = useQuery({
    queryKey: ['clinicas'],
    queryFn: () => fetch('/api/clinicas').then((r) => r.json()),
  })

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['reserva-stats'],
    queryFn: () => fetch('/api/reserva/stats').then((r) => r.json()),
  })

  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => '',
  )

  const clinics: ClinicOption[] = clinicsData?.data || []
  const generalUrl = origin ? `${origin}/reservar` : '/reservar'

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Link2 className="h-6 w-6" style={{ color: BRAND }} />
          Link de Reserva Pública
        </h1>
        <p className="text-sm text-muted-foreground">
          Comparte este link con tus pacientes para que agenden sus citas desde el celular.
          No requiere inicio de sesión.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Reservas web este mes"
          value={statsLoading ? null : stats?.thisMonth ?? 0}
          icon={CalendarCheck}
        />
        <KpiCard
          label="Confirmadas"
          value={statsLoading ? null : stats?.thisMonthConfirmed ?? 0}
          icon={CheckCircle2}
          color="text-emerald-700 bg-emerald-50"
        />
        <KpiCard
          label="Pendientes"
          value={statsLoading ? null : stats?.thisMonthPending ?? 0}
          icon={Clock}
          color="text-amber-700 bg-amber-50"
        />
        <KpiCard
          label="Total histórico"
          value={statsLoading ? null : stats?.total ?? 0}
          icon={Globe}
          color="text-slate-700 bg-slate-100"
        />
      </div>

      {/* Link general */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" /> Link general
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            El paciente elige la sucursal al abrir el link.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-[1fr_auto_auto] gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">URL</label>
              <Input
                readOnly
                value={generalUrl}
                className="font-mono text-sm bg-slate-50"
                onFocus={(e) => e.target.select()}
              />
            </div>
            <CopyButton text={generalUrl} label="Copiar" />
            <a href="/reservar" target="_blank" rel="noreferrer">
              <Button variant="outline" className="w-full md:w-auto">
                <ExternalLink className="h-4 w-4 mr-1" /> Abrir
              </Button>
            </a>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
            <div className="rounded-xl border border-slate-200 p-3 bg-white">
              <QrCode className="h-3 w-3 text-slate-400 mb-1" />
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(generalUrl)}`}
                alt="QR general"
                width={180}
                height={180}
                className="rounded"
              />
            </div>
            <div className="text-sm text-muted-foreground flex-1">
              <p className="font-medium text-slate-900 mb-1">Cómo usarlo</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Imprime este QR en tu recepción o tarjetas de presentación.</li>
                <li>Compártelo por WhatsApp cuando un paciente te pregunte por cita.</li>
                <li>Ponlo en tu perfil de Instagram/Facebook.</li>
                <li>Las reservas llegan con estado <Badge variant="outline" className="text-[10px]">PENDIENTE</Badge> a la agenda.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Links por sucursal */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Links por sucursal
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            El paciente entra directamente a la sucursal elegida, sin paso de selección.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {clinicsLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
          ) : clinics.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No hay clínicas configuradas.
            </p>
          ) : (
            clinics.map((c) => {
              const url = origin ? `${origin}/reservar/${c.slug}` : `/reservar/${c.slug}`
              const monthCount = stats?.byClinic?.find((b: { clinicId: string }) => b.clinicId === c.id)?.count
              return (
                <div
                  key={c.id}
                  className="rounded-xl border border-slate-200 p-4 flex flex-col md:flex-row md:items-center gap-4"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: BRAND }}
                    >
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900">{c.name}</p>
                        {typeof monthCount === 'number' && (
                          <Badge variant="secondary" className="text-[10px]">
                            {monthCount} este mes
                          </Badge>
                        )}
                      </div>
                      <Input
                        readOnly
                        value={url}
                        className="font-mono text-xs mt-1.5 bg-slate-50 h-8"
                        onFocus={(e) => e.target.select()}
                      />
                      <div className="flex gap-2 mt-2">
                        <CopyButton text={url} label="Copiar" small />
                        <a href={`/reservar/${c.slug}`} target="_blank" rel="noreferrer">
                          <Button variant="outline" size="sm">
                            <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir
                          </Button>
                        </a>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(url)}`}
                      alt={`QR ${c.name}`}
                      width={120}
                      height={120}
                      className="rounded border border-slate-200"
                    />
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Nota informativa */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-medium mb-1">¿Cómo funcionan las reservas web?</p>
        <ol className="list-decimal list-inside space-y-1 text-xs text-blue-800">
          <li>El paciente entra al link desde su celular (no necesita cuenta).</li>
          <li>Elige sucursal, podólogo, día y uno de los horarios disponibles.</li>
          <li>El sistema solo muestra 2–3 horarios por día (no toda la agenda).</li>
          <li>Registra sus datos y confirma la cita.</li>
          <li>La cita aparece en tu agenda con estado <strong>PENDIENTE</strong> y origen <strong>WEB</strong>.</li>
          <li>Se le ofrece un botón de WhatsApp para avisar a la clínica y confirmar su asistencia.</li>
        </ol>
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  icon: Icon,
  color = 'text-primary bg-[#0a3143]/10',
}: {
  label: string
  value: number | null
  icon: typeof CalendarCheck
  color?: string
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">
              {value === null ? <Skeleton className="h-7 w-10" /> : value}
            </p>
          </div>
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CopyButton({ text, label, small }: { text: string; label: string; small?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant={small ? 'outline' : 'default'}
      size={small ? 'sm' : 'default'}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          toast.success('Link copiado al portapapeles')
          setTimeout(() => setCopied(false), 1800)
        } catch {
          toast.error('No se pudo copiar. Cópialo manualmente.')
        }
      }}
      style={small ? undefined : { backgroundColor: BRAND }}
    >
      <Copy className={small ? 'h-3.5 w-3.5 mr-1' : 'h-4 w-4 mr-1'} />
      {copied ? '¡Copiado!' : label}
    </Button>
  )
}
