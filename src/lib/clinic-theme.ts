// ============================================================
// PodoClinic SaaS — Theme helper
// Convierte colores hex de la clínica a variables CSS OKLCH
// y proporciona defaults de la marca PodoClinic.
// ============================================================

/** Colores de marca por defecto de PodoClinic (SaaS platform). */
export const PODOCLINIC_DEFAULTS = {
  name: 'PodoClinic',
  primaryColor: '#0d9488', // teal-600 — color de marca PodoClinic
  secondaryColor: '#0f766e', // teal-700
  logoUrl: '/podoclinic-logo.png' as string | null,
  timezone: 'America/Hermosillo',
}

/** Convierte un color hex (#RRGGBB) a OKLCH para usar en CSS variables. */
export function hexToOklch(hex: string): string {
  // Usamos el color tal cual en hex si el navegador soporta color() 
  // o lo convertimos a oklch. Para máxima compatibilidad, usamos hex directamente
  // envuelto en oklch() solo si es necesario. Por simplicidad, devolvemos el hex.
  return hex
}

/**
 * Establece las variables CSS de tema de la clínica en el document root.
 * Llamar desde el cliente cuando se carga la sesión.
 */
export function applyClinicTheme(opts: {
  primaryColor?: string | null
  secondaryColor?: string | null
}) {
  if (typeof document === 'undefined') return

  const primary = opts.primaryColor || PODOCLINIC_DEFAULTS.primaryColor
  const secondary = opts.secondaryColor || PODOCLINIC_DEFAULTS.secondaryColor

  const root = document.documentElement
  // Variables CSS personalizadas de clínica
  root.style.setProperty('--clinic-primary', primary)
  root.style.setProperty('--clinic-secondary', secondary)
  
  // Mapear a TODAS las variables de shadcn/ui para que la UI complete cambie
  root.style.setProperty('--primary', primary)
  root.style.setProperty('--primary-foreground', '#ffffff')
  root.style.setProperty('--ring', primary)
  root.style.setProperty('--sidebar', primary)
  root.style.setProperty('--sidebar-primary', '#ffffff')
  root.style.setProperty('--sidebar-primary-foreground', primary)
  root.style.setProperty('--sidebar-accent', primary)
  root.style.setProperty('--sidebar-accent-foreground', '#ffffff')
  root.style.setProperty('--sidebar-ring', secondary)
  root.style.setProperty('--chart-1', primary)
  root.style.setProperty('--accent-foreground', primary)
  root.style.setProperty('--secondary-foreground', primary)
  root.style.setProperty('--secondary', secondary + '15') // secondary con baja opacidad
}

/** Resetea el tema a los defaults de PodoClinic. */
export function resetToPodoclinicDefault() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.removeProperty('--clinic-primary')
  root.style.removeProperty('--clinic-secondary')
  // Resetear TODAS las variables para que vuelvan a defaults de globals.css
  root.style.removeProperty('--primary')
  root.style.removeProperty('--primary-foreground')
  root.style.removeProperty('--ring')
  root.style.removeProperty('--sidebar')
  root.style.removeProperty('--sidebar-primary')
  root.style.removeProperty('--sidebar-primary-foreground')
  root.style.removeProperty('--sidebar-accent')
  root.style.removeProperty('--sidebar-accent-foreground')
  root.style.removeProperty('--sidebar-ring')
  root.style.removeProperty('--chart-1')
  root.style.removeProperty('--accent-foreground')
  root.style.removeProperty('--secondary-foreground')
  root.style.removeProperty('--secondary')
}
