/**
 * Helper para emitir eventos en tiempo real al mini-servicio de Red PodoClinic.
 *
 * Las API routes de Next.js llaman a `redEmit()` DESPUÉS de escribir en la BD.
 * El mini-servicio (mini-services/red-service, puerto 3003) recibe el POST y
 * transmite vía socket.io a los clientes conectados.
 *
 * Este archivo solo se usa server-side (API routes). NO lo importes en cliente.
 */

const RED_SERVICE_URL = 'http://localhost:3003/emit'

type EmitPayload = {
  event: string
  room?: string
  broadcast?: boolean
  payload?: unknown
}

/**
 * Emite un evento al mini-servicio. No lanza: si falla, loggea y sigue.
 * El mini-servicio responde 202 inmediatamente sin esperar el broadcast.
 */
export async function redEmit(opts: EmitPayload): Promise<void> {
  try {
    await fetch(RED_SERVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
      // No esperamos más de 3s — el servicio responde 202 al instante.
      signal: AbortSignal.timeout(3000),
    })
  } catch (e) {
    // El mini-servicio podría estar caído; no rompemos el flujo principal.
    console.error('[red-emit] failed:', (e as Error)?.message || e)
  }
}

/** Helpers específicos del módulo Red. */
export const redEvents = {
  /** Mensaje nuevo en la red → avisa a la clínica destinataria. */
  messageCreated: async (toClinicId: string, payload: unknown) =>
    redEmit({ event: 'red:message', room: `clinic:${toClinicId}`, payload }),

  /** Aviso nuevo → broadcast a todas las clínicas (la matriz emite). */
  noticeCreated: async (payload: unknown) =>
    redEmit({ event: 'red:notice', broadcast: true, payload }),

  /** Pedido nuevo o actualizado → avisa a la clínica correspondiente. */
  orderUpdated: async (clinicId: string, payload: unknown) =>
    redEmit({ event: 'red:order', room: `clinic:${clinicId}`, payload }),
}
