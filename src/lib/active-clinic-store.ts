'use client'

import { create } from 'zustand'
import { ACTIVE_CLINIC_COOKIE } from '@/lib/roles'

type ActiveClinicState = {
  /** ID de la sucursal activa (solo relevante para SUPER). */
  clinicId: string | null
  clinicName: string | null
  /** Ya se hidrató desde la cookie inicial. */
  hydrated: boolean
  /** Setea la sucursal activa (escribe cookie + estado). */
  setClinic: (id: string, name: string) => void
  /** Lee la cookie inicial al montar. */
  hydrate: () => void
}

function readCookie(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${ACTIVE_CLINIC_COOKIE}=`))
  return match ? decodeURIComponent(match.split('=')[1]) : null
}

export const useActiveClinic = create<ActiveClinicState>((set, get) => ({
  clinicId: null,
  clinicName: null,
  hydrated: false,
  setClinic: (id, name) => {
    if (typeof document !== 'undefined') {
      document.cookie = `${ACTIVE_CLINIC_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=604800; samesite=lax`
    }
    set({ clinicId: id, clinicName: name })
  },
  hydrate: () => {
    if (get().hydrated) return
    const id = readCookie()
    set({ clinicId: id, hydrated: true })
  },
}))
