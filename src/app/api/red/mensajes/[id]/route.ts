import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/red/mensajes/[id]
 * Devuelve el mensaje + el hilo completo (parentId chain).
 * Si el usuario es el destinatario y no estaba leído, marca readAt = now.
 * Solo participantes (from o to) o SUPER pueden verlo.
 * PODOLOGIST = 403.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const { id } = await params
  const msg = await db.redMessage.findUnique({
    where: { id },
    include: {
      fromClinic: { select: { id: true, name: true, isMatrix: true, isDistributor: true } },
      toClinic: { select: { id: true, name: true, isMatrix: true, isDistributor: true } },
    },
  })
  if (!msg) return bad('Mensaje no encontrado', 404)

  const isParticipant =
    msg.fromClinicId === user!.clinicId || msg.toClinicId === user!.clinicId
  if (!isParticipant && user!.role !== 'SUPER') return bad('Acceso denegado', 403)

  // Marcar como leído si soy el destinatario y no estaba leído
  let readAt = msg.readAt
  if (!msg.readAt && msg.toClinicId === user!.clinicId) {
    const updated = await db.redMessage.update({
      where: { id },
      data: { readAt: new Date() },
      select: { readAt: true },
    })
    readAt = updated.readAt
  }

  // Hilo: mensaje raíz (parentId o este mismo) + todas las respuestas
  const rootId = msg.parentId || msg.id
  const thread = await db.redMessage.findMany({
    where: {
      OR: [{ id: rootId }, { parentId: rootId }],
    },
    include: {
      fromClinic: { select: { id: true, name: true } },
      toClinic: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return ok({ data: { ...msg, readAt, thread } })
}

/**
 * PATCH /api/red/mensajes/[id]
 * Body: { status: 'ABIERTO' | 'RESUELTO' }
 * Solo participantes (from o to) o SUPER pueden cambiar status.
 * PODOLOGIST = 403.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const { id } = await params
  const msg = await db.redMessage.findUnique({ where: { id }, select: { fromClinicId: true, toClinicId: true } })
  if (!msg) return bad('Mensaje no encontrado', 404)

  const isParticipant = msg.fromClinicId === user!.clinicId || msg.toClinicId === user!.clinicId
  if (!isParticipant && user!.role !== 'SUPER') return bad('Acceso denegado', 403)

  const body = await req.json().catch(() => null)
  if (!body) return bad('JSON inválido', 400)

  const { status } = body as { status?: string }
  if (!['ABIERTO', 'RESUELTO'].includes(status || '')) {
    return bad('status inválido (ABIERTO | RESUELTO)', 400)
  }

  const updated = await db.redMessage.update({
    where: { id },
    data: { status: status as string },
    include: {
      fromClinic: { select: { id: true, name: true } },
      toClinic: { select: { id: true, name: true } },
    },
  })

  return ok({ data: updated })
}
