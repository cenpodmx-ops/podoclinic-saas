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
  // Establecer variables CSS personalizadas de clínica
  root.style.setProperty('--clinic-primary', primary)
  root.style.setProperty('--clinic-secondary', secondary)
  
  // Mapear también a las variables de shadcn/ui para que TODA la UI cambie
  // --primary controla botones, sidebar, rings, etc.
  root.style.setProperty('--primary', hexToOklch(primary))
  root.style.setProperty('--ring', hexToOklch(primary))
  root.style.setProperty('--sidebar', hexToOklch(primary))
  root.style.setProperty('--chart-1', hexToOklch(primary))
  root.style.setProperty('--accent-foreground', hexToOklch(primary))
  root.style.setProperty('--secondary-foreground', hexToOklch(primary))
}

/** Resetea el tema a los defaults de PodoClinic. */
export function resetToPodoclinicDefault() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.removeProperty('--clinic-primary')
  root.style.removeProperty('--clinic-secondary')
  // Las variables --primary etc. volverán a los valores de globals.css
  root.style.removeProperty('--primary')
  root.style.removeProperty('--ring')
  root.style.removeProperty('--sidebar')
  root.style.removeProperty('--chart-1')
  root.style.removeProperty('--accent-foreground')
  root.style.removeProperty('--secondary-foreground')
}
