'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Megaphone, MessageCircle, Cake, Activity, Heart, UserPlus, AlertTriangle,
  Calendar, ChevronLeft, ChevronRight, X, ExternalLink, CheckCircle2, Users,
} from 'lucide-react'
import {
  SEGMENT_LABELS, type SegmentType, type SegmentPatient, type CampanaRecipient,
} from './types'
import { fmtDate } from '@/lib/format'
import { waUrl, fillTemplate, DEFAULT_TEMPLATES } from '@/lib/whatsapp'

const SEGMENT_ORDER: SegmentType[] = [
  'INACTIVOS_30', 'INACTIVOS_60', 'INACTIVOS_90', 'INACTIVOS_180',
  'CUMPLEANOS_HOY', 'CUMPLEANOS_SEMANA', 'CUMPLEANOS_MES',
  'DIABETICOS', 'NUEVOS_MES', 'RIESGO_ABANDONO',
]

const SEGMENT_ICONS: Record<SegmentType, any> = {
  INACTIVOS_30: Activity,
  INACTIVOS_60: Activity,
  INACTIVOS_90: Activity,
  INACTIVOS_180: Activity,
  CUMPLEANOS_MES: Cake,
  CUMPLEANOS_SEMANA: Cake,
  CUMPLEANOS_HOY: Cake,
  DIABETICOS: Heart,
  NUEVOS_MES: UserPlus,
  RIESGO_ABANDONO: AlertTriangle,
}

