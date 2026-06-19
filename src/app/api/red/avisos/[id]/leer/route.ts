import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/red/avisos/[id]/leer
 * Marca el aviso como leído por el usuario actual (crea NoticeRead si no existe).
 * Idempotente: si ya está leído, no crea duplicado.
 * PODOLOGIST = 403.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const { id } = await params
  const notice = await db.redNotice.findUnique({ where: { id }, select: { id: true } })
  if (!notice) return bad('Aviso no encontrado', 404)

  const existing = await db.noticeRead.findFirst({
    where: { noticeId: id, userId: user!.id },
    select: { id: true, readAt: true },
  })

  if (existing) {
    return ok({ data: { ok: true, readAt: existing.readAt, alreadyRead: true } })
  }

  const read = await db.noticeRead.create({
    data: { noticeId: id, userId: user!.id },
    select: { id: true, readAt: true },
  })

  return ok({ data: { ok: true, readAt: read.readAt, alreadyRead: false } })
}
