import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'

// PATCH datos de la clínica + datos fiscales + FacturAPI
export async function PATCH(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role !== 'SUPER' && user!.role !== 'OWNER') return bad('Sin permisos', 403)

  const body = await req.json()
  const clinicId = user!.role === 'SUPER' && body.clinicId ? body.clinicId : user!.clinicId
  if (!clinicId) return bad('Sin clínica', 400)

  const allowed = [
    'name', 'address', 'phone', 'email', 'logoUrl',
    'openingTime', 'closingTime', 'slotMinutes',
    'rfc', 'razonSocial', 'regimenFiscal',
    'facturapiToken', 'facturapiSeries',
  ]
  const data: any = {}
  for (const k of allowed) {
    if (body[k] !== undefined) data[k] = body[k]
  }
  if (data.slotMinutes !== undefined) data.slotMinutes = Number(data.slotMinutes)

  const updated = await db.clinic.update({ where: { id: clinicId }, data })
  return ok(updated)
}
