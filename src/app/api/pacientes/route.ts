import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad, effectiveClinic } from '@/lib/api'
import { Prisma } from '@prisma/client'

/** Genera el siguiente número de expediente: C{clinicNumber}-{sequential 5 dígitos}. */
async function generateExpNumber(clinicId: string, slug: string): Promise<string> {
  const m = slug.match(/\d+/)
  const clinicNum = m ? m[0] : '0'
  const prefix = `C${clinicNum}`

  const existing = await db.patient.findMany({
    where: { clinicId, expNumber: { startsWith: `${prefix}-` } },
    select: { expNumber: true },
  })

  let maxNum = 0
  for (const p of existing) {
    const parts = p.expNumber.split('-')
    if (parts.length === 2) {
      const n = parseInt(parts[1], 10)
      if (!isNaN(n) && n > maxNum) maxNum = n
    }
  }

  return `${prefix}-${String(maxNum + 1).padStart(5, '0')}`
}

export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('No tienes acceso a este módulo', 403)

  const sp = req.nextUrl.searchParams
  const q = sp.get('q')?.trim() || undefined
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') || '20', 10)))
  const diabetic = sp.get('diabetic') // 'true' | 'false' | null
  const riskLevel = sp.get('riskLevel') || undefined // BAJO | MEDIO | ALTO
  const noRecent = sp.get('sinCitaReciente') === '1'
  const allParam = sp.get('all') || undefined
  const overrideClinicId = sp.get('clinicId') || undefined
  const global = sp.get('global') === '1'

  // SUPER puede ver todas las clínicas con ?all=1, o pisar clinicId
  // OWNER/RECEPTION con ?global=1 puede ver pacientes de todas las clínicas del grupo
  let clinicId: string | undefined
  let clinicFilter: Prisma.PatientWhereInput = {}

  if (user!.role === 'SUPER') {
    if (overrideClinicId) clinicId = overrideClinicId
    else clinicId = effectiveClinic(user!, allParam)
    if (clinicId) clinicFilter = { clinicId }
  } else if (global) {
    // Modo global: ver pacientes de todas las clínicas operativas (no distribuidora ni matriz)
    const allClinics = await db.clinic.findMany({
      where: { isDistributor: false, isMatrix: false },
      select: { id: true },
    })
    clinicFilter = { clinicId: { in: allClinics.map(c => c.id) } }
  } else {
    clinicId = user!.clinicId
    clinicFilter = { clinicId }
  }

  const where: Prisma.PatientWhereInput = clinicFilter

  if (q) {
    // NOTE: SQLite no soporta `mode: 'insensitive'` pero ya es case-insensitive por defecto.
    // En PostgreSQL (prod) sí se requiere para búsquedas acento-insensibles.
    // Para compatibilidad cross-DB omitimos `mode` (SQLite lo ignora y PostgreSQL hace búsqueda case-sensitive — aceptable para MVP).
    where.OR = [
      { firstName: { contains: q } },
      { lastName: { contains: q } },
      { phone: { contains: q } },
      { expNumber: { contains: q } },
    ]
  }
  if (diabetic === 'true') where.isDiabetic = true
  if (diabetic === 'false') where.isDiabetic = false
  if (riskLevel) where.riskLevel = riskLevel

  if (noRecent) {
    // Sin cita FINALIZADA en los últimos 90 días
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 90)
    where.NOT = {
      appointments: {
        some: { status: 'FINALIZADA', startTime: { gte: cutoff } },
      },
    }
  }

  const [total, rows] = await Promise.all([
    db.patient.count({ where }),
    db.patient.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        clinic: { select: { name: true } },
        appointments: {
          where: { status: 'FINALIZADA' },
          orderBy: { startTime: 'desc' },
          take: 1,
          select: { startTime: true },
        },
      },
    }),
  ])

  const data = rows.map((p) => ({
    id: p.id,
    expNumber: p.expNumber,
    firstName: p.firstName,
    lastName: p.lastName,
    phone: p.phone,
    email: p.email,
    isDiabetic: p.isDiabetic,
    allergies: p.allergies,
    riskLevel: p.riskLevel,
    totalSpent: p.totalSpent,
    lastVisit: p.appointments[0]?.startTime || null,
    createdAt: p.createdAt,
    clinic: { name: p.clinic.name },
  }))

  return ok({ data, total, page, limit })
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('No tienes permiso para crear pacientes', 403)

  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')

  const firstName = String(body.firstName || '').trim()
  const lastName = String(body.lastName || '').trim()
  const phone = String(body.phone || '').trim()
  if (!firstName) return bad('Nombre es obligatorio')
  if (!lastName) return bad('Apellido es obligatorio')
  if (!phone) return bad('Teléfono es obligatorio')

  // Clinic: SUPER puede especificar clinicId; el resto usa el suyo.
  let clinicId = user!.clinicId
  let clinicSlug = user!.clinicSlug
  if (user!.role === 'SUPER' && body.clinicId) {
    const c = await db.clinic.findUnique({ where: { id: String(body.clinicId) }, select: { id: true, slug: true } })
    if (!c) return bad('Clínica no encontrada', 404)
    clinicId = c.id
    clinicSlug = c.slug
  }
  if (!clinicId) return bad('Sin clínica asignada', 400)

  const expNumber = await generateExpNumber(clinicId, clinicSlug)

  const data: Prisma.PatientCreateInput = {
    clinic: { connect: { id: clinicId } },
    expNumber,
    firstName,
    lastName,
    phone,
    email: body.email ? String(body.email) : null,
    birthDate: body.birthDate ? new Date(body.birthDate) : null,
    sex: body.sex || null,
    curp: body.curp ? String(body.curp).toUpperCase() : null,
    rfc: body.rfc ? String(body.rfc).toUpperCase() : null,
    address: body.address || null,
    razonSocial: body.razonSocial || null,
    regimenFiscal: body.regimenFiscal || null,
    cfdiUso: body.cfdiUso || null,
    emailFactura: body.emailFactura || null,
    isDiabetic: !!body.isDiabetic,
    allergies: body.allergies || null,
    currentMeds: body.currentMeds || null,
    chronicConditions: body.chronicConditions || null,
    riskLevel: body.riskLevel || null,
    antecedentsHereditary: body.antecedentsHereditary || null,
    antecedentsPathologic: body.antecedentsPathologic || null,
    antecedentsNonPathologic: body.antecedentsNonPathologic || null,
    physicalExploration: body.physicalExploration || null,
    clinicalSummary: body.clinicalSummary || null,
    generalNotes: body.generalNotes || null,
  }

  const created = await db.patient.create({ data, include: { clinic: { select: { name: true } } } })
  return ok(created, 201)
}
