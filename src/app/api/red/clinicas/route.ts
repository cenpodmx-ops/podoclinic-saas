import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'

/**
 * GET /api/red/clinicas
 * Lista de clínicas activas para el módulo Red PodoClinic (mensajes, avisos, pedidos).
 * Incluye distribuidora y matriz.
 *
 * - SUPER ve todas las clínicas (incluida distribuidora).
 * - Resto: su propia clínica + distribuidora + matriz (para poder enviar y pedir).
 *
 * PODOLOGIST = 403.
 */
export async function GET(_req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  if (user!.role === 'SUPER') {
    const clinics = await db.clinic.findMany({
      where: { isMatrix: false }, // excluye la matriz misma como destino
      select: { id: true, name: true, slug: true, isDistributor: true, isMatrix: true },
      orderBy: [{ isDistributor: 'desc' }, { name: 'asc' }],
    })
    return ok({ data: clinics })
  }

  // Resto: todas las clínicas operativas + distribuidora (excluye matriz y la propia)
  const clinics = await db.clinic.findMany({
    where: {
      isMatrix: false,
      NOT: { id: user!.clinicId! },
    },
    select: { id: true, name: true, slug: true, isDistributor: true, isMatrix: true },
    orderBy: [{ isDistributor: 'desc' }, { name: 'asc' }],
  })
  return ok({ data: clinics })
}
