import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import {
  getFacturapiMasterKey,
  createOrganization,
  updateOrganizationLegal,
  uploadCSD,
  getOrganizationTestApiKey,
  getOrganization,
} from '@/lib/facturapi'

/**
 * GET /api/config/facturapi
 * Devuelve el estado de configuración de FacturAPI para la clínica actual.
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response

  const clinicIdParam = req.nextUrl.searchParams.get('clinicId')
  const clinicId = user!.role === 'SUPER' && clinicIdParam ? clinicIdParam : user!.clinicId

  if (!clinicId) return ok({ configured: false, masterKeyConfigured: false })

  const [clinic] = await Promise.all([
    db.clinic.findUnique({
      where: { id: clinicId },
      select: {
        facturapiToken: true,
        facturapiOrgId: true,
        rfc: true,
        razonSocial: true,
        regimenFiscal: true,
        name: true,
      },
    }),
  ])

  const masterKeyConfigured = !!getFacturapiMasterKey()
  const apiKey = clinic?.facturapiToken?.trim()
  const orgId = clinic?.facturapiOrgId?.trim()
  const configured = !!apiKey && !!orgId

  let orgInfo: any = null
  if (orgId && masterKeyConfigured) {
    const org = await getOrganization(orgId)
    if (org) {
      orgInfo = {
        id: (org as any).id,
        name: (org as any).name,
        legal_name: (org as any).legal?.legal_name,
        tax_id: (org as any).legal?.tax_id,
        tax_system: (org as any).legal?.tax_system,
        has_certificate: (org as any).certificate?.has_certificate,
        is_production_ready: (org as any).is_production_ready,
        pending_steps: (org as any).pending_steps || [],
      }
    }
  }

  return ok({
    configured,
    masterKeyConfigured,
    hasApiKey: !!apiKey,
    hasOrg: !!orgId,
    hasCertificate: orgInfo?.has_certificate || false,
    organization: orgInfo,
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
 * Configura la facturación de la sucursal:
 *   - Crea (o reutiliza) la organización en FacturAPI
 *   - Sube los CSD (.cer, .key + contraseña)
 *   - Actualiza los datos legales (razón social, régimen, CP)
 *   - Recupera la API key de test de la organización y la guarda
 *
 * Body: multipart/form-data con campos:
 *   razon_social, regimen_fiscal, cp, cer_file, key_file, password
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role !== 'SUPER' && user!.role !== 'OWNER') return bad('Sin permisos', 403)

  if (!getFacturapiMasterKey()) {
    return bad('Falta configurar FACTURAPI_SECRET_KEY en el servidor', 500)
  }

  const clinicId = user!.role === 'SUPER' && req.nextUrl.searchParams.get('clinicId')
    ? req.nextUrl.searchParams.get('clinicId')!
    : user!.clinicId
  if (!clinicId) return bad('Sin clínica asignada', 400)

  const formData = await req.formData()
  const razonSocial = (formData.get('razon_social') as string)?.trim()
  const regimenFiscal = (formData.get('regimen_fiscal') as string)?.trim()
  const cp = (formData.get('cp') as string)?.trim()
  const cerFile = formData.get('cer_file') as File | null
  const keyFile = formData.get('key_file') as File | null
  const password = (formData.get('password') as string)?.trim()

  if (!razonSocial) return bad('Razón social requerida')
  if (!regimenFiscal) return bad('Régimen fiscal requerido')
  if (!cp) return bad('Código postal requerido')

  const clinic = await db.clinic.findUnique({ where: { id: clinicId } })
  if (!clinic) return bad('Clínica no encontrada', 404)

  let orgId = clinic.facturapiOrgId || ''

  try {
    // A. Crear organización si no existe
    if (!orgId) {
      const org = await createOrganization(razonSocial)
      orgId = org.id
    }

    // B. Subir CSD si se proporcionaron archivos
    if (cerFile && keyFile && cerFile.size > 0 && keyFile.size > 0) {
      if (!password) return bad('Contraseña de los sellos requerida', 400)
      const cerBuffer = Buffer.from(await cerFile.arrayBuffer())
      const keyBuffer = Buffer.from(await keyFile.arrayBuffer())
      try {
        await uploadCSD(orgId, cerBuffer, keyBuffer, password)
      } catch (e: any) {
        return bad(`Error al subir sellos: ${e.message || e}`, 400)
      }
    }

    // C. Actualizar datos legales
    await updateOrganizationLegal(orgId, {
      name: razonSocial,
      legal_name: razonSocial,
      tax_system: regimenFiscal,
      zip: cp,
    })

    // D. Recuperar la API key de test de la organización
    let apiKey = ''
    try {
      apiKey = (await getOrganizationTestApiKey(orgId)) || ''
    } catch {
      // La key puede no existir todavía — el admin puede crearla manualmente
    }

    // E. Guardar en la clínica
    await db.clinic.update({
      where: { id: clinicId },
      data: {
        facturapiOrgId: orgId,
        facturapiToken: apiKey || clinic.facturapiToken, // no sobrescribir si no obtuvimos nueva
        razonSocial,
        regimenFiscal,
      },
    })

    return ok({
      ok: true,
      organizationId: orgId,
      hasApiKey: !!apiKey,
      message: apiKey
        ? 'Configuración guardada. Ya puedes facturar.'
        : 'Organización creada. Ve a FacturAPI para generar una API key manualmente.',
    })
  } catch (e: any) {
    console.error('[FACTURAPI] error configurando:', e)
    return bad(e?.message || 'Error al configurar FacturAPI', 500)
  }
}

/**
 * DELETE /api/config/facturapi
 * Elimina la configuración de la sucursal (vuelve a modo no configurado).
 * No elimina la organización en FacturAPI (por si tiene facturas emitidas).
 */
export async function DELETE(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role !== 'SUPER' && user!.role !== 'OWNER') return bad('Sin permisos', 403)

  const clinicId = user!.role === 'SUPER' && req.nextUrl.searchParams.get('clinicId')
    ? req.nextUrl.searchParams.get('clinicId')!
    : user!.clinicId
  if (!clinicId) return bad('Sin clínica asignada', 400)

  await db.clinic.update({
    where: { id: clinicId },
    data: {
      facturapiToken: null,
      facturapiOrgId: null,
    },
  })

  return ok({ ok: true })
}
