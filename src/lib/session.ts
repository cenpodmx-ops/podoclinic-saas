import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export type SessionUser = {
  id: string
  name: string
  email: string
  role: string
  clinicId: string
  clinicName: string
  clinicSlug: string
  podologistId?: string
}

export async function getSession(): Promise<SessionUser | null> {
  const s = await getServerSession(authOptions)
  if (!s?.user) return null
  return s.user as unknown as SessionUser
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

export const ROLES = {
  SUPER: 'Súper Dueño',
  OWNER: 'Dueño de Clínica',
  RECEPTION: 'Recepción',
  PODOLOGIST: 'Podólogo',
} as const

export function canAccessFinance(user: SessionUser | null) {
  return !!user && (user.role === 'SUPER' || user.role === 'OWNER')
}

export function canManageAgenda(user: SessionUser | null) {
  return !!user && (user.role === 'SUPER' || user.role === 'OWNER' || user.role === 'RECEPTION')
}

export function canSeeAllClinics(user: SessionUser | null) {
  return !!user && user.role === 'SUPER'
}

export function isPodologist(user: SessionUser | null) {
  return !!user && user.role === 'PODOLOGIST'
}
