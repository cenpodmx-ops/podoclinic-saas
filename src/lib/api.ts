import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

export function ok(data: any, status = 200) {
  return NextResponse.json(data, { status })
}

export function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

export async function requireSession() {
  const s = await getSession()
  if (!s) {
    return { user: null, response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
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
