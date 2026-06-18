import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'

// PATCH plantillas WhatsApp + diagnosesList + holidays + diseño receta + sharedDbCode
export async function PATCH(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role !== 'SUPER' && user!.role !== 'OWNER') return bad('Sin permisos', 403)

  const body = await req.json()
  const clinicId = user!.role === 'SUPER' && body.clinicId ? body.clinicId : user!.clinicId
  if (!clinicId) return bad('Sin clínica', 400)

  const allowed = [
    'tplConfirm', 'tplReminder', 'tplGoogleReview', 'tplBirthday',
    'tplInactive', 'tplFollowUp',
    'diagnosesList', 'holidaysJson', 'prescriptionDesign', 'sharedDbCode',
  ]
  const data: any = {}
  for (const k of allowed) {
    if (body[k] !== undefined) {
      // diagnosesList y holidaysJson se reciben como arrays → stringificar
      if (k === 'diagnosesList' && Array.isArray(body[k])) {
        data[k] = JSON.stringify(body[k])
      } else if (k === 'holidaysJson' && Array.isArray(body[k])) {
        data[k] = JSON.stringify(body[k])
      } else {
        data[k] = body[k]
      }
    }
  }

  // upsert porque ClinicConfig es 1:1
  const updated = await db.clinicConfig.upsert({
    where: { clinicId },
    update: data,
    create: { clinicId, ...data },
  })
  return ok(updated)
}
