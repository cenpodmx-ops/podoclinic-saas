import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad, effectiveClinic } from '@/lib/api'

// ============================================================
// MÓDULO 17 — CONTROL DE EQUIPOS
// GET  ?all=1   → lista equipos de la clínica (o todas para SUPER)
//               cada equipo incluye daysUntilMaintenance calculado
// POST         → crear equipo
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

export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'RECEPTION' || user!.role === 'PODOLOGIST') {
    return bad('Acceso denegado', 403)
  }

  const all = req.nextUrl.searchParams.get('all') || undefined
  const clinicId = effectiveClinic(user!, all || undefined)
  const where = clinicId ? { clinicId } : {}

  const equipos = await db.equipment.findMany({
    where,
    include: {
      clinic: { select: { name: true } },
      _count: { select: { maintenances: true } },
    },
    orderBy: { name: 'asc' },
  })

  const rows = equipos.map((e) => {
    const d = daysUntil(e.nextMaintenance)
    return {
      id: e.id,
      name: e.name,
      brand: e.brand,
      model: e.model,
      serialNumber: e.serialNumber,
      acquisitionDate: e.acquisitionDate,
      serviceProvider: e.serviceProvider,
      lastCalibration: e.lastCalibration,
      nextMaintenance: e.nextMaintenance,
      notes: e.notes,
      clinicName: e.clinic?.name,
      maintenancesCount: e._count.maintenances,
      daysUntilMaintenance: d,
      status: statusOf(d),
    }
  })

  return ok(rows)
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'RECEPTION' || user!.role === 'PODOLOGIST') {
    return bad('Acceso denegado', 403)
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
    clinicId,
  } = body as {
    name?: string
    brand?: string
    model?: string
    serialNumber?: string
    acquisitionDate?: string
    serviceProvider?: string
    lastCalibration?: string
    nextMaintenance?: string
    notes?: string
    clinicId?: string
  }

  if (!name) return bad('Nombre del equipo requerido')

  // SUPER puede especificar clinicId; otros usan el suyo
  const targetClinicId =
    user!.role === 'SUPER' && clinicId ? clinicId : user!.clinicId

  const created = await db.equipment.create({
    data: {
      clinicId: targetClinicId,
      name: name.trim(),
      brand: brand?.trim() || null,
      model: model?.trim() || null,
      serialNumber: serialNumber?.trim() || null,
      acquisitionDate: acquisitionDate ? new Date(acquisitionDate) : null,
      serviceProvider: serviceProvider?.trim() || null,
      lastCalibration: lastCalibration ? new Date(lastCalibration) : null,
      nextMaintenance: nextMaintenance ? new Date(nextMaintenance) : null,
      notes: notes?.trim() || null,
    },
  })

  return ok(created, 201)
}
