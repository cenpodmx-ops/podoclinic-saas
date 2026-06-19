// Tipos para el expediente clínico NOM-004 del paciente
// El shape viene de GET /api/pacientes/[id] (extendido) + endpoints relacionados.

export type ClinicInfo = {
  id: string
  name: string
  slug: string
  address?: string | null
  phone?: string | null
  email?: string | null
  logoUrl?: string | null
  rfc?: string | null
  razonSocial?: string | null
  regimenFiscal?: string | null
  openingTime?: string | null
  closingTime?: string | null
}

export type PodologistInfo = {
  id: string
  name: string
} | null

export type AppointmentRow = {
  id: string
  date: string
  startTime: string
  endTime: string
  status: string
  reason: string | null
  notes: string | null
  serviceName: string | null
  price: number | null
  podologist: PodologistInfo
}

export type ConsultationRow = {
  id: string
  patientId: string
  clinicId: string
  podologistId: string | null
  date: string
  reason: string | null
  referredBy: string | null
  diagnosis: string | null
  treatment: string | null
  notes: string | null
  consultPrice: number
  productsTotal: number
  discount: number
  total: number
  paymentMethod: string | null
  paid: boolean
  itemsJson: string
  followUpDays: number | null
  soapJson: string | null
  createdAt: string
  updatedAt: string
  podologist: PodologistInfo
}

export type PrescriptionMedication = {
  name: string
  dose?: string
  via?: string
  duration?: string
}

export type PrescriptionRow = {
  id: string
  date: string
  diagnosis: string | null
  medicationsJson: string
  indications: string | null
  podologist: PodologistInfo
}

export type PatientFileRow = {
  id: string
  name: string
  type: string
  fileUrl: string
  mimeType: string
  sizeBytes: number
  zonaAnatomica?: string | null
  vista?: string | null
  motivoFoto?: string | null
  relacionadoDiagnostico?: string | null
  autorizaUsoClinico?: boolean
  autorizaDocencia?: boolean
  permiteIdentificar?: boolean
  createdAt: string
}

export type FollowUpRow = {
  id: string
  dueDate: string
  notes: string | null
  status: string
  whatsappSent: boolean
  createdAt: string
}

// ===== Nuevos tipos NOM-004 =====

export type ProcedureRow = {
  id: string
  patientId: string
  clinicId: string
  consultationId?: string | null
  podologistId?: string | null
  fecha: string
  procedimiento: string
  indicacion?: string | null
  diagnosticoRelacionado?: string | null
  regionAnatomica?: string | null
  pieDedoLado?: string | null
  tecnica?: string | null
  antisepctico?: string | null
  antisepcticoTypo?: string | null // alt field name sometimes used
  instrumental?: string | null
  anestesiaJson?: string | null
  hemostasia?: string | null
  hallazgos?: string | null
  complicaciones?: string | null
  materialCuracion?: string | null
  indicacionesPost?: string | null
  tolerancia?: string | null
  profesionalResponsable?: string | null
  firmaData?: string | null
  createdAt: string
}

export type ConsentRow = {
  id: string
  patientId: string
  clinicId: string
  procedimientoPropuesto: string
  diagnostico?: string | null
  explicacion?: string | null
  beneficios?: string | null
  riesgosJson?: string | null
  alternativas?: string | null
  consecuenciasNoRealizar?: string | null
  confirmacionPreguntas: boolean
  aceptacionVoluntaria: boolean
  firmaPaciente?: string | null
  firmaProfesional?: string | null
  firmaTestigo?: string | null
  firmaTutor?: string | null
  identificacionAdjuntaUrl?: string | null
  fecha: string
  createdAt: string
}

export type ReferralRow = {
  id: string
  patientId: string
  clinicId: string
  tipo: string
  motivoReferencia?: string | null
  diagnosticoPresuntivo?: string | null
  hallazgosRelevantes?: string | null
  tratamientoRealizado?: string | null
  motivoClinicoJson?: string | null
  servicioSugerido?: string | null
  prioridad: string
  firmaData?: string | null
  fecha: string
  createdAt: string
}

