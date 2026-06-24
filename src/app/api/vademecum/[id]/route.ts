import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'

/**
 * PATCH /api/vademecum/[id]
 * Actualiza un medicamento del vademécum.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'RECEPTION' || user!.role === 'PODOLOGIST') {
    return bad('Sin permisos', 403)
  }

  const { id } = await params
  const existing = await db.vademecum.findUnique({ where: { id }, select: { clinicId: true } })
  if (!existing) return bad('No encontrado', 404)
  if (user!.role !== 'SUPER' && existing.clinicId !== user!.clinicId) {
    return bad('Sin permisos', 403)
  }

  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')

  const allowed = [
    'name', 'genericName', 'category', 'dose', 'via',
    'defaultDuration', 'indication', 'notes', 'active',
  ]
  const data: any = {}
  for (const k of allowed) {
    if (body[k] !== undefined) {
      if (k === 'active') {
        data[k] = body[k] === true || body[k] === 'true' || body[k] === 'on' || body[k] === 1
      } else {
        data[k] = body[k] === null ? null : String(body[k]).trim()
      }
    }
  }

  const updated = await db.vademecum.update({ where: { id }, data })
  return ok(updated)
}

/**
 * DELETE /api/vademecum/[id]
 * Elimina un medicamento del vademécum (soft delete: marcar inactivo).
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'RECEPTION' || user!.role === 'PODOLOGIST') {
    return bad('Sin permisos', 403)
  }

  const { id } = await params
  const existing = await db.vademecum.findUnique({ where: { id }, select: { clinicId: true } })
  if (!existing) return bad('No encontrado', 404)
  if (user!.role !== 'SUPER' && existing.clinicId !== user!.clinicId) {
    return bad('Sin permisos', 403)
  }

  await db.vademecum.update({ where: { id }, data: { active: false } })
  return ok({ ok: true })
}
