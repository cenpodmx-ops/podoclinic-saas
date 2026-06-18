import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'

const FACTURAPI_BASE = 'https://www.facturapi.io/v2'

/**
 * GET /api/config/facturapi
 * Devuelve el estado de configuración de FacturAPI para la clínica actual.
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response

  const clinicIdParam = req.nextUrl.searchParams.get('clinicId')
  const clinicId = user!.role === 'SUPER' && clinicIdParam ? clinicIdParam : user!.clinicId

  if (!clinicId) return ok({ configured: false })

  const clinic = await db.clinic.findUnique({
    where: { id: clinicId },
    select: {
      facturapiToken: true,
      rfc: true,
      razonSocial: true,
      regimenFiscal: true,
      name: true,
    },
  })

  const token = clinic?.facturapiToken?.trim()

  return ok({
    configured: !!token,
    token: token ? '••••••••' : null,
    clinic: clinic
      ? {
          rfc: clinic.rfc,
          razonSocial: clinic.razonSocial,
          regimenFiscal: clinic.regimenFiscal,
        }
      : null,
  })
}

/**
 * POST /api/config/facturapi
 * Guarda (o actualiza) la API key de FacturAPI de la sucursal.
 * Body: { apiKey }
 * Antes de guardar, valida que la key funciona consultando /organizations.
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role !== 'SUPER' && user!.role !== 'OWNER') return bad('Sin permisos', 403)

  const body = await req.json()
  const { apiKey } = body
  if (!apiKey || typeof apiKey !== 'string') return bad('API key requerida')

  const trimmed = apiKey.trim()
  if (!trimmed.startsWith('sk_test_') && !trimmed.startsWith('sk_live_')) {
    return bad('La API key debe empezar con "sk_test_" o "sk_live_"')
  }

  const clinicId = user!.role === 'SUPER' && body.clinicId ? body.clinicId : user!.clinicId
  if (!clinicId) return bad('Sin clínica asignada', 400)

  // Validar la key consultando /customers (endpoint que SÍ permite la org key)
  try {
    const res = await fetch(`${FACTURAPI_BASE}/customers?limit=1`, {
      headers: { Authorization: `Bearer ${trimmed}` },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return bad(`La API key no es válida: ${err?.message || res.status}`, 400)
    }
  } catch (e: any) {
    return bad(`No se pudo conectar con FacturAPI: ${e.message}`, 502)
  }

  // Guardar el token en la clínica
  const updated = await db.clinic.update({
    where: { id: clinicId },
    data: { facturapiToken: trimmed },
  })

  return ok({
    ok: true,
    clinic: { id: updated.id, name: updated.name },
  })
}

/**
 * DELETE /api/config/facturapi
 * Elimina la API key guardada (vuelve a modo simulación).
 */
export async function DELETE(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role !== 'SUPER' && user!.role !== 'OWNER') return bad('Sin permisos', 403)

  const clinicId = user!.role === 'SUPER' && req.nextUrl.searchParams.get('clinicId') ? req.nextUrl.searchParams.get('clinicId') : user!.clinicId
  if (!clinicId) return bad('Sin clínica asignada', 400)

  await db.clinic.update({
    where: { id: clinicId },
    data: { facturapiToken: null },
  })

  return ok({ ok: true })
}