export type AuditLogRow = {
  id: string
  patientId: string
  clinicId: string
  userId?: string | null
  userName?: string | null
  action: string
  section?: string | null
  details?: string | null
  ip?: string | null
  createdAt: string
}

export type AlertaRow = {
  level: 'RED' | 'ORANGE' | 'YELLOW'
  title: string
  description?: string
}

export type FichaIdentificacion = {
  estadoCivil?: string
  ocupacion?: string
  escolaridad?: string
  contactoEmergencia?: string
  telefonoEmergencia?: string
  parentescoEmergencia?: string
  grupoSanguineo?: string
  religion?: string
  grupoEtnico?: string
  pacienteNuevoSubsecuente?: string // NUEVO | SUBSECUENTE
  medioLlegada?: string
  motivoAdmin?: string
  [k: string]: any
}

// ===== Historia clínica inicial (JSON grande) =====
// Tipado flexible para no atar el formulario a un schema rígido.

export type HistoriaClinicaInicial = {
  motivoConsulta?: {
    motivosSeleccionados?: string[]
    descripcionTextual?: string
  }
  padecimientoActual?: {
    inicio?: string
    tiempoEvolucion?: string
    localizacion?: string[]
    mecanismoProbable?: string[]
    sintomasAsociados?: string[]
    eva?: number
    factoresAgravan?: string
    factoresAlivian?: string
    tratamientosPrevios?: string[]
    evolucion?: string
    observaciones?: string
  }
  antecedentesFamiliares?: {
    condiciones?: Record<string, { presente: boolean; familiar?: string; edadPresentacion?: string; observaciones?: string }>
    observaciones?: string
  }
  antecedentesPatologicos?: {
    condiciones?: Record<string, boolean>
    diabetes?: {
      anioDiagnostico?: string
      tratamiento?: string
      ultimaGlucosa?: string
      hba1c?: string
      neuropatia?: boolean
      retinopatia?: boolean
      nefropatia?: boolean
      pieDiabetico?: boolean
    }
    cirugias?: string
    hospitalizaciones?: string
    alergias?: {
      medicamentos?: string
      latex?: boolean
      anestesicos?: string
      antisempticos?: string
    }
    medicamentosActuales?: string
    anticoagulantes?: {
      warfarina?: boolean
      aspirina?: boolean
      clopidogrel?: boolean
      otro?: string
    }
    embarazoLactancia?: string
    observaciones?: string
  }
  antecedentesNoPatologicos?: {
    tabaquismo?: { activo: boolean; cigarrillosDia?: number; anos?: number; exfumador?: boolean }
    alcohol?: { activo: boolean; frecuencia?: string }
    sustancias?: string
    actividadFisica?: string
    tipoCalzado?: string
    bipedestacionProlongada?: boolean
    higiene?: string
    corteUnas?: string
    quienCorta?: string
    banosPublicos?: boolean
    sudoracion?: string
    ocupacionRiesgo?: string
    observaciones?: string
  }
  interrogatorioAparatos?: {
    general?: { sinDatosPatologicos?: boolean; notas?: string }
    cardiovascular?: { sinDatosPatologicos?: boolean; checkboxes?: Record<string, boolean>; notas?: string }
    endocrino?: { sinDatosPatologicos?: boolean; checkboxes?: Record<string, boolean>; notas?: string }
    neurologico?: { sinDatosPatologicos?: boolean; checkboxes?: Record<string, boolean>; notas?: string }
    dermatologico?: { sinDatosPatologicos?: boolean; checkboxes?: Record<string, boolean>; notas?: string }
    musculoesqueletico?: { sinDatosPatologicos?: boolean; checkboxes?: Record<string, boolean>; notas?: string }
  }
  signosVitales?: {
    taSistolica?: number
    taDiastolica?: number
    fc?: number
    fr?: number
    temperatura?: number
    spo2?: number
    peso?: number
    talla?: number
    imc?: number
    glucosaCapilar?: number
    eva?: number
  }
  exploracionGeneral?: {
    estadoAlerta?: string
    orientacion?: string
    habitus?: string
    estadoGeneral?: string
    marcha?: string
    usoApoyo?: string
    observaciones?: string
  }
  exploracionPodologica?: {
    inspeccionDermatologica?: {
      pieDerecho?: { coloracion?: string; temperatura?: string; hidratacion?: string; integridad?: string; lesiones?: string }
      pieIzquierdo?: { coloracion?: string; temperatura?: string; hidratacion?: string; integridad?: string; lesiones?: string }
    }
    exploracionUngueal?: {
      dedos?: Record<string, { onicocriptosis?: boolean; onicogrifosis?: boolean; onicomicosis?: boolean; onicorrexis?: boolean; grado?: string; observaciones?: string }>
    }
    exploracionVascular?: {
      pulsoPedioDerecho?: string
      pulsoPedioIzquierdo?: string
      pulsoTibialDerecho?: string
      pulsoTibialIzquierdo?: string
      llenadoCapilarDerecho?: string
      llenadoCapilarIzquierdo?: string
      edema?: string
      itbDerecho?: number
      itbIzquierdo?: number
    }
    exploracionNeurologica?: {
      monofilamentoDerecho?: string
      monofilamentoIzquierdo?: string
      sensibilidad?: string
      parestesias?: boolean
      observaciones?: string
    }
    exploracionMusculoesqueletica?: {
      tipoPie?: string
      arco?: string
      deformidades?: string
      dolor?: string
      rom?: string
      marcha?: string
    }
  }
  evaluacionRiesgo?: {
    nivel?: string // BAJO | MODERADO | ALTO | URGENTE
    justificacion?: string
    requiereReferencia?: boolean
  }
  diagnosticos?: {
    diagnosticoPrincipal?: string
    secundarios?: string[]
    problemasActivos?: string
    lateralidad?: string
    region?: string
    cie10?: string
    observaciones?: string
  }
  pronostico?: {
    tipo?: string // BUENO | RESERVADO | GUARDADO
    descripcion?: string
  }
  planManejo?: {
    manejoRealizado?: string[]
    tratamientoIndicado?: string[]
    indicacionesPaciente?: string
  }
}

