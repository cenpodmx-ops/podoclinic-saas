import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { Prisma } from '@prisma/client'

/** Carga el paciente verificando acceso cross-clinic. */
async function loadPatientForUser(id: string, user: { role: string; clinicId: string }) {
  const p = await db.patient.findUnique({
    where: { id },
    select: { id: true, clinicId: true },
  })
  if (!p) return null
  if (user.role !== 'SUPER' && p.clinicId !== user.clinicId) return 'forbidden' as const
  return p
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  const { id } = await ctx.params

  const access = await loadPatientForUser(id, user!)
  if (access === null) return bad('Paciente no encontrado', 404)
  if (access === 'forbidden') return bad('Sin acceso a este paciente', 403)

  const patient = await db.patient.findUnique({
    where: { id },
    include: {
      clinic: { select: { id: true, name: true, slug: true } },
      appointments: {
        orderBy: { startTime: 'desc' },
        include: { podologist: { select: { id: true, name: true } } },
      },
      consultations: {
        orderBy: { date: 'desc' },
        include: { podologist: { select: { id: true, name: true } } },
      },
      prescriptions: {
        orderBy: { date: 'desc' },
        include: { podologist: { select: { id: true, name: true } } },
      },
      files: { orderBy: { createdAt: 'desc' } },
      followUps: { orderBy: { dueDate: 'asc' } },
    },
  })

  return ok(patient)
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('No tienes permiso para editar pacientes', 403)
  const { id } = await ctx.params

  const access = await loadPatientForUser(id, user!)
  if (access === null) return bad('Paciente no encontrado', 404)
  if (access === 'forbidden') return bad('Sin acceso a este paciente', 403)

  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')

  const data: Prisma.PatientUpdateInput = {}
  if (body.firstName !== undefined) data.firstName = String(body.firstName).trim()
  if (body.lastName !== undefined) data.lastName = String(body.lastName).trim()
  if (body.phone !== undefined) data.phone = String(body.phone).trim()
  if (body.email !== undefined) data.email = body.email ? String(body.email) : null
  if (body.birthDate !== undefined) data.birthDate = body.birthDate ? new Date(body.birthDate) : null
  if (body.sex !== undefined) data.sex = body.sex || null
  if (body.curp !== undefined) data.curp = body.curp ? String(body.curp).toUpperCase() : null
  if (body.rfc !== undefined) data.rfc = body.rfc ? String(body.rfc).toUpperCase() : null
  if (body.address !== undefined) data.address = body.address || null
  if (body.razonSocial !== undefined) data.razonSocial = body.razonSocial || null
  if (body.regimenFiscal !== undefined) data.regimenFiscal = body.regimenFiscal || null
  if (body.cfdiUso !== undefined) data.cfdiUso = body.cfdiUso || null
  if (body.emailFactura !== undefined) data.emailFactura = body.emailFactura || null
  if (body.isDiabetic !== undefined) data.isDiabetic = !!body.isDiabetic
  if (body.allergies !== undefined) data.allergies = body.allergies || null
  if (body.currentMeds !== undefined) data.currentMeds = body.currentMeds || null
  if (body.chronicConditions !== undefined) data.chronicConditions = body.chronicConditions || null
  if (body.riskLevel !== undefined) data.riskLevel = body.riskLevel || null
  if (body.antecedentsHereditary !== undefined) data.antecedentsHereditary = body.antecedentsHereditary || null
  if (body.antecedentsPathologic !== undefined) data.antecedentsPathologic = body.antecedentsPathologic || null
  if (body.antecedentsNonPathologic !== undefined) data.antecedentsNonPathologic = body.antecedentsNonPathologic || null
  if (body.physicalExploration !== undefined) data.physicalExploration = body.physicalExploration || null
  if (body.clinicalSummary !== undefined) data.clinicalSummary = body.clinicalSummary || null
  if (body.generalNotes !== undefined) data.generalNotes = body.generalNotes || null

  const updated = await db.patient.update({ where: { id }, data })
  return ok(updated)
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('No tienes permiso para eliminar pacientes', 403)
  const { id } = await ctx.params

  const access = await loadPatientForUser(id, user!)
  if (access === null) return bad('Paciente no encontrado', 404)
  if (access === 'forbidden') return bad('Sin acceso a este paciente', 403)

  // No se puede borrar si tiene consultas o recetas
  const [consCount, rxCount] = await Promise.all([
    db.consultation.count({ where: { patientId: id } }),
    db.prescription.count({ where: { patientId: id } }),
  ])
  if (consCount > 0 || rxCount > 0) {
    return bad(
      `No se puede eliminar: el paciente tiene ${consCount} consulta(s) y ${rxCount} receta(s). Elimina primero esos registros.`,
      409,
    )
  }

  // Borrar archivos físicos asociados
  const files = await db.patientFile.findMany({ where: { patientId: id }, select: { fileUrl: true } })
  const { rm } = await import('fs/promises')
  const path = await import('path')
  for (const f of files) {
    try {
      const abs = path.join(process.cwd(), 'public', f.fileUrl)
      await rm(abs, { force: true })
    } catch {}
  }

  await db.patient.delete({ where: { id } })
  return ok({ ok: true })
}
