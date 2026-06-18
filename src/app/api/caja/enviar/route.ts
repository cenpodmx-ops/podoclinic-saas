import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { startOfDay, endOfDay, format } from 'date-fns'

// ============================================================
// MÓDULO 07 — CAJA — Enviar corte por WhatsApp
// POST /api/caja/enviar  body { phone }
// Devuelve un URL wa.me con texto preformateado (resumen del corte).
// Acceso: RECEPTION + OWNER + SUPER. PODOLOGIST = 403.
// ============================================================

export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')

  const phone = String(body.phone || '').replace(/[^0-9]/g, '')
  if (phone.length < 10) return bad('Teléfono inválido')

  const clinicId = user!.clinicId
  if (!clinicId) return bad('Sin clínica asignada', 403)

  // Buscar sesión de hoy
  const todayStart = startOfDay(new Date())
  const todayEnd = endOfDay(new Date())
  const session = await db.cashSession.findFirst({
    where: { clinicId, date: { gte: todayStart, lte: todayEnd } },
    include: { movements: true, clinic: true },
  })
  if (!session) return bad('No hay caja abierta para hoy', 404)

  const clinic = session.clinic
  const dateLabel = format(session.date, 'dd/MM/yyyy')

  // Calcular resumen
  const ingresos = session.movements
    .filter((m) => m.type === 'INGRESO' && m.source !== 'EFECTIVO_INICIAL')
    .reduce((s, m) => s + m.amount, 0)
  const egresos = session.movements
    .filter((m) => m.type === 'EGRESO')
    .reduce((s, m) => s + m.amount, 0)

  const byMethod = { EFECTIVO: 0, TARJETA: 0, TRANSFERENCIA: 0, OTRO: 0 }
  for (const m of session.movements) {
    if (m.type !== 'INGRESO' || m.source === 'EFECTIVO_INICIAL') continue
    if (m.method === 'EFECTIVO') byMethod.EFECTIVO += m.amount
    else if (m.method === 'DEBITO' || m.method === 'CREDITO') byMethod.TARJETA += m.amount
    else if (m.method === 'TRANSFERENCIA') byMethod.TRANSFERENCIA += m.amount
    else byMethod.OTRO += m.amount
  }

  const saldoFinal = session.openingFund + ingresos - egresos
  const diferencia = session.closed && session.countedCash !== null
    ? session.countedCash - (session.expectedCash ?? 0)
    : null

  const lines: string[] = []
  lines.push(`*CORTE DE CAJA*`)
  lines.push(`${clinic?.name || 'CENPOD'}`)
  lines.push(`Fecha: ${dateLabel}`)
  lines.push(`Responsable: ${session.closedBy || user!.name}`)
  lines.push('')
  lines.push(`*Fondo inicial:* $${session.openingFund.toFixed(2)}`)
  lines.push(`*Ingresos:* $${ingresos.toFixed(2)}`)
  lines.push(`  • Efectivo: $${byMethod.EFECTIVO.toFixed(2)}`)
  lines.push(`  • Tarjeta: $${byMethod.TARJETA.toFixed(2)}`)
  lines.push(`  • Transferencia: $${byMethod.TRANSFERENCIA.toFixed(2)}`)
  lines.push(`  • Otro: $${byMethod.OTRO.toFixed(2)}`)
  lines.push(`*Egresos:* $${egresos.toFixed(2)}`)
  lines.push(`*Saldo final:* $${saldoFinal.toFixed(2)}`)
  if (session.closed) {
    lines.push('')
    lines.push(`*Caja cerrada*`)
    lines.push(`Efectivo contado: $${(session.countedCash ?? 0).toFixed(2)}`)
    lines.push(`Efectivo esperado: $${(session.expectedCash ?? 0).toFixed(2)}`)
    if (diferencia !== null) {
      const sign = diferencia >= 0 ? '+' : ''
      lines.push(`Diferencia: ${sign}$${diferencia.toFixed(2)}`)
    }
  }
  lines.push('')
  lines.push(`_Enviado desde Sistema CENPOD_`)

  const text = encodeURIComponent(lines.join('\n'))
  // Si el teléfono tiene 10 dígitos, asumir México (52)
  const fullPhone = phone.length === 10 ? `52${phone}` : phone
  const url = `https://wa.me/${fullPhone}?text=${text}`

  return ok({ url, text: lines.join('\n') })
}
