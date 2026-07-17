'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChevronLeft,
  ChevronRight,
  Check,
  MapPin,
  Phone,
  Stethoscope,
  Clock,
  User,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CalendarDays,
  Building2,
  Sun,
  Moon,
} from 'lucide-react'
import { format, startOfDay, addDays } from 'date-fns'
import { es } from 'date-fns/locale'

// ============================================================
// Tipos
// ============================================================
type Clinic = {
  id: string
  name: string
  slug: string
  address: string | null
  phone: string | null
  email: string | null
}

type Podologist = {
  id: string
  name: string
  specialty: string | null
  photoUrl: string | null
}

type Slot = { startTime: string; endTime: string }

type BookingSuccess = {
  success: true
  appointmentId: string
  patientId: string
  isNewPatient: boolean
  patientName: string
  expNumber: string
  podologistName: string | null
  clinicName: string
  whatsappUrl: string | null
}

const BRAND = '#0a3143'

const STEPS = [
  { id: 1, label: 'Clínica' },
  { id: 2, label: 'Podólogo' },
  { id: 3, label: 'Día' },
  { id: 4, label: 'Hora' },
  { id: 5, label: 'Datos' },
  { id: 6, label: 'Confirmar' },
]

// ============================================================
// Componente principal
// ============================================================
export function PublicBookingFlow({ initialClinicSlug }: { initialClinicSlug?: string }) {
  const [step, setStep] = useState<number>(initialClinicSlug ? 2 : 1)
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [clinic, setClinic] = useState<Clinic | null>(null)
  const [clinicsLoading, setClinicsLoading] = useState(true)

  const [podologists, setPodologists] = useState<Podologist[]>([])
  const [podologistsLoading, setPodologistsLoading] = useState(false)
  const [podologistId, setPodologistId] = useState<string>('') // '' = cualquiera

  const [date, setDate] = useState<Date | undefined>(undefined)

  const [slots, setSlots] = useState<Slot[]>([])
  const [morningSlots, setMorningSlots] = useState<Slot[]>([])
  const [afternoonSlots, setAfternoonSlots] = useState<Slot[]>([])
  const [turno, setTurno] = useState<'manana' | 'tarde' | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slot, setSlot] = useState<Slot | null>(null)
  const [resolvedPodologistName, setResolvedPodologistName] = useState<string | null>(null)

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    reason: '',
    esNuevo: true,
  })

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<BookingSuccess | null>(null)

  // ----- Fetch clínicas -----
  useEffect(() => {
    let mounted = true
    setClinicsLoading(true)
    fetch('/api/public/clinicas')
      .then((r) => r.json())
      .then((d) => {
        if (!mounted) return
        const list: Clinic[] = d.data || []
        setClinics(list)
        if (initialClinicSlug) {
          const c = list.find((x) => x.slug === initialClinicSlug)
          if (c) setClinic(c)
          else setStep(1) // slug no encontrado → mostrar selector
        }
      })
      .catch(() => {
        if (mounted) setError('No pudimos cargar las clínicas. Reintenta más tarde.')
      })
      .finally(() => mounted && setClinicsLoading(false))
    return () => {
      mounted = false
    }
  }, [initialClinicSlug])

  // ----- Fetch podólogos cuando cambia la clínica -----
  useEffect(() => {
    if (!clinic) return
    setPodologistsLoading(true)
    setPodologistId('')
    setPodologists([])
    fetch(`/api/public/podologos?clinicId=${clinic.id}`)
      .then((r) => r.json())
      .then((d) => setPodologists(d.data || []))
      .catch(() => setPodologists([]))
      .finally(() => setPodologistsLoading(false))
  }, [clinic])

  // ----- Fetch disponibilidad cuando cambia fecha o podólogo -----
  const fetchSlots = useCallback(async () => {
    if (!clinic || !date) return
    setSlotsLoading(true)
    setError('')
    setSlots([])
    setSlot(null)
    const params = new URLSearchParams({
      clinicId: clinic.id,
      date: format(date, 'yyyy-MM-dd'),
    })
    if (podologistId) params.set('podologistId', podologistId)
    try {
      const r = await fetch(`/api/public/disponibilidad?${params.toString()}`)
      const d = await r.json()
      setSlots(d.slots || [])
      setMorningSlots(d.morningSlots || [])
      setAfternoonSlots(d.afternoonSlots || [])
      setTurno(null) // reset turno al cargar nuevos slots
      // Si el usuario eligió "cualquiera" y la API eligió uno, lo guardamos para el resumen
      if (!podologistId && d.podologistId) {
        setResolvedPodologistName(d.podologistName)
      } else {
        const p = podologists.find((x) => x.id === podologistId)
        setResolvedPodologistName(p?.name || null)
      }
    } catch {
      setSlots([])
    } finally {
      setSlotsLoading(false)
    }
  }, [clinic, date, podologistId, podologists])

  useEffect(() => {
    if (date) fetchSlots()
  }, [date, fetchSlots])

  // Si cambia el podólogo, limpiar fecha y slot seleccionados
  useEffect(() => {
    setDate(undefined)
    setSlots([])
    setSlot(null)
  }, [podologistId, clinic])

  // ----- Navegación entre pasos -----
  const goNext = () => {
    setError('')
    setStep((s) => Math.min(6, s + 1))
  }
  const goBack = () => {
    setError('')
    setStep((s) => Math.max(1, s - 1))
  }
  const reset = () => {
    setSuccess(null)
    setStep(initialClinicSlug && clinic ? 2 : 1)
    setPodologistId('')
    setDate(undefined)
    setSlots([])
    setSlot(null)
    setForm({ firstName: '', lastName: '', phone: '', email: '', reason: '', esNuevo: true })
    setError('')
    setResolvedPodologistName(null)
  }

  // ----- Submit final -----
  const submit = async () => {
    if (!clinic || !date || !slot) return
    setSubmitting(true)
    setError('')
    try {
      const r = await fetch('/api/public/reservar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId: clinic.id,
          podologistId: podologistId || undefined,
          date: format(date, 'yyyy-MM-dd'),
          startTime: slot.startTime,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          reason: form.reason.trim() || undefined,
          esNuevo: form.esNuevo,
        }),
      })
      const d = await r.json()
      if (!r.ok || !d.success) {
        // Si el slot ya fue tomado → volver a step 4
        if (r.status === 409) {
          setError(d.error || 'Ese horario ya fue reservado. Elige otro.')
          setSlot(null)
          setStep(4)
          fetchSlots()
        } else {
          setError(d.error || 'Ocurrió un error al reservar. Intenta de nuevo.')
        }
        return
      }
      setSuccess(d as BookingSuccess)
    } catch {
      setError('No pudimos completar tu reserva. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  // ----- Render -----
  return (
    <div className="min-h-screen flex flex-col bg-slate-50" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <header className="px-5 py-4 shadow-md" style={{ backgroundColor: BRAND }}>
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <img src="/logo-white.png" alt="CENPOD" className="h-8 w-auto" />
          <div className="ml-auto text-white/90 text-xs sm:text-sm">
            {clinic ? clinic.name : 'Reserva de cita'}
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="flex-1 px-4 py-6 sm:py-10">
        <div className="max-w-2xl mx-auto w-full">
          {/* Pantalla de éxito */}
          {success ? (
            <SuccessScreen
              success={success}
              clinic={clinic}
              date={date}
              slot={slot}
              form={form}
              onReset={reset}
            />
          ) : (
            <>
              {/* Stepper */}
              <Stepper currentStep={step} />

              {/* Card principal */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-7 mt-5">
                {error && (
                  <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 text-red-800 p-3 text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {step === 1 && (
                  <StepClinica
                    clinics={clinics}
                    loading={clinicsLoading}
                    selected={clinic}
                    onSelect={(c) => {
                      setClinic(c)
                      setStep(2)
                    }}
                  />
                )}

                {step === 2 && (
                  <StepPodologo
                    clinic={clinic}
                    podologists={podologists}
                    loading={podologistsLoading}
                    selected={podologistId}
                    onSelect={(id) => {
                      setPodologistId(id)
                    }}
                    onContinue={goNext}
                    onBack={goBack}
                  />
                )}

                {step === 3 && (
                  <StepDia
                    date={date}
                    onSelect={(d) => {
                      setDate(d)
                      goNext()
                    }}
                    onBack={goBack}
                  />
                )}

                {step === 4 && (
                  <StepHorario
                    clinic={clinic}
                    date={date}
                    slots={slots}
                    morningSlots={morningSlots}
                    afternoonSlots={afternoonSlots}
                    turno={turno}
                    onTurnoChange={setTurno}
                    loading={slotsLoading}
                    selected={slot}
                    onSelect={(s) => {
                      setSlot(s)
                    }}
                    onContinue={goNext}
                    onBack={goBack}
                    onRetry={fetchSlots}
                  />
                )}

                {step === 5 && (
                  <StepDatos
                    form={form}
                    onChange={setForm}
                    onContinue={goNext}
                    onBack={goBack}
                  />
                )}

                {step === 6 && (
                  <StepConfirmacion
                    clinic={clinic}
                    podologistId={podologistId}
                    podologists={podologists}
                    resolvedPodologistName={resolvedPodologistName}
                    date={date}
                    slot={slot}
                    form={form}
                    submitting={submitting}
                    onConfirm={submit}
                    onBack={goBack}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-5 py-4 text-white text-xs" style={{ backgroundColor: BRAND }}>
        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="opacity-90">© {new Date().getFullYear()} Grupo CENPOD</div>
          {clinic?.phone && (
            <a
              href={`tel:+52${clinic.phone.replace(/\D/g, '')}`}
              className="flex items-center gap-1 hover:underline"
            >
              <Phone className="h-3 w-3" />
              {clinic.phone}
            </a>
          )}
        </div>
      </footer>
    </div>
  )
}

// ============================================================
// Stepper
// ============================================================
function Stepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-between">
      {STEPS.map((s, i) => {
        const done = currentStep > s.id
        const active = currentStep === s.id
        return (
          <div key={s.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`h-8 w-8 sm:h-9 sm:w-9 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                  done
                    ? 'text-white'
                    : active
                      ? 'text-white ring-4 ring-[#0a3143]/15'
                      : 'bg-slate-200 text-slate-500'
                }`}
                style={done || active ? { backgroundColor: BRAND } : undefined}
              >
                {done ? <Check className="h-4 w-4" /> : s.id}
              </div>
              <span
                className={`text-[10px] sm:text-xs font-medium ${
                  active ? 'text-[#0a3143]' : done ? 'text-slate-700' : 'text-slate-400'
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="flex-1 h-0.5 mx-1 sm:mx-2 -mt-4 rounded"
                style={{
                  backgroundColor: currentStep > s.id ? BRAND : '#e2e8f0',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ============================================================
// Step 1 — Sucursal
// ============================================================
function StepClinica({
  clinics,
  loading,
  selected,
  onSelect,
}: {
  clinics: Clinic[]
  loading: boolean
  selected: Clinic | null
  onSelect: (c: Clinic) => void
}) {
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900">¿A qué clínica deseas asistir?</h2>
      <p className="text-sm text-slate-500 mt-1">Selecciona la sucursal más cercana a ti.</p>

      <div className="mt-5 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : clinics.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">
            No hay clínicas disponibles por ahora.
          </p>
        ) : (
          clinics.map((c) => {
            const active = selected?.id === c.id
            return (
              <button
                key={c.id}
                onClick={() => onSelect(c)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                  active
                    ? 'border-[#0a3143] bg-[#0a3143]/5'
                    : 'border-slate-200 hover:border-[#0a3143]/40 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: BRAND }}
                  >
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">{c.name}</p>
                    {c.address && (
                      <p className="text-sm text-slate-500 flex items-start gap-1 mt-0.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span className="truncate">{c.address}</span>
                      </p>
                    )}
                    {c.phone && (
                      <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone className="h-3.5 w-3.5" />
                        {c.phone}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

// ============================================================
// Step 2 — Podólogo
// ============================================================
function StepPodologo({
  clinic,
  podologists,
  loading,
  selected,
  onSelect,
  onContinue,
  onBack,
}: {
  clinic: Clinic | null
  podologists: Podologist[]
  loading: boolean
  selected: string
  onSelect: (id: string) => void
  onContinue: () => void
  onBack: () => void
}) {
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900">Selecciona tu podólogo</h2>
      <p className="text-sm text-slate-500 mt-1">
        Puedes elegir un podólogo específico o dejarnos asignarte el primero disponible.
      </p>

      <div className="mt-5 space-y-2.5">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
        ) : (
          <>
            {/* Opción "Cualquier podólogo" */}
            <button
              onClick={() => onSelect('')}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                selected === ''
                  ? 'border-[#0a3143] bg-[#0a3143]/5'
                  : 'border-slate-200 hover:border-[#0a3143]/40 hover:bg-slate-50'
              }`}
            >
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: BRAND }}
              >
                <Stethoscope className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">Cualquier podólogo</p>
                <p className="text-sm text-slate-500">El primero disponible para tu horario</p>
              </div>
              {selected === '' && <Check className="h-5 w-5" style={{ color: BRAND }} />}
            </button>

            {podologists.length === 0 && !loading && (
              <p className="text-sm text-slate-500 text-center py-4">
                No hay podólogos activos en esta clínica. Selecciona &quot;cualquier podólogo&quot;.
              </p>
            )}

            {podologists.map((p) => {
              const active = selected === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => onSelect(p.id)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                    active
                      ? 'border-[#0a3143] bg-[#0a3143]/5'
                      : 'border-slate-200 hover:border-[#0a3143]/40 hover:bg-slate-50'
                  }`}
                >
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-white shrink-0 text-sm font-semibold"
                    style={{ backgroundColor: BRAND }}
                  >
                    {p.photoUrl ? (
                      <img
                        src={p.photoUrl}
                        alt={p.name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      p.name.charAt(0)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">{p.name}</p>
                    {p.specialty && (
                      <p className="text-sm text-slate-500 truncate">{p.specialty}</p>
                    )}
                  </div>
                  {active && <Check className="h-5 w-5" style={{ color: BRAND }} />}
                </button>
              )
            })}
          </>
        )}
      </div>

      <div className="mt-6 flex gap-2">
        <Button variant="outline" onClick={onBack} className="flex-1 sm:flex-none">
          <ChevronLeft className="h-4 w-4 mr-1" /> Atrás
        </Button>
        <Button
          onClick={onContinue}
          disabled={loading}
          className="flex-1 text-white"
          style={{ backgroundColor: BRAND }}
        >
          Continuar
        </Button>
      </div>
      {!clinic && (
        <p className="text-xs text-amber-600 mt-2">
          No se cargó la clínica. Vuelve al paso anterior.
        </p>
      )}
    </div>
  )
}

// ============================================================
// Step 3 — Día
// ============================================================
function StepDia({
  date,
  onSelect,
  onBack,
}: {
  date: Date | undefined
  onSelect: (d: Date) => void
  onBack: () => void
}) {
  const today = startOfDay(new Date())
  // Desactivar domingos y fechas pasadas (también limitar a 60 días hacia adelante)
  const maxDate = addDays(today, 60)

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900">Selecciona el día</h2>
      <p className="text-sm text-slate-500 mt-1">
        Los domingos la clínica permanece cerrada.
      </p>

      <div className="mt-5 flex justify-center">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => d && onSelect(d)}
          locale={es}
          disabled={[
            { dayOfWeek: [0] }, // Domingos
            { before: today },
            { after: maxDate },
          ]}
          fromMonth={today}
          toMonth={maxDate}
          className="rounded-xl border border-slate-200 p-3"
        />
      </div>

      <div className="mt-6 flex gap-2">
        <Button variant="outline" onClick={onBack} className="flex-1 sm:flex-none">
          <ChevronLeft className="h-4 w-4 mr-1" /> Atrás
        </Button>
        {date && (
          <div className="flex-1 text-right text-sm text-slate-600 self-center">
            <CalendarDays className="inline h-4 w-4 mr-1" />
            {format(date, "EEEE, d 'de' MMMM", { locale: es })}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Step 4 — Horario
// ============================================================
function StepHorario({
  clinic,
  date,
  morningSlots,
  afternoonSlots,
  turno,
  onTurnoChange,
  loading,
  selected,
  onSelect,
  onContinue,
  onBack,
  onRetry,
}: {
  clinic: Clinic | null
  date: Date | undefined
  morningSlots: Slot[]
  afternoonSlots: Slot[]
  turno: 'manana' | 'tarde' | null
  onTurnoChange: (t: 'manana' | 'tarde' | null) => void
  loading: boolean
  selected: Slot | null
  onSelect: (s: Slot) => void
  onContinue: () => void
  onBack: () => void
  onRetry: () => void
}) {
  const hasMorning = morningSlots.length > 0
  const hasAfternoon = afternoonSlots.length > 0
  const hasAny = hasMorning || hasAfternoon
  const displaySlots = turno === 'manana' ? morningSlots : turno === 'tarde' ? afternoonSlots : []

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900">Selecciona un horario</h2>
      <p className="text-sm text-slate-500 mt-1">
        {date && (
          <>
            Para <span className="font-medium">{format(date, "EEEE, d 'de' MMMM", { locale: es })}</span>
            {clinic && ` · ${clinic.name}`}
          </>
        )}
      </p>

      <div className="mt-5">
        {loading ? (
          <div className="space-y-2.5">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : !hasAny ? (
          <div className="text-center py-8 px-4 rounded-xl bg-amber-50 border border-amber-200">
            <AlertCircle className="h-8 w-8 text-amber-600 mx-auto" />
            <p className="text-sm text-amber-800 mt-2 font-medium">
              No hay horarios disponibles para este día.
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Intenta con otra fecha o vuelve a intentar.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="mt-3 border-amber-300 text-amber-700 hover:bg-amber-100"
            >
              Reintentar
            </Button>
          </div>
        ) : (
          <>
            {/* Selección de turno */}
            <p className="text-sm font-medium text-slate-700 mb-2">¿Qué turno prefieres?</p>
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <button
                onClick={() => { onTurnoChange('manana'); onSelect({} as Slot) }}
                disabled={!hasMorning}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                  turno === 'manana'
                    ? 'border-[#0a3143] bg-[#0a3143]/5'
                    : hasMorning
                      ? 'border-slate-200 hover:border-[#0a3143]/40 hover:bg-slate-50'
                      : 'border-slate-100 opacity-40 cursor-not-allowed'
                }`}
              >
                <Sun className={`h-5 w-5 ${turno === 'manana' ? 'text-[#0a3143]' : 'text-slate-400'}`} />
                <span className="font-bold text-slate-900">Mañana</span>
                <span className="text-xs text-slate-500">{hasMorning ? `${morningSlots.length} disponible${morningSlots.length > 1 ? 's' : ''}` : 'Sin cupo'}</span>
              </button>
              <button
                onClick={() => { onTurnoChange('tarde'); onSelect({} as Slot) }}
                disabled={!hasAfternoon}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                  turno === 'tarde'
                    ? 'border-[#0a3143] bg-[#0a3143]/5'
                    : hasAfternoon
                      ? 'border-slate-200 hover:border-[#0a3143]/40 hover:bg-slate-50'
                      : 'border-slate-100 opacity-40 cursor-not-allowed'
                }`}
              >
                <Moon className={`h-5 w-5 ${turno === 'tarde' ? 'text-[#0a3143]' : 'text-slate-400'}`} />
                <span className="font-bold text-slate-900">Tarde</span>
                <span className="text-xs text-slate-500">{hasAfternoon ? `${afternoonSlots.length} disponible${afternoonSlots.length > 1 ? 's' : ''}` : 'Sin cupo'}</span>
              </button>
            </div>

            {/* Horarios del turno seleccionado */}
            {turno && displaySlots.length > 0 && (
              <>
                <p className="text-sm font-medium text-slate-700 mb-2">
                  Horarios disponibles ({turno === 'manana' ? 'mañana' : 'tarde'}):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {displaySlots.map((s) => {
                    const active = selected?.startTime === s.startTime
                    return (
                      <button
                        key={s.startTime}
                        onClick={() => onSelect(s)}
                        className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                          active
                            ? 'border-[#0a3143] bg-[#0a3143]/5'
                            : 'border-slate-200 hover:border-[#0a3143]/40 hover:bg-slate-50'
                        }`}
                      >
                        <Clock className={`h-5 w-5 ${active ? 'text-[#0a3143]' : 'text-slate-400'}`} />
                        <span className="font-bold text-lg text-slate-900">{fmt12h(s.startTime)}</span>
                        <span className="text-xs text-slate-500">a {fmt12h(s.endTime)}</span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="mt-6 flex gap-2">
        <Button variant="outline" onClick={onBack} className="flex-1 sm:flex-none">
          <ChevronLeft className="h-4 w-4 mr-1" /> Atrás
        </Button>
        <Button
          onClick={onContinue}
          disabled={!selected?.startTime}
          className="flex-1 text-white"
          style={{ backgroundColor: BRAND }}
        >
          Continuar
        </Button>
      </div>
    </div>
  )
}

// ============================================================
// Step 5 — Datos personales
// ============================================================
function StepDatos({
  form,
  onChange,
  onContinue,
  onBack,
}: {
  form: {
    firstName: string
    lastName: string
    phone: string
    email: string
    reason: string
    esNuevo: boolean
  }
  onChange: (f: typeof form) => void
  onContinue: () => void
  onBack: () => void
}) {
  const [touched, setTouched] = useState(false)
  const phoneDigits = form.phone.replace(/\D/g, '')
  const phoneValid = phoneDigits.length === 10
  const nameValid = form.firstName.trim().length >= 2
  const lastNameValid = form.lastName.trim().length >= 2
  const emailValid = !form.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
  const canContinue = phoneValid && nameValid && lastNameValid && emailValid

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900">Tus datos</h2>
      <p className="text-sm text-slate-500 mt-1">
        Necesitamos algunos datos para registrar tu cita.
      </p>

      <div className="mt-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="firstName">
              Nombre <span className="text-red-500">*</span>
            </Label>
            <Input
              id="firstName"
              value={form.firstName}
              onChange={(e) => onChange({ ...form, firstName: e.target.value })}
              placeholder="Ej. María"
              autoComplete="given-name"
            />
            {touched && !nameValid && (
              <p className="text-xs text-red-500">El nombre es muy corto.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName">
              Apellido <span className="text-red-500">*</span>
            </Label>
            <Input
              id="lastName"
              value={form.lastName}
              onChange={(e) => onChange({ ...form, lastName: e.target.value })}
              placeholder="Ej. López"
              autoComplete="family-name"
            />
            {touched && !lastNameValid && (
              <p className="text-xs text-red-500">El apellido es muy corto.</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">
            Teléfono (10 dígitos) <span className="text-red-500">*</span>
          </Label>
          <Input
            id="phone"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => onChange({ ...form, phone: e.target.value })}
            placeholder="662 123 4567"
            autoComplete="tel"
            maxLength={15}
          />
          {touched && !phoneValid && (
            <p className="text-xs text-red-500">Ingresa un teléfono mexicano válido (10 dígitos).</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Correo electrónico (opcional)</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => onChange({ ...form, email: e.target.value })}
            placeholder="tucorreo@ejemplo.com"
            autoComplete="email"
          />
          {touched && !emailValid && (
            <p className="text-xs text-red-500">Email inválido.</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reason">Motivo de la visita (opcional)</Label>
          <Textarea
            id="reason"
            rows={2}
            value={form.reason}
            onChange={(e) => onChange({ ...form, reason: e.target.value })}
            placeholder="Ej. Dolor en el pie, revisión general, etc."
          />
        </div>

        <div className="rounded-xl border border-slate-200 p-4">
          <Label className="text-sm font-medium mb-2 block">¿Eres paciente de la clínica?</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...form, esNuevo: true })}
              className={`flex-1 py-2.5 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                form.esNuevo
                  ? 'border-[#0a3143] bg-[#0a3143]/5 text-[#0a3143]'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              Soy paciente nuevo
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...form, esNuevo: false })}
              className={`flex-1 py-2.5 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                !form.esNuevo
                  ? 'border-[#0a3143] bg-[#0a3143]/5 text-[#0a3143]'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              Ya he visitado la clínica
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        <Button variant="outline" onClick={onBack} className="flex-1 sm:flex-none">
          <ChevronLeft className="h-4 w-4 mr-1" /> Atrás
        </Button>
        <Button
          onClick={() => {
            setTouched(true)
            if (canContinue) onContinue()
          }}
          className="flex-1 text-white"
          style={{ backgroundColor: BRAND }}
        >
          Continuar
        </Button>
      </div>
    </div>
  )
}

// ============================================================
// Step 6 — Confirmación
// ============================================================
function StepConfirmacion({
  clinic,
  podologistId,
  podologists,
  resolvedPodologistName,
  date,
  slot,
  form,
  submitting,
  onConfirm,
  onBack,
}: {
  clinic: Clinic | null
  podologistId: string
  podologists: Podologist[]
  resolvedPodologistName: string | null
  date: Date | undefined
  slot: Slot | null
  form: {
    firstName: string
    lastName: string
    phone: string
    email: string
    reason: string
    esNuevo: boolean
  }
  submitting: boolean
  onConfirm: () => void
  onBack: () => void
}) {
  const podName = podologistId
    ? podologists.find((p) => p.id === podologistId)?.name || 'Podólogo'
    : resolvedPodologistName || 'Cualquier podólogo'

  const rows: { label: string; value: string; icon: typeof User }[] = []
  if (clinic) {
    rows.push({ label: 'Clínica', value: clinic.name, icon: Building2 })
  }
  rows.push({ label: 'Podólogo', value: podName, icon: Stethoscope })
  if (date) {
    rows.push({
      label: 'Fecha',
      value: format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es }),
      icon: CalendarDays,
    })
  }
  if (slot) {
    rows.push({ label: 'Hora', value: `${fmt12h(slot.startTime)} – ${fmt12h(slot.endTime)}`, icon: Clock })
  }
  rows.push({
    label: 'Paciente',
    value: `${form.firstName} ${form.lastName}`,
    icon: User,
  })
  rows.push({ label: 'Teléfono', value: form.phone, icon: Phone })

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900">Confirma tu cita</h2>
      <p className="text-sm text-slate-500 mt-1">
        Revisa que todo esté correcto antes de confirmar.
      </p>

      <div className="mt-5 rounded-xl border border-slate-200 overflow-hidden">
        {rows.map((r, i) => {
          const Icon = r.icon
          return (
            <div
              key={r.label}
              className={`flex items-start gap-3 p-3.5 ${
                i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
              }`}
            >
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: BRAND }}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500 uppercase tracking-wide">{r.label}</p>
                <p className="text-sm font-medium text-slate-900 break-words">{r.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
        Al confirmar, tu cita quedará en estado <strong>pendiente</strong>. Te sugerimos
        avisar a la clínica por WhatsApp para confirmar tu asistencia.
      </div>

      <div className="mt-6 flex gap-2">
        <Button variant="outline" onClick={onBack} disabled={submitting} className="flex-1 sm:flex-none">
          <ChevronLeft className="h-4 w-4 mr-1" /> Atrás
        </Button>
        <Button
          onClick={onConfirm}
          disabled={submitting}
          className="flex-1 text-white"
          style={{ backgroundColor: BRAND }}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Reservando...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Confirmar cita
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

// ============================================================
// Pantalla de éxito
// ============================================================
function SuccessScreen({
  success,
  clinic,
  date,
  slot,
  form,
  onReset,
}: {
  success: BookingSuccess
  clinic: Clinic | null
  date: Date | undefined
  slot: Slot | null
  form: {
    firstName: string
    lastName: string
    phone: string
    email: string
    reason: string
    esNuevo: boolean
  }
  onReset: () => void
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-10 text-center">
      {/* Check animado */}
      <div className="mx-auto h-20 w-20 rounded-full flex items-center justify-center" style={{ backgroundColor: '#dcfce7' }}>
        <CheckCircle2 className="h-12 w-12 text-emerald-600" />
      </div>

      <h2 className="text-2xl font-bold text-slate-900 mt-4">¡Cita reservada!</h2>
      <p className="text-sm text-slate-500 mt-1">
        Hemos registrado tu cita. Te recomendamos avisar a la clínica por WhatsApp para
        confirmar tu asistencia.
      </p>

      {/* Resumen */}
      <div className="mt-6 rounded-xl border border-slate-200 text-left p-4 space-y-2.5 bg-slate-50/60">
        <SuccessRow label="Clínica" value={success.clinicName} />
        <SuccessRow label="Paciente" value={success.patientName} />
        <SuccessRow label="Expediente" value={success.expNumber} />
        <SuccessRow label="Podólogo" value={success.podologistName || 'Por asignar'} />
        {date && (
          <SuccessRow
            label="Fecha"
            value={format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
          />
        )}
        {slot && <SuccessRow label="Hora" value={`${fmt12h(slot.startTime)} – ${fmt12h(slot.endTime)}`} />}
        <SuccessRow label="Estado" value="Pendiente de confirmación" />
        {success.isNewPatient && (
          <div className="pt-2 mt-2 border-t border-slate-200">
            <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full">
              <Check className="h-3 w-3" /> Paciente nuevo registrado
            </span>
          </div>
        )}
      </div>

      {/* Botones */}
      <div className="mt-6 space-y-2.5">
        {success.whatsappUrl && (
          <a
            href={success.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-medium text-white transition-colors"
            style={{ backgroundColor: '#25D366' }}
          >
            <MessageCircle className="h-5 w-5" />
            Avisar a la clínica por WhatsApp
          </a>
        )}
        <Button
          variant="outline"
          onClick={onReset}
          className="w-full"
        >
          Agendar otra cita
        </Button>
      </div>

      {clinic?.phone && (
        <p className="text-xs text-slate-500 mt-4">
          ¿Tienes dudas? Llámanos al{' '}
          <a
            href={`tel:+52${clinic.phone.replace(/\D/g, '')}`}
            className="font-medium text-[#0a3143] underline"
          >
            {clinic.phone}
          </a>
        </p>
      )}
    </div>
  )
}

function SuccessRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-3">
      <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-slate-900 text-right">{value}</span>
    </div>
  )
}

// ============================================================
// Helpers
// ============================================================
function fmt12h(hhmm: string): string {
  // "13:30" → "1:30 PM"
  const [h, m] = hhmm.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}
