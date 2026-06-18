'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, Save, Printer, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import type { HistoriaClinicaInicial, Patient } from './types'

import { MotivoConsultaSection } from './motivo-consulta-section'
import { PadecimientoActualSection } from './padecimiento-actual-section'
import { AntecedentesFamiliaresSection } from './antecedentes-familiares-section'
import { AntecedentesPatologicosSection } from './antecedentes-patologicos-section'
import { AntecedentesNoPatologicosSection } from './antecedentes-no-patologicos-section'
import { InterrogatorioSection } from './interrogatorio-section'
import { SignosVitalesSection } from './signos-vitales-section'
import { ExploracionGeneralSection } from './exploracion-general-section'
import { ExploracionPodologicaSection } from './exploracion-podologica-section'
import { DiagnosticosSection } from './diagnosticos-section'
import { PronosticoSection } from './pronostico-section'
import { PlanManejoSection } from './plan-manejo-section'
import { SectionCard } from './section-card'
import { fmtDateTime } from '@/lib/format'

/** Calcula un riesgo sugerido basado en los inputs del formulario. */
function computeSuggestedRisk(form: HistoriaClinicaInicial, isDiabetic: boolean): {
  nivel: string
  justificacion: string
  requiereReferencia: boolean
} {
  const reasons: string[] = []
  let nivel = 'BAJO'

  // Diabetes + neuropatía o pie diabético = ALTO o URGENTE
  const pat = form.antecedentesPatologicos?.diabetes
  if (isDiabetic) {
    reasons.push('Paciente diabético')
    if (pat?.neuropatia || pat?.pieDiabetico) {
      nivel = 'URGENTE'
      reasons.push('Neuropatía / pie diabético documentado')
    } else if (pat?.retinopatia || pat?.nefropatia) {
      nivel = 'ALTO'
      reasons.push('Complicaciones microvasculares')
    } else {
      nivel = 'ALTO'
    }
  }

  // ITB bajo
  const itbD = form.exploracionPodologica?.exploracionVascular?.itbDerecho
  const itbI = form.exploracionPodologica?.exploracionVascular?.itbIzquierdo
  if ((itbD && itbD < 0.9) || (itbI && itbI < 0.9)) {
    if (nivel !== 'URGENTE') nivel = 'ALTO'
    reasons.push('ITB < 0.9 (isquemia)')
  }

  // Úlceras / heridas en exploración
  const integ = form.exploracionPodologica?.inspeccionDermatologica?.pieDerecho?.integridad
  const integI = form.exploracionPodologica?.inspeccionDermatologica?.pieIzquierdo?.integridad
  if (integ === 'Úlceras' || integI === 'Úlceras') {
    nivel = 'URGENTE'
    reasons.push('Úlcera presente')
  }

  // Sin pulso
  const vasc = form.exploracionPodologica?.exploracionVascular
  if (
    vasc?.pulsoPedioDerecho === 'Ausente' ||
    vasc?.pulsoPedioIzquierdo === 'Ausente' ||
    vasc?.pulsoTibialDerecho === 'Ausente' ||
    vasc?.pulsoTibialIzquierdo === 'Ausente'
  ) {
    if (nivel !== 'URGENTE') nivel = 'ALTO'
    reasons.push('Pulso ausente')
  }

  // EVA alta
  const eva = form.padecimientoActual?.eva
  if (eva && eva >= 8) {
    if (nivel === 'BAJO') nivel = 'MODERADO'
    reasons.push(`EVA ${eva}/10`)
  }

  if (reasons.length === 0) reasons.push('Sin factores de riesgo identificados')

  return {
    nivel,
    justificacion: reasons.join('; '),
    requiereReferencia: nivel === 'URGENTE',
  }
}

const RISK_COLOR: Record<string, string> = {
  BAJO: '#16a34a',
  MODERADO: '#d97706',
  ALTO: '#dc2626',
  URGENTE: '#7f1d1d',
}

