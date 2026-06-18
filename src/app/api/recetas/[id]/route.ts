import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'

// ============================================================
// MÓDULO 05 — RECETAS / [id]
// GET    → receta completa con paciente, podólogo, medicamentos parseados
// DELETE → 403 si PODOLOGIST. Solo OWNER/SUPER.
// ============================================================

type Medication = {
  name: string
  dose?: string
  via?: string
  duration?: string
  productId?: string
}

function safeParseMeds(s: string | null | undefined): Medication[] {
  if (!s) return []
  try {
    return JSON.parse(s) as Medication[]
  } catch {
    return []
  }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const { id } = await ctx.params
  const rx = await db.prescription.findUnique({
    where: { id },
    include: {
      patient: {
        select: {
          id: true, firstName: true, lastName: true, expNumber: true,
          birthDate: true, sex: true, phone: true, address: true,
        },
      },
      podologist: {
        select: { id: true, name: true, specialty: true, cedula: true, certNumber: true },
      },
    },
  })
  if (!rx) return bad('Receta no encontrada', 404)

  // Cross-clinic guard
  if (user!.role !== 'SUPER' && rx.clinicId !== user!.clinicId) {
    return bad('No tienes acceso a esta receta', 403)
  }

  // Prescription has clinicId but no `clinic` relation in schema — fetch separately.
  const clinic = await db.clinic.findUnique({
    where: { id: rx.clinicId },
    select: {
      id: true, name: true, address: true, phone: true, email: true,
      logoUrl: true, rfc: true, razonSocial: true, slug: true,
    },
  })

  return ok({
    id: rx.id,
    date: rx.date,
    diagnosis: rx.diagnosis,
    medications: safeParseMeds(rx.medicationsJson),
    indications: rx.indications,
    patient: rx.patient
      ? {
          id: rx.patient.id,
          firstName: rx.patient.firstName,
          lastName: rx.patient.lastName,
          name: `${rx.patient.firstName} ${rx.patient.lastName}`,
          expNumber: rx.patient.expNumber,
          birthDate: rx.patient.birthDate,
          sex: rx.patient.sex,
          phone: rx.patient.phone,
          address: rx.patient.address,
        }
      : null,
    podologist: rx.podologist
      ? {
          id: rx.podologist.id,
          name: rx.podologist.name,
          specialty: rx.podologist.specialty,
          cedula: rx.podologist.cedula,
          certNumber: rx.podologist.certNumber,
        }
      : null,
    clinic: clinic,
    createdAt: rx.createdAt,
  })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  // Only OWNER/SUPER can delete
  if (user!.role !== 'SUPER' && user!.role !== 'OWNER') {
    return bad('Solo el dueño puede eliminar recetas', 403)
  }

  const { id } = await ctx.params
  const rx = await db.prescription.findUnique({
    where: { id },
    select: { id: true, clinicId: true },
  })
  if (!rx) return bad('Receta no encontrada', 404)

  if (user!.role !== 'SUPER' && rx.clinicId !== user!.clinicId) {
    return bad('No tienes acceso a esta receta', 403)
  }

  await db.prescription.delete({ where: { id } })
  return ok({ id })
}
