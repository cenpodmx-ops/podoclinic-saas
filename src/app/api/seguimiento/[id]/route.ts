import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'

// ============================================================
// MÓDULO 14 — SEGUIMIENTO POST-CONSULTA
// PATCH /api/seguimiento/[id]  body { status?, whatsappSent? }
//
// status: PENDIENTE | CONTACTADO | AGENDADO | VENCIDO
// (Si se pasa VENCIDO, se guarda tal cual aunque normalmente se deriva en runtime.)
//
// Acceso: SUPER + OWNER + RECEPTION. PODOLOGIST → 403.
// ============================================================

const VALID_STATUSES = ['PENDIENTE', 'CONTACTADO', 'AGENDADO', 'VENCIDO']

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response

  if (user!.role === 'PODOLOGIST') {
    return bad('Acceso denegado', 403)
  }

  const { id } = await ctx.params
  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')

  const existing = await db.followUp.findUnique({ where: { id } })
  if (!existing) return bad('Seguimiento no encontrado', 404)
  if (user!.role !== 'SUPER' && existing.clinicId !== user!.clinicId) {
    return bad('Sin acceso a este seguimiento', 403)
  }

  const { status, whatsappSent, notes } = body as {
    status?: string
    whatsappSent?: boolean
    notes?: string
  }

  const data: any = {}
  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) return bad('Status inválido', 400)
    data.status = status
  }
  if (whatsappSent !== undefined) data.whatsappSent = !!whatsappSent
  if (notes !== undefined) data.notes = notes

  const updated = await db.followUp.update({
    where: { id },
    data,
    include: {
      patient: {
        select: { id: true, firstName: true, lastName: true, phone: true, expNumber: true },
      },
      consultation: {
        select: {
          id: true,
          date: true,
          podologist: { select: { id: true, name: true } },
        },
      },
    },
  })

  return ok(updated)
}