export function HistoriaClinicaForm({ patient }: { patient: Patient }) {
  // Cargar historia clínica primero, luego montar el body con key para evitar
  // setState-in-effect (remount limpio cuando los datos llegan).
  const { data: hcData, isLoading } = useQuery<{ historiaClinicaInicial?: HistoriaClinicaInicial }>({
    queryKey: ['historia-clinica', patient.id],
    queryFn: () =>
      fetch(`/api/pacientes/${patient.id}/historia-clinica`)
        .then((r) => r.json())
        .then((d) => d?.data || d || {}),
    enabled: !!patient.id,
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Cargando historia clínica…</span>
      </div>
    )
  }

  return (
    <HistoriaClinicaFormBody
      key={hcData ? 'loaded' : 'empty'}
      patient={patient}
      initial={hcData?.historiaClinicaInicial || {}}
    />
  )
}

function HistoriaClinicaFormBody({
  patient,
  initial,
}: {
  patient: Patient
  initial: HistoriaClinicaInicial
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState<HistoriaClinicaInicial>(initial || {})

  // Mutación de guardado
  const saveMutation = useMutation({
    mutationFn: async (next: HistoriaClinicaInicial) => {
      const res = await fetch(`/api/pacientes/${patient.id}/historia-clinica`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'Error al guardar')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Historia clínica guardada')
      qc.invalidateQueries({ queryKey: ['historia-clinica', patient.id] })
      qc.invalidateQueries({ queryKey: ['paciente', patient.id] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function save() {
    saveMutation.mutate(form)
  }

  // Sugerencia de riesgo podológico (derivada, no destructiva)
  const suggestedRisk = useMemo(() => computeSuggestedRisk(form, patient.isDiabetic), [form, patient.isDiabetic])

  function applySuggestedRisk() {
    setForm({
      ...form,
      evaluacionRiesgo: suggestedRisk,
    })
    toast.success(`Riesgo sugerido: ${suggestedRisk.nivel}`)
  }

  const riesgo = form.evaluacionRiesgo || { nivel: '', justificacion: '', requiereReferencia: false }
  function setRiesgo(patch: Partial<NonNullable<HistoriaClinicaInicial['evaluacionRiesgo']>>) {
    setForm({ ...form, evaluacionRiesgo: { ...riesgo, ...patch } })
  }

  const handlePrint = () => window.print()

  const pctCompleto =
    Object.values(form).filter((v) => v && (typeof v === 'object' ? Object.keys(v).length > 0 : true))
      .length / 13

  return (
    <div className="space-y-3">
      {/* Banner de estado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-md border bg-muted/30 print:hidden">
        <div className="flex items-center gap-2 text-sm">
          {patient.historiaClinicaCompleta ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-amber-600" />
          )}
          <span className="text-muted-foreground">
            {patient.historiaClinicaCompleta ? 'Historia clínica completa' : 'Historia clínica en captura'}
          </span>
          {patient.historiaClinicaFecha && (
            <span className="text-xs text-muted-foreground">
              · Última actualización: {fmtDateTime(patient.historiaClinicaFecha)}
            </span>
          )}
          <Badge variant="outline" className="text-[10px]">
            {Math.round(pctCompleto * 100)}% lleno
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
          <Button
            size="sm"
            onClick={save}
            disabled={saveMutation.isPending}
            style={{ backgroundColor: '#0a3143' }}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Guardar historia clínica
          </Button>
        </div>
      </div>

      <MotivoConsultaSection
        value={form.motivoConsulta}
        onChange={(v) => setForm({ ...form, motivoConsulta: v })}
      />
      <PadecimientoActualSection
        value={form.padecimientoActual}
        onChange={(v) => setForm({ ...form, padecimientoActual: v })}
      />
      <AntecedentesFamiliaresSection
        value={form.antecedentesFamiliares}
        onChange={(v) => setForm({ ...form, antecedentesFamiliares: v })}
      />
      <AntecedentesPatologicosSection
        value={form.antecedentesPatologicos}
        onChange={(v) => setForm({ ...form, antecedentesPatologicos: v })}
      />
      <AntecedentesNoPatologicosSection
        value={form.antecedentesNoPatologicos}
        onChange={(v) => setForm({ ...form, antecedentesNoPatologicos: v })}
      />
      <InterrogatorioSection
        value={form.interrogatorioAparatos}
        onChange={(v) => setForm({ ...form, interrogatorioAparatos: v })}
      />
      <SignosVitalesSection
        value={form.signosVitales}
        onChange={(v) => setForm({ ...form, signosVitales: v })}
      />
      <ExploracionGeneralSection
        value={form.exploracionGeneral}
        onChange={(v) => setForm({ ...form, exploracionGeneral: v })}
      />
      <ExploracionPodologicaSection
        value={form.exploracionPodologica}
        onChange={(v) => setForm({ ...form, exploracionPodologica: v })}
      />

      {/* 13. Evaluación de riesgo podológico */}
      <SectionCard number="13" title="Evaluación de riesgo podológico" icon={AlertCircle}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">Nivel actual:</span>
          <Badge
            variant="outline"
            className="text-sm font-bold px-3 py-1"
            style={{
              color: RISK_COLOR[riesgo.nivel || ''] || '#666',
              borderColor: RISK_COLOR[riesgo.nivel || ''] || '#666',
            }}
          >
            {riesgo.nivel || 'Sin clasificar'}
          </Badge>
          <Button type="button" variant="outline" size="sm" onClick={applySuggestedRisk}>
            <AlertCircle className="h-3 w-3" /> Sugerir según datos
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Sugerencia del sistema: <strong>{suggestedRisk.nivel}</strong> — {suggestedRisk.justificacion}
        </p>

        <div className="flex flex-wrap gap-2">
          {['BAJO', 'MODERADO', 'ALTO', 'URGENTE'].map((n) => {
            const active = riesgo.nivel === n
            return (
              <button
                type="button"
                key={n}
                onClick={() => setRiesgo({ nivel: n })}
                className="rounded-md border px-3 py-1.5 text-sm font-medium"
                style={{
                  backgroundColor: active ? RISK_COLOR[n] : 'transparent',
                  borderColor: RISK_COLOR[n],
                  color: active ? 'white' : RISK_COLOR[n],
                }}
              >
                {n}
              </button>
            )
          })}
        </div>

        <div>
          <label className="text-xs uppercase text-muted-foreground">Justificación</label>
          <textarea
            rows={2}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={riesgo.justificacion || ''}
            onChange={(e) => setRiesgo({ justificacion: e.target.value })}
          />
        </div>

        {riesgo.nivel === 'URGENTE' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Riesgo URGENTE</AlertTitle>
            <AlertDescription>
              Se recomienda generar una referencia médica inmediata y atención prioritaria.
            </AlertDescription>
          </Alert>
        )}
      </SectionCard>

      <DiagnosticosSection
        value={form.diagnosticos}
        onChange={(v) => setForm({ ...form, diagnosticos: v })}
        isDiabetic={patient.isDiabetic}
      />
      <PronosticoSection
        value={form.pronostico}
        onChange={(v) => setForm({ ...form, pronostico: v })}
      />
      <PlanManejoSection
        value={form.planManejo}
        onChange={(v) => setForm({ ...form, planManejo: v })}
      />

      {/* Sticky bottom save on mobile */}
      <div className="sticky bottom-2 flex justify-end print:hidden">
        <Button
          size="sm"
          onClick={save}
          disabled={saveMutation.isPending}
          style={{ backgroundColor: '#0a3143' }}
          className="shadow-lg"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Guardar historia clínica
        </Button>
      </div>
    </div>
  )
}
