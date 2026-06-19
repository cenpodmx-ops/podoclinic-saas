import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'

/**
 * DELETE /api/bloqueos/[id]
 *  - 403 for PODOLOGIST
 *  - Cross-clinic guard
 */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Sin permisos para eliminar bloqueos', 403)

  const { id } = await ctx.params
  const existing = await db.appointmentBlock.findUnique({ where: { id } })
  if (!existing) return bad('Bloqueo no encontrado', 404)

  if (user!.role !== 'SUPER' && existing.clinicId !== user!.clinicId) {
    return bad('Bloqueo fuera de tu clínica', 403)
  }

  await db.appointmentBlock.delete({ where: { id } })
  return ok({ deleted: true })
}
