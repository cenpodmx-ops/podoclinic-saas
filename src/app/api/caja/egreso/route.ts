import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { startOfDay, endOfDay } from 'date-fns'
import { formatDateHermosillo } from '@/lib/timezone'

// ============================================================
// MÓDULO 07 — CAJA — Registrar egreso (gasto)
// POST /api/caja/egreso  body { amount, category, description, method? }
// Acceso: RECEPTION + OWNER + SUPER. PODOLOGIST = 403.
// ============================================================

const EGRESO_CATEGORIES = [
  'RENTA',
  'SERVICIOS', // agua, luz, internet, teléfono
  'SUELDOS',
  'COMISIONES',
  'MATERIAL',
  'EQUIPO',
  'MANTENIMIENTO',
  'PUBLICIDAD',
  'TRANSPORTE',
  'IMPUESTOS',
  'OTRO',
] as const

export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')

  const amount = Number(body.amount)
  if (isNaN(amount) || amount <= 0) return bad('Monto inválido')

  const category = String(body.category || '').toUpperCase()
  if (!EGRESO_CATEGORIES.includes(category as any)) {
    return bad('Categoría inválida')
  }

  const description = typeof body.description === 'string' ? body.description.trim() : ''
  if (!description) return bad('Descripción requerida')

  const method = (String(body.method || 'EFECTIVO').toUpperCase()) as string
  if (!['EFECTIVO', 'DEBITO', 'CREDITO', 'TRANSFERENCIA', 'OTRO'].includes(method)) {
    return bad('Método de pago inválido')
  }

  const clinicId = user!.clinicId
  if (!clinicId) return bad('Sin clínica asignada', 403)

  // Obtener o crear sesión de caja de hoy
  // Usar medianoche UTC del día calendario de Hermosillo (igual que caja y operaciones)
  const todayStr = formatDateHermosillo(new Date())
  const todayStart = new Date(todayStr + 'T00:00:00.000Z')
  const todayEnd = new Date(todayStr + 'T23:59:59.999Z')
  let session = await db.cashSession.findFirst({
    where: { clinicId, date: { gte: todayStart, lte: todayEnd } },
  })
  if (!session) {
    return bad('No hay caja abierta para hoy. Abre la caja primero.', 409)
  }
  if (session.closed) {
    return bad('La caja de hoy ya está cerrada', 409)
  }

  // Crear el movimiento de egreso
  const movement = await db.cashMovement.create({
    data: {
      cashSessionId: session.id,
      clinicId,
      type: 'EGRESO',
      source: 'GASTO',
      amount,
      method,
      description: `[${category}] ${description}`,
    },
  })

  return ok(
    {
      id: movement.id,
      type: movement.type,
      source: movement.source,
      amount: movement.amount,
      method: movement.method,
      description: movement.description,
      time: movement.createdAt,
    },
    201,
  )
}

export { EGRESO_CATEGORIES }
