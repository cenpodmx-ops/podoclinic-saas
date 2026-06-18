'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  Stethoscope,
  ArrowLeft,
  ArrowRight,
  Check,
  Printer,
  Save,
  CreditCard,
  CalendarPlus,
  FileText,
  AlertTriangle,
  ChevronRight,
  ClipboardList,
  Search,
  Clock,
  CircleDollarSign,
  ClipboardCheck,
} from 'lucide-react'
import { format, addDays, format as fmtDateFn } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'

import { PatientCard, TicketPreview } from './_components/PatientCard'
import { ProductAdder } from './_components/ProductAdder'
import {
  REFERRED_BY_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  type ConsultaItem,
  type ConsultaApiResponse,
  type ConfigResponse,
  type ServiceItem,
  type AppointmentListItem,
} from './_lib/types'
import { fmtMoney, fmtDateTime, METHOD_LABELS, STATUS_LABELS, STATUS_COLORS } from '@/lib/format'

type Phase = 'loading' | 'list' | 'confirm-start' | 'form' | 'finalized' | 'saved-unpaid' | 'success'

export default function ConsultaPage() {
  const params = useSearchParams()
  const router = useRouter()
  const qc = useQueryClient()

  const citaId = params.get('cita') || ''

  const [showTicket, setShowTicket] = useState(false)
  const [savedConsultationId, setSavedConsultationId] = useState<string | null>(null)
  // Override de fase: cuando el usuario inicia/cobra/continúa, se setea
  // manualmente y toma prioridad sobre la derivación automática.
  const [manualPhase, setManualPhase] = useState<Phase | null>(null)

  // ── Query principal: trae la cita + paciente + consulta existente (si la hay)
  const consultaQ = useQuery<ConsultaApiResponse>({
    queryKey: ['consulta-context', citaId],
    queryFn: async () => {
      const r = await fetch(`/api/consultas?cita=${encodeURIComponent(citaId)}`)
      if (!r.ok) throw new Error('No se pudo cargar la cita')
      return r.json()
    },
    enabled: !!citaId,
    staleTime: 0,
  })

  // ── Configuración de la clínica (diagnósticos predefinidos + datos para ticket)
  const configQ = useQuery<ConfigResponse>({
    queryKey: ['config-clinica'],
    queryFn: async () => {
      const r = await fetch('/api/config')
      if (!r.ok) throw new Error('No se pudo cargar configuración')
      return r.json()
    },
    staleTime: 60_000,
  })

  // ── Servicios disponibles (selector en step 2)
  const servicesQ = useQuery<{ rows: ServiceItem[] }>({
    queryKey: ['servicios-list'],
    queryFn: async () => {
      const r = await fetch('/api/servicios')
      if (!r.ok) throw new Error('No se pudo cargar servicios')
      return r.json()
    },
    staleTime: 60_000,
  })

  // ── Fase derivada automáticamente de los datos
  const autoPhase: Phase = useMemo(() => {
    if (!citaId) return 'list'
    if (consultaQ.isLoading || !consultaQ.data) return 'loading'
    if (consultaQ.isError) return 'list'
    const { appointment, consultation } = consultaQ.data
    if (consultation && consultation.paid) return 'finalized'
    if (consultation && !consultation.paid) return 'saved-unpaid'
    if (appointment.status === 'EN_CONSULTA') return 'form'
    if (appointment.status === 'FINALIZADA') return 'finalized'
    return 'confirm-start'
  }, [citaId, consultaQ.isLoading, consultaQ.isError, consultaQ.data])

  // El override manual tiene prioridad; se reinicia cuando cambia la cita
  const phase: Phase = useMemo(() => {
    if (manualPhase) {
      // Si la data cargó y refleja un estado "final", respetar la reality
      if (consultaQ.data?.consultation?.paid) {
        // Pero si el usuario acaba de cobrar y estamos en 'success', mostrar success
        if (manualPhase === 'success') return 'success'
        return 'finalized'
      }
      return manualPhase
    }
    return autoPhase
  }, [manualPhase, autoPhase, consultaQ.data])

  // Reset del override cuando cambia la cita (URL)
  const [lastCita, setLastCita] = useState(citaId)
  if (citaId !== lastCita) {
    setLastCita(citaId)
    setManualPhase(null)
    setSavedConsultationId(null)
  }

  // ── Mutación para iniciar consulta (PATCH cita → EN_CONSULTA)
  const startMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/citas/${citaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'EN_CONSULTA' }),
      })
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e.error || 'No se pudo iniciar la consulta')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('Consulta iniciada')
      qc.invalidateQueries({ queryKey: ['consulta-context', citaId] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setManualPhase('form')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // ──────────────────────────────────────────────────────────
  //  RENDER
  // ──────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1100px] mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/agenda')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Stethoscope className="h-5 w-5" style={{ color: '#0a3143' }} />
            Consulta
          </h1>
          <p className="text-xs text-muted-foreground">Módulo 02 · Registro clínico y cobro</p>
        </div>
      </div>

      {phase === 'loading' && <LoadingSkeleton />}

      {phase === 'list' && <ConsultasList onPick={(id) => router.push(`/consulta?cita=${id}`)} />}

      {phase === 'confirm-start' && consultaQ.data && (
        <ConfirmStart
          data={consultaQ.data}
          onConfirm={() => startMut.mutate()}
          loading={startMut.isPending}
        />
      )}

      {phase === 'form' && consultaQ.data && (
        <ConsultaForm
          key={citaId}
          citaId={citaId}
          data={consultaQ.data}
          config={configQ.data}
          services={servicesQ.data?.rows || []}
          onSuccess={(id, paid) => {
            setSavedConsultationId(id)
            qc.invalidateQueries({ queryKey: ['consulta-context', citaId] })
            qc.invalidateQueries({ queryKey: ['dashboard'] })
            if (paid) {
              setManualPhase('success')
              setShowTicket(true)
            } else {
              setManualPhase('saved-unpaid')
            }
          }}
          onCancel={() => router.push('/agenda')}
        />
      )}

      {phase === 'saved-unpaid' && consultaQ.data && (
        <SavedUnpaidView
          data={consultaQ.data}
          config={configQ.data}
          consultationId={savedConsultationId}
          onContinue={() => setManualPhase('form')}
          onTicket={() => setShowTicket(true)}
        />
      )}

      {phase === 'finalized' && consultaQ.data && (
        <FinalizedView
          data={consultaQ.data}
          config={configQ.data}
          onTicket={() => setShowTicket(true)}
        />
      )}

      {phase === 'success' && consultaQ.data && (
        <SuccessView
          data={consultaQ.data}
          config={configQ.data}
          onTicket={() => setShowTicket(true)}
        />
      )}

      {/* Modal de ticket */}
      {showTicket && consultaQ.data && (
        <TicketDialog
          open={showTicket}
          onOpenChange={setShowTicket}
          data={consultaQ.data}
          config={configQ.data}
          consultationId={savedConsultationId}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  LOADING
// ─────────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24" />
      <Skeleton className="h-64" />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  LISTA DE CITAS DISPONIBLES PARA CONSULTA
// ─────────────────────────────────────────────────────────────
function ConsultasList({ onPick }: { onPick: (id: string) => void }) {
  const router = useRouter()
  const [search, setSearch] = useState('')

  const listQ = useQuery<{ rows: AppointmentListItem[] }>({
    queryKey: ['citas-hoy-actionable'],
    queryFn: async () => {
      const r = await fetch('/api/citas?actionable=1&hoy=1')
      if (!r.ok) throw new Error('No se pudo cargar la agenda')
      return r.json()
    },
  })

  const rows = listQ.data?.rows || []
  const filtered = search
    ? rows.filter((r) => {
        const name = `${r.patient.firstName} ${r.patient.lastName}`.toLowerCase()
        return name.includes(search.toLowerCase()) || (r.podologist?.name || '').toLowerCase().includes(search.toLowerCase())
      })
    : rows

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Citas para iniciar consulta (hoy)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por paciente o podólogo…"
              className="pl-8"
            />
          </div>

          {listQ.isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          )}

          {!listQ.isLoading && filtered.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No hay citas pendientes o confirmadas para hoy.
              <div className="mt-3">
                <Button size="sm" variant="outline" onClick={() => router.push('/agenda')}>
                  Ver agenda completa
                </Button>
              </div>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {filtered.map((a) => (
                <button
                  key={a.id}
                  onClick={() => onPick(a.id)}
                  className="w-full text-left p-3 rounded-md border hover:border-foreground/30 hover:bg-accent/50 transition-colors flex items-center gap-3"
                >
                  <div className="text-center min-w-[56px]">
                    <div className="text-sm font-mono font-bold">{format(new Date(a.startTime), 'HH:mm')}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {format(new Date(a.startTime), 'dd/MM')}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">
                        {a.patient.firstName} {a.patient.lastName}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {a.patient.expNumber}
                      </Badge>
                      {a.patient.isDiabetic && (
                        <Badge variant="outline" className="text-[10px] border-red-300 bg-red-50 text-red-700">
                          Diabético
                        </Badge>
                      )}
                      <Badge className={`text-[10px] ${STATUS_COLORS[a.status] || ''}`} variant="outline">
                        {STATUS_LABELS[a.status] || a.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {a.podologist?.name || 'Sin podólogo'} · {a.serviceName || a.reason || 'Sin motivo'}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  CONFIRMAR INICIO
// ─────────────────────────────────────────────────────────────
function ConfirmStart({
  data,
  onConfirm,
  loading,
}: {
  data: ConsultaApiResponse
  onConfirm: () => void
  loading: boolean
}) {
  const { appointment, patient, podologist } = data
  const isBlocked = ['CANCELADA', 'NO_ASISTIO', 'BLOQUEADA'].includes(appointment.status)

  return (
    <div className="space-y-4">
      <PatientCard patient={patient} />

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-blue-50 text-blue-700">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Iniciar consulta</h2>
              <p className="text-xs text-muted-foreground">
                {isBlocked
                  ? 'Esta cita tiene un estado que requiere atención.'
                  : 'Confirma para marcar la cita como “En consulta” y comenzar el registro.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Fecha" value={format(new Date(appointment.startTime), 'dd/MM/yyyy')} />
            <Info label="Hora" value={format(new Date(appointment.startTime), 'HH:mm')} />
            <Info label="Podólogo" value={podologist?.name || '—'} />
            <Info label="Servicio" value={appointment.serviceName || '—'} />
            <Info label="Motivo" value={appointment.reason || '—'} />
            <Info label="Precio cita" value={appointment.price != null ? fmtMoney(appointment.price) : '—'} />
          </div>

          {isBlocked && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Esta cita está marcada como <strong>{STATUS_LABELS[appointment.status]}</strong>. Si inicias la
                consulta se reabrirá. Verifica con el paciente antes de continuar.
              </span>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button variant="outline" asChild className="sm:flex-1">
              <Link href="/agenda">Cancelar</Link>
            </Button>
            <Button
              onClick={onConfirm}
              disabled={loading}
              className="sm:flex-1"
              style={{ backgroundColor: '#0a3143' }}
            >
              {loading ? 'Iniciando…' : 'Iniciar consulta'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  FORMULARIO DE CONSULTA — 3 PASOS
// ─────────────────────────────────────────────────────────────
function ConsultaForm({
  citaId,
  data,
  config,
  services,
  onSuccess,
  onCancel,
}: {
  citaId: string
  data: ConsultaApiResponse
  config: ConfigResponse | undefined
  services: ServiceItem[]
  onSuccess: (id: string, paid: boolean) => void
  onCancel: () => void
}) {
  const qc = useQueryClient()
  const { appointment, patient, podologist, consultation } = data

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [saving, setSaving] = useState(false)

  // Step 1 fields
  const [reason, setReason] = useState(consultation?.reason || appointment.reason || '')
  const [referredBy, setReferredBy] = useState<string>(consultation?.referredBy || 'NADIE')
  const [diagnosis, setDiagnosis] = useState(consultation?.diagnosis || '')
  const [treatment, setTreatment] = useState(consultation?.treatment || '')
  const [notes, setNotes] = useState(consultation?.notes || '')

  // Step 2 fields
  const [items, setItems] = useState<ConsultaItem[]>(
    consultation?.items?.filter((i) => i.type !== 'SERVICIO') || []
  )
  const [consultPrice, setConsultPrice] = useState<number>(
    consultation?.consultPrice ?? appointment.price ?? 0
  )
  const [selectedServiceId, setSelectedServiceId] = useState<string>(appointment.serviceId || '')
  const [discount, setDiscount] = useState<number>(consultation?.discount || 0)
  const [paymentMethod, setPaymentMethod] = useState<string>(
    consultation?.paymentMethod || 'EFECTIVO'
  )
  const [followUpDays, setFollowUpDays] = useState<number | ''>(consultation?.followUpDays ?? '')

  // Cálculos
  const productsTotal = useMemo(
    () => items.reduce((s, i) => s + i.qty * i.price, 0),
    [items]
  )
  const subtotal = consultPrice + productsTotal
  const total = Math.max(0, subtotal - discount)

  // Cuando se selecciona un servicio desde el selector, setear precio y agregar item SERVICIO
  function onServiceChange(serviceId: string) {
    setSelectedServiceId(serviceId)
    const svc = services.find((s) => s.id === serviceId)
    if (svc) {
      setConsultPrice(svc.price)
    }
  }

  function canAdvance(stepN: 1 | 2 | 3) {
    if (stepN === 1) {
      // Validar motivo o diagnóstico (al menos uno con contenido)
      return reason.trim().length > 0 || diagnosis.trim().length > 0
    }
    if (stepN === 2) {
      return consultPrice >= 0 && !!paymentMethod
    }
    return true
  }

  // ── Mutación: guardar (con o sin cobro)
  const saveMut = useMutation({
    mutationFn: async (paid: boolean) => {
      setSaving(true)
      const payload = {
        appointmentId: citaId,
        reason: reason.trim() || null,
        referredBy,
        diagnosis: diagnosis.trim() || null,
        treatment: treatment.trim() || null,
        notes: notes.trim() || null,
        // Items: servicio seleccionado + items de productos/medicamentos
        items: buildItems(),
        consultPrice: Number(consultPrice) || 0,
        discount: Number(discount) || 0,
        paymentMethod,
        paid,
        followUpDays: followUpDays === '' ? null : Number(followUpDays),
      }
      // Si ya existe consulta, usamos PATCH; si no, POST
      const url = consultation ? `/api/consultas/${consultation.id}` : '/api/consultas'
      const method = consultation ? 'PATCH' : 'POST'
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e.error || 'No se pudo guardar la consulta')
      }
      return { data: await r.json(), paid }
    },
    onSuccess: ({ data, paid }) => {
      setSaving(false)
      if (paid) {
        toast.success('Consulta finalizada y cobrada correctamente')
      } else {
        toast.info('Consulta guardada, pendiente de cobro')
      }
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['citas-hoy-actionable'] })
      onSuccess(data.id, paid)
    },
    onError: (e: Error) => {
      setSaving(false)
      toast.error(e.message)
    },
  })

  function buildItems(): ConsultaItem[] {
    const out: ConsultaItem[] = []
    // Servicio seleccionado → item SERVICIO
    if (selectedServiceId) {
      const svc = services.find((s) => s.id === selectedServiceId)
      if (svc) {
        out.push({
          name: svc.name,
          qty: 1,
          price: svc.price,
          type: 'SERVICIO',
          serviceId: svc.id,
        })
      }
    } else if (consultPrice > 0) {
      // Si hay precio pero no servicio → igual lo guardamos como concepto genérico
      out.push({
        name: appointment.serviceName || 'Consulta',
        qty: 1,
        price: consultPrice,
        type: 'SERVICIO',
      })
    }
    // Productos y medicamentos
    for (const it of items) {
      out.push({
        name: it.name,
        qty: it.qty,
        price: it.price,
        type: it.type,
        productId: it.productId,
      })
    }
    return out
  }

  return (
    <div className="space-y-4">
      <PatientCard patient={patient} />

      {/* Stepper */}
      <Stepper step={step} />

      {/* Step 1 — Datos clínicos */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> Datos de la consulta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="reason">Motivo de consulta</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="¿Qué motivo la visita del paciente?"
              />
            </div>

            <div>
              <Label>¿Quién lo refirió?</Label>
              <Select value={referredBy} onValueChange={setReferredBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REFERRED_BY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Diagnóstico</Label>
              <Textarea
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                rows={3}
                placeholder="Diagnóstico clínico"
              />
              {config && config.diagnosesList.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="text-[10px] text-muted-foreground w-full">Diagnósticos frecuentes:</span>
                  {config.diagnosesList.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDiagnosis(diagnosis ? `${diagnosis}, ${d}` : d)}
                      className="text-[10px] px-2 py-0.5 rounded-full border bg-accent/40 hover:bg-accent transition-colors"
                    >
                      + {d}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label>Tratamiento realizado</Label>
              <Textarea
                value={treatment}
                onChange={(e) => setTreatment(e.target.value)}
                rows={3}
                placeholder="Procedimientos realizados en esta sesión"
              />
            </div>

            <div>
              <Label>Notas de evolución</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Observaciones adicionales"
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
            <Button
              onClick={() => setStep(2)}
              disabled={!canAdvance(1)}
              style={{ backgroundColor: '#0a3143' }}
            >
              Continuar <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 2 — Cobro */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CircleDollarSign className="h-4 w-4" /> Cobro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Precio consulta + servicio */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="consultPrice">Precio de la consulta</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    id="consultPrice"
                    type="number"
                    min={0}
                    step="0.01"
                    value={consultPrice}
                    onChange={(e) => setConsultPrice(Number(e.target.value) || 0)}
                    className="pl-7"
                  />
                </div>
              </div>
              <div>
                <Label>Servicio (opcional)</Label>
                <Select value={selectedServiceId || '__none'} onValueChange={(v) => onServiceChange(v === '__none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="— Sin servicio —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— Sin servicio —</SelectItem>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} · {fmtMoney(s.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Productos / Medicamentos */}
            <div>
              <Label className="text-sm font-medium">Productos y medicamentos</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Busca y agrega productos. El stock se descontará al confirmar el cobro.
              </p>
              <ProductAdder items={items} onChange={setItems} />
            </div>

            <Separator />

            {/* Descuento + Método + Seguimiento */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="discount">Descuento</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    id="discount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                    className="pl-7"
                  />
                </div>
              </div>
              <div>
                <Label>Método de pago</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHOD_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="followUp">Seguimiento (días)</Label>
                <Input
                  id="followUp"
                  type="number"
                  min={0}
                  value={followUpDays}
                  onChange={(e) => setFollowUpDays(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0 = sin seguimiento"
                />
              </div>
            </div>

            {/* Resumen de totales */}
            <div className="rounded-lg border p-4 bg-accent/20 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Consulta</span>
                <span className="font-mono">{fmtMoney(consultPrice)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Productos y medicamentos</span>
                <span className="font-mono">{fmtMoney(productsTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono">{fmtMoney(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-red-700">
                  <span>Descuento</span>
                  <span className="font-mono">-{fmtMoney(discount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-base font-semibold">TOTAL</span>
                <span className="text-2xl font-bold font-mono" style={{ color: '#0a3143' }}>
                  {fmtMoney(total)}
                </span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Atrás
            </Button>
            <Button onClick={() => setStep(3)} style={{ backgroundColor: '#0a3143' }}>
              Continuar <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 3 — Confirmar y ticket */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" /> Confirmar y cobrar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Paciente" value={`${patient.firstName} ${patient.lastName}`} />
              <Info label="Expediente" value={patient.expNumber} />
              <Info label="Podólogo" value={podologist?.name || '—'} />
              <Info label="Fecha" value={fmtDateTime(new Date())} />
              <Info label="Método de pago" value={METHOD_LABELS[paymentMethod] || paymentMethod} />
              {followUpDays !== '' && Number(followUpDays) > 0 && (
                <Info label="Seguimiento" value={`${followUpDays} días`} />
              )}
            </div>

            <Separator />

            {/* Lista de items en el resumen */}
            <div className="rounded-md border divide-y">
              {consultPrice > 0 && (
                <RowItem name={selectedServiceId ? services.find((s) => s.id === selectedServiceId)?.name || 'Consulta' : appointment.serviceName || 'Consulta'} qty={1} price={consultPrice} />
              )}
              {items.map((it, i) => (
                <RowItem key={i} name={it.name} qty={it.qty} price={it.price} />
              ))}
              {consultPrice === 0 && items.length === 0 && (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  No hay conceptos que cobrar.
                </div>
              )}
            </div>

            <div className="rounded-lg border p-4 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono">{fmtMoney(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-red-700">
                  <span>Descuento</span>
                  <span className="font-mono">-{fmtMoney(discount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between items-center">
                <span className="font-semibold">TOTAL A COBRAR</span>
                <span className="text-2xl font-bold font-mono" style={{ color: '#0a3143' }}>
                  {fmtMoney(total)}
                </span>
              </div>
            </div>

            {/* Aviso de stock si alguno supera el disponible */}
            {items.some((it) => typeof it.stock === 'number' && it.qty > (it.stock || 0)) && (
              <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Algunos productos exceden el stock disponible. El cobro fallará si no hay existencia
                  suficiente.
                </span>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col-reverse sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setStep(2)} className="sm:flex-1">
              <ArrowLeft className="h-4 w-4 mr-1" /> Atrás
            </Button>
            <Button
              variant="outline"
              onClick={() => saveMut.mutate(false)}
              disabled={saving}
              className="sm:flex-1"
            >
              <Save className="h-4 w-4 mr-1" />
              {saving ? 'Guardando…' : 'Guardar sin cobrar'}
            </Button>
            <Button
              onClick={() => saveMut.mutate(true)}
              disabled={saving}
              className="sm:flex-1"
              style={{ backgroundColor: '#0a3143' }}
            >
              <CreditCard className="h-4 w-4 mr-1" />
              {saving ? 'Procesando…' : 'Confirmar pago'}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}

function RowItem({ name, qty, price }: { name: string; qty: number; price: number }) {
  return (
    <div className="p-2.5 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm truncate">{name}</span>
        <span className="text-xs text-muted-foreground shrink-0">× {qty}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground font-mono">{fmtMoney(price)}</span>
        <span className="text-sm font-semibold font-mono">{fmtMoney(qty * price)}</span>
      </div>
    </div>
  )
}

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: 'Datos', icon: ClipboardList },
    { n: 2, label: 'Cobro', icon: CircleDollarSign },
    { n: 3, label: 'Confirmar', icon: ClipboardCheck },
  ] as const
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {steps.map((s, i) => {
        const Icon = s.icon
        const active = step === s.n
        const done = step > s.n
        return (
          <div key={s.n} className="flex items-center flex-1">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md flex-1 ${
                active ? 'text-white' : done ? 'text-emerald-700 bg-emerald-50' : 'text-muted-foreground bg-muted/50'
              }`}
              style={active ? { backgroundColor: '#0a3143' } : undefined}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="text-xs font-medium hidden sm:inline">{s.label}</span>
              {done && <Check className="h-3 w-3 ml-auto" />}
            </div>
            {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0 mx-0.5" />}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  VISTA: CONSULTA GUARDADA SIN COBRAR
// ─────────────────────────────────────────────────────────────
function SavedUnpaidView({
  data,
  config,
  consultationId,
  onContinue,
  onTicket,
}: {
  data: ConsultaApiResponse
  config: ConfigResponse | undefined
  consultationId: string | null
  onContinue: () => void
  onTicket: () => void
}) {
  const { patient, podologist, consultation } = data
  if (!consultation) return null

  return (
    <div className="space-y-4">
      <PatientCard patient={patient} />
      <Card className="border-amber-300">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-amber-50 text-amber-700">
              <Save className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Consulta guardada · pendiente de cobro</h2>
              <p className="text-xs text-muted-foreground">
                La cita sigue “En consulta”. Puedes cobrar ahora o continuar editando.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <Info label="Podólogo" value={podologist?.name || '—'} />
            <Info label="Fecha" value={fmtDateTime(consultation.date)} />
            <Info label="Total" value={fmtMoney(consultation.total)} />
            <Info label="Método" value={consultation.paymentMethod ? METHOD_LABELS[consultation.paymentMethod] || consultation.paymentMethod : '—'} />
            <Info label="Conceptos" value={`${consultation.items.length}`} />
            <Info label="Diagnóstico" value={consultation.diagnosis || '—'} />
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button variant="outline" asChild className="sm:flex-1">
              <Link href="/agenda">Volver a agenda</Link>
            </Button>
            <Button variant="outline" onClick={onTicket} className="sm:flex-1">
              <Printer className="h-4 w-4 mr-1" /> Ver ticket
            </Button>
            <Button onClick={onContinue} className="sm:flex-1" style={{ backgroundColor: '#0a3143' }}>
              <CreditCard className="h-4 w-4 mr-1" /> Continuar y cobrar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  VISTA: CONSULTA FINALIZADA
// ─────────────────────────────────────────────────────────────
function FinalizedView({
  data,
  config,
  onTicket,
}: {
  data: ConsultaApiResponse
  config: ConfigResponse | undefined
  onTicket: () => void
}) {
  const { patient, podologist, consultation } = data
  if (!consultation) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          La cita está finalizada pero no tiene consulta registrada.
        </CardContent>
      </Card>
    )
  }
  return (
    <div className="space-y-4">
      <PatientCard patient={patient} />
      <Card className="border-emerald-300">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-emerald-50 text-emerald-700">
              <Check className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Consulta ya finalizada</h2>
              <p className="text-xs text-muted-foreground">
                {fmtDateTime(consultation.date)} · {podologist?.name || '—'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <Info label="Diagnóstico" value={consultation.diagnosis || '—'} />
            <Info label="Tratamiento" value={consultation.treatment || '—'} />
            <Info label="Método de pago" value={consultation.paymentMethod ? METHOD_LABELS[consultation.paymentMethod] || consultation.paymentMethod : '—'} />
            <Info label="Total cobrado" value={fmtMoney(consultation.total)} />
            {consultation.followUpDays && (
              <Info label="Seguimiento" value={`${consultation.followUpDays} días`} />
            )}
            <Info label="Conceptos" value={`${consultation.items.length}`} />
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button variant="outline" asChild className="sm:flex-1">
              <Link href="/agenda">Volver a agenda</Link>
            </Button>
            <Button variant="outline" asChild className="sm:flex-1">
              <Link href={`/recetas?paciente=${patient.id}&consulta=${consultation.id}`}>
                <FileText className="h-4 w-4 mr-1" /> Generar receta
              </Link>
            </Button>
            <Button onClick={onTicket} className="sm:flex-1" style={{ backgroundColor: '#0a3143' }}>
              <Printer className="h-4 w-4 mr-1" /> Ver ticket
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  VISTA: ÉXITO DESPUÉS DE CONFIRMAR PAGO
// ─────────────────────────────────────────────────────────────
function SuccessView({
  data,
  config,
  onTicket,
}: {
  data: ConsultaApiResponse
  config: ConfigResponse | undefined
  onTicket: () => void
}) {
  const { patient, consultation } = data
  // Calcular fecha de seguimiento si aplica
  const followUpDate = consultation?.followUpDays
    ? fmtDateFn(addDays(new Date(), consultation.followUpDays), 'yyyy-MM-dd')
    : null

  return (
    <div className="space-y-4">
      <PatientCard patient={patient} />
      <Card className="border-emerald-300">
        <CardContent className="p-6 space-y-4 text-center">
          <div className="mx-auto p-3 rounded-full bg-emerald-50 text-emerald-700 w-fit">
            <Check className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold">¡Consulta finalizada!</h2>
            <p className="text-sm text-muted-foreground">
              Se cobró <strong>{fmtMoney(consultation?.total || 0)}</strong> y la cita se marcó como finalizada.
            </p>
          </div>

          {consultation?.followUpDays && followUpDate && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 flex items-center gap-2 justify-center">
              <CalendarPlus className="h-4 w-4" />
              <span>
                Seguimiento en <strong>{consultation.followUpDays} días</strong> ·{' '}
                <Link href={`/agenda?nueva=1&paciente=${patient.id}&date=${followUpDate}`} className="underline font-semibold">
                  Agendar ahora
                </Link>
              </span>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button variant="outline" asChild className="sm:flex-1">
              <Link href="/agenda">Volver a agenda</Link>
            </Button>
            <Button variant="outline" asChild className="sm:flex-1">
              <Link href={`/recetas?paciente=${patient.id}&consulta=${consultation?.id || ''}`}>
                <FileText className="h-4 w-4 mr-1" /> Generar receta
              </Link>
            </Button>
            <Button onClick={onTicket} className="sm:flex-1" style={{ backgroundColor: '#0a3143' }}>
              <Printer className="h-4 w-4 mr-1" /> Imprimir ticket
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  DIÁLOGO DE TICKET
// ─────────────────────────────────────────────────────────────
function TicketDialog({
  open,
  onOpenChange,
  data,
  config,
  consultationId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  data: ConsultaApiResponse
  config: ConfigResponse | undefined
  consultationId: string | null
}) {
  const { patient, podologist, consultation } = data
  if (!consultation) return null

  function handlePrint() {
    window.print()
  }

  // Marcar ticket como impreso (no crítico)
  async function markPrinted() {
    if (!consultationId || !consultation) return
    try {
      await fetch(`/api/consultas/${consultationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketPrinted: true }),
      })
    } catch {}
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[360px] p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Ticket de consulta</DialogTitle>
          <DialogDescription>Vista previa del ticket imprimible.</DialogDescription>
        </DialogHeader>
        <div className="bg-white p-3 flex justify-center">
          <TicketPreview
            data={{
              clinic: config?.clinic || null,
              date: new Date(consultation.date),
              patientName: `${patient.firstName} ${patient.lastName}`,
              expNumber: patient.expNumber,
              podologistName: podologist?.name || '—',
              items: consultation.items.filter((i) => i.type !== 'SERVICIO'),
              consultPrice: consultation.consultPrice,
              productsTotal: consultation.productsTotal,
              discount: consultation.discount,
              total: consultation.total,
              paymentMethod: consultation.paymentMethod ? METHOD_LABELS[consultation.paymentMethod] || consultation.paymentMethod : null,
              followUpDays: consultation.followUpDays,
            }}
          />
        </div>
        <DialogFooter className="px-3 pb-3 gap-2 sm:gap-2 no-print">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cerrar
          </Button>
          <Button
            onClick={() => {
              markPrinted()
              handlePrint()
            }}
            className="flex-1"
            style={{ backgroundColor: '#0a3143' }}
          >
            <Printer className="h-4 w-4 mr-1" /> Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
