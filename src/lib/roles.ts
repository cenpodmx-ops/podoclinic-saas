// Constantes compartidas cliente/servidor
export const ACTIVE_CLINIC_COOKIE = 'cenpod_active_clinic'

export const ROLES = {
  SUPER: 'Súper Dueño',
  OWNER: 'Dueño de Clínica',
  RECEPTION: 'Recepción',
  PODOLOGIST: 'Podólogo',
} as const

export type Role = keyof typeof ROLES

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

// Helpers de permisos puros (sin dependencias server)
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
