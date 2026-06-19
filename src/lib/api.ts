import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

/** Respuesta JSON exitosa. Sin cache para que los datos siempre sean frescos. */
export function ok(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  })
}

export function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function requireSession() {
  const s = await getSession()
  if (!s) {
    return {
      user: null,
      response: NextResponse.json(
        { error: 'No autenticado' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      ),
    }
  }
  return { user: s, response: null }
}

export function parseBody<T = any>(body: any): T {
  return body as T
}

/** Devuelve el clinicId efectivo para filtrar. SUPER puede ver todo si pasa ?all=1 */
export function effectiveClinic(user: { role: string; clinicId: string }, allParam?: string) {
  if (user.role === 'SUPER' && allParam === '1') return undefined
  return user.clinicId
}
