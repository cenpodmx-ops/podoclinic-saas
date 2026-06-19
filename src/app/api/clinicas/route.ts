import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'

/**
 * GET /api/clinicas
 * Lista las clínicas activas para SUPER (cambio de sucursal en filtros).
 * No-clínicas (distribuidora) se excluyen del listado operativo.
 */
export async function GET(_req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response

  // SUPER ve todas las clínicas operativas
  if (user!.role === 'SUPER') {
    const clinics = await db.clinic.findMany({
      where: { isDistributor: false },
      select: { id: true, name: true, slug: true },
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