export type Patient = {
  id: string
  clinicId: string
  expNumber: string
  firstName: string
  lastName: string
  birthDate: string | null
  sex: string | null
  curp: string | null
  rfc: string | null
  address: string | null
  phone: string | null
  email: string | null
  razonSocial: string | null
  regimenFiscal: string | null
  cfdiUso: string | null
  emailFactura: string | null
  isDiabetic: boolean
  allergies: string | null
  currentMeds: string | null
  chronicConditions: string | null
  riskLevel: string | null
  antecedentsHereditary: string | null
  antecedentsPathologic: string | null
  antecedentsNonPathologic: string | null
  physicalExploration: string | null
  clinicalSummary: string | null
  generalNotes: string | null
  fichaIdentificacion?: FichaIdentificacion | null
  historiaClinicaInicial?: HistoriaClinicaInicial | null
  historiaClinicaCompleta?: boolean
  historiaClinicaFecha?: string | null
  totalSpent: number
  createdAt: string
  updatedAt: string
  clinic: ClinicInfo
  appointments: AppointmentRow[]
  consultations: ConsultationRow[]
  prescriptions: PrescriptionRow[]
  files: PatientFileRow[]
  followUps: FollowUpRow[]
  procedures?: ProcedureRow[]
  consents?: ConsentRow[]
  referrals?: ReferralRow[]
  auditLogs?: AuditLogRow[]
}

export type ClinicConfig = {
  clinic: ClinicInfo | null
  diagnosesList: string[]
}
