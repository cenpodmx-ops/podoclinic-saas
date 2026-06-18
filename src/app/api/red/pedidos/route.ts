import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { redEvents } from '@/lib/red-emit'

/**
 * GET /api/red/pedidos?box=inbox|sent
 * - inbox: pedidos donde toClinicId = mi clínica (la distribuidora recibe)
 * - sent:  pedidos donde fromClinicId = mi clínica (los que yo envié)
 * SUPER ve todo si ?all=1.
 * PODOLOGIST = 403.
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const sp = req.nextUrl.searchParams
  const box = sp.get('box') === 'inbox' ? 'inbox' : 'sent'
  const all = sp.get('all') === '1'
  const isSuper = user!.role === 'SUPER' && all

  const where = isSuper
    ? undefined
    : box === 'inbox'
      ? { toClinicId: user!.clinicId! }
      : { fromClinicId: user!.clinicId! }

  const rows = await db.order.findMany({
    where,
    include: {
      fromClinic: { select: { id: true, name: true, isDistributor: true } },
      toClinic: { select: { id: true, name: true, isDistributor: true } },
      items: {
        include: { product: { select: { id: true, name: true, code: true } } },
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return ok({ data: rows })
}

/**
 * POST /api/red/pedidos
 * Body: {
 *   toClinicId,                                  // la distribuidora
 *   items: [{ productId?, name, requestedQty }],
 *   urgency: 'NORMAL' | 'URGENTE',
 *   observations?
 * }
 * Crea el pedido y emite realtime a la distribuidora.
 * PODOLOGIST = 403.
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)
  if (!user!.clinicId) return bad('Sin clínica asignada', 403)

  const body = await req.json().catch(() => null)
  if (!body) return bad('JSON inválido', 400)

  const { toClinicId, items, urgency, observations } = body as {
    toClinicId?: string
    items?: Array<{ productId?: string; name?: string; requestedQty?: number }>
    urgency?: string
    observations?: string
  }

  if (!toClinicId) return bad('Distribuidora requerida', 400)
  if (toClinicId === user!.clinicId) return bad('No puedes pedirte a ti mismo', 400)
  if (!Array.isArray(items) || items.length === 0) return bad('Items requeridos', 400)
  if (!['NORMAL', 'URGENTE'].includes(urgency || '')) {
    return bad('urgency inválido (NORMAL | URGENTE)', 400)
  }

  // Validar que la distribuidora exista
  const toClinic = await db.clinic.findUnique({
    where: { id: toClinicId },
    select: { id: true, isDistributor: true },
  })
  if (!toClinic) return bad('Distribuidora no encontrada', 404)

  // Normalizar items
  const cleanItems = items.map((it, idx) => {
    const name = String(it.name || '').trim()
    if (!name) throw new Error(`Item ${idx + 1}: nombre requerido`)
    const requestedQty = Number(it.requestedQty) || 0
    if (requestedQty <= 0) throw new Error(`Item ${idx + 1}: cantidad inválida`)
    return { productId: it.productId || null, name, requestedQty }
  })

  const order = await db.order.create({
    data: {
      fromClinicId: user!.clinicId,
      toClinicId,
      urgency: urgency as string,
      observations: observations?.trim() || null,
      items: { create: cleanItems },
    },
    include: {
      fromClinic: { select: { id: true, name: true, isDistributor: true } },
      toClinic: { select: { id: true, name: true, isDistributor: true } },
      items: { include: { product: { select: { id: true, name: true, code: true } } } },
    },
  })

  // Emit a la distribuidora
  void redEvents.orderUpdated(toClinicId, order)

  return ok({ data: order }, 201)
}
