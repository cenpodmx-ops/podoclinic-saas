import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad, effectiveClinic } from '@/lib/api'
import { startOfDay, endOfDay } from 'date-fns'

// ============================================================
// MÓDULO 05 — RECETAS
// GET  ?page=1&limit=20&patientId=&all=1&q=&from=&to=
//      → { data: Prescription[], total }
// POST → crea receta. Body:
//      { patientId, podologistId?, diagnosis?, medications: [{name, dose, via, duration, productId?}], indications? }
//      403 si PODOLOGIST (only OWNER/SUPER/RECEPTION can create)
// ============================================================

export type MedicationInput = {
  name: string
  dose?: string
  via?: string
  duration?: string
  productId?: string
}

function safeParseMeds(s: string | null | undefined): MedicationInput[] {
  if (!s) return []
  try {
    return JSON.parse(s) as MedicationInput[]
  } catch {
    return []
  }
}

export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const sp = req.nextUrl.searchParams
  const all = sp.get('all') || undefined
  const clinicId = effectiveClinic(user!, all || undefined)
  const patientId = sp.get('patientId') || undefined
  const q = sp.get('q')?.trim() || undefined
  const from = sp.get('from') || undefined
  const to = sp.get('to') || undefined
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') || '20', 10)))
  const skip = (page - 1) * limit

  const where: any = {}
  if (clinicId) where.clinicId = clinicId
  if (patientId) where.patientId = patientId

  if (from || to) {
    where.date = {}
    if (from) where.date.gte = startOfDay(new Date(from))
    if (to) where.date.lte = endOfDay(new Date(to))
  }

  if (q) {
    where.OR = [
      { patient: { firstName: { contains: q } } },
      { patient: { lastName: { contains: q } } },
      { patient: { expNumber: { contains: q } } },
      { diagnosis: { contains: q } },
    ]
  }

  const [rows, total] = await Promise.all([
    db.prescription.findMany({
      where,
      orderBy: { date: 'desc' },
      skip,
      take: limit,
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            expNumber: true,
            birthDate: true,
            sex: true,
            phone: true,
          },
        },
        podologist: {
          select: { id: true, name: true, specialty: true, cedula: true },
        },
      },
    }),
    db.prescription.count({ where }),
  ])

  const data = rows.map((r) => ({
    id: r.id,
    date: r.date,
    diagnosis: r.diagnosis,
    medications: safeParseMeds(r.medicationsJson),
    indications: r.indications,
    patient: r.patient
      ? {
          id: r.patient.id,
          name: `${r.patient.firstName} ${r.patient.lastName}`,
          expNumber: r.patient.expNumber,
          birthDate: r.patient.birthDate,
          sex: r.patient.sex,
          phone: r.patient.phone,
        }
      : null,
    podologist: r.podologist
      ? {
          id: r.podologist.id,
          name: r.podologist.name,
          specialty: r.podologist.specialty,
          cedula: r.podologist.cedula,
        }
      : null,
    createdAt: r.createdAt,
  }))

  return ok({ data, total, page, limit })
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  // PODOLOGIST: 403 — only OWNER/SUPER/RECEPTION can create.
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')

  const { patientId, podologistId, diagnosis, medications, indications } = body as {
    patientId?: string
    podologistId?: string
    diagnosis?: string
    medications?: MedicationInput[]
    indications?: string
    clinicId?: string
  }

  if (!patientId) return bad('Falta patientId')

  // Verify patient exists & belongs to user's clinic (SUPER may pass clinicId)
  const patient = await db.patient.findUnique({
    where: { id: patientId },
    select: { id: true, clinicId: true },
  })
  if (!patient) return bad('Paciente no encontrado', 404)

  // Determine clinicId
  let clinicId = patient.clinicId
  if (user!.role === 'SUPER' && body.clinicId) {
    clinicId = body.clinicId
  }
  if (user!.role !== 'SUPER' && patient.clinicId !== user!.clinicId) {
    return bad('No tienes acceso a este paciente', 403)
  }

  // Validate podologist if provided
  if (podologistId) {
    const pod = await db.podologist.findUnique({
      where: { id: podologistId },
      select: { id: true, clinicId: true },
    })
    if (!pod) return bad('Podólogo no encontrado', 404)
    if (pod.clinicId !== clinicId) return bad('El podólogo no pertenece a la clínica', 400)
  }

  // Normalize medications
  const meds: MedicationInput[] = (Array.isArray(medications) ? medications : [])
    .filter((m) => m && (m.name || '').trim())
    .map((m) => ({
      name: String(m.name).trim(),
      dose: m.dose ? String(m.dose).trim() : '',
      via: m.via ? String(m.via).trim() : '',
      duration: m.duration ? String(m.duration).trim() : '',
      ...(m.productId ? { productId: String(m.productId) } : {}),
    }))

  if (meds.length === 0) return bad('Agrega al menos un medicamento', 400)

  // Determine date (server time)
  const created = await db.prescription.create({
    data: {
      clinicId,
      patientId,
      podologistId: podologistId || null,
      diagnosis: diagnosis?.trim() || null,
      medicationsJson: JSON.stringify(meds),
      indications: indications?.trim() || null,
    },
    include: {
      patient: {
        select: {
          id: true, firstName: true, lastName: true, expNumber: true,
          birthDate: true, sex: true, phone: true,
        },
      },
      podologist: {
        select: { id: true, name: true, specialty: true, cedula: true },
      },
    },
  })

  return ok({
    id: created.id,
    date: created.date,
    diagnosis: created.diagnosis,
    medications: safeParseMeds(created.medicationsJson),
    indications: created.indications,
    patient: created.patient
      ? {
          id: created.patient.id,
          name: `${created.patient.firstName} ${created.patient.lastName}`,
          expNumber: created.patient.expNumber,
          birthDate: created.patient.birthDate,
          sex: created.patient.sex,
          phone: created.patient.phone,
        }
      : null,
    podologist: created.podologist
      ? {
          id: created.podologist.id,
          name: created.podologist.name,
          specialty: created.podologist.specialty,
          cedula: created.podologist.cedula,
        }
      : null,
    createdAt: created.createdAt,
  }, 201)
}
