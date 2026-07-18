import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad, effectiveClinic } from '@/lib/api'
import { startOfMonth, endOfMonth, parseISO, startOfDay, endOfDay } from 'date-fns'

// ============================================================
// MÓDULO 04 — FACTURACIÓN
// GET /api/facturas/citables
//   ?page=1&limit=20&from=&to=&podologo=&paciente=
//   → listado de consultas finalizadas que NO tienen factura emitida.
// ============================================================

export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const sp = req.nextUrl.searchParams
  const all = sp.get('all') || undefined
  const clinicId = effectiveClinic(user!, all)

  const page = Math.max(1, parseInt(sp.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') || '20')))
  const skip = (page - 1) * limit

  const where: any = {}
  if (clinicId) where.clinicId = clinicId

  // Solo consultas pagadas/finalizadas
  where.paid = true

  // Filtros de fecha
  const from = sp.get('from')
  const to = sp.get('to')
  if (from && to) {
    where.date = { gte: startOfDay(parseISO(from)), lte: endOfDay(parseISO(to)) }
  } else if (from) {
    where.date = { gte: startOfDay(parseISO(from)) }
  } else if (to) {
    where.date = { lte: endOfDay(parseISO(to)) }
  }

  // Filtro por mes
  const month = sp.get('month')
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const base = parseISO(`${month}-01`)
    where.date = { gte: startOfMonth(base), lte: endOfMonth(base) }
  }

  // Filtro por podólogo
  const podologo = sp.get('podologo')
  if (podologo && podologo !== 'all') where.podologistId = podologo

  // Filtro por paciente (búsqueda por nombre)
  const paciente = sp.get('paciente')
  if (paciente) {
    where.patient = {
      OR: [
        { firstName: { contains: paciente, mode: 'insensitive' } },
        { lastName: { contains: paciente, mode: 'insensitive' } },
        { expNumber: { contains: paciente, mode: 'insensitive' } },
      ],
    }
  }

  const [rows, total] = await Promise.all([
    db.consultation.findMany({
      where,
      orderBy: { date: 'desc' },
      skip,
      take: limit,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, expNumber: true, rfc: true, phone: true } },
        podologist: { select: { id: true, name: true } },
      },
    }),
    db.consultation.count({ where }),
  ])

  // Buscar cuáles tienen factura (no cancelada)
  const consultationIds = rows.map((r) => r.id)
  const invoices = await db.invoice.findMany({
    where: {
      consultationId: { in: consultationIds },
      status: { not: 'CANCELADA' },
    },
    select: { consultationId: true },
  })
  const invoicedIds = new Set(invoices.map((i) => i.consultationId))

  return ok({
    rows: rows.map((r) => {
      const items = safeParse(r.itemsJson)
      return {
        id: r.id,
        date: r.date,
        patientId: r.patientId,
        patientName: r.patient ? `${r.patient.firstName} ${r.patient.lastName}` : '—',
        expNumber: r.patient?.expNumber ?? '',
        patientRfc: r.patient?.rfc || null,
        patientPhone: r.patient?.phone || null,
        podologistId: r.podologistId,
        podologistName: r.podologist?.name || '—',
        total: r.total,
        hasInvoice: invoicedIds.has(r.id),
        itemsCount: items.length,
        paymentMethod: r.paymentMethod,
      }
    }),
    total,
    page,
    limit,
  })
}

function safeParse(s: string | null | undefined): any[] {
  if (!s) return []
  try {
    return JSON.parse(s) as any[]
  } catch {
    return []
  }
}
