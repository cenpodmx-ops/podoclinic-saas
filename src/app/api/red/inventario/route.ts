import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'

/**
 * GET /api/red/inventario?clinicId=<X>&q=<texto>
 * Lista productos activos de una clínica específica (típicamente la distribuidora)
 * para armar pedidos desde otra clínica.
 *
 * Reglas:
 *  - PODOLOGIST = 403.
 *  - Solo se permite consultar inventario de la propia clínica o de clínicas
 *    marcadas como isDistributor=true.
 *  - SUPER puede consultar cualquier clínica.
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const sp = req.nextUrl.searchParams
  const clinicId = sp.get('clinicId')
  const q = (sp.get('q') || '').trim()

  if (!clinicId) return bad('clinicId requerido', 400)

  // Validar acceso a esa clínica
  const target = await db.clinic.findUnique({
    where: { id: clinicId },
    select: { id: true, isDistributor: true, isMatrix: true },
  })
  if (!target) return bad('Clínica no encontrada', 404)

  const isOwn = clinicId === user!.clinicId
  const isSuper = user!.role === 'SUPER'
  if (!isOwn && !isSuper && !target.isDistributor) {
    return bad('Solo puedes consultar inventario de tu clínica o de la distribuidora', 403)
  }

  const where: any = { active: true, clinicId }
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { code: { contains: q } },
      { description: { contains: q } },
    ]
  }

  const products = await db.product.findMany({
    where,
    orderBy: { name: 'asc' },
    take: 100,
    select: {
      id: true,
      name: true,
      code: true,
      stock: true,
      category: true,
      salePrice: true,
    },
  })

  return ok({ data: products })
}
