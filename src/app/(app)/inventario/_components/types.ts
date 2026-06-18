export const CATEGORIES = ['MEDICAMENTO', 'PRODUCTO', 'MATERIAL', 'EQUIPO'] as const
export const CATEGORY_LABELS: Record<string, string> = {
  MEDICAMENTO: 'Medicamento',
  PRODUCTO: 'Producto',
  MATERIAL: 'Material',
  EQUIPO: 'Equipo',
}

export const IVA_TYPES = ['EXENTO', 'IVA0', 'IVA16'] as const
export const IVA_LABELS: Record<string, string> = {
  EXENTO: 'Exento',
  IVA0: 'IVA 0%',
  IVA16: 'IVA 16%',
}

export const PAYMENT_METHODS = ['EFECTIVO', 'DEBITO', 'CREDITO', 'TRANSFERENCIA', 'OTRO'] as const
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  DEBITO: 'Tarjeta de débito',
  CREDITO: 'Tarjeta de crédito',
  TRANSFERENCIA: 'Transferencia',
  OTRO: 'Otro',
}

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  ENTRADA: 'Entrada',
  SALIDA: 'Salida',
  AJUSTE: 'Ajuste',
  VENTA: 'Venta',
}

export type Product = {
  id: string
  clinicId: string
  code: string | null
  name: string
  description: string | null
  category: string
  costPrice: number
  salePrice: number
  ivaType: string
  stock: number
  minStock: number
  supplier: string | null
  active: boolean
  createdAt: string
  updatedAt: string
  stockBajo?: boolean
}

export type StockMovement = {
  id: string
  productId: string
  clinicId: string
  type: string
  quantity: number
  reason: string | null
  cost: number | null
  supplier: string | null
  createdAt: string
}

export type CartItem = {
  productId: string
  name: string
  category: string
  ivaType: string
  qty: number
  price: number
  stock: number
  subtotal: number
  ivaAmount: number
}

export type VentaMostradorResponse = {
  ticketId: string
  date: string
  total: number
  subtotal: number
  ivaTotal: number
  paymentMethod: string
  items: {
    productId: string
    name: string
    category: string
    ivaType: string
    qty: number
    price: number
    subtotal: number
    ivaAmount: number
  }[]
  clinic: {
    id: string
    name: string
    address: string | null
    phone: string | null
    email: string | null
    logoUrl: string | null
  } | null
  cashier: { id: string; name: string }
}
