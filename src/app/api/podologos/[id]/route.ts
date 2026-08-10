import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'RECEPTION' || user!.role === 'PODOLOGIST') return bad('Sin permisos', 403)

  const { id } = await params
  const existing = await db.podologist.findUnique({ where: { id } })
  if (!existing) return bad('No encontrado', 404)
  if (user!.role !== 'SUPER' && existing.clinicId !== user!.clinicId) return bad('Sin permisos', 403)

  const body = await req.json()
  const allowed = [
    'name', 'gender', 'specialty', 'cedula', 'certNumber', 'photoUrl', 'phone', 'email',
    'commissionPct', 'monthlyGoalConsults', 'monthlyGoalRevenue', 'active',
    'openingTime', 'closingTime', 'slotMinutes',
  ]
  const data: any = {}
  for (const k of allowed) {
    if (body[k] !== undefined) {
      if (['commissionPct', 'monthlyGoalConsults', 'monthlyGoalRevenue', 'slotMinutes'].includes(k)) {
        data[k] = body[k] === null ? null : Number(body[k])
      } else if (k === 'active') {
        // Switch envía "on" vía FormData — convertir a boolean real
        data[k] = body[k] === 'on' || body[k] === true || body[k] === 'true' || body[k] === 1
      } else if (k === 'gender') {
        // gender solo acepta 'F' o 'M' o null
        data[k] = (body[k] === 'F' || body[k] === 'M') ? body[k] : null
      } else {
        data[k] = body[k]
      }
    }
  }

  const updated = await db.podologist.update({ where: { id }, data })
  return ok(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'RECEPTION' || user!.role === 'PODOLOGIST') return bad('Sin permisos', 403)

  const { id } = await params
  const existing = await db.podologist.findUnique({ where: { id } })
  if (!existing) return bad('No encontrado', 404)
  if (user!.role !== 'SUPER' && existing.clinicId !== user!.clinicId) return bad('Sin permisos', 403)

  // Soft delete: marcar inactivo
  await db.podologist.update({ where: { id }, data: { active: false } })
  return ok({ ok: true })
}
