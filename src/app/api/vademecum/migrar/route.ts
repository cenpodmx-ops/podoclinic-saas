import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'

/**
 * POST /api/vademecum/migrar
 * Body: { fromClinicId, toClinicId }
 *
 * Migra todos los medicamentos del vademécum de una clínica a otra.
 * Útil cuando se quiere replicar el vademécum (ej: de Quiroga a Portillo)
 * sin tener que subir el Excel manualmente.
 *
 * - Solo SUPER puede ejecutarlo
 * - Si el medicamento ya existe en la clínica destino (mismo nombre), se omite
 *   (no se duplica)
 * - Devuelve { migrated, skipped, errors }
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role !== 'SUPER') return bad('Solo el Súper Dueño puede migrar vademécum', 403)

  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')

  const { fromClinicId, toClinicId } = body as { fromClinicId?: string; toClinicId?: string }
  if (!fromClinicId || !toClinicId) return bad('Se requiere fromClinicId y toClinicId')
  if (fromClinicId === toClinicId) return bad('fromClinicId y toClinicId no pueden ser iguales')

  // Verificar que ambas clínicas existan
  const [fromClinic, toClinic] = await Promise.all([
    db.clinic.findUnique({ where: { id: fromClinicId }, select: { id: true, name: true } }),
    db.clinic.findUnique({ where: { id: toClinicId }, select: { id: true, name: true } }),
  ])
  if (!fromClinic) return bad(`Clínica origen no encontrada: ${fromClinicId}`, 404)
  if (!toClinic) return bad(`Clínica destino no encontrada: ${toClinicId}`, 404)

  // Cargar todos los medicamentos de la clínica origen
  const sourceItems = await db.vademecum.findMany({
    where: { clinicId: fromClinicId },
  })

  if (sourceItems.length === 0) {
    return ok({
      migrated: 0,
      skipped: 0,
      errors: [],
      message: `La clínica origen (${fromClinic.name}) no tiene medicamentos en el vademécum`,
    })
  }

  // Cargar nombres existentes en la clínica destino (case-insensitive) para omitir duplicados
  const existingDest = await db.vademecum.findMany({
    where: { clinicId: toClinicId },
    select: { name: true },
  })
  const existingNames = new Set(existingDest.map((d) => d.name.toLowerCase().trim()))

  let migrated = 0
  let skipped = 0
  const errors: Array<{ name: string; error: string }> = []

  for (const item of sourceItems) {
    const nameNorm = item.name.toLowerCase().trim()
    if (existingNames.has(nameNorm)) {
      skipped++
      continue
    }
    try {
      await db.vademecum.create({
        data: {
          clinicId: toClinicId,
          name: item.name,
          genericName: item.genericName,
          category: item.category,
          dose: item.dose,
          via: item.via,
          defaultDuration: item.defaultDuration,
          indication: item.indication,
          notes: item.notes,
          active: item.active,
        },
      })
      migrated++
      existingNames.add(nameNorm)
    } catch (e: any) {
      errors.push({ name: item.name, error: e.message || 'Error desconocido' })
    }
  }

  return ok({
    migrated,
    skipped,
    errors,
    fromClinic: fromClinic.name,
    toClinic: toClinic.name,
  })
}
