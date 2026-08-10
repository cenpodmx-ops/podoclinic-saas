// Tipos compartidos del Módulo 07 — Caja

export type CashMovement = {
  id: string
  type: 'INGRESO' | 'EGRESO'
  source: string // CONSULTA | MOSTRADOR | EFECTIVO_INICIAL | GASTO | OTRO
  amount: number
  method: string | null // EFECTIVO | DEBITO | CREDITO | TRANSFERENCIA | OTRO
  description: string | null
  refId: string | null
  time: string
}

export type CashSession = {
  id: string
  openingFund: number
  closed: boolean
  closedAt: string | null
  closedBy: string | null
  countedCash: number | null
  expectedCash: number | null
  difference: number | null
  notes: string | null
  signatureData: string | null
  createdAt: string
  date: string
}

export type CashSummary = {
  openingFund: number
  ingresos: number
  egresos: number
  egresosEfectivo: number
  saldoEsperado: number
  byMethod: {
    EFECTIVO: number
    TARJETA: number
    TRANSFERENCIA: number
    TARJETA_DE_REGALO: number
    OTRO: number
  }
  methodLabels: Record<string, string>
  closed: boolean
  countedCash: number | null
  expectedCash: number | null
  difference: number | null
}

export type CajaApiResponse = {
  date: string
  session: CashSession | null
  movements: CashMovement[]
  summary: CashSummary
}

export const SOURCE_LABELS: Record<string, string> = {
  CONSULTA: 'Consulta',
  MOSTRADOR: 'Mostrador',
  EFECTIVO_INICIAL: 'Fondo inicial',
  GASTO: 'Gasto',
  OTRO: 'Otro',
}

export const EGRESO_CATEGORIES: Array<{ value: string; label: string }> = [
  { value: 'RENTA', label: 'Renta' },
  { value: 'SERVICIOS', label: 'Servicios (agua, luz, internet)' },
  { value: 'SUELDOS', label: 'Sueldos' },
  { value: 'COMISIONES', label: 'Comisiones' },
  { value: 'MATERIAL', label: 'Material' },
  { value: 'EQUIPO', label: 'Equipo' },
  { value: 'MANTENIMIENTO', label: 'Mantenimiento' },
  { value: 'PUBLICIDAD', label: 'Publicidad' },
  { value: 'TRANSPORTE', label: 'Transporte' },
  { value: 'IMPUESTOS', label: 'Impuestos' },
  { value: 'OTRO', label: 'Otro' },
]

export const PAYMENT_METHODS = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'DEBITO', label: 'Tarjeta de débito' },
  { value: 'CREDITO', label: 'Tarjeta de crédito' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'TARJETA_DE_REGALO', label: 'Tarjeta de regalo' },
  { value: 'OTRO', label: 'Otro' },
]
