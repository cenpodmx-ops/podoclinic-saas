// MÓDULO SERVER-ONLY — importa next/headers y db.
// Los componentes cliente deben importar de @/lib/roles en su lugar.

import 'server-only'
import { getServerSession } from 'next-auth'
import { cookies } from 'next/headers'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { ACTIVE_CLINIC_COOKIE, type SessionUser } from '@/lib/roles'

// Reexportar para compatibilidad con imports existentes
export { ACTIVE_CLINIC_COOKIE, ROLES, canAccessFinance, canManageAgenda, canSeeAllClinics, isPodologist } from '@/lib/roles'
export type { SessionUser, Role } from '@/lib/roles'

export async function getSession(): Promise<SessionUser | null> {
  const s = await getServerSession(authOptions)
  if (!s?.user) return null
  const user = s.user as unknown as SessionUser

  // SUPER: override clinicId con la sucursal activa (cookie).
  // Esto permite que el Súper Dueño "entre" a cada clínica y vea
  // su dashboard, agenda, pacientes, etc. como si operara esa sucursal.
  if (user.role === 'SUPER') {
    try {
      const cookieStore = await cookies()
      const activeClinicId = cookieStore.get(ACTIVE_CLINIC_COOKIE)?.value
      if (activeClinicId) {
        const clinic = await db.clinic.findUnique({
          where: { id: activeClinicId },
          select: { id: true, name: true, slug: true },
        })
        if (clinic) {
          user.clinicId = clinic.id
          user.clinicName = clinic.name
          user.clinicSlug = clinic.slug
        }
      }
    } catch {
      // cookies() puede fallar en algunos contextos — ignorar
    }
  }

  return user
}

/** Devuelve el clinicId efectivo: el del usuario o, si es SUPER y pide todas, undefined. */
export async function getEffectiveClinicId(viewAll = false): Promise<string | undefined> {
  const u = await getSession()
  if (!u) return undefined
  if (u.role === 'SUPER' && viewAll) return undefined
  return u.clinicId
}

/** Filtra por sucursal: SUPER puede ver todo, los demás solo su clínica. */
export function clinicFilter(user: SessionUser, allowSuper = true) {
  if (allowSuper && user.role === 'SUPER') return {} as Record<string, string>
  return { clinicId: user.clinicId }
}
