import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad, effectiveClinic } from '@/lib/api'

/**
 * GET /api/vademecum
 * Lista los medicamentos del vademécum de la clínica del usuario.
 * Query params:
 *   - q: búsqueda por nombre o nombre genérico
 *   - category: filtrar por categoría
 *   - includeInactive=1: incluir medicamentos inactivos
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response

  const sp = req.nextUrl.searchParams
  const q = sp.get('q')?.trim() || ''
  const category = sp.get('category')
  const includeInactive = sp.get('includeInactive') === '1'
  // Permitir a SUPER especificar clinicId por query param (para migración entre clínicas)
  // Si no se especifica, usar la clínica efectiva del usuario
  const clinicParam = sp.get('clinicId')
  const where: any = {
    clinicId: (user!.role === 'SUPER' && clinicParam) ? clinicParam : effectiveClinic(user!),
  }
  if (!includeInactive) where.active = true
  if (category && category !== '__all') where.category = category
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { genericName: { contains: q, mode: 'insensitive' } },
    ]
  }

  const items = await db.vademecum.findMany({
    where,
    orderBy: [{ name: 'asc' }],
    take: 200,
  })

  return ok({ data: items, total: items.length })
}

/**
 * POST /api/vademecum
 * Crea un nuevo medicamento en el vademécum.
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'RECEPTION' || user!.role === 'PODOLOGIST') {
    return bad('Sin permisos', 403)
  }

  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')
  if (!body.name?.trim()) return bad('Nombre es obligatorio')

  const created = await db.vademecum.create({
    data: {
      clinicId: user!.clinicId,
      name: String(body.name).trim(),
      genericName: body.genericName?.trim() || null,
      category: body.category?.trim() || null,
      dose: body.dose?.trim() || null,
      via: body.via?.trim() || null,
      defaultDuration: body.defaultDuration?.trim() || null,
      indication: body.indication?.trim() || null,
      notes: body.notes?.trim() || null,
      active: body.active !== false,
    },
  })

  return ok(created, 201)
}
