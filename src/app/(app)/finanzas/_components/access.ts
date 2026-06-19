// Helpers de acceso para el cliente (espejo de /lib/session)

/** Solo OWNER + SUPER pueden acceder a Finanzas en el cliente. */
export function canAccessFinanceClient(user: any): boolean {
  return !!user && (user.role === 'SUPER' || user.role === 'OWNER')
}
