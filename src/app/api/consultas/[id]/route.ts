import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { startOfDay, endOfDay, addDays } from 'date-fns'

// ============================================================
// MÓDULO 02 — CONSULTAS / [id]
// GET   → consulta completa con relaciones y items parseados
// PATCH → actualiza campos. Si paid cambia false→true, ejecuta
//         toda la lógica de cobro (stock, caja, finalizar cita,
//         follow-up). 403 si PODOLOGIST.
// ============================================================

type ItemType = 'SERVICIO' | 'PRODUCTO' | 'MEDICAMENTO'
type ConsultaItem = {
  name: string
  qty: number
  price: number
  type: ItemType
  productId?: string
  serviceId?: string
}

function safeParse(s: string | null | undefined): ConsultaItem[] {
  if (!s) return []
  try {
    return JSON.parse(s) as ConsultaItem[]
  } catch {
    return []
  }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const { id } = await ctx.params
  const c = await db.consultation.findUnique({
    where: { id },
    include: {
      patient: true,
      podologist: true,
      appointment: { include: { clinic: true } },
      followUps: true,
    },
  })
  if (!c) return bad('Consulta no encontrada', 404)

  if (user!.role !== 'SUPER' && c.clinicId !== user!.clinicId) {
    return bad('No tienes acceso a esta consulta', 403)
  }

  return ok({
    id: c.id,
    date: c.date,
    reason: c.reason,
    referredBy: c.referredBy,
    diagnosis: c.diagnosis,
    treatment: c.treatment,
    notes: c.notes,
    consultPrice: c.consultPrice,
    productsTotal: c.productsTotal,
    discount: c.discount,
    total: c.total,
    paymentMethod: c.paymentMethod,
    paid: c.paid,
    ticketPrinted: c.ticketPrinted,
    followUpDays: c.followUpDays,
    items: safeParse(c.itemsJson),
    patient: c.patient,
    podologist: c.podologist,
    appointment: c.appointment,
    clinic: c.appointment?.clinic,
    followUps: c.followUps,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const { id } = await ctx.params
  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')

  const existing = await db.consultation.findUnique({
    where: { id },
    include: { appointment: true },
  })
  if (!existing) return bad('Consulta no encontrada', 404)

  if (user!.role !== 'SUPER' && existing.clinicId !== user!.clinicId) {
    return bad('No tienes acceso a esta consulta', 403)
  }

  const {
    reason,
    referredBy,
    diagnosis,
    treatment,
    notes,
    items,
    consultPrice,
    discount,
    paymentMethod,
    paid,
    followUpDays,
    ticketPrinted,
  } = body as {
    reason?: string | null
    referredBy?: string | null
    diagnosis?: string | null
    treatment?: string | null
    notes?: string | null
    items?: ConsultaItem[]
    consultPrice?: number
    discount?: number
    paymentMethod?: string
    paid?: boolean
    followUpDays?: number | null
    ticketPrinted?: boolean
  }

  // Recalcular totales si se actualizan items/precio/descuento
  let productsTotal = existing.productsTotal
  let total = existing.total
  let itemsJson = existing.itemsJson
  let itemsList: ConsultaItem[] = safeParse(existing.itemsJson)

  if (Array.isArray(items)) {
    itemsList = items.filter((i) => i && i.name).map((i) => ({
      name: String(i.name),
      qty: Math.max(1, Number(i.qty) || 1),
      price: Math.max(0, Number(i.price) || 0),
      type: (i.type === 'PRODUCTO' || i.type === 'MEDICAMENTO' || i.type === 'SERVICIO' ? i.type : 'PRODUCTO') as ItemType,
      productId: i.productId || undefined,
      serviceId: i.serviceId || undefined,
    }))
    itemsJson = JSON.stringify(itemsList)
    productsTotal = itemsList
      .filter((i) => i.type === 'PRODUCTO' || i.type === 'MEDICAMENTO')
      .reduce((s, i) => s + i.qty * i.price, 0)
    const cp = consultPrice !== undefined ? Number(consultPrice) || 0 : existing.consultPrice
    const dsc = discount !== undefined ? Number(discount) || 0 : existing.discount
    total = Math.max(0, cp + productsTotal - dsc)
  } else if (consultPrice !== undefined || discount !== undefined) {
    const cp = consultPrice !== undefined ? Number(consultPrice) || 0 : existing.consultPrice
    const dsc = discount !== undefined ? Number(discount) || 0 : existing.discount
    total = Math.max(0, cp + productsTotal - dsc)
  }

  const wasPaid = existing.paid
  const willPay = paid !== undefined ? !!paid : wasPaid
  const becamePaid = !wasPaid && willPay

  // ── Si se va a cobrar ahora (o recobrar), validar stock de PRODUCTO/MEDICAMENTO
  if (becamePaid) {
    for (const it of itemsList.filter((i) => i.type === 'PRODUCTO' || i.type === 'MEDICAMENTO')) {
      if (!it.productId) continue
      const prod = await db.product.findUnique({ where: { id: it.productId } })
      if (!prod) return bad(`Producto no encontrado: ${it.name}`, 400)
      if (prod.stock < it.qty) {
        return bad(`Stock insuficiente para ${it.name} (disponible: ${prod.stock}, solicitado: ${it.qty})`, 400)
      }
    }
  }

  // ── Actualizar consulta
  const updated = await db.consultation.update({
    where: { id },
    data: {
      reason: reason !== undefined ? (reason || null) : existing.reason,
      referredBy: referredBy !== undefined ? (referredBy || null) : existing.referredBy,
      diagnosis: diagnosis !== undefined ? (diagnosis || null) : existing.diagnosis,
      treatment: treatment !== undefined ? (treatment || null) : existing.treatment,
      notes: notes !== undefined ? (notes || null) : existing.notes,
      itemsJson,
      consultPrice: consultPrice !== undefined ? Number(consultPrice) || 0 : existing.consultPrice,
      discount: discount !== undefined ? Number(discount) || 0 : existing.discount,
      productsTotal,
      total,
      paymentMethod: paymentMethod !== undefined ? (paymentMethod || null) : existing.paymentMethod,
      paid: willPay,
      followUpDays: followUpDays !== undefined ? (followUpDays ?? null) : existing.followUpDays,
      ticketPrinted: ticketPrinted !== undefined ? !!ticketPrinted : existing.ticketPrinted,
    },
  })

  // ── Si cambió a pagado, ejecutar lógica de cobro
  if (becamePaid) {
    const appt = existing.appointment

    // 1) Descontar stock + StockMovement
    for (const it of itemsList.filter((i) => i.type === 'PRODUCTO' || i.type === 'MEDICAMENTO')) {
      if (!it.productId) continue
      await db.product.update({
        where: { id: it.productId },
        data: { stock: { decrement: it.qty } },
      })
      await db.stockMovement.create({
        data: {
          productId: it.productId,
          clinicId: existing.clinicId,
          type: 'SALIDA',
          quantity: it.qty,
          reason: `Venta en consulta ${existing.id}`,
        },
      })
    }

    // 2) Finalizar cita
    await db.appointment.update({
      where: { id: appt.id },
      data: { status: 'FINALIZADA' },
    })

    // 3) CashSession get-or-create de hoy
    const todayStart = startOfDay(new Date())
    const todayEnd = endOfDay(new Date())
    let session = await db.cashSession.findFirst({
      where: { clinicId: existing.clinicId, date: { gte: todayStart, lte: todayEnd } },
    })
    if (!session) {
      session = await db.cashSession.create({
        data: {
          clinicId: existing.clinicId,
          date: new Date(),
          openingFund: 0,
          closed: false,
        },
      })
    }

    // 4) CashMovement
    await db.cashMovement.create({
      data: {
        cashSessionId: session.id,
        clinicId: existing.clinicId,
        type: 'INGRESO',
        source: 'CONSULTA',
        amount: total,
        method: paymentMethod || existing.paymentMethod || 'EFECTIVO',
        description: `Consulta ${existing.id}`,
        refId: existing.id,
      },
    })

    // 5) Acumular totalSpent
    await db.patient.update({
      where: { id: existing.patientId },
      data: { totalSpent: { increment: total } },
    })

    // 6) FollowUp (si aún no existe uno para esta consulta y hay followUpDays)
    if (updated.followUpDays && updated.followUpDays > 0) {
      const hasFollow = await db.followUp.findFirst({
        where: { consultationId: existing.id },
      })
      if (!hasFollow) {
        await db.followUp.create({
          data: {
            patientId: existing.patientId,
            consultationId: existing.id,
            clinicId: existing.clinicId,
            dueDate: addDays(new Date(), updated.followUpDays),
            status: 'PENDIENTE',
          },
        })
      }
    }
  }

  return ok({ id: updated.id, paid: updated.paid, total: updated.total, ticketPrinted: updated.ticketPrinted })
}
