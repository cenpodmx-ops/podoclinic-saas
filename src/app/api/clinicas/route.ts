import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'

/**
 * GET /api/clinicas
 * Lista las clínicas del SUPER (solo las que posee, no todas las del sistema).
 * No-clínicas (distribuidora) se excluyen del listado operativo.
 */
export async function GET(_req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response

  // SUPER ve solo SUS clínicas (ownerId = su id) + su clínica inicial
  if (user!.role === 'SUPER') {
    const clinics = await db.clinic.findMany({
      where: {
        isDistributor: false,
        OR: [
          { ownerId: user!.id },
          { id: user!.clinicId },
        ],
      },
      select: { id: true, name: true, slug: true, timezone: true, primaryColor: true },
      orderBy: { name: 'asc' },
    })
    return ok({ data: clinics })
  }

  // Resto: solo su propia clínica
  if (!user!.clinicId) return bad('Sin clínica asignada', 403)
  const c = await db.clinic.findUnique({
    where: { id: user!.clinicId },
    select: { id: true, name: true, slug: true },
  })
  return ok({ data: c ? [c] : [] })
}

/**
 * POST /api/clinicas
 * Crea una nueva clínica/sucursal (solo SUPER).
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role !== 'SUPER') return bad('No autorizado', 403)

  const body = await req.json().catch(() => ({}))
  const { name, slug, timezone, address, phone, email, openingTime, closingTime, primaryColor, secondaryColor } = body

  if (!name || !slug) return bad('Nombre y slug son requeridos', 400)

  // Verificar que el slug no exista
  const existing = await db.clinic.findUnique({ where: { slug } })
  if (existing) return bad('El slug ya existe', 400)

  const clinic = await db.clinic.create({
    data: {
      name: String(name).trim(),
      slug: String(slug).trim(),
      timezone: timezone || 'America/Mexico_City',
      address: address || null,
      phone: phone || null,
      email: email || null,
      openingTime: openingTime || '09:00',
      closingTime: closingTime || '18:00',
      primaryColor: primaryColor || '#0d9488',
      secondaryColor: secondaryColor || '#0f766e',
      ownerId: user!.id,
      onboardingComplete: true, // nueva sucursal del SUPER ya tiene configuración básica
    },
    select: { id: true, name: true, slug: true },
  })

  return ok({ data: clinic }, 201)
}
