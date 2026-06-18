import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'

// ============================================================
// MÓDULO 07 — CAJA — Cerrar sesión
// PATCH /api/caja/[id]  body { countedCash, notes, signatureData? }
// Acceso: RECEPTION + OWNER + SUPER. PODOLOGIST = 403.
// ============================================================

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')

  const countedCash = Number(body.countedCash)
  if (isNaN(countedCash) || countedCash < 0) return bad('Efectivo contado inválido')

  const notes = typeof body.notes === 'string' ? body.notes.trim() : ''
  const signatureData = typeof body.signatureData === 'string' ? body.signatureData : null

  const clinicId = user!.clinicId
  if (!clinicId) return bad('Sin clínica asignada', 403)

  // Cargar la sesión y validar que sea de la clínica del usuario
  const session = await db.cashSession.findUnique({
    where: { id },
    include: { movements: true },
  })
  if (!session) return bad('Sesión de caja no encontrada', 404)
  if (session.clinicId !== clinicId && user!.role !== 'SUPER') {
    return bad('No tienes acceso a esta caja', 403)
  }
  if (session.closed) return bad('Esta caja ya está cerrada', 409)

  // Calcular efectivo esperado:
  // fondo inicial + ingresos EFECTIVO (excluyendo EFECTIVO_INICIAL) − egresos EFECTIVO
  const ingresosEfectivo = session.movements
    .filter((m) => m.type === 'INGRESO' && m.source !== 'EFECTIVO_INICIAL' && (m.method || 'EFECTIVO') === 'EFECTIVO')
    .reduce((s, m) => s + m.amount, 0)
  const egresosEfectivo = session.movements
    .filter((m) => m.type === 'EGRESO' && (m.method || 'EFECTIVO') === 'EFECTIVO')
    .reduce((s, m) => s + m.amount, 0)
  const expectedCash = session.openingFund + ingresosEfectivo - egresosEfectivo
  const difference = countedCash - expectedCash

  await db.cashSession.update({
    where: { id },
    data: {
      closed: true,
      closedAt: new Date(),
      closedBy: user!.name,
      countedCash,
      expectedCash,
      difference,
      notes: notes || null,
      signatureData,
    },
  })

  return ok({
    id: session.id,
    closed: true,
    closedAt: new Date(),
    countedCash,
    expectedCash,
    difference,
  })
}
