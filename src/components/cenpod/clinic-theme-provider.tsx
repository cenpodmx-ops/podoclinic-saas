'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { applyClinicTheme, resetToPodoclinicDefault, PODOCLINIC_DEFAULTS } from '@/lib/clinic-theme'

/**
 * ClinicThemeProvider
 * 
 * Aplica dinámicamente los colores de la clínica activa como variables CSS.
 * Si no hay sesión o la clínica no tiene colores configurados, usa los defaults de PodoClinic.
 * 
 * Debe envolver el contenido de la aplicación (dentro de <Providers>).
 */
export function ClinicThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const user = session?.user as any

  useEffect(() => {
    if (user?.clinicPrimaryColor || user?.clinicSecondaryColor) {
      applyClinicTheme({
        primaryColor: user.clinicPrimaryColor,
        secondaryColor: user.clinicSecondaryColor,
      })
    } else {
      resetToPodoclinicDefault()
    }
  }, [user?.clinicPrimaryColor, user?.clinicSecondaryColor])

  return <>{children}</>
}

/**
 * Devuelve el nombre a mostrar para la clínica actual.
 * Usa el nombre de la clínica de la sesión, o 'PodoClinic' como default.
 */
export function useClinicName(): string {
  const { data: session } = useSession()
  const user = session?.user as any
  return user?.clinicName || PODOCLINIC_DEFAULTS.name
}

/**
 * Devuelve la URL del logo de la clínica actual, o null si no hay.
 */
export function useClinicLogo(): string | null {
  // El logo no viene en la sesión JWT — se obtiene de /api/config
  // Por ahora devolvemos null; el AppShell puede hacer fetch si necesita
  return null
}
