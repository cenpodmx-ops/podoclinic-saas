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
        openingTime: true,
        closingTime: true,
        slotMinutes: true,
        slug: true,
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
    clinic,
    diagnosesList,
    config, // plantillas WhatsApp + holidaysJson para el módulo de Agenda
  })
}
