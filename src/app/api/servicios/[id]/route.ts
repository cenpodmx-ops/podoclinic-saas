import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'RECEPTION' || user!.role === 'PODOLOGIST') return bad('Sin permisos', 403)

  const { id } = await params
  const existing = await db.service.findUnique({ where: { id } })
  if (!existing) return bad('No encontrado', 404)
  if (user!.role !== 'SUPER' && existing.clinicId !== user!.clinicId) return bad('Sin permisos', 403)

  const body = await req.json()
  const { name, description, durationMin, price, commissionPct, ivaType, active } = body

  const updated = await db.service.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description: description || null }),
      ...(durationMin !== undefined && { durationMin: Number(durationMin) }),
      ...(price !== undefined && { price: Number(price) }),
      ...(commissionPct !== undefined && { commissionPct: Number(commissionPct) }),
      ...(ivaType !== undefined && { ivaType }),
      ...(active !== undefined && { active }),
    },
  })
  return ok(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'RECEPTION' || user!.role === 'PODOLOGIST') return bad('Sin permisos', 403)

  const { id } = await params
  const existing = await db.service.findUnique({ where: { id } })
  if (!existing) return bad('No encontrado', 404)
  if (user!.role !== 'SUPER' && existing.clinicId !== user!.clinicId) return bad('Sin permisos', 403)

  // Soft delete: marcar inactivo en lugar de borrar
  await db.service.update({ where: { id }, data: { active: false } })
  return ok({ ok: true })
}
