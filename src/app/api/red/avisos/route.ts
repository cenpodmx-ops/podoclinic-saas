import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { redEvents } from '@/lib/red-emit'

/**
 * GET /api/red/avisos
 * Devuelve los avisos emitidos por la Matriz. Para cada uno, incluye si el
 * usuario actual ya lo leyó (en `reads[0]`).
 *
 * Como el schema no tiene un modelo NoticeClinicTarget, todos los avisos son
 * visibles para todas las clínicas del grupo (toAllClinics es informativo).
 *
 * PODOLOGIST = 403.
 */
export async function GET(_req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const notices = await db.redNotice.findMany({
    include: {
      fromClinic: { select: { id: true, name: true, isMatrix: true } },
      reads: {
        where: { userId: user!.id },
        select: { id: true, readAt: true },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return ok({ data: notices })
}

/**
 * POST /api/red/avisos
 * Body: { title, body, type: INFO|URGENTE|CAPACITACION, toAllClinics?, targetClinicIds?[] }
 * Solo SUPER (Súper Dueño = Matriz) puede emitir avisos.
 * targetClinicIds se acepta por compatibilidad futura pero se ignora (todos ven el aviso).
 * Tras crear → broadcast a todas las clínicas vía realtime.
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role !== 'SUPER') return bad('Solo la Matriz puede emitir avisos', 403)
  if (!user!.clinicId) return bad('Sin clínica asignada', 403)

  const body = await req.json().catch(() => null)
  if (!body) return bad('JSON inválido', 400)

  const { title, body: text, type, toAllClinics } = body as {
    title?: string
    body?: string
    type?: string
    toAllClinics?: boolean
  }

  if (!title || !String(title).trim()) return bad('Título requerido', 400)
  if (!text || !String(text).trim()) return bad('Cuerpo requerido', 400)
  if (!['INFO', 'URGENTE', 'CAPACITACION'].includes(type || '')) {
    return bad('type inválido (INFO | URGENTE | CAPACITACION)', 400)
  }

  const notice = await db.redNotice.create({
    data: {
      fromClinicId: user!.clinicId,
      toAllClinics: toAllClinics !== false, // default true
      type: type as string,
      title: String(title).trim().slice(0, 200),
      body: String(text).trim(),
    },
    include: {
      fromClinic: { select: { id: true, name: true, isMatrix: true } },
    },
  })

  // Broadcast a TODAS las clínicas conectadas
  void redEvents.noticeCreated(notice)

  return ok({ data: notice }, 201)
}
