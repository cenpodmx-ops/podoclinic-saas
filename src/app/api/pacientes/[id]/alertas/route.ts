import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'

// ============================================================
// MÓDULO EXPEDIENTE NOM-004 — Motor de alertas clínicas (sección 25)
// GET /api/pacientes/[id]/alertas
//
// Devuelve un array de alertas { level, title, description } donde
// level es 'RED' | 'ORANGE' | 'YELLOW'.
// 403 si PODOLOGIST o cross-clinic.
// ============================================================

type Alert = {
  level: 'RED' | 'ORANGE' | 'YELLOW'
  title: string
  description?: string
}

async function loadPatientForUser(id: string, user: { role: string; clinicId: string }) {
  const p = await db.patient.findUnique({
    where: { id },
    select: { id: true, clinicId: true },
  })
  if (!p) return null
  if (user.role === 'PODOLOGIST' && p.clinicId !== user.clinicId) return 'forbidden' as const
  return p
}

function safeParse<T = any>(s: string | null | undefined, fallback: T = {} as T): T {
  if (!s) return fallback
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}

function includesAny(haystack: string, needles: string[]): boolean {
  if (!haystack) return false
  const h = haystack.toLowerCase()
  return needles.some((n) => h.includes(n.toLowerCase()))
}

function calcAge(birthDate: Date | string | null): number | null {
  if (!birthDate) return null
  const d = new Date(birthDate)
  if (isNaN(d.getTime())) return null
  const diff = Date.now() - d.getTime()
  const age = Math.floor(diff / (365.25 * 24 * 3600 * 1000))
  return age >= 0 ? age : null
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)
  const { id } = await ctx.params

  const access = await loadPatientForUser(id, user!)
  if (access === null) return bad('Paciente no encontrado', 404)
  if (access === 'forbidden') return bad('Sin acceso a este paciente', 403)

  const patient = await db.patient.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      isDiabetic: true,
      allergies: true,
      currentMeds: true,
      chronicConditions: true,
      fichaIdentificacion: true,
      historiaClinicaInicial: true,
    },
  })
  if (!patient) return bad('Paciente no encontrado', 404)

  // Última consulta con SOAP (para signos vitales más recientes)
  const latestCons = await db.consultation.findFirst({
    where: { patientId: id },
    orderBy: { date: 'desc' },
    select: { id: true, soapJson: true, date: true },
  })

  // Procedimientos recientes y consentimientos (para alerta de consentimiento faltante)
  const [recentProcs, recentConsents, recentFiles] = await Promise.all([
    db.procedure.findMany({
      where: { patientId: id },
      orderBy: { fecha: 'desc' },
      take: 5,
      select: { id: true, procedimiento: true, fecha: true },
    }),
    db.consent.findMany({
      where: { patientId: id },
      orderBy: { fecha: 'desc' },
      take: 5,
      select: { id: true, procedimientoPropuesto: true, fecha: true },
    }),
    db.patientFile.findMany({
      where: { patientId: id, type: 'FOTO_CLINICA' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, name: true, permiteIdentificar: true, autorizaUsoClinico: true, createdAt: true },
    }),
  ])

  const ficha = safeParse<any>(patient.fichaIdentificacion, {})
  const histo = safeParse<any>(patient.historiaClinicaInicial, {})

  // Signos vitales: prioritario el de la última consulta (soapJson.O.signosVitales),
  // fallback al de la historia clínica inicial.
  let sv: any = histo?.signosVitales || {}
  if (latestCons?.soapJson) {
    const soap = safeParse<any>(latestCons.soapJson, {})
    const svCons = soap?.O?.signosVitales || soap?.signosVitales
    if (svCons && typeof svCons === 'object') {
      // Sobreescribir con los más recientes donde existan
      sv = { ...sv, ...svCons }
    }
  }

  // Exploración vascular (pulsos)
  const vasc = histo?.exploracionPodologica?.exploracionVascular || {}
  const pulsosPedio = [vasc.pulsoPedioDerecho, vasc.pulsoPedioIzquierdo]
  const pulsosTibial = [vasc.pulsoTibialDerecho, vasc.pulsoTibialIzquierdo]
  const pulsosAusentes = [...pulsosPedio, ...pulsosTibial].some((p) => {
    if (!p) return false
    const s = String(p).toLowerCase()
    return s.includes('ausent') || s.includes('no palpable') || s === '0' || s === 'no'
  })

  // Exploración neurológica
  const neuro = histo?.exploracionPodologica?.exploracionNeurologica || {}
  const parestesias = !!neuro?.parestesias

  // Diagnósticos / problemas activos (para heridas, celulitis, necrosis)
  const diag = histo?.diagnosticos || {}
  const diagText = [
    diag.diagnosticoPrincipal,
    diag.problemasActivos,
    diag.observaciones,
    histo?.pronostico?.descripcion,
    histo?.planManejo?.indicacionesPaciente,
    patient.chronicConditions,
  ].filter(Boolean).join(' ')

  // Padecimiento actual (motivo de consulta, EVA, evolución)
  const padec = histo?.padecimientoActual || {}
  const evaHisto = typeof padec.eva === 'number' ? padec.eva : null

  // Antecedentes patológicos: alergias y anticoagulantes
  const patol = histo?.antecedentesPatologicos || {}
  const alergiasHisto = patol?.alergias || {}
  const anticoagHisto = patol?.anticoagulantes || {}

  const alergiasText = [patient.allergies, alergiasHisto.medicamentos, alergiasHisto.anestesicos, alergiasHisto.antisempticos].filter(Boolean).join(', ')
  const medsText = [patient.currentMeds, patol?.medicamentosActuales].filter(Boolean).join(', ')

  const hasLatex = !!alergiasHisto.latex || includesAny(alergiasText, ['látex', 'latex'])
  const hasIodo = includesAny(alergiasText, ['yodo', 'iodo', 'povidona'])
  const hasClorhex = includesAny(alergiasText, ['clorhex', 'clorohex'])
  const hasAnestAlergia = includesAny(alergiasText, ['anestes', 'lidocaina', 'lidocaína', 'mepivacaina', 'bupivacaina'])

  const hasAnticoag =
    !!anticoagHisto.warfarina ||
    !!anticoagHisto.aspirina ||
    !!anticoagHisto.clopidogrel ||
    !!anticoagHisto.otro ||
    includesAny(medsText, ['warfarina', 'aspirina', 'aas', 'clopidogrel', 'heparina', 'acenocumarol', 'rivaroxaban', 'apixaban', ' dabigatran'])

  const hasDiabetes = !!patient.isDiabetic || !!patol?.diabetes || includesAny(diagText, ['diabet'])
  const hasHeridaActiva = includesAny(diagText, ['herida', 'ulcera', 'úlcera', 'lesion abierta', 'lesión abierta', 'fisura', 'desgarro', 'postquirurg'])
  const hasSecrecionPurulenta = includesAny(diagText, ['purulent', 'pus', 'secrecion', 'secreción'])
  const hasNecrosis = includesAny(diagText, ['necros', 'gangrena', 'tejido desvitalizado', 'esfacelo', 'esfác', 'tejido negro'])
  const hasEritema = includesAny(diagText, ['eritema', 'rubor', 'calor local', 'inflamacion', 'inflamación'])
  const hasCelulitis = includesAny(diagText, ['celulitis', 'linfangitis', 'erisipela'])
  const hasInfeccion = includesAny(diagText, ['infeccion', 'infección', 'infectad', 'absceso', 'flemón', 'flemon'])

  const temp = typeof sv.temperatura === 'number' ? sv.temperatura : null
  const hasFiebre = temp !== null && temp >= 38

  const glucosa = typeof sv.glucosaCapilar === 'number' ? sv.glucosaCapilar : null
  const taSis = typeof sv.taSistolica === 'number' ? sv.taSistolica : null
  const taDia = typeof sv.taDiastolica === 'number' ? sv.taDiastolica : null
  const eva = typeof sv.eva === 'number' ? sv.eva : evaHisto

  // Menor de edad
  const age = calcAge(patient.birthDate)
  const isMinor = age !== null && age < 18

  // Ficha: contacto de emergencia / tutor (para menores)
  const tutorPresente = !!ficha?.contactoEmergencia || !!ficha?.telefonoEmergencia || !!ficha?.parentescoEmergencia

  // Foto identificable sin autorización
  const fotoIdentificableSinAuth = recentFiles.some((f) => f.permiteIdentificar && !f.autorizaUsoClinico)

  // Consentimiento faltante antes de procedimiento invasivo
  // Si hay procedimientos registrados pero el último de ellos NO tiene consent
  // asociado (aproximación: si hay más procedimientos que consentimientos en
  // los últimos 90 días), alertar.
  const noveletaDays = 90
  const cutoff = new Date(Date.now() - noveletaDays * 24 * 3600 * 1000)
  const procsRecent = recentProcs.filter((p) => new Date(p.fecha) >= cutoff)
  const consentsRecent = recentConsents.filter((c) => new Date(c.fecha) >= cutoff)
  const consentFaltante = procsRecent.length > 0 && consentsRecent.length === 0

  // ===== Construir alertas =====
  const alerts: Alert[] = []

  // RED alerts
  if (hasDiabetes && hasHeridaActiva) {
    alerts.push({
      level: 'RED',
      title: 'Paciente diabético con herida activa',
      description: 'Riesgo elevado de pie diabético infectado. Requiere valoración urgente y manejo protocolizado.',
    })
  }
  if (hasDiabetes && pulsosAusentes) {
    alerts.push({
      level: 'RED',
      title: 'Diabetes con pulsos pedios/tibiales ausentes',
      description: 'Sugiere isquemia / arteriopatía periférica. Considerar referencia a angiología.',
    })
  }
  if (hasFiebre && hasInfeccion) {
    alerts.push({
      level: 'RED',
      title: 'Fiebre + lesión infectada',
      description: `Temperatura ${temp}°C asociada a signos de infección. Riesgo de sepsis. Valorar estudio y antibiótico.`,
    })
  }
  if (hasSecrecionPurulenta) {
    alerts.push({
      level: 'RED',
      title: 'Secreción purulenta',
      description: 'Signo de infección activa con probable colección. Requiere drenaje y cultivo.',
    })
  }
  if (hasNecrosis) {
    alerts.push({
      level: 'RED',
      title: 'Necrosis / tejido desvitalizado',
      description: 'Riesgo de amputación. Desbridamiento urgente y valoración interdisciplinaria.',
    })
  }
  if (hasCelulitis) {
    alerts.push({
      level: 'RED',
      title: 'Sospecha de celulitis / linfangitis',
      description: 'Infección de partes blandas con riesgo de extensión. Antibioticoterapia sistémica y vigilancia.',
    })
  }
  if (glucosa !== null && glucosa > 250) {
    alerts.push({
      level: 'RED',
      title: 'Glucosa capilar elevada',
      description: `Glucosa capilar: ${glucosa} mg/dL. Postergar procedimiento invasivo y referir a control glucémico.`,
    })
  }
  if (taSis !== null && taDia !== null && (taSis > 180 || taDia > 110)) {
    alerts.push({
      level: 'RED',
      title: 'Hipertensión severa',
      description: `TA: ${taSis}/${taDia} mmHg. Riesgo cardiovascular elevado. Postergar y referir a control.`,
    })
  }

  // ORANGE alerts
  if (eva !== null && eva !== undefined && eva >= 8) {
    alerts.push({
      level: 'ORANGE',
      title: 'Dolor severo (EVA ≥ 8)',
      description: `EVA: ${eva}/10. Manejo analgésico agresivo y reevaluación antes de procedimientos.`,
    })
  }
  if (hasEritema && !hasCelulitis) {
    alerts.push({
      level: 'ORANGE',
      title: 'Eritema progresivo',
      description: 'Signo inflamatorio local que puede evolucionar a celulitis. Vigilar y marcar límites.',
    })
  }
  if (hasAnticoag && procsRecent.length > 0) {
    alerts.push({
      level: 'ORANGE',
      title: 'Paciente anticoagulado antes de procedimiento',
      description: 'Riesgo de sangrado. Verificar TP/TIN y considerar suspensión supervisada antes de cirugía podológica.',
    })
  }
  if (hasAnestAlergia) {
    alerts.push({
      level: 'ORANGE',
      title: 'Alergia a anestésico',
      description: 'Reportada alergia a anestésicos. Usar alternativa y tener kit de emergencia disponible.',
    })
  }
  if (hasLatex) {
    alerts.push({
      level: 'ORANGE',
      title: 'Alergia al látex',
      description: 'Usar guantes y material libre de látex. Verificar envoltorios de instrumental.',
    })
  }
  if (hasIodo) {
    alerts.push({
      level: 'ORANGE',
      title: 'Alergia al yodo',
      description: 'Evitar povidona y antisépticos yodados. Usar clorhexidina o alcohol.',
    })
  }
  if (hasClorhex) {
    alerts.push({
      level: 'ORANGE',
      title: 'Alergia a la clorhexidina',
      description: 'Usar alternativa antiséptica (alcohol, povidona si no hay alergia al yodo).',
    })
  }
  if (isMinor && !tutorPresente) {
    alerts.push({
      level: 'ORANGE',
      title: 'Menor de edad sin tutor registrado',
      description: `Edad: ${age} años. Se requiere tutor legal para consentimiento informado y procedimientos.`,
    })
  }
  if (consentFaltante) {
    alerts.push({
      level: 'ORANGE',
      title: 'Consentimiento informado faltante',
      description: 'Hay procedimientos recientes sin consentimiento informado registrado. Regístrelo antes de continuar.',
    })
  }
  if (fotoIdentificableSinAuth) {
    alerts.push({
      level: 'ORANGE',
      title: 'Foto clínica identificable sin autorización',
      description: 'Existen fotos que permiten identificación sin autorización de uso clínico. Regularizar consentimiento.',
    })
  }
  if (parestesias && hasDiabetes) {
    alerts.push({
      level: 'ORANGE',
      title: 'Neuropatía diabética (parestesias)',
      description: 'Pérdida de sensibilidad protectora. Educación al paciente y revisión de calzado.',
    })
  }

  // YELLOW alerts (informativas)
  if (hasDiabetes && alerts.filter((a) => a.level === 'RED').length === 0) {
    alerts.push({
      level: 'YELLOW',
      title: 'Paciente diabético',
      description: 'Sin alertas críticas activas, pero requiere protocolo de pie diabético en todo procedimiento.',
    })
  }
  if (glucosa !== null && glucosa > 140 && glucosa <= 250) {
    alerts.push({
      level: 'YELLOW',
      title: 'Glucosa capilar alterada',
      description: `Glucosa capilar: ${glucosa} mg/dL. Vigilar y optimizar control glucémico.`,
    })
  }
  if (taSis !== null && taDia !== null && ((taSis >= 140 && taSis <= 180) || (taDia >= 90 && taDia <= 110))) {
    alerts.push({
      level: 'YELLOW',
      title: 'Hipertensión grado 1-2',
      description: `TA: ${taSis}/${taDia} mmHg. Control y seguimiento.`,
    })
  }
  if (age !== null && age >= 60) {
    alerts.push({
      level: 'YELLOW',
      title: 'Paciente adulto mayor',
      description: `Edad: ${age} años. Considerar fragilidad, polifarmacia y caídas.`,
    })
  }

  // Orden: RED primero, luego ORANGE, luego YELLOW
  const order = { RED: 0, ORANGE: 1, YELLOW: 2 }
  alerts.sort((a, b) => order[a.level] - order[b.level])

  return ok({
    data: alerts,
    summary: {
      red: alerts.filter((a) => a.level === 'RED').length,
      orange: alerts.filter((a) => a.level === 'ORANGE').length,
      yellow: alerts.filter((a) => a.level === 'YELLOW').length,
      total: alerts.length,
    },
  })
}
