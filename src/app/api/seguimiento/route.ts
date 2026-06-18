import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad, effectiveClinic } from '@/lib/api'
import { startOfDay, endOfDay, format, parseISO } from 'date-fns'

// ============================================================
// MÓDULO 14 — SEGUIMIENTO POST-CONSULTA
// GET ?status=PENDIENTE|CONTACTADO|AGENDADO|VENCIDO&from=&to=
//
// Devuelve follow-ups para la clínica del usuario (o todas para SUPER con ?all=1).
// - VENCIDO: se calcula en runtime si dueDate < hoy y status='PENDIENTE'.
// - Orden: dueDate asc.
// - Cada item incluye: id, patient { id, firstName, lastName, phone, expNumber },
//   consultation { id, date, podologist { name } }, dueDate, status, daysUntilDue,
//   notes, whatsappSent, createdAt.
//
// Acceso: SUPER + OWNER + RECEPTION. PODOLOGIST → 403.
// ============================================================

const VALID_STATUSES = ['PENDIENTE', 'CONTACTADO', 'AGENDADO', 'VENCIDO']

export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response

  if (user!.role === 'PODOLOGIST') {
    return bad('Acceso denegado al módulo de seguimiento', 403)
  }

  const sp = req.nextUrl.searchParams
  const statusFilter = sp.get('status') || undefined
  if (statusFilter && !VALID_STATUSES.includes(statusFilter)) {
    return bad('Status inválido', 400)
  }

  const all = sp.get('all') || undefined
  const clinicId = effectiveClinic(user!, all)
  const where: any = {}
  if (clinicId) where.clinicId = clinicId

  const from = sp.get('from') || undefined
  const to = sp.get('to') || undefined
  if (from) {
    where.dueDate = { ...(where.dueDate || {}), gte: startOfDay(parseISO(from)) }
  }
  if (to) {
    where.dueDate = { ...(where.dueDate || {}), lte: endOfDay(parseISO(to)) }
  }

  const followUps = await db.followUp.findMany({
    where,
    orderBy: { dueDate: 'asc' },
    take: 500,
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          expNumber: true,
        },
      },
      consultation: {
        select: {
          id: true,
          date: true,
          diagnosis: true,
          treatment: true,
          podologist: { select: { id: true, name: true } },
        },
      },
    },
  })

  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)

  const rows = followUps.map((f) => {
    const due = new Date(f.dueDate)
    // VENCIDO: dueDate < hoy AND status='PENDIENTE'
    const effectiveStatus =
      f.status === 'PENDIENTE' && due < todayStart ? 'VENCIDO' : f.status

    const daysUntilDue = Math.floor(
      (due.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24),
    )

    return {
      id: f.id,
      patient: f.patient,
      consultation: f.consultation,
      dueDate: f.dueDate,
      dueDateLabel: format(due, 'dd/MM/yyyy'),
      status: f.status,
      effectiveStatus,
      daysUntilDue,
      notes: f.notes,
      whatsappSent: f.whatsappSent,
      createdAt: f.createdAt,
      isToday: due >= todayStart && due <= todayEnd,
      isOverdue: effectiveStatus === 'VENCIDO',
    }
  })

  // Si el usuario filtró por VENCIDO, aplicar aquí (es un estado derivado)
  let filtered = rows
  if (statusFilter === 'VENCIDO') {
    filtered = rows.filter((r) => r.effectiveStatus === 'VENCIDO')
  } else if (statusFilter) {
    filtered = rows.filter(
      (r) => r.status === statusFilter && r.effectiveStatus !== 'VENCIDO',
    )
  }

  // Agrupar por bucket para el frontend
  const buckets = {
    vencidos: filtered.filter((r) => r.effectiveStatus === 'VENCIDO'),
    hoy: filtered.filter(
      (r) => r.effectiveStatus !== 'VENCIDO' && r.isToday && r.status === 'PENDIENTE',
    ),
    proximos7: filtered.filter(
      (r) =>
        r.effectiveStatus !== 'VENCIDO' &&
        !r.isToday &&
        r.status === 'PENDIENTE' &&
        r.daysUntilDue > 0 &&
        r.daysUntilDue <= 7,
    ),
    futuros: filtered.filter(
      (r) =>
        r.effectiveStatus !== 'VENCIDO' &&
        r.status === 'PENDIENTE' &&
        r.daysUntilDue > 7,
    ),
    contactados: filtered.filter((r) => r.effectiveStatus === 'CONTACTADO'),
    agendados: filtered.filter((r) => r.effectiveStatus === 'AGENDADO'),
  }

  return ok({
    total: filtered.length,
    counts: {
      vencidos: buckets.vencidos.length,
      hoy: buckets.hoy.length,
      proximos7: buckets.proximos7.length,
      futuros: buckets.futuros.length,
      contactados: buckets.contactados.length,
      agendados: buckets.agendados.length,
    },
    buckets,
    rows: filtered,
    generatedAt: now.toISOString(),
  })
}
