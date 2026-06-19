'use client'

import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { ClinicRef } from './types'

/**
 * Hook que trae la lista de clínicas con las que puedo interactuar en la Red.
 * Usa /api/red/clinicas (incluye distribuidora).
 * SUPER ve todas las clínicas (menos matriz).
 * Resto: clínicas operativas + distribuidora (sin matriz ni la propia).
 */
export function useRedClinics() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role as string | undefined

  return useQuery<ClinicRef[]>({
    queryKey: ['red', 'clinics', role],
    queryFn: async () => {
      const res = await fetch('/api/red/clinicas', { credentials: 'include' })
      if (!res.ok) throw new Error('No se pudieron cargar las clínicas')
      const json = await res.json()
      return (json?.data || []) as ClinicRef[]
    },
    enabled: !!session,
    staleTime: 60_000,
  })
}
