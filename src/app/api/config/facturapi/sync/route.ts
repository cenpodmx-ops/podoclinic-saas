import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import {
  isFacturapiConfigured,
  createFacturapiOrganization,
  updateFacturapiOrganization,
  getFacturapiOrganization,
} from '@/lib/facturapi'

/**
 * POST /api/config/facturapi/sync
 * Crea o actualiza la organización de la sucursal en FacturAPI usando la API key global.
 * Body: { rfc, razonSocial, regimenFiscal, address?, cp?, ... } (datos fiscales del emisor)
 * Si la clínica ya tiene facturapiOrgId, actualiza; si no, crea.
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role !== 'SUPER' && user!.role !== 'OWNER') return bad('Sin permisos', 403)

  if (!isFacturapiConfigured()) {
    return bad('FacturAPI no configurada a nivel global. Contacta al administrador.', 500)
  }

  const body = await req.json()
  const {
    rfc,
    razonSocial,
    regimenFiscal,
    street,
    exterior,
    interior,
    neighborhood,
    municipality,
    state,
    zip,
  } = body

  // Validaciones
  if (!rfc) return bad('RFC requerido')
  if (!razonSocial) return bad('Razón social requerida')
  if (!regimenFiscal) return bad('Régimen fiscal requerido')
  if (!zip) return bad('Código postal requerido (requerido por FacturAPI)')

  const clinicId = user!.role === 'SUPER' && body.clinicId ? body.clinicId : user!.clinicId
  if (!clinicId) return bad('Sin clínica asignada', 400)

  const clinic = await db.clinic.findUnique({ where: { id: clinicId } })
  if (!clinic) return bad('Clínica no encontrada', 404)

  const orgInput = {
    name: razonSocial, // nombre corto de la organización
    legal_name: razonSocial, // razón social
    tax_system: regimenFiscal,
    address: {
      street: street || undefined,
      exterior: exterior || undefined,
      interior: interior || undefined,
      neighborhood: neighborhood || undefined,
      municipality: municipality || undefined,
      state: state || undefined,
      zip,
    },
  }

  let org
  try {
    if (clinic.facturapiOrgId) {
      // Actualizar existente
      org = await updateFacturapiOrganization(clinic.facturapiOrgId, orgInput)
    } else {
      // Crear nueva
      org = await createFacturapiOrganization(orgInput)
    }
  } catch (e: any) {
    return bad(e?.message || 'Error al sincronizar con FacturAPI', 502)
  }

  // Guardar orgId + datos fiscales en la clínica
  const updated = await db.clinic.update({
    where: { id: clinicId },
    data: {
      facturapiOrgId: org.id,
      rfc: rfc.toUpperCase(),
      razonSocial,
      regimenFiscal,
    },
  })

  return ok({
    ok: true,
    organization: {
      id: org.id,
      name: org.name,
      legal_name: org.legal?.legal_name || org.name,
      tax_id: org.legal?.tax_id || '',
      tax_system: org.legal?.tax_system || '',
      is_production_ready: org.is_production_ready,
      pending_steps: org.pending_steps || [],
    },
    clinic: { id: updated.id, name: updated.name, facturapiOrgId: updated.facturapiOrgId },
  })
}

/**
 * GET /api/config/facturapi/sync
 * Devuelve el estado de la conexión de FacturAPI para la clínica actual:
 * - si la API key global está configurada
 * - si la clínica tiene organización creada
 * - los datos de la organización si existe
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response

  const clinicIdParam = req.nextUrl.searchParams.get('clinicId')
  const clinicId = user!.role === 'SUPER' && clinicIdParam ? clinicIdParam : user!.clinicId

  const result: any = {
    apiKeyConfigured: isFacturapiConfigured(),
    organizationId: null,
    organization: null,
  }

  if (clinicId) {
    const clinic = await db.clinic.findUnique({
      where: { id: clinicId },
      select: {
        facturapiOrgId: true,
        rfc: true,
        razonSocial: true,
        regimenFiscal: true,
        address: true,
      },
    })
    result.organizationId = clinic?.facturapiOrgId || null
    result.clinic = clinic

    if (clinic?.facturapiOrgId) {
      result.organization = await getFacturapiOrganization(clinic.facturapiOrgId)
    }
  }

  return ok(result)
}