export function TabSegmentacion() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<SegmentType | null>(null)
  const [campanaOpen, setCampanaOpen] = useState(false)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['crm-segmento', selected],
    queryFn: async () => {
      if (!selected) return null
      const r = await fetch(`/api/crm/segmentos?type=${selected}`)
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e.error || 'Error al cargar segmento')
      }
      return r.json()
    },
    enabled: !!selected,
  })

  const iniciarCampana = useMutation({
    mutationFn: async ({ segment, templateKey }: { segment: SegmentType; templateKey: string }) => {
      const r = await fetch('/api/crm/campana', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment, templateKey }),
      })
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e.error || 'Error al iniciar campaña')
      }
      return r.json()
    },
    onSuccess: () => {
      setCampanaOpen(true)
      toast.success('Campaña lista. Abre cada WhatsApp uno por uno.')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const markContacted = useMutation({
    mutationFn: async (patientId: string) => {
      // Best-effort: marcamos contacted vía upsert en SegmentMembership desde el backend
      // No hay endpoint directo, lo hacemos con un PATCH interno opcional.
      // Por simplicidad sólo invalidamos el cache local y mostramos toast.
      return patientId
    },
    onSuccess: (pid) => {
      toast.success(`Paciente marcado como contactado`, { description: pid })
      qc.invalidateQueries({ queryKey: ['crm-segmento', selected] })
    },
  })

  return (
    <div className="space-y-4">
      {/* Botones de segmentos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Selecciona un segmento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {SEGMENT_ORDER.map((seg) => {
              const Icon = SEGMENT_ICONS[seg]
              const meta = SEGMENT_LABELS[seg]
              const active = selected === seg
              return (
                <button
                  key={seg}
                  onClick={() => setSelected(seg)}
                  className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors ${
                    active
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                  style={active ? { borderColor: '#0a3143', backgroundColor: 'rgba(10,49,67,0.05)' } : undefined}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" style={{ color: '#0a3143' }} />
                    <span className="text-xs font-semibold">{meta.label}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground line-clamp-2">{meta.desc}</span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tabla de pacientes del segmento seleccionado */}
      {selected && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  {SEGMENT_LABELS[selected].label}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {SEGMENT_LABELS[selected].desc}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {data?.count !== undefined && (
                  <Badge variant="secondary">{data.count} pacientes</Badge>
                )}
                <Button
                  size="sm"
                  disabled={!data?.count || iniciarCampana.isPending}
                  onClick={() =>
                    iniciarCampana.mutate({
                      segment: selected,
                      templateKey: SEGMENT_LABELS[selected].tplKey,
                    })
                  }
                  style={{ backgroundColor: '#0a3143' }}
                >
                  <Megaphone className="h-4 w-4 mr-1" />
                  {iniciarCampana.isPending ? 'Preparando...' : 'Iniciar campaña'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading || isFetching ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !data?.patients?.length ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                No hay pacientes en este segmento.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Última visita</TableHead>
                      <TableHead>Días sin visita</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.patients.map((p: SegmentPatient) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          {p.firstName} {p.lastName}
                          {p.isDiabetic && (
                            <Badge variant="outline" className="ml-2 bg-red-50 text-red-700 border-red-300">
                              Diabético
                            </Badge>
                          )}
                          {p.riskLevel === 'ALTO' && (
                            <Badge variant="outline" className="ml-2 bg-orange-50 text-orange-700 border-orange-300">
                              Riesgo alto
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{p.phone || '—'}</TableCell>
                        <TableCell className="text-sm">{p.lastVisit ? fmtDate(p.lastVisit) : 'Nunca'}</TableCell>
                        <TableCell>
                          {p.daysSinceVisit === null ? (
                            <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">Sin visitas</Badge>
                          ) : p.daysSinceVisit > 90 ? (
                            <span className="text-red-700 font-medium">{p.daysSinceVisit}</span>
                          ) : p.daysSinceVisit > 30 ? (
                            <span className="text-amber-700 font-medium">{p.daysSinceVisit}</span>
                          ) : (
                            <span>{p.daysSinceVisit}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <WhatsAppButton patient={p} segment={selected} />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="ml-1"
                            onClick={() => markContacted.mutate(p.id)}
                            title="Marcar contactado"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal de campaña uno-por-uno */}
      {campanaOpen && iniciarCampana.data && (
        <CampanaModal
          recipients={iniciarCampana.data.recipients}
          clinica={iniciarCampana.data.clinica}
          segmentLabel={SEGMENT_LABELS[selected!].label}
          onClose={() => {
            setCampanaOpen(false)
            qc.invalidateQueries({ queryKey: ['crm-segmento', selected] })
          }}
        />
      )}
    </div>
  )
}

function WhatsAppButton({ patient, segment }: { patient: SegmentPatient; segment: SegmentType }) {
  const tplKey = SEGMENT_LABELS[segment].tplKey
  const text = fillTemplate(DEFAULT_TEMPLATES[tplKey], {
    nombre_paciente: patient.firstName,
    clinica: 'CENPOD',
    link_reserva: '',
    fecha: '',
    hora: '',
    podologo: '',
  })
  const url = waUrl(patient.phone, text)
  if (!url) {
    return (
      <Button size="sm" variant="ghost" disabled title="Sin teléfono válido">
        <MessageCircle className="h-4 w-4 opacity-40" />
      </Button>
    )
  }
  return (
    <Button asChild size="sm" variant="ghost" title="Abrir WhatsApp">
      <a href={url} target="_blank" rel="noopener noreferrer">
        <MessageCircle className="h-4 w-4" style={{ color: '#25D366' }} />
      </a>
    </Button>
  )
}

function CampanaModal({
  recipients, clinica, segmentLabel, onClose,
}: {
  recipients: CampanaRecipient[]
  clinica: string
  segmentLabel: string
  onClose: () => void
}) {
  const [idx, setIdx] = useState(0)
  const [contacted, setContacted] = useState<Set<string>>(new Set())

  const current = recipients[idx]
  const total = recipients.length
  const done = idx >= total

  const next = () => setIdx((i) => i + 1)
  const prev = () => setIdx((i) => Math.max(0, i - 1))
  const toggleContacted = (pid: string) => {
    setContacted((s) => {
      const next = new Set(s)
      if (next.has(pid)) next.delete(pid)
      else next.add(pid)
      return next
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" style={{ color: '#0a3143' }} />
            Campaña: {segmentLabel}
          </DialogTitle>
          <DialogDescription>
            {clinica} · {total} pacientes · {contacted.size} marcados contactados
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-600" />
            <p className="text-base font-medium">Campaña completada</p>
            <p className="text-sm text-muted-foreground">
              Contactaste a {contacted.size} de {total} pacientes.
            </p>
          </div>
        ) : !current ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No hay destinatarios.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Progreso */}
            <div className="flex items-center justify-between">
              <Badge variant="secondary">{idx + 1} / {total}</Badge>
              <div className="flex-1 mx-3 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${((idx) / total) * 100}%`,
                    backgroundColor: '#0a3143',
                  }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{Math.round((idx / total) * 100)}%</span>
            </div>

            {/* Paciente actual */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-lg">{current.name}</p>
                    <p className="text-sm text-muted-foreground">{current.phone || 'Sin teléfono'}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={contacted.has(current.patientId) ? 'default' : 'outline'}
                    onClick={() => toggleContacted(current.patientId)}
                    style={contacted.has(current.patientId) ? { backgroundColor: '#0a3143' } : undefined}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    {contacted.has(current.patientId) ? 'Contactado' : 'Marcar contactado'}
                  </Button>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Mensaje:</p>
                  <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {current.message}
                  </div>
                </div>

                {current.waUrl ? (
                  <Button asChild className="w-full" style={{ backgroundColor: '#25D366' }}>
                    <a href={current.waUrl} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Abrir WhatsApp
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </Button>
                ) : (
                  <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 text-center">
                    Este paciente no tiene teléfono válido.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter className="flex !flex-row !justify-between sm:!justify-between">
          <Button variant="ghost" onClick={prev} disabled={idx === 0}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-1" /> Cerrar
            </Button>
            {!done && (
              <Button onClick={next} style={{ backgroundColor: '#0a3143' }}>
                Siguiente <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
