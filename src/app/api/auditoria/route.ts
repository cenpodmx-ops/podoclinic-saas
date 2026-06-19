import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'

// ============================================================
// MÓDULO EXPEDIENTE NOM-004 — Auditoría de accesos al expediente
// GET /api/auditoria?patientId=  → lista de entradas de auditoría
//   (newest first, limit 100). 403 si PODOLOGIST o cross-clinic.
// ============================================================

async function loadPatientForUser(patientId: string, user: { role: string; clinicId: string }) {
  const p = await db.patient.findUnique({
    where: { id: patientId },
    select: { id: true, clinicId: true },
  })
  if (!p) return null
  if (user.role !== 'SUPER' && p.clinicId !== user.clinicId) return 'forbidden' as const
  return p
}

export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get('patientId')
  if (!patientId) return bad('patientId es requerido', 400)

  const access = await loadPatientForUser(patientId, user!)
  if (access === null) return bad('Paciente no encontrado', 404)
  if (access === 'forbidden') return bad('Sin acceso a este paciente', 403)

  const rows = await db.auditLog.findMany({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return ok({ data: rows })
}
