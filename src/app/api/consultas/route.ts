import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad, effectiveClinic } from '@/lib/api'
import { startOfDay, endOfDay, addDays, format } from 'date-fns'
import { formatDateHermosillo } from '@/lib/timezone'

// ============================================================
// MÓDULO 02 — CONSULTAS
// GET  ?cita=<id>            → consulta existente para esa cita
//      ?page=1&limit=20      → listado (SUPER/OWNER)
// POST body → ver schema abajo. Crea consulta y, si paid=true,
//      finaliza cita, descuenta stock, crea CashMovement, FollowUp.
// ============================================================

export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const url = req.nextUrl
  const citaId = url.searchParams.get('cita')

  // ── Caso A: consulta de una cita específica
  if (citaId) {
    const appt = await db.appointment.findUnique({
      where: { id: citaId },
      include: {
        patient: true,
        podologist: true,
        consultation: true,
      },
    })
    if (!appt) return bad('Cita no encontrada', 404)

    // SUPER puede ver cualquier clínica; los demás solo la suya
    if (user!.role !== 'SUPER' && appt.clinicId !== user!.clinicId) {
      return bad('No tienes acceso a esta cita', 403)
    }

    return ok({
      appointment: {
        id: appt.id,
        status: appt.status,
        date: appt.date,
        startTime: appt.startTime,
        endTime: appt.endTime,
        reason: appt.reason,
        serviceName: appt.serviceName,
        serviceId: appt.serviceId,
        price: appt.price,
      },
      patient: {
        id: appt.patient.id,
        firstName: appt.patient.firstName,
        lastName: appt.patient.lastName,
        expNumber: appt.patient.expNumber,
        phone: appt.patient.phone,
        isDiabetic: appt.patient.isDiabetic,
        allergies: appt.patient.allergies,
        currentMeds: appt.patient.currentMeds,
        chronicConditions: appt.patient.chronicConditions,
        riskLevel: appt.patient.riskLevel,
        totalSpent: appt.patient.totalSpent,
        sex: appt.patient.sex,
        birthDate: appt.patient.birthDate,
      },
      podologist: appt.podologist
        ? { id: appt.podologist.id, name: appt.podologist.name, specialty: appt.podologist.specialty }
        : null,
      consultation: appt.consultation
        ? {
            id: appt.consultation.id,
            date: appt.consultation.date,
            reason: appt.consultation.reason,
            referredBy: appt.consultation.referredBy,
            diagnosis: appt.consultation.diagnosis,
            treatment: appt.consultation.treatment,
            notes: appt.consultation.notes,
            consultPrice: appt.consultation.consultPrice,
            productsTotal: appt.consultation.productsTotal,
            discount: appt.consultation.discount,
            total: appt.consultation.total,
            paymentMethod: appt.consultation.paymentMethod,
            paid: appt.consultation.paid,
            ticketPrinted: appt.consultation.ticketPrinted,
            followUpDays: appt.consultation.followUpDays,
            items: safeParse(appt.consultation.itemsJson),
            createdAt: appt.consultation.createdAt,
          }
        : null,
    })
  }

  // ── Caso B: listado paginado (solo SUPER/OWNER)
  if (user!.role !== 'SUPER' && user!.role !== 'OWNER') {
    return bad('Acceso denegado', 403)
  }

  const all = url.searchParams.get('all') || undefined
  const clinicId = effectiveClinic(user!, all || undefined)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')))
  const skip = (page - 1) * limit

  const where = clinicId ? { clinicId } : {}
  const [rows, total] = await Promise.all([
    db.consultation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, expNumber: true } },
        podologist: { select: { id: true, name: true } },
        appointment: { select: { id: true, startTime: true } },
      },
    }),
    db.consultation.count({ where }),
  ])

  return ok({
    rows: rows.map((c) => ({
      id: c.id,
      date: c.date,
      patient: c.patient ? `${c.patient.firstName} ${c.patient.lastName}` : '—',
      exp: c.patient?.expNumber,
      podologist: c.podologist?.name || '—',
      startTime: c.appointment?.startTime,
      total: c.total,
      paid: c.paid,
      paymentMethod: c.paymentMethod,
    })),
    total,
    page,
    limit,
  })
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')

  const {
    appointmentId,
    reason,
    referredBy,
    diagnosis,
    treatment,
    notes,
    items = [],
    consultPrice = 0,
    discount = 0,
    paymentMethod,
    paid = false,
    followUpDays,
  } = body as {
    appointmentId: string
    reason?: string
    referredBy?: string
    diagnosis?: string
    treatment?: string
    notes?: string
    items?: ConsultaItem[]
    consultPrice?: number
    discount?: number
    paymentMethod?: string
    paid?: boolean
    followUpDays?: number
  }

  if (!appointmentId) return bad('Falta appointmentId')

  // ── Validar cita
  const appt = await db.appointment.findUnique({
    where: { id: appointmentId },
    include: { consultation: true },
  })
  if (!appt) return bad('Cita no encontrada', 404)

  if (user!.role !== 'SUPER' && appt.clinicId !== user!.clinicId) {
    return bad('No tienes acceso a esta cita', 403)
  }

  // ── No permitir duplicar consulta
  if (appt.consultation) {
    return bad('Esta cita ya tiene una consulta registrada', 409)
  }

  // ── Cálculos
  const itemsList: ConsultaItem[] = (items || []).filter((i) => i && i.name).map((i) => ({
    name: String(i.name),
    qty: Math.max(1, Number(i.qty) || 1),
    price: Math.max(0, Number(i.price) || 0),
    type: (i.type === 'PRODUCTO' || i.type === 'MEDICAMENTO' || i.type === 'SERVICIO' ? i.type : 'PRODUCTO') as ItemType,
    productId: i.productId || undefined,
    serviceId: i.serviceId || undefined,
  }))

  const productsTotal = itemsList
    .filter((i) => i.type === 'PRODUCTO' || i.type === 'MEDICAMENTO')
    .reduce((s, i) => s + i.qty * i.price, 0)

  const total = Math.max(0, Number(consultPrice) + productsTotal - Number(discount))

  // ── Si se cobra, validar stock ANTES de tocar nada
  if (paid) {
    for (const it of itemsList.filter((i) => i.type === 'PRODUCTO' || i.type === 'MEDICAMENTO')) {
      if (!it.productId) continue
      const prod = await db.product.findUnique({ where: { id: it.productId } })
      if (!prod) return bad(`Producto no encontrado: ${it.name}`, 400)
      if (prod.stock < it.qty) {
        return bad(`Stock insuficiente para ${it.name} (disponible: ${prod.stock}, solicitado: ${it.qty})`, 400)
      }
    }
  }

  // ── Crear la consulta
  const consultation = await db.consultation.create({
    data: {
      clinicId: appt.clinicId,
      appointmentId: appt.id,
      patientId: appt.patientId,
      podologistId: appt.podologistId,
      reason: reason || null,
      referredBy: referredBy || null,
      diagnosis: diagnosis || null,
      treatment: treatment || null,
      notes: notes || null,
      consultPrice: Number(consultPrice) || 0,
      productsTotal,
      discount: Number(discount) || 0,
      total,
      paymentMethod: paymentMethod || null,
      paid: !!paid,
      itemsJson: JSON.stringify(itemsList),
      followUpDays: followUpDays ?? null,
    },
  })

  // ── Lógica de cobro
  if (paid) {
    // 1) Descontar stock + crear StockMovement
    for (const it of itemsList.filter((i) => i.type === 'PRODUCTO' || i.type === 'MEDICAMENTO')) {
      if (!it.productId) continue
      await db.product.update({
        where: { id: it.productId },
        data: { stock: { decrement: it.qty } },
      })
      await db.stockMovement.create({
        data: {
          productId: it.productId,
          clinicId: appt.clinicId,
          type: 'SALIDA',
          quantity: it.qty,
          reason: `Venta en consulta ${consultation.id}`,
        },
      })
    }

    // 2) Finalizar cita
    await db.appointment.update({
      where: { id: appt.id },
      data: { status: 'FINALIZADA' },
    })

    // 3) CashSession (get-or-create de hoy)
    // Usar medianoche UTC del día calendario de Hermosillo (igual que caja y operaciones)
    // para que la búsqueda coincida con la sesión creada por apertura/caja
    const todayStr = formatDateHermosillo(new Date())
    const todayStart = new Date(todayStr + 'T00:00:00.000Z')
    const todayEnd = new Date(todayStr + 'T23:59:59.999Z')
    let session = await db.cashSession.findFirst({
      where: { clinicId: appt.clinicId, date: { gte: todayStart, lte: todayEnd } },
    })
    if (!session) {
      session = await db.cashSession.create({
        data: {
          clinicId: appt.clinicId,
          date: todayStart,
          openingFund: 0,
          closed: false,
        },
      })
    }

    // 4) CashMovement INGRESO
    await db.cashMovement.create({
      data: {
        cashSessionId: session.id,
        clinicId: appt.clinicId,
        type: 'INGRESO',
        source: 'CONSULTA',
        amount: total,
        method: paymentMethod || 'EFECTIVO',
        description: `Consulta ${appt.patientId ? '' : ''}— ${consultation.id}`,
        refId: consultation.id,
      },
    })

    // 5) Acumular totalSpent del paciente
    await db.patient.update({
      where: { id: appt.patientId },
      data: { totalSpent: { increment: total } },
    })

    // 6) FollowUp opcional
    if (followUpDays && Number(followUpDays) > 0) {
      await db.followUp.create({
        data: {
          patientId: appt.patientId,
          consultationId: consultation.id,
          clinicId: appt.clinicId,
          dueDate: addDays(new Date(), Number(followUpDays)),
          status: 'PENDIENTE',
        },
      })
    }
  } else {
    // Sin cobro → la cita queda EN_CONSULTA
    await db.appointment.update({
      where: { id: appt.id },
      data: { status: 'EN_CONSULTA' },
    })
  }

  // ── Devolver consulta completa con relaciones
  const fresh = await db.consultation.findUnique({
    where: { id: consultation.id },
    include: {
      patient: true,
      podologist: true,
      appointment: { include: { clinic: true } },
      followUps: true,
    },
  })

  return ok({
    id: fresh!.id,
    date: fresh!.date,
    reason: fresh!.reason,
    referredBy: fresh!.referredBy,
    diagnosis: fresh!.diagnosis,
    treatment: fresh!.treatment,
    notes: fresh!.notes,
    consultPrice: fresh!.consultPrice,
    productsTotal: fresh!.productsTotal,
    discount: fresh!.discount,
    total: fresh!.total,
    paymentMethod: fresh!.paymentMethod,
    paid: fresh!.paid,
    followUpDays: fresh!.followUpDays,
    items: safeParse(fresh!.itemsJson),
    patient: fresh!.patient,
    podologist: fresh!.podologist,
    appointment: fresh!.appointment,
    clinic: fresh!.appointment?.clinic,
    followUps: fresh!.followUps,
    createdAt: fresh!.createdAt,
  }, 201)
}

// ── Tipos locales
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
