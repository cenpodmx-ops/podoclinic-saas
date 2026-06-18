import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { redEvents } from '@/lib/red-emit'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/red/pedidos/[id]
 * Detalle del pedido con items. Solo participantes (from o to) o SUPER.
 * PODOLOGIST = 403.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const { id } = await params
  const order = await db.order.findUnique({
    where: { id },
    include: {
      fromClinic: { select: { id: true, name: true, isDistributor: true } },
      toClinic: { select: { id: true, name: true, isDistributor: true } },
      items: { include: { product: { select: { id: true, name: true, code: true } } } },
    },
  })
  if (!order) return bad('Pedido no encontrado', 404)

  const isParticipant =
    order.fromClinicId === user!.clinicId || order.toClinicId === user!.clinicId
  if (!isParticipant && user!.role !== 'SUPER') return bad('Acceso denegado', 403)

  return ok({ data: order })
}

/**
 * PATCH /api/red/pedidos/[id]
 * Body: {
 *   status: 'ACEPTADO' | 'PARCIAL' | 'RECHAZADO' | 'SURTIDO',
 *   items?: [{ id, suppliedQty }],   // para PARCIAL
 *   rejectReason?: string            // para RECHAZADO
 * }
 * Solo la clínica destinataria (distribuidora) o SUPER pueden actualizar.
 * Tras actualizar → emite realtime a la clínica que hizo el pedido.
 * PODOLOGIST = 403.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const { id } = await params
  const order = await db.order.findUnique({
    where: { id },
    select: { id: true, fromClinicId: true, toClinicId: true, status: true },
  })
  if (!order) return bad('Pedido no encontrado', 404)

  // Solo la distribuidora (toClinic) o SUPER pueden actualizar
  if (order.toClinicId !== user!.clinicId && user!.role !== 'SUPER') {
    return bad('Solo la distribuidora puede actualizar el pedido', 403)
  }

  const body = await req.json().catch(() => null)
  if (!body) return bad('JSON inválido', 400)

  const { status, items, rejectReason } = body as {
    status?: string
    items?: Array<{ id?: string; suppliedQty?: number }>
    rejectReason?: string
  }

  if (!['ACEPTADO', 'PARCIAL', 'RECHAZADO', 'SURTIDO'].includes(status || '')) {
    return bad('status inválido (ACEPTADO | PARCIAL | RECHAZADO | SURTIDO)', 400)
  }

  // Si es PARCIAL, actualizar suppliedQty por item
  if (status === 'PARCIAL' && Array.isArray(items)) {
    for (const it of items) {
      if (!it.id) continue
      const supplied = Math.max(0, Number(it.suppliedQty) || 0)
      await db.orderItem.update({
        where: { id: it.id },
        data: { suppliedQty: supplied },
      })
    }
  }

  const updated = await db.order.update({
    where: { id },
    data: {
      status: status as string,
      rejectReason: status === 'RECHAZADO' ? (rejectReason || '').trim() || null : null,
    },
    include: {
      fromClinic: { select: { id: true, name: true, isDistributor: true } },
      toClinic: { select: { id: true, name: true, isDistributor: true } },
      items: { include: { product: { select: { id: true, name: true, code: true } } } },
    },
  })

  // Notificar a la clínica que hizo el pedido
  void redEvents.orderUpdated(order.fromClinicId, updated)

  return ok({ data: updated })
}
