import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { ACTIVE_CLINIC_COOKIE } from '@/lib/session'
import { NextResponse } from 'next/server'

/**
 * POST /api/auth/active-clinic
 * Body: { clinicId }
 * Setea la cookie de sucursal activa para el Súper Dueño.
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role !== 'SUPER') return bad('Solo el Súper Dueño puede cambiar de sucursal', 403)

  const body = await req.json()
  const { clinicId } = body
  if (!clinicId) return bad('clinicId requerido')

  // Validar que la clínica exista y no sea distribuidora
  const clinic = await db.clinic.findUnique({ where: { id: clinicId } })
  if (!clinic) return bad('Clínica no encontrada', 404)
  if (clinic.isDistributor) return bad('No se puede operar como distribuidora', 400)

  const res = NextResponse.json({ ok: true, clinic: { id: clinic.id, name: clinic.name, slug: clinic.slug } })
  res.cookies.set(ACTIVE_CLINIC_COOKIE, clinicId, {
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'lax',
    httpOnly: false,
  })
  return res
}
