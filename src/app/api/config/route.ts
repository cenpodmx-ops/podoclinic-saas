import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok } from '@/lib/api'

// ============================================================
// MÓDULO 18 — CONFIGURACIÓN (lectura, soporte para Consulta)
// GET → devuelve datos de la clínica y su configuración:
//      clinic (nombre, dirección, teléfono, logoUrl)
//      diagnosesList (array de strings)
// ============================================================

export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response

  const url = req.nextUrl
  const clinicIdParam = url.searchParams.get('clinicId')
  const clinicId = clinicIdParam || user!.clinicId

  if (!clinicId) return ok({ clinic: null, diagnosesList: [], config: null })

  const [clinic, config] = await Promise.all([
    db.clinic.findUnique({
      where: { id: clinicId },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        email: true,
        logoUrl: true,
        rfc: true,
        razonSocial: true,
        regimenFiscal: true,
        openingTime: true,
        closingTime: true,
        slotMinutes: true,
        slug: true,
        // Sin exponer el token: solo un flag booleano
        facturapiToken: true,
        facturapiSeries: true,
        timezone: true,
        primaryColor: true,
        secondaryColor: true,
      },
    }),
    db.clinicConfig.findUnique({
      where: { clinicId },
      select: {
        diagnosesList: true,
        prescriptionDesign: true,
        tplConfirm: true,
        tplReminder: true,
        tplGoogleReview: true,
        tplBirthday: true,
        tplInactive: true,
        tplFollowUp: true,
        holidaysJson: true,
      },
    }),
  ])

  let diagnosesList: string[] = []
  if (config?.diagnosesList) {
    try {
      diagnosesList = JSON.parse(config.diagnosesList) as string[]
    } catch {
      diagnosesList = []
    }
  }

  return ok({
    clinic: clinic
      ? {
          ...clinic,
          // No exponer el token al cliente — solo un flag booleano
          facturapiToken: undefined,
          facturapiConfigured: !!clinic.facturapiToken,
          facturapiSeries: clinic.facturapiSeries,
        }
      : null,
    diagnosesList,
    config, // plantillas WhatsApp + holidaysJson para el módulo de Agenda
  })
}

// ============================================================
// POST — Actualizar branding y zona horaria de la clínica
// Body: { timezone?, primaryColor?, secondaryColor? }
// ============================================================
export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response

  // Solo OWNER y SUPER pueden cambiar la configuración de branding
  if (user!.role !== 'OWNER' && user!.role !== 'SUPER') {
    return ok({ error: 'No autorizado' }, 403)
  }

  const body = await req.json().catch(() => ({}))
  const { timezone, primaryColor, secondaryColor } = body

  const data: Record<string, string> = {}
  if (typeof timezone === 'string' && timezone.trim()) data.timezone = timezone.trim()
  if (typeof primaryColor === 'string' && primaryColor.trim()) data.primaryColor = primaryColor.trim()
  if (typeof secondaryColor === 'string') data.secondaryColor = secondaryColor.trim()

  if (Object.keys(data).length === 0) {
    return ok({ error: 'No hay campos válidos para actualizar' }, 400)
  }

  const updated = await db.clinic.update({
    where: { id: user!.clinicId },
    data,
    select: { id: true, name: true, timezone: true, primaryColor: true, secondaryColor: true, logoUrl: true }
  })

  return ok({ clinic: updated })
}
