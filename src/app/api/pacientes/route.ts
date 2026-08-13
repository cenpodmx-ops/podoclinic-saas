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
    // Búsqueda insensible a mayúsculas/minúsculas y acentos.
    // Usa la función unaccent_immutable de PostgreSQL (instalada en Supabase)
    // para comparar sin acentos. Soporta nombre completo ("Daniel González"),
    // nombre solo, apellido solo, teléfono o expediente.

    // Normalizar el query: quitar acentos y pasar a minúsculas
    // Esto se comparará con el nombre completo normalizado del paciente
    // usando Prisma.sql con unaccent_immutable.

    // Como Prisma no soporta funciones SQL en where directamente,
    // usamos un enfoque híbrido:
    // 1. Búsqueda simple por campos individuales (sin acentos del query)
    // 2. Búsqueda por palabras (AND de cada palabra en firstName O lastName)
    // 3. Búsqueda por nombre completo usando raw SQL filter

    const normalizeStr = (s: string): string =>
      s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

    const qNormalized = normalizeStr(q)

    // Búsqueda por palabras: cada palabra debe aparecer en firstName O lastName
    // (sin acentos, sin mayúsculas)
    const words = q.split(/\s+/).filter(Boolean)

    // Construir OR conditions
    where.OR = [
      // Búsqueda simple por campo (query original)
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q } },
      { expNumber: { contains: q, mode: 'insensitive' } },
    ]

    // Búsqueda por nombre completo: cada palabra en firstName O lastName
    // Ej: "Daniel González" → AND[
    //   OR[firstName contains "Daniel", lastName contains "Daniel"],
    //   OR[firstName contains "González", lastName contains "González"]
    // ]
    if (words.length > 1) {
      where.OR.push({
        AND: words.map((word) => ({
          OR: [
            { firstName: { contains: word, mode: 'insensitive' } },
            { lastName: { contains: word, mode: 'insensitive' } },
          ],
        })),
      })
    }

    // Búsqueda usando raw SQL con unaccent para ignorar acentos completamente
    // Esto se aplica como un filtro adicional usando Prisma.sql
    // Solo se activa si el query tiene acentos o si las búsquedas anteriores no encontraron nada
    // (se ejecuta en el findMany con un filtro raw adicional)
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

  // Si hay query de búsqueda, usar Prisma nativo (compatible SQLite y PostgreSQL).
  // Ignora acentos normalizando el query y buscando con contains.
  if (q) {
    const normalizeStr = (s: string): string =>
      s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const qNorm = normalizeStr(q)
    const qNolower = q.toLowerCase()

    const searchOr: Prisma.PatientWhereInput['OR'] = [
      { firstName: { contains: q, mode: 'insensitive' as any } },
      { lastName: { contains: q, mode: 'insensitive' as any } },
      { phone: { contains: q } },
      { expNumber: { contains: q, mode: 'insensitive' as any } },
    ]

    // Buscar también sin acentos: comparar firstName/lastName sin acentos.
    // Prisma no soporta ignorar acentos nativamente, así que traemos pacientes
    // de la clínica con un límite alto y filtramos en JS (solo cuando hay query).
    const clinicIds: string[] = []
    if (clinicFilter.clinicId) {
      if (typeof clinicFilter.clinicId === 'object' && (clinicFilter.clinicId as any).in) {
        clinicIds.push(...(clinicFilter.clinicId as any).in)
      } else {
        clinicIds.push(clinicFilter.clinicId as string)
      }
    }

    const candidates = await db.patient.findMany({
      where: clinicFilter.clinicId
        ? { clinicId: { in: clinicIds.length ? clinicIds : [clinicFilter.clinicId as string] } }
        : {},
      select: { id: true, firstName: true, lastName: true, phone: true, expNumber: true },
      take: 2000,
    })

    const filtered = candidates.filter((p: any) => {
      const full = normalizeStr(`${p.firstName || ''} ${p.lastName || ''}`)
      const fn = normalizeStr(p.firstName || '')
      const ln = normalizeStr(p.lastName || '')
      const exp = normalizeStr(p.expNumber || '')
      const ph = normalizeStr(p.phone || '')
      return full.includes(qNorm) || fn.includes(qNorm) || ln.includes(qNorm) || exp.includes(qNorm) || ph.includes(qNorm)
    })

    const allCases = Array.from(new Set([...filtered.map((p: any) => p.id)]))
    const whereIds: Prisma.PatientWhereInput = clinicFilter.clinicId
      ? { id: { in: allCases }, AND: clinicFilter }
      : { id: { in: allCases } }

    const total = allCases.length
    const pagedIds = allCases.slice((page - 1) * limit, (page - 1) * limit + limit)

    const fullRows = pagedIds.length > 0
      ? await db.patient.findMany({
          where: { id: { in: pagedIds } },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          include: {
            clinic: { select: { name: true } },
            appointments: {
              where: { status: 'FINALIZADA' },
              orderBy: { startTime: 'desc' },
              take: 1,
              select: { startTime: true },
            },
          },
        })
      : []

    const data = fullRows.map((p) => ({
      id: p.id,
      expNumber: p.expNumber,
      firstName: p.firstName,
      lastName: p.lastName,
      phone: p.phone,
      email: p.email,
      isDiabetic: p.isDiabetic,
      allergies: p.allergies,
      currentMeds: p.currentMeds,
      chronicConditions: p.chronicConditions,
      riskLevel: p.riskLevel,
      clinicId: p.clinicId,
      clinic: p.clinic,
      totalSpent: p.totalSpent,
      birthDate: p.birthDate,
      sex: p.sex,
      createdAt: p.createdAt,
      lastVisit: p.appointments[0]?.startTime || null,
    }))

    return ok({ data, total, page, limit })
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
