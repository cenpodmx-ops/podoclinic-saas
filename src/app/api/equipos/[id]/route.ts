import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'

// ============================================================
// MÓDULO 17 — CONTROL DE EQUIPOS
// GET    /api/equipos/[id]  → equipo + historial de mantenimientos
// PATCH  /api/equipos/[id]  → actualizar campos
// DELETE /api/equipos/[id]  → borrado físico
// 403 si RECEPTION / PODOLOGIST
// ============================================================

function daysUntil(d?: Date | null): number | null {
  if (!d) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function statusOf(days: number | null): 'OK' | 'PROXIMO' | 'VENCIDO' | 'SIN_FECHA' {
  if (days === null) return 'SIN_FECHA'
  if (days < 0) return 'VENCIDO'
  if (days <= 30) return 'PROXIMO'
  return 'OK'
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'RECEPTION' || user!.role === 'PODOLOGIST') {
    return bad('Acceso denegado', 403)
  }
  const { id } = await ctx.params

  const eq = await db.equipment.findUnique({
    where: { id },
    include: {
      clinic: { select: { name: true, phone: true, address: true } },
      maintenances: { orderBy: { date: 'desc' } },
    },
  })
  if (!eq) return bad('Equipo no encontrado', 404)
  if (user!.role !== 'SUPER' && eq.clinicId !== user!.clinicId) {
    return bad('No tienes acceso a este equipo', 403)
  }

  const d = daysUntil(eq.nextMaintenance)
  return ok({
    id: eq.id,
    name: eq.name,
    brand: eq.brand,
    model: eq.model,
    serialNumber: eq.serialNumber,
    acquisitionDate: eq.acquisitionDate,
    serviceProvider: eq.serviceProvider,
    lastCalibration: eq.lastCalibration,
    nextMaintenance: eq.nextMaintenance,
    notes: eq.notes,
    createdAt: eq.createdAt,
    updatedAt: eq.updatedAt,
    clinic: eq.clinic,
    daysUntilMaintenance: d,
    status: statusOf(d),
    maintenances: eq.maintenances.map((m) => ({
      id: m.id,
      date: m.date,
      type: m.type,
      description: m.description,
      technician: m.technician,
      cost: m.cost,
    })),
  })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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

  const {
    name,
    brand,
    model,
    serialNumber,
    acquisitionDate,
    serviceProvider,
    lastCalibration,
    nextMaintenance,
    notes,
  } = body as any

  const data: any = {}
  if (name !== undefined) data.name = String(name).trim()
  if (brand !== undefined) data.brand = brand ? String(brand).trim() : null
  if (model !== undefined) data.model = model ? String(model).trim() : null
  if (serialNumber !== undefined) data.serialNumber = serialNumber ? String(serialNumber).trim() : null
  if (acquisitionDate !== undefined) data.acquisitionDate = acquisitionDate ? new Date(acquisitionDate) : null
  if (serviceProvider !== undefined) data.serviceProvider = serviceProvider ? String(serviceProvider).trim() : null
  if (lastCalibration !== undefined) data.lastCalibration = lastCalibration ? new Date(lastCalibration) : null
  if (nextMaintenance !== undefined) data.nextMaintenance = nextMaintenance ? new Date(nextMaintenance) : null
  if (notes !== undefined) data.notes = notes ? String(notes).trim() : null

  const updated = await db.equipment.update({ where: { id }, data })
  return ok(updated)
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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

  // Borrado físico: las maintenances se borran en cascada por onDelete: Cascade
  await db.equipment.delete({ where: { id } })
  return ok({ deleted: true, id })
}
