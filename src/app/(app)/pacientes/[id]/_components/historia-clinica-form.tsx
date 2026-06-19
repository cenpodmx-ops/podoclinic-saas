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

  const handlePrint = () => {
    // Generar HTML de impresión profesional NOM-004
    const f = form as any
    const p = patient
    const patientName = `${p.firstName} ${p.lastName}`
    const age = p.birthDate ? Math.floor((Date.now() - new Date(p.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : '—'

    const esc = (s: any) => !s ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

    // Helper para renderizar antecedentes con checkboxes
    const renderAntecedentes = (items: Record<string, any>, labels: Record<string, string>) => {
      if (!items) return '<p class="muted">Sin datos registrados.</p>'
      const active = Object.entries(items).filter(([, v]) => v && (typeof v === 'object' ? Object.keys(v).length > 0 : v === true))
      if (active.length === 0) return '<p class="muted">Sin antecedentes registrados.</p>'
      return active.map(([k, v]) => {
        const label = labels[k] || k
        if (typeof v === 'object' && v) {
          return `<div class="ant-row"><span class="ant-check">☑</span> <strong>${esc(label)}</strong>` +
            (v.familiar ? ` — ${esc(v.familiar)}` : '') +
            (v.edad ? ` (edad: ${esc(v.edad)})` : '') +
            (v.observaciones ? ` — ${esc(v.observaciones)}` : '') +
            `</div>`
        }
        return `<div class="ant-row"><span class="ant-check">☑</span> ${esc(label)}</div>`
      }).join('')
    }

    // Helper para chips
    const renderChips = (arr: string[], labels?: Record<string,string>) => {
      if (!arr || arr.length === 0) return '<span class="muted">Ninguno</span>'
      return arr.map(a => `<span class="chip">${esc(labels?.[a] || a)}</span>`).join(' ')
    }

    const motivoConsulta = f.motivoConsulta || {}
    const padecimiento = f.padecimientoActual || {}
    const antFam = f.antecedentesFamiliares || {}
    const antPat = f.antecedentesPatologicos || {}
    const antNoPat = f.antecedentesNoPatologicos || {}
    const interrogatorio = f.interrogatorioAparatos || {}
    const signos = f.signosVitales || {}
    const exploracion = f.exploracionGeneral || {}
    const explPodo = f.exploracionPodologica || {}
    const riesgo = f.evaluacionRiesgo || {}
    const diagnosticos = f.diagnosticos || {}
    const pronostico = f.pronostico || {}
    const plan = f.planManejo || {}

    const MOTIVO_LABELS: Record<string,string> = {
      'una_encarnada':'Uña encarnada','dolor_dedo':'Dolor en dedo','dolor_plantar':'Dolor plantar',
      'callosidad':'Callosidad','heloma':'Heloma','dureza':'Dureza','verruga_plantar':'Verruga plantar',
      'onicomicosis':'Onicomicosis','engrosamiento_ungueal':'Engrosamiento ungueal','una_traumatica':'Uña traumática',
      'pie_diabetico':'Pie diabético','herida':'Herida','ulcera':'Úlcera','mal_olor':'Mal olor',
      'sudoracion':'Sudoración excesiva','dolor_talon':'Dolor en talón','dolor_arco':'Dolor en arco',
      'dolor_metatarsos':'Dolor en metatarsos','pisada':'Alteración de la pisada','fascitis':'Fascitis plantar',
      'revision':'Revisión preventiva','corte':'Corte podológico','seguimiento':'Seguimiento post-procedimiento',
      'otro':'Otro'
    }

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>Historia Clínica — ${esc(patientName)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Times New Roman', Georgia, serif; color: #1a1a1a; margin: 0; line-height: 1.6; font-size: 12px; }
  .doc { max-width: 190mm; margin: 0 auto; }
  .header { text-align: center; border-bottom: 3px solid #0a3143; padding-bottom: 10px; margin-bottom: 16px; }
  .header h1 { font-size: 20px; color: #0a3143; margin: 0; letter-spacing: 0.05em; }
  .header .sub { font-size: 12px; color: #555; margin-top: 4px; }
  .header .nom { font-size: 10px; color: #888; margin-top: 2px; }
  .section { margin-top: 14px; }
  .section-title { font-size: 13px; font-weight: 700; color: #0a3143; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1.5px solid #0a3143; padding-bottom: 3px; margin-bottom: 6px; }
  .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; }
  .field { font-size: 11px; }
  .field .lbl { font-weight: 600; color: #444; }
  .field .val { color: #111; }
  .ant-row { font-size: 11px; margin: 2px 0; }
  .ant-check { color: #0a3143; font-weight: bold; }
  .chip { display: inline-block; background: #e8f0f4; border: 1px solid #b0c4d8; border-radius: 3px; padding: 1px 6px; font-size: 10px; margin: 1px; }
  .muted { color: #999; font-style: italic; font-size: 11px; }
  .alert-box { border: 1.5px solid #dc2626; background: #fef2f2; border-radius: 4px; padding: 6px 10px; font-size: 11px; color: #991b1b; margin: 6px 0; }
  .risk-box { display: inline-block; padding: 3px 12px; border-radius: 4px; font-weight: 700; font-size: 12px; }
  .risk-BAJO { background: #d1fae5; color: #065f46; }
  .risk-MEDIO { background: #fef3c7; color: #92400e; }
  .risk-ALTO { background: #fee2e2; color: #991b1b; }
  .risk-URGENTE { background: #dc2626; color: #fff; }
  .signature-area { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
  .sig-line { border-top: 1.5px solid #333; padding-top: 6px; font-size: 10px; text-align: center; color: #555; }
  .footer { margin-top: 30px; border-top: 1px solid #ddd; padding-top: 8px; font-size: 9px; color: #888; text-align: center; }
  .confidential { font-size: 9px; color: #999; text-align: center; margin-top: 4px; font-style: italic; }
  @media print { .no-print { display: none; } .doc { max-width: none; } }
</style>
</head>
<body>
<div class="doc">
  <div class="header">
    <h1>HISTORIA CLÍNICA PODOLÓGICA</h1>
    <div class="sub">Grupo CENPOD · Centro Podológico</div>
    <div class="nom">Documento conforme a la NOM-004-SSA3-2012</div>
  </div>

  <!-- DATOS DEL PACIENTE -->
  <div class="section">
    <div class="section-title">Datos del paciente</div>
    <div class="field-grid">
      <div class="field"><span class="lbl">Nombre:</span> <span class="val">${esc(patientName)}</span></div>
      <div class="field"><span class="lbl">Expediente:</span> <span class="val">${esc(p.expNumber)}</span></div>
      <div class="field"><span class="lbl">Fecha de nacimiento:</span> <span class="val">${p.birthDate ? new Date(p.birthDate).toLocaleDateString('es-MX') : '—'}</span></div>
      <div class="field"><span class="lbl">Edad:</span> <span class="val">${age} años</span></div>
      <div class="field"><span class="lbl">Sexo:</span> <span class="val">${esc(p.sex || '—')}</span></div>
      <div class="field"><span class="lbl">Teléfono:</span> <span class="val">${esc(p.phone || '—')}</span></div>
      <div class="field"><span class="lbl">CURP:</span> <span class="val">${esc(p.curp || '—')}</span></div>
      <div class="field"><span class="lbl">RFC:</span> <span class="val">${esc(p.rfc || '—')}</span></div>
    </div>
    ${p.isDiabetic ? '<div class="alert-box">⚠ PACIENTE DIABÉTICO — Requiere manejo especial y precaución en procedimientos.</div>' : ''}
    ${p.allergies ? `<div class="alert-box">⚠ ALERGIAS: ${esc(p.allergies)}</div>` : ''}
    ${p.currentMeds ? `<div class="field" style="margin-top:4px"><span class="lbl">Medicamentos actuales:</span> <span class="val">${esc(p.currentMeds)}</span></div>` : ''}
  </div>

  <!-- MOTIVO DE CONSULTA -->
  ${motivoConsulta.opciones || motivoConsulta.descripcion ? `
  <div class="section">
    <div class="section-title">Motivo de consulta</div>
    ${motivoConsulta.opciones ? `<div style="margin-bottom:4px">${renderChips(motivoConsulta.opciones, MOTIVO_LABELS)}</div>` : ''}
    ${motivoConsulta.descripcion ? `<div class="field">${esc(motivoConsulta.descripcion)}</div>` : ''}
  </div>` : ''}

  <!-- PADECIMIENTO ACTUAL -->
  ${padecimiento.inicio || padecimiento.tiempo || padecimiento.sintomas ? `
  <div class="section">
    <div class="section-title">Padecimiento actual</div>
    <div class="field-grid">
      <div class="field"><span class="lbl">Inicio:</span> <span class="val">${esc(padecimiento.inicio || '—')}</span></div>
      <div class="field"><span class="lbl">Tiempo de evolución:</span> <span class="val">${esc(padecimiento.tiempo || '—')}</span></div>
    </div>
    ${padecimiento.localizacion ? `<div class="field" style="margin-top:4px"><span class="lbl">Localización:</span> ${renderChips(padecimiento.localizacion)}</div>` : ''}
    ${padecimiento.sintomas ? `<div class="field" style="margin-top:4px"><span class="lbl">Síntomas:</span> ${renderChips(padecimiento.sintomas)}</div>` : ''}
    ${padecimiento.eva !== undefined ? `<div class="field" style="margin-top:4px"><span class="lbl">Escala EVA:</span> <span class="val">${esc(padecimiento.eva)}/10</span></div>` : ''}
    ${padecimiento.observaciones ? `<div class="field" style="margin-top:4px"><span class="lbl">Observaciones:</span> ${esc(padecimiento.observaciones)}</div>` : ''}
  </div>` : ''}

  <!-- ANTECEDENTES HEREDOFAMILIARES -->
  <div class="section">
    <div class="section-title">Antecedentes heredofamiliares</div>
    ${renderAntecedentes(antFam.items || antFam, {
      diabetes:'Diabetes mellitus','hipertension':'Hipertensión arterial','renal':'Enfermedad renal crónica',
      vascular':'Enfermedad vascular periférica','cardiovascular':'Enfermedad cardiovascular','artritis':'Artritis reumatoide',
      gota':'Gota','psoriasis':'Psoriasis','cancer':'Cáncer','coagulacion':'Trastornos de coagulación',
      ortopedicos':'Problemas ortopédicos del pie','amputaciones':'Amputaciones','pie_diabetico':'Pie diabético'
    })}
  </div>

  <!-- ANTECEDENTES PERSONALES PATOLÓGICOS -->
  <div class="section">
    <div class="section-title">Antecedentes personales patológicos</div>
    ${renderAntecedentes(antPat.enfermedades || antPat, {
      dm1':'Diabetes mellitus tipo 1','dm2':'Diabetes mellitus tipo 2','hta':'Hipertensión arterial',
      dislipidemia':'Dislipidemia','renal':'Enfermedad renal crónica','cardiopatia':'Cardiopatía',
      venosa':'Insuficiencia venosa','arterial':'Enfermedad arterial periférica','neuropatia':'Neuropatía periférica',
      artritis':'Artritis reumatoide','gota':'Gota','psoriasis':'Psoriasis','dermatitis':'Dermatitis',
      inmunosupresion':'Inmunosupresión','vih':'VIH','cancer':'Cáncer','obesidad':'Obesidad',
      coagulacion':'Trastornos de coagulación','epilepsia':'Epilepsia'
    })}
    ${antPat.diabetes ? `<div style="margin-top:6px"><strong>Datos de diabetes:</strong>` +
      (antPat.diabetes.añoDiagnostico ? `<div class="field">Año de diagnóstico: ${esc(antPat.diabetes.añoDiagnostico)}</div>` : '') +
      (antPat.diabetes.tratamiento ? `<div class="field">Tratamiento: ${renderChips(antPat.diabetes.tratamiento)}</div>` : '') +
      (antPat.diabetes.ultimaGlucosa ? `<div class="field">Última glucosa capilar: ${esc(antPat.diabetes.ultimaGlucosa)} mg/dL</div>` : '') +
      (antPat.diabetes.hba1c ? `<div class="field">Última HbA1c: ${esc(antPat.diabetes.hba1c)}%</div>` : '') +
      (antPat.diabetes.neuropatia ? `<div class="field">⚠ Neuropatía conocida</div>` : '') +
      `</div>` : ''}
    ${antPat.alergias ? `<div class="alert-box" style="margin-top:6px">Alergias: ${esc(antPat.alergias)}</div>` : ''}
    ${antPat.medicamentos ? `<div class="field" style="margin-top:4px"><span class="lbl">Medicamentos actuales:</span> ${esc(antPat.medicamentos)}</div>` : ''}
  </div>

  <!-- ANTECEDENTES NO PATOLÓGICOS -->
  <div class="section">
    <div class="section-title">Antecedentes personales no patológicos</div>
    <div class="field-grid">
      <div class="field"><span class="lbl">Tabaquismo:</span> <span class="val">${esc(antNoPat.tabaquismo || '—')}</span></div>
      <div class="field"><span class="lbl">Alcohol:</span> <span class="val">${esc(antNoPat.alcohol || '—')}</span></div>
      <div class="field"><span class="lbl">Actividad física:</span> <span class="val">${esc(antNoPat.actividad || '—')}</span></div>
      <div class="field"><span class="lbl">Tipo de calzado:</span> <span class="val">${esc(antNoPat.calzado || '—')}</span></div>
      <div class="field"><span class="lbl">Quién corta uñas:</span> <span class="val">${esc(antNoPat.quienCorta || '—')}</span></div>
      <div class="field"><span class="lbl">Ocupación:</span> <span class="val">${esc(antNoPat.ocupacion || '—')}</span></div>
    </div>
  </div>

  <!-- SIGNOS VITALES -->
  ${signos.ta || signos.fc || signos.fr || signos.temperatura || signos.peso || signos.talla ? `
  <div class="section">
    <div class="section-title">Signos vitales y somatometría</div>
    <div class="field-grid">
      <div class="field"><span class="lbl">TA:</span> <span class="val">${esc(signos.ta || '—')} mmHg</span></div>
      <div class="field"><span class="lbl">FC:</span> <span class="val">${esc(signos.fc || '—')} lpm</span></div>
      <div class="field"><span class="lbl">FR:</span> <span class="val">${esc(signos.fr || '—')} rpm</span></div>
      <div class="field"><span class="lbl">Temp:</span> <span class="val">${esc(signos.temperatura || '—')} °C</span></div>
      <div class="field"><span class="lbl">Peso:</span> <span class="val">${esc(signos.peso || '—')} kg</span></div>
      <div class="field"><span class="lbl">Talla:</span> <span class="val">${esc(signos.talla || '—')} m</span></div>
      <div class="field"><span class="lbl">IMC:</span> <span class="val">${signos.imc || (signos.peso && signos.talla ? (Number(signos.peso) / (Number(signos.talla) ** 2)).toFixed(1) : '—')}</span></div>
      <div class="field"><span class="lbl">Glucosa capilar:</span> <span class="val">${esc(signos.glucosa || '—')} mg/dL</span></div>
      <div class="field"><span class="lbl">EVA:</span> <span class="val">${esc(signos.eva ?? '—')}/10</span></div>
    </div>
  </div>` : ''}

  <!-- EXPLORACIÓN PODOLÓGICA -->
  ${explPodo.dermatologica || explPodo.ungueal || explPodo.vascular || explPodo.neurologica || explPodo.musculoesqueletica ? `
  <div class="section">
    <div class="section-title">Exploración podológica</div>
    ${explPodo.dermatologica ? `<div class="field" style="margin-top:4px"><span class="lbl">Inspección dermatológica:</span> ${esc(JSON.stringify(explPodo.dermatologica).replace(/[{}"]/g,' ').slice(0,500))}</div>` : ''}
    ${explPodo.ungueal ? `<div class="field" style="margin-top:4px"><span class="lbl">Exploración ungueal:</span> ${esc(JSON.stringify(explPodo.ungueal).replace(/[{}"]/g,' ').slice(0,500))}</div>` : ''}
    ${explPodo.vascular ? `<div class="field" style="margin-top:4px"><span class="lbl">Exploración vascular:</span> ${esc(JSON.stringify(explPodo.vascular).replace(/[{}"]/g,' ').slice(0,300))}</div>` : ''}
    ${explPodo.neurologica ? `<div class="field" style="margin-top:4px"><span class="lbl">Exploración neurológica:</span> ${esc(JSON.stringify(explPodo.neurologica).replace(/[{}"]/g,' ').slice(0,300))}</div>` : ''}
    ${explPodo.musculoesqueletica ? `<div class="field" style="margin-top:4px"><span class="lbl">Exploración musculoesquelética:</span> ${esc(JSON.stringify(explPodo.musculoesqueletica).replace(/[{}"]/g,' ').slice(0,300))}</div>` : ''}
  </div>` : ''}

  <!-- EVALUACIÓN DE RIESGO -->
  ${riesgo.nivel ? `
  <div class="section">
    <div class="section-title">Evaluación de riesgo podológico</div>
    <div class="risk-box risk-${esc(riesgo.nivel)}">Riesgo ${esc(riesgo.nivel)}</div>
    ${riesgo.observaciones ? `<div class="field" style="margin-top:4px">${esc(riesgo.observaciones)}</div>` : ''}
    ${riesgo.nivel === 'URGENTE' ? '<div class="alert-box">⚠ Paciente requiere referencia médica urgente.</div>' : ''}
  </div>` : ''}

  <!-- DIAGNÓSTICOS -->
  ${diagnosticos.principal || diagnosticos.secundarios ? `
  <div class="section">
    <div class="section-title">Diagnósticos</div>
    ${diagnosticos.principal ? `<div class="field"><span class="lbl">Diagnóstico principal:</span> ${esc(diagnosticos.principal)}</div>` : ''}
    ${diagnosticos.secundarios ? `<div class="field"><span class="lbl">Secundarios:</span> ${esc(diagnosticos.secundarios)}</div>` : ''}
    ${diagnosticos.lateralidad ? `<div class="field"><span class="lbl">Lateralidad:</span> ${esc(diagnosticos.lateralidad)}</div>` : ''}
  </div>` : ''}

  <!-- PRONÓSTICO -->
  ${pronostico.tipo || pronostico.descripcion ? `
  <div class="section">
    <div class="section-title">Pronóstico</div>
    <div class="field"><span class="lbl">Tipo:</span> ${esc(pronostico.tipo || '—')}</div>
    ${pronostico.descripcion ? `<div class="field" style="margin-top:4px">${esc(pronostico.descripcion)}</div>` : ''}
  </div>` : ''}

  <!-- PLAN DE MANEJO -->
  ${plan.manejo || plan.tratamiento || plan.indicaciones ? `
  <div class="section">
    <div class="section-title">Plan terapéutico</div>
    ${plan.manejo ? `<div class="field"><span class="lbl">Manejo realizado:</span> ${renderChips(plan.manejo)}</div>` : ''}
    ${plan.tratamiento ? `<div class="field" style="margin-top:4px"><span class="lbl">Tratamiento indicado:</span> ${renderChips(plan.tratamiento)}</div>` : ''}
    ${plan.indicaciones ? `<div class="field" style="margin-top:4px"><span class="lbl">Indicaciones al paciente:</span> ${esc(plan.indicaciones)}</div>` : ''}
  </div>` : ''}

  <!-- FIRMAS -->
  <div class="signature-area">
    <div>
      <div class="sig-line">
        ${esc(patientName)}<br/>
        Paciente (o tutor)
      </div>
    </div>
    <div>
      <div class="sig-line">
        Podólogo/a responsable<br/>
        Cédula profesional
      </div>
    </div>
  </div>

  <div class="footer">
    Documento generado el ${new Date().toLocaleString('es-MX')} · Sistema CENPOD · Expediente ${esc(p.expNumber)}
  </div>
  <div class="confidential">
    Documento confidencial — Conforme a la NOM-004-SSA3-2012 del Sistema Nacional de Salud.<br/>
    La información contenida es propiedad del Grupo CENPOD y su divulgación está prohibida sin autorización.
  </div>
</div>

<div class="no-print" style="margin-top:24px;text-align:center;">
  <button onclick="window.print()" style="background:#0a3143;color:#fff;border:none;padding:10px 24px;font-size:14px;border-radius:6px;cursor:pointer;">Imprimir / Guardar PDF</button>
</div>
</body>
</html>`

    const win = window.open('', '_blank', 'width=800,height=900')
    if (!win) {
      toast.error('Habilita las ventanas emergentes para imprimir')
      return
    }
    win.document.write(html)
    win.document.close()
  }

  const pctCompleto =
    Object.values(form).filter((v) => v && (typeof v === 'object' ? Object.keys(v).length > 0 : true))
      .length / 13

  return (
    <div className="space-y-3 print-expediente">
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
