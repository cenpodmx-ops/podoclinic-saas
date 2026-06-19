import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { startOfDay, endOfDay, format } from 'date-fns'

// ============================================================
// MÓDULO 06 — Venta de mostrador (POS)
// POST: {items:[{productId, qty}], paymentMethod, descontarStock=true}
// - Valida stock por item
// - Crea StockMovement SALIDA por item
// - Decrementa product.stock
// - Get-or-create CashSession de hoy
// - Crea CashMovement INGRESO source='MOSTRADOR'
// - Retorna {total, ticketId, items, clinic, date}
// PODOLOGIST: 403
// ============================================================

const PAYMENT_METHODS = ['EFECTIVO', 'DEBITO', 'CREDITO', 'TRANSFERENCIA', 'OTRO']

export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response

  if (user!.role === 'PODOLOGIST') {
    return bad('Acceso denegado', 403)
  }

  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')

  const { items, paymentMethod, descontarStock = true } = body as {
    items?: { productId: string; qty: number }[]
    paymentMethod?: string
    descontarStock?: boolean
  }

  if (!Array.isArray(items) || items.length === 0) {
    return bad('Debes agregar al menos un producto')
  }
  if (!paymentMethod || !PAYMENT_METHODS.includes(paymentMethod)) {
    return bad(`Método de pago inválido. Debe ser uno de: ${PAYMENT_METHODS.join(', ')}`)
  }

  const clinicId = user!.clinicId

  // ── Cargar productos y validar stock
  const productIds = items.map((i) => i.productId)
  const products = await db.product.findMany({
    where: { id: { in: productIds }, clinicId },
  })

  if (products.length !== productIds.length) {
    const found = new Set(products.map((p) => p.id))
    const missing = productIds.filter((id) => !found.has(id))
    return bad(`Productos no encontrados o de otra clínica: ${missing.join(', ')}`, 404)
  }

  // Validar cantidades y stock
  const lineItems: {
    product: (typeof products)[number]
    qty: number
    subtotal: number
    ivaAmount: number
  }[] = []
  for (const it of items) {
    const prod = products.find((p) => p.id === it.productId)!
    const qty = Math.max(1, Number(it.qty) || 1)
    if (descontarStock && prod.stock < qty) {
      return bad(`Stock insuficiente para ${prod.name} (disponible: ${prod.stock}, solicitado: ${qty})`, 400)
    }
    const subtotal = prod.salePrice * qty
    let ivaAmount = 0
    if (prod.ivaType === 'IVA16') ivaAmount = subtotal * 0.16
    lineItems.push({ product: prod, qty, subtotal, ivaAmount })
  }

  const subtotal = lineItems.reduce((s, l) => s + l.subtotal, 0)
  const ivaTotal = lineItems.reduce((s, l) => s + l.ivaAmount, 0)
  const total = subtotal + ivaTotal

  // ── Ticket id (últimos 10 dígitos del timestamp)
  const ticketId = Date.now().toString().slice(-10)

  // ── 1) Descontar stock + crear StockMovement SALIDA
  if (descontarStock) {
    for (const it of lineItems) {
      await db.product.update({
        where: { id: it.product.id },
        data: { stock: { decrement: it.qty } },
      })
      await db.stockMovement.create({
        data: {
          productId: it.product.id,
          clinicId,
          type: 'SALIDA',
          quantity: it.qty,
          reason: `Venta de mostrador #${ticketId}`,
        },
      })
    }
  }

  // ── 2) CashSession de hoy (get-or-create)
  const todayStart = startOfDay(new Date())
  const todayEnd = endOfDay(new Date())
  let session = await db.cashSession.findFirst({
    where: { clinicId, date: { gte: todayStart, lte: todayEnd } },
  })
  if (!session) {
    session = await db.cashSession.create({
      data: {
        clinicId,
        date: new Date(),
        openingFund: 0,
        closed: false,
      },
    })
  }

  // ── 3) CashMovement INGRESO
  await db.cashMovement.create({
    data: {
      cashSessionId: session.id,
      clinicId,
      type: 'INGRESO',
      source: 'MOSTRADOR',
      amount: total,
      method: paymentMethod,
      description: `Venta de mostrador #${ticketId} (${lineItems.length} items)`,
      refId: ticketId,
    },
  })

  // ── 4) Retornar respuesta con datos del ticket
  const clinic = await db.clinic.findUnique({
    where: { id: clinicId },
    select: { id: true, name: true, address: true, phone: true, email: true, logoUrl: true },
  })

  return ok({
    ticketId,
    date: new Date(),
    total,
    subtotal,
    ivaTotal,
    paymentMethod,
    items: lineItems.map((l) => ({
      productId: l.product.id,
      name: l.product.name,
      category: l.product.category,
      ivaType: l.product.ivaType,
      qty: l.qty,
      price: l.product.salePrice,
      subtotal: l.subtotal,
      ivaAmount: l.ivaAmount,
    })),
    clinic,
    cashier: { id: user!.id, name: user!.name },
  }, 201)
}
