import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { addMonths } from 'date-fns'

// ============================================================
// MÓDULO 17 — CONTROL DE EQUIPOS
// POST /api/equipos/[id]/mantenimientos
// Body: { type: CALIBRACION|MANTENIMIENTO|REPARACION, description?, technician?, cost? }
// - Crea registro de mantenimiento
// - Si type=CALIBRACION: actualiza lastCalibration = hoy
// - Si type=MANTENIMIENTO: actualiza nextMaintenance = hoy + 6 meses
// - Si type=REPARACION: no actualiza fechas automáticamente (dejar PATCH)
// 403 si RECEPTION / PODOLOGIST
// ============================================================

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'RECEPTION' || user!.role === 'PODOLOGIST') {
    return bad('Acceso denegado', 403)
  }
  const { id } = await ctx.params

  const existing = await db.equipment.findUnique({ where: { id } })
  if (!existing) return bad('Equipo no encontrado', 404)
  if (user!.role !== 'SUPER' && existing.clinicId !== user!.clinicId) {
    return bad('No tienes acceso a este equipo', 403)
  }

  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')

  const { type, description, technician, cost } = body as {
    type?: string
    description?: string
    technician?: string
    cost?: number
  }

  if (!type) return bad('Falta type')
  const t = String(type).toUpperCase()
  if (!['CALIBRACION', 'MANTENIMIENTO', 'REPARACION'].includes(t)) {
    return bad('type inválido (CALIBRACION | MANTENIMIENTO | REPARACION)')
  }

  const now = new Date()
  const data: any = {
    equipmentId: id,
    type: t,
    description: description?.trim() || null,
    technician: technician?.trim() || null,
    cost: cost !== undefined ? Number(cost) || 0 : 0,
  }

  // Actualizar campos del equipo según el tipo
  const eqUpdate: any = {}
  if (t === 'CALIBRACION') {
    eqUpdate.lastCalibration = now
    // Próxima calibración anual recomendada (12 meses)
    eqUpdate.nextMaintenance = addMonths(now, 12)
  } else if (t === 'MANTENIMIENTO') {
    eqUpdate.nextMaintenance = addMonths(now, 6)
  }

  const [created] = await db.$transaction([
    db.maintenance.create({ data }),
    db.equipment.update({ where: { id }, data: eqUpdate }),
  ])

  return ok({
    id: created.id,
    equipmentId: created.equipmentId,
    date: created.date,
    type: created.type,
    description: created.description,
    technician: created.technician,
    cost: created.cost,
    updatedEquipment: eqUpdate,
  }, 201)
}
