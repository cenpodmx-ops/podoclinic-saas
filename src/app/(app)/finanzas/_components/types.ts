// Tipos compartidos del Módulo 07 — Finanzas

export type Period = 'dia' | 'semana' | 'mes' | 'año'

export type FinanzasDashboard = {
  period: Period
  range: { from: string; to: string }
  totals: {
    ingresos: number
    egresos: number
    neto: number
    bySource: { consulta: number; mostrador: number; otros: number }
    egresosByCategory: Record<string, number>
  }
  byMethod: { EFECTIVO: number; TARJETA: number; TRANSFERENCIA: number; TARJETA_DE_REGALO: number; OTRO: number }
  byPodologist: Array<{
    name: string
    consults: number
    revenue: number
    consultRevenue?: number
    productsRevenue?: number
    commissionPct: number
    commission: number
  }>
  topServices: Array<{
    name: string
    count: number
    revenue: number
    bruto?: number
    descuento?: number
    productos?: number
    avgPrice?: number
    podologosCount?: number
  }>
  productos?: {
    total: number
    enConsultas: number
    mostrador: number
    top: Array<{ name: string; count: number; revenue: number; category: string }>
    byPodologo: Array<{ name: string; productsCount: number; productsRevenue: number }>
  }
  descuentos?: {
    count: number
    total: number
    bruto: number
    neto: number
    pctAhorro: number
  }
  dailySeries: Array<{ date: string; ingresos: number; egresos: number }>
  comparison: {
    prevIngresos: number
    prevEgresos: number
    prevNeto: number
    ingresosPct: number
    egresosPct: number
    netoPct: number
  }
}

export type ComisionRow = {
  name: string
  consultCount: number
  totalGenerated: number
  consultRevenue?: number
  commissionPct: number
  commissionAmount: number
  productsCount?: number
  productsRevenue?: number
}

export type ComisionesResponse = {
  range: { from: string; to: string }
  rows: ComisionRow[]
  total: {
    consultCount: number
    totalGenerated: number
    consultRevenue?: number
    commissionAmount: number
    productsCount?: number
    productsRevenue?: number
  }
}

export type ReporteResponse =
  | {
      title: string
      range?: { from: string; to: string }
      [k: string]: any
    }
  | any
