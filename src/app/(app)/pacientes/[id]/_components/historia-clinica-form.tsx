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
    const f = form as any
    const p = patient
    const patientName = `${p.firstName} ${p.lastName}`
    const age = p.birthDate ? Math.floor((Date.now() - new Date(p.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : '—'
    const ficha = p.fichaIdentificacion ? (typeof p.fichaIdentificacion === 'string' ? JSON.parse(p.fichaIdentificacion) : p.fichaIdentificacion) : {}

    const esc = (s: any) => {
      if (s === null || s === undefined || s === '') return ''
      if (typeof s === 'object') return JSON.stringify(s).replace(/[{}"]/g,' ').trim()
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    }

    // Helper: renderizar valor o "—"
    const val = (s: any) => s && s !== '' ? esc(s) : '—'

    // Helper: renderizar array de strings como chips
    const chips = (arr: any) => {
      if (!arr || !Array.isArray(arr) || arr.length === 0) return '<span class="muted">Ninguno</span>'
      return arr.map(a => `<span class="chip">${esc(a)}</span>`).join(' ')
    }

    // Helper: renderizar objeto de antecedentes (checkboxes)
    const renderChecks = (obj: any, labels: Record<string,string>) => {
      if (!obj || typeof obj !== 'object') return '<span class="muted">Sin datos</span>'
      const entries = Object.entries(obj).filter(([, v]) => {
        if (v === true) return true
        if (typeof v === 'object' && v && Object.keys(v).length > 0) return true
        return false
      })
      if (entries.length === 0) return '<span class="muted">Ninguno</span>'
      return entries.map(([k, v]) => {
        const label = labels[k] || k
        if (typeof v === 'object' && v) {
          const parts = [v.familiar, v.edad ? `edad: ${v.edad}` : '', v.observaciones].filter(Boolean)
          return `<div class="row"><span class="chk">☑</span> <b>${esc(label)}</b>${parts.length ? ' — ' + parts.map(esc).join(', ') : ''}</div>`
        }
        return `<div class="row"><span class="chk">☑</span> ${esc(label)}</div>`
      }).join('')
    }

    const motivo = f.motivoConsulta || {}
    const padec = f.padecimientoActual || {}
    const antFam = f.antecedentesFamiliares || {}
    const antPat = f.antecedentesPatologicos || {}
    const antNoPat = f.antecedentesNoPatologicos || {}
    const inter = f.interrogatorioAparatos || {}
    const sig = f.signosVitales || {}
    const explG = f.exploracionGeneral || {}
    const explP = f.exploracionPodologica || {}
    const riesgo = f.evaluacionRiesgo || {}
    const dx = f.diagnosticos || {}
    const pron = f.pronostico || {}
    const plan = f.planManejo || {}

    const imc = sig.peso && sig.talla ? (Number(sig.peso) / (Number(sig.talla) ** 2)).toFixed(1) : (sig.imc || '—')

    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"/>
<title>Historia Clínica — ${esc(patientName)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, 'Helvetica Neue', sans-serif; color: #1a1a1a; margin: 0; font-size: 11px; line-height: 1.6; padding: 30px 40px; background: #f5f5f5; }
  .page { max-width: 800px; margin: 0 auto; background: #fff; padding: 30px 36px; box-shadow: 0 2px 12px rgba(0,0,0,0.1); border-radius: 6px; }
  .hdr { background: #0a3143; color: #fff; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; border-radius: 4px; }
  .hdr .brand { font-size: 16px; font-weight: 800; letter-spacing: 0.06em; }
  .hdr .brand-sub { font-size: 9px; opacity: 0.7; }
  .hdr .meta { text-align: right; font-size: 9px; opacity: 0.8; }
  .sec { margin-top: 14px; }
  .sec-hdr { background: #f0f0f0; padding: 5px 12px; font-weight: 700; font-size: 11px; color: #333; text-transform: uppercase; letter-spacing: 0.03em; border-left: 4px solid #0a3143; border-radius: 0 3px 3px 0; }
  .sec-body { padding: 8px 12px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 18px; }
  .fld { font-size: 10.5px; margin: 2px 0; }
  .fld b { color: #555; font-weight: 600; }
  .chip { display: inline-block; background: #e8f0f4; border: 1px solid #b0c4d8; border-radius: 3px; padding: 1px 6px; font-size: 9px; margin: 1px; }
  .muted { color: #aaa; font-style: italic; }
  .row { font-size: 10.5px; margin: 2px 0; }
  .chk { color: #0a3143; font-weight: bold; }
  .alert { border: 1px solid #dc2626; background: #fef2f2; border-radius: 3px; padding: 5px 10px; font-size: 10px; color: #991b1b; margin: 5px 0; }
  .risk { display: inline-block; padding: 3px 12px; border-radius: 3px; font-weight: 700; font-size: 11px; }
  .risk-BAJO { background: #d1fae5; color: #065f46; }
  .risk-MEDIO { background: #fef3c7; color: #92400e; }
  .risk-ALTO { background: #fee2e2; color: #991b1b; }
  .risk-URGENTE { background: #dc2626; color: #fff; }
  .sigs { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
  .sig { border-top: 1.5px solid #333; padding-top: 5px; font-size: 9px; text-align: center; color: #555; }
  .ftr { margin-top: 28px; border-top: 1px solid #ddd; padding-top: 8px; font-size: 8px; color: #999; text-align: center; }
  .conf { font-size: 8px; color: #bbb; text-align: center; margin-top: 4px; font-style: italic; }
  @media print {
    .np { display: none; }
    body { padding: 0 !important; background: #fff !important; }
    .page { max-width: none !important; box-shadow: none !important; border-radius: 0 !important; padding: 0 !important; }
    .sec { break-inside: avoid; page-break-inside: avoid; }
    .sec-hdr { break-after: avoid; page-break-after: avoid; }
    .sigs { break-inside: avoid; page-break-inside: avoid; }
    .alert { break-inside: avoid; page-break-inside: avoid; }
    .grid { break-inside: avoid; page-break-inside: avoid; }
  }
</style></head><body>
<div class="page">

<div class="hdr">
  <div><div class="brand">CENPOD</div><div class="brand-sub">CENTRO PODOLÓGICO</div></div>
  <div class="meta">HISTORIA CLÍNICA PODOLÓGICA<br/>Expediente: ${esc(p.expNumber)}<br/>${new Date().toLocaleDateString('es-MX')}</div>
</div>

<!-- I. FICHA DE IDENTIFICACIÓN -->
<div class="sec">
  <div class="sec-hdr">I. Ficha de identificación</div>
  <div class="sec-body">
    <div class="grid">
      <div class="fld"><b>Nombre:</b> ${esc(patientName)}</div>
      <div class="fld"><b>Edad:</b> ${age} años</div>
      <div class="fld"><b>Fecha de nacimiento:</b> ${p.birthDate ? new Date(p.birthDate).toLocaleDateString('es-MX') : '—'}</div>
      <div class="fld"><b>Sexo:</b> ${val(p.sex)}</div>
      <div class="fld"><b>Ocupación:</b> ${val(ficha.ocupacion || antNoPat.ocupacion)}</div>
      <div class="fld"><b>Escolaridad:</b> ${val(ficha.escolaridad)}</div>
      <div class="fld"><b>Estado civil:</b> ${val(ficha.estadoCivil)}</div>
      <div class="fld"><b>Teléfono:</b> ${val(p.phone)}</div>
      <div class="fld"><b>Grupo sanguíneo:</b> ${val(ficha.grupoSanguineo)}</div>
      <div class="fld"><b>Contacto de emergencia:</b> ${val(ficha.contactoEmergencia)} ${ficha.parentescoEmergencia ? '(' + esc(ficha.parentescoEmergencia) + ')' : ''}</div>
    </div>
    ${p.isDiabetic ? '<div class="alert">⚠ PACIENTE DIABÉTICO</div>' : ''}
    ${p.allergies ? `<div class="alert">⚠ ALERGIAS: ${esc(p.allergies)}</div>` : ''}
    ${p.currentMeds ? `<div class="fld" style="margin-top:3px"><b>Medicamentos actuales:</b> ${esc(p.currentMeds)}</div>` : ''}
  </div>
</div>

<!-- II. MOTIVO DE CONSULTA -->
<div class="sec">
  <div class="sec-hdr">II. Motivo de consulta</div>
  <div class="sec-body">
    ${motivo.opciones && motivo.opciones.length > 0 ? `<div class="fld" style="margin-bottom:3px">${chips(motivo.opciones)}</div>` : ''}
    ${motivo.descripcion ? `<div class="fld">${esc(motivo.descripcion)}</div>` : '<div class="muted">No registrado</div>'}
  </div>
</div>

<!-- III. PADECIMIENTO ACTUAL -->
<div class="sec">
  <div class="sec-hdr">III. Padecimiento actual</div>
  <div class="sec-body">
    <div class="grid">
      <div class="fld"><b>Inicio:</b> ${val(padec.inicio)}</div>
      <div class="fld"><b>Tiempo de evolución:</b> ${val(padec.tiempo)}</div>
    </div>
    ${padec.localizacion ? `<div class="fld" style="margin-top:2px"><b>Localización:</b> ${chips(padec.localizacion)}</div>` : ''}
    ${padec.mecanismo ? `<div class="fld" style="margin-top:2px"><b>Mecanismo:</b> ${chips(padec.mecanismo)}</div>` : ''}
    ${padec.sintomas ? `<div class="fld" style="margin-top:2px"><b>Síntomas:</b> ${chips(padec.sintomas)}</div>` : ''}
    ${padec.eva !== undefined ? `<div class="fld" style="margin-top:2px"><b>EVA:</b> ${esc(padec.eva)}/10</div>` : ''}
    ${padec.tratamientosPrevios ? `<div class="fld" style="margin-top:2px"><b>Tratamientos previos:</b> ${chips(padec.tratamientosPrevios)}</div>` : ''}
    ${padec.observaciones ? `<div class="fld" style="margin-top:2px">${esc(padec.observaciones)}</div>` : ''}
    ${!padec.inicio && !padec.tiempo && !padec.sintomas && !padec.observaciones ? '<div class="muted">No registrado</div>' : ''}
  </div>
</div>

<!-- IV. ANTECEDENTES HEREDOFAMILIARES -->
<div class="sec">
  <div class="sec-hdr">IV. Antecedentes heredofamiliares</div>
  <div class="sec-body">
    ${renderChecks(antFam.condiciones || antFam, {
      'diabetes':'Diabetes mellitus','hipertension':'Hipertensión arterial','renal':'Enfermedad renal',
      'vascular':'Enf. vascular periférica','cardiovascular':'Enf. cardiovascular','artritis':'Artritis reumatoide',
      'gota':'Gota','psoriasis':'Psoriasis','cancer':'Cáncer','coagulacion':'Trastornos de coagulación',
      'ortopedicos':'Problemas ortopédicos del pie','amputaciones':'Amputaciones','pie_diabetico':'Pie diabético'
    })}
  </div>
</div>

<!-- V. ANTECEDENTES PERSONALES PATOLÓGICOS -->
<div class="sec">
  <div class="sec-hdr">V. Antecedentes personales patológicos</div>
  <div class="sec-body">
    ${renderChecks(antPat.condiciones || antPat, {
      'dm1':'Diabetes tipo 1','dm2':'Diabetes tipo 2','hta':'Hipertensión arterial','dislipidemia':'Dislipidemia',
      'renal':'Enf. renal crónica','cardiopatia':'Cardiopatía','venosa':'Insuficiencia venosa',
      'arterial':'Enf. arterial periférica','neuropatia':'Neuropatía periférica','artritis':'Artritis',
      'gota':'Gota','psoriasis':'Psoriasis','dermatitis':'Dermatitis','inmunosupresion':'Inmunosupresión',
      'obesidad':'Obesidad','coagulacion':'Trastornos de coagulación','epilepsia':'Epilepsia'
    })}
    ${antPat.diabetes ? `<div style="margin-top:4px"><b>Datos de diabetes:</b>` +
      (antPat.diabetes.añoDiagnostico ? ` Año: ${esc(antPat.diabetes.añoDiagnostico)}.` : '') +
      (antPat.diabetes.tratamiento ? ` Tratamiento: ${chips(antPat.diabetes.tratamiento)}.` : '') +
      (antPat.diabetes.ultimaGlucosa ? ` Glucosa: ${esc(antPat.diabetes.ultimaGlucosa)} mg/dL.` : '') +
      (antPat.diabetes.hba1c ? ` HbA1c: ${esc(antPat.diabetes.hba1c)}%.` : '') +
      (antPat.diabetes.neuropatia ? ' ⚠ Neuropatía.' : '') +
      `</div>` : ''}
    ${antPat.alergias ? `<div class="alert" style="margin-top:3px">Alergias: ${esc(antPat.alergias)}</div>` : ''}
    ${antPat.medicamentos ? `<div class="fld" style="margin-top:2px"><b>Medicamentos:</b> ${esc(antPat.medicamentos)}</div>` : ''}
  </div>
</div>

<!-- VI. ANTECEDENTES NO PATOLÓGICOS -->
<div class="sec">
  <div class="sec-hdr">VI. Antecedentes personales no patológicos</div>
  <div class="sec-body">
    <div class="grid">
      <div class="fld"><b>Tabaco:</b> ${val(antNoPat.tabaquismo)}</div>
      <div class="fld"><b>Alcohol:</b> ${val(antNoPat.alcohol)}</div>
      <div class="fld"><b>Actividad física:</b> ${val(antNoPat.actividad)}</div>
      <div class="fld"><b>Tipo de calzado:</b> ${val(antNoPat.calzado)}</div>
      <div class="fld"><b>Quién corta uñas:</b> ${val(antNoPat.quienCorta)}</div>
      <div class="fld"><b>Higiene de pies:</b> ${val(antNoPat.higiene)}</div>
      <div class="fld"><b>Bipedestación (hrs):</b> ${val(antNoPat.bipedestacion)}</div>
      <div class="fld"><b>Ocupación de riesgo:</b> ${val(antNoPat.ocupacion)}</div>
    </div>
  </div>
</div>

<!-- VII. SIGNOS VITALES -->
${sig.ta || sig.fc || sig.fr || sig.peso || sig.talla ? `
<div class="sec">
  <div class="sec-hdr">VII. Signos vitales y somatometría</div>
  <div class="sec-body">
    <div class="grid">
      <div class="fld"><b>TA:</b> ${val(sig.ta)} mmHg</div>
      <div class="fld"><b>FC:</b> ${val(sig.fc)} lpm</div>
      <div class="fld"><b>FR:</b> ${val(sig.fr)} rpm</div>
      <div class="fld"><b>Temp:</b> ${val(sig.temperatura)} °C</div>
      <div class="fld"><b>Peso:</b> ${val(sig.peso)} kg</div>
      <div class="fld"><b>Talla:</b> ${val(sig.talla)} m</div>
      <div class="fld"><b>IMC:</b> ${imc}</div>
      <div class="fld"><b>Glucosa:</b> ${val(sig.glucosa)} mg/dL</div>
      <div class="fld"><b>EVA:</b> ${val(sig.eva)}/10</div>
    </div>
  </div>
</div>` : ''}

<!-- VIII. EXPLORACIÓN PODOLÓGICA -->
${explP.inspeccionDermatologica || explP.exploracionVascular || explP.exploracionNeurologica || explP.exploracionMusculoesqueletica ? `
<div class="sec">
  <div class="sec-hdr">VIII. Exploración podológica</div>
  <div class="sec-body">
    ${explP.inspeccionDermatologica ? `
    <div class="fld" style="margin-top:3px"><b>Inspección dermatológica:</b></div>
    ${['pieDerecho','pieIzquierdo'].map(pie => {
      const d = explP.inspeccionDermatologica[pie]
      if (!d) return ''
      return `<div class="fld" style="margin-left:10px"><b>${pie === 'pieDerecho' ? 'Pie derecho' : 'Pie izquierdo'}:</b> ` +
        `Coloración: ${val(d.coloracion)}, Temp: ${val(d.temperatura)}, Hidratación: ${val(d.hidratacion)}, Integridad: ${val(d.integridad)}${d.lesiones ? `, Lesiones: ${esc(d.lesiones)}` : ''}</div>`
    }).join('')}` : ''}

    ${explP.exploracionVascular ? `
    <div class="fld" style="margin-top:4px"><b>Exploración vascular:</b></div>
    <div class="grid" style="margin-left:10px">
      <div class="fld">Pulso pedio D: ${val(explP.exploracionVascular.pulsoPedioDerecho)}</div>
      <div class="fld">Pulso pedio I: ${val(explP.exploracionVascular.pulsoPedioIzquierdo)}</div>
      <div class="fld">Pulso tibial D: ${val(explP.exploracionVascular.pulsoTibialDerecho)}</div>
      <div class="fld">Pulso tibial I: ${val(explP.exploracionVascular.pulsoTibialIzquierdo)}</div>
      <div class="fld">Llenado capilar D: ${val(explP.exploracionVascular.llenadoCapilarDerecho)}</div>
      <div class="fld">Llenado capilar I: ${val(explP.exploracionVascular.llenadoCapilarIzquierdo)}</div>
      <div class="fld">Edema: ${val(explP.exploracionVascular.edema)}</div>
    </div>` : ''}

    ${explP.exploracionNeurologica ? `
    <div class="fld" style="margin-top:4px"><b>Exploración neurológica:</b></div>
    <div class="grid" style="margin-left:10px">
      <div class="fld">Monofilamento D: ${val(explP.exploracionNeurologica.monofilamentoDerecho)}</div>
      <div class="fld">Monofilamento I: ${val(explP.exploracionNeurologica.monofilamentoIzquierdo)}</div>
      <div class="fld">Sensibilidad: ${val(explP.exploracionNeurologica.sensibilidad)}</div>
      <div class="fld">Parestesias: ${explP.exploracionNeurologica.parestesias ? 'Sí' : 'No'}</div>
    </div>` : ''}

    ${explP.exploracionMusculoesqueletica ? `
    <div class="fld" style="margin-top:4px"><b>Exploración musculoesquelética:</b></div>
    <div class="grid" style="margin-left:10px">
      <div class="fld">Tipo de pie: ${val(explP.exploracionMusculoesqueletica.tipoPie)}</div>
      <div class="fld">Arco: ${val(explP.exploracionMusculoesqueletica.arco)}</div>
      <div class="fld">Deformidades: ${val(explP.exploracionMusculoesqueletica.deformidades)}</div>
      <div class="fld">Dolor: ${val(explP.exploracionMusculoesqueletica.dolor)}</div>
    </div>` : ''}
  </div>
</div>` : ''}

<!-- IX. RIESGO -->
${riesgo.nivel ? `
<div class="sec">
  <div class="sec-hdr">IX. Riesgo podológico</div>
  <div class="sec-body">
    <div class="risk risk-${esc(riesgo.nivel)}">Riesgo ${esc(riesgo.nivel)}</div>
    ${riesgo.observaciones ? `<div class="fld" style="margin-top:2px">${esc(riesgo.observaciones)}</div>` : ''}
  </div>
</div>` : ''}

<!-- X. DIAGNÓSTICO Y PLAN -->
${dx.principal || dx.secundarios || pron.tipo || plan.indicaciones ? `
<div class="sec">
  <div class="sec-hdr">X. Diagnóstico, pronóstico y plan</div>
  <div class="sec-body">
    ${dx.principal ? `<div class="fld"><b>Diagnóstico principal:</b> ${esc(dx.principal)}</div>` : ''}
    ${dx.secundarios ? `<div class="fld"><b>Secundarios:</b> ${esc(dx.secundarios)}</div>` : ''}
    ${dx.lateralidad ? `<div class="fld"><b>Lateralidad:</b> ${esc(dx.lateralidad)}</div>` : ''}
    ${pron.tipo ? `<div class="fld" style="margin-top:3px"><b>Pronóstico:</b> ${esc(pron.tipo)}</div>` : ''}
    ${pron.descripcion ? `<div class="fld">${esc(pron.descripcion)}</div>` : ''}
    ${plan.manejo && plan.manejo.length ? `<div class="fld" style="margin-top:3px"><b>Manejo realizado:</b> ${chips(plan.manejo)}</div>` : ''}
    ${plan.tratamiento && plan.tratamiento.length ? `<div class="fld"><b>Tratamiento indicado:</b> ${chips(plan.tratamiento)}</div>` : ''}
    ${plan.indicaciones ? `<div class="fld" style="margin-top:2px"><b>Indicaciones:</b> ${esc(plan.indicaciones)}</div>` : ''}
  </div>
</div>` : ''}

<!-- FIRMAS -->
<div class="sigs">
  <div class="sig">${esc(patientName)}<br/>Paciente (o tutor)</div>
  <div class="sig">Podólogo/a responsable<br/>Cédula profesional</div>
</div>

<div class="ftr">Documento generado el ${new Date().toLocaleString('es-MX')} · Sistema CENPOD · Expediente ${esc(p.expNumber)}</div>
<div class="conf">Documento confidencial — NOM-004-SSA3-2012 · La información es propiedad del Grupo CENPOD.</div>

</div><!-- fin .page -->

<div class="np" style="margin-top:20px;text-align:center;">
  <button onclick="window.print()" style="background:#0a3143;color:#fff;border:none;padding:10px 24px;font-size:14px;border-radius:6px;cursor:pointer;">Imprimir / Guardar PDF</button>
</div>
</body></html>`

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
