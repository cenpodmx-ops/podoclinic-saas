'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { Building2, ChevronDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useActiveClinic } from '@/lib/active-clinic-store'
import { toast } from 'sonner'

type Clinic = { id: string; name: string; slug: string }

export function ClinicSwitcher() {
  const { data: session } = useSession()
  const user = session?.user as any
  const isSuper = user?.role === 'SUPER'
  const qc = useQueryClient()
  const { clinicId, setClinic, hydrate, hydrated } = useActiveClinic()
  const [switching, setSwitching] = useState(false)

  // Hidratar desde cookie al montar
  useEffect(() => {
    hydrate()
  }, [hydrate])

  // Cargar lista de clínicas
  const { data: clinicsData } = useQuery({
    queryKey: ['clinicas-switcher'],
    queryFn: () => fetch('/api/clinicas').then((r) => r.json()),
    enabled: isSuper,
  })
  const clinics: Clinic[] = clinicsData?.data || []

  // Si SUPER no tiene sucursal activa, autoseleccionar la primera clínica
  // vía la API (para que la cookie se setee server-side) y refrescar queries.
  useEffect(() => {
    if (isSuper && hydrated && !clinicId && clinics.length > 0) {
      const first = clinics.find((c) => !c.slug.includes('matriz')) || clinics[0]
      // Llamar a la API para setear cookie server-side + invalidar queries
      fetch('/api/auth/active-clinic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId: first.id }),
      }).then(() => {
        setClinic(first.id, first.name)
        qc.invalidateQueries()
      }).catch(() => {})
    }
  }, [isSuper, hydrated, clinicId, clinics, setClinic, qc])

  if (!isSuper) {
    // No-SUPER: mostrar el nombre de su clínica fija
    return (
      <div className="hidden md:flex items-center gap-2 text-sm">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{user?.clinicName || 'PodoClinic'}</span>
      </div>
    )
  }

  const currentName = clinics.find((c) => c.id === clinicId)?.name || 'Seleccionar sucursal'

  async function switchTo(c: Clinic) {
    if (c.id === clinicId) return
    setSwitching(true)
    try {
      const res = await fetch('/api/auth/active-clinic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId: c.id }),
      })
      if (!res.ok) throw new Error('Error al cambiar')
      setClinic(c.id, c.name)
      toast.success(`Ahora operando: ${c.name}`)
      // Invalidar TODAS las queries para que se recarguen con la nueva sucursal
      qc.invalidateQueries()
    } catch (e: any) {
      toast.error(e.message || 'Error al cambiar de sucursal')
    } finally {
      setSwitching(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 max-w-[220px]" disabled={switching}>
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="truncate">{switching ? 'Cambiando...' : currentName}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Cambiar de sucursal
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {clinics.map((c) => (
          <DropdownMenuItem
            key={c.id}
            onClick={() => switchTo(c)}
            className="gap-2 cursor-pointer"
          >
            <Building2 className="h-3.5 w-3.5 opacity-60" />
            <span className="flex-1 truncate">{c.name}</span>
            {c.id === clinicId && <Check className="h-4 w-4 text-emerald-600" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
