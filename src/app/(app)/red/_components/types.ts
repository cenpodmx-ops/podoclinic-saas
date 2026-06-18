// Tipos compartidos del módulo Red CENPOD.

export type ClinicRef = {
  id: string
  name: string
  isMatrix?: boolean
  isDistributor?: boolean
}

export type RedMessageItem = {
  id: string
  fromClinicId: string | null
  toClinicId: string | null
  subject: string
  body: string
  parentId: string | null
  status: string // ABIERTO | RESUELTO
  readAt: string | null
  createdAt: string
  fromClinic: ClinicRef | null
  toClinic: ClinicRef | null
}

export type RedMessageDetail = RedMessageItem & {
  thread: RedMessageItem[]
}

export type RedNoticeItem = {
  id: string
  fromClinicId: string
  toAllClinics: boolean
  type: string // INFO | URGENTE | CAPACITACION
  title: string
  body: string
  createdAt: string
  fromClinic: ClinicRef
  reads: { id: string; readAt: string }[] // 0 o 1 elemento
}

export type OrderItemRow = {
  id: string
  productId: string | null
  name: string
  requestedQty: number
  suppliedQty: number
  product: { id: string; name: string; code: string | null } | null
}

export type OrderRow = {
  id: string
  fromClinicId: string
  toClinicId: string
  urgency: string // NORMAL | URGENTE
  observations: string | null
  status: string // PENDIENTE | ACEPTADO | PARCIAL | RECHAZADO | SURTIDO
  rejectReason: string | null
  createdAt: string
  updatedAt: string
  fromClinic: ClinicRef
  toClinic: ClinicRef
  items: OrderItemRow[]
}

export type ProductRow = {
  id: string
  name: string
  code: string | null
  stock: number
  category: string
}

// Badges de status

export const NOTICE_TYPE_META: Record<string, { label: string; badge: string; dot: string }> = {
  INFO: {
    label: 'Info',
    badge: 'bg-sky-100 text-sky-800 border-sky-300',
    dot: 'bg-sky-500',
  },
  URGENTE: {
    label: 'Urgente',
    badge: 'bg-red-100 text-red-800 border-red-300',
    dot: 'bg-red-500',
  },
  CAPACITACION: {
    label: 'Capacitación',
    badge: 'bg-purple-100 text-purple-800 border-purple-300',
    dot: 'bg-purple-500',
  },
}

export const ORDER_STATUS_META: Record<string, { label: string; badge: string }> = {
  PENDIENTE: { label: 'Pendiente', badge: 'bg-amber-100 text-amber-800 border-amber-300' },
  ACEPTADO: { label: 'Aceptado', badge: 'bg-blue-100 text-blue-800 border-blue-300' },
  PARCIAL: { label: 'Parcial', badge: 'bg-orange-100 text-orange-800 border-orange-300' },
  SURTIDO: { label: 'Surtido', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  RECHAZADO: { label: 'Rechazado', badge: 'bg-red-100 text-red-800 border-red-300' },
}

export const MSG_STATUS_META: Record<string, { label: string; badge: string }> = {
  ABIERTO: { label: 'Abierto', badge: 'bg-amber-100 text-amber-800 border-amber-300' },
  RESUELTO: { label: 'Resuelto', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
}
