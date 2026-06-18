import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { redEvents } from '@/lib/red-emit'

/**
 * GET /api/red/mensajes?box=inbox|sent
 * - inbox: mensajes donde toClinicId = clínica del usuario (recibidos)
 * - sent:  mensajes donde fromClinicId = clínica del usuario (enviados)
 * SUPER ve todo si pasa ?all=1.
 * PODOLOGIST = 403.
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const sp = req.nextUrl.searchParams
  const box = sp.get('box') === 'sent' ? 'sent' : 'inbox'
  const all = sp.get('all') === '1'

  const isSuper = user!.role === 'SUPER' && all

  const where = isSuper
    ? undefined
    : box === 'sent'
      ? { fromClinicId: user!.clinicId! }
      : { toClinicId: user!.clinicId! }

  const rows = await db.redMessage.findMany({
    where,
    include: {
      fromClinic: { select: { id: true, name: true, isMatrix: true, isDistributor: true } },
      toClinic: { select: { id: true, name: true, isMatrix: true, isDistributor: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return ok({ data: rows })
}

/**
 * POST /api/red/mensajes
 * Body: { toClinicId, subject, body, parentId? }
 * Crea un mensaje en la red y dispara realtime al destinatario.
 * PODOLOGIST = 403.
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)
  if (!user!.clinicId) return bad('Sin clínica asignada', 403)

  const body = await req.json().catch(() => null)
  if (!body) return bad('JSON inválido', 400)

  const { toClinicId, subject, body: text, parentId } = body as {
    toClinicId?: string
    subject?: string
    body?: string
    parentId?: string
  }

  if (!toClinicId) return bad('Destinatario requerido', 400)
  if (!subject || !String(subject).trim()) return bad('Asunto requerido', 400)
  if (!text || !String(text).trim()) return bad('Mensaje requerido', 400)
  if (toClinicId === user!.clinicId) return bad('No puedes enviarte un mensaje a ti mismo', 400)

  // Validar que la clínica destinataria exista
  const toClinic = await db.clinic.findUnique({ where: { id: toClinicId }, select: { id: true } })
  if (!toClinic) return bad('Clínica destinataria no encontrada', 404)

  // Validar parentId si viene
  if (parentId) {
    const parent = await db.redMessage.findUnique({ where: { id: parentId }, select: { id: true } })
    if (!parent) return bad('Mensaje padre no encontrado', 404)
  }

  const msg = await db.redMessage.create({
    data: {
      fromClinicId: user!.clinicId,
      toClinicId,
      subject: String(subject).trim().slice(0, 200),
      body: String(text).trim(),
      parentId: parentId || null,
    },
    include: {
      fromClinic: { select: { id: true, name: true, isMatrix: true, isDistributor: true } },
      toClinic: { select: { id: true, name: true, isMatrix: true, isDistributor: true } },
    },
  })

  // Emit al destinatario (no bloquea la respuesta)
  void redEvents.messageCreated(toClinicId, msg)

  return ok({ data: msg }, 201)
}
