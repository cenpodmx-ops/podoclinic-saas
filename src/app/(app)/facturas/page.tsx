'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import {
  ShieldAlert,
  FileText,
  Receipt,
  BarChart3,
  ListChecks,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TabPorFacturar, TabHistorial, TabResumen } from './_components/tabs'
import { FacturarDialog } from './_components/facturar-dialog'
import type { CitableConsultation } from './_lib/types'

export default function FacturasPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role as string
  const canCancel = role === 'SUPER' || role === 'OWNER'

  const [tab, setTab] = useState('por-facturar')
  const [facturarTarget, setFacturarTarget] = useState<CitableConsultation | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Traer el flag facturapiConfigured desde /api/facturas (sin exponer token)
  const facturapiQ = useQuery<{ facturapiConfigured: boolean }>({
    queryKey: ['facturas-config-status'],
    queryFn: async () => {
      const r = await fetch('/api/facturas?limit=1')
      if (!r.ok) return { facturapiConfigured: false }
      const data = await r.json()
      return { facturapiConfigured: !!data.facturapiConfigured }
    },
    staleTime: 30_000,
  })

  const facturapiConfigured = !!facturapiQ.data?.facturapiConfigured

  function openFacturar(c: CitableConsultation) {
    setFacturarTarget(c)
    setDialogOpen(true)
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" style={{ color: '#0a3143' }} />
            Facturación
          </h1>
          <p className="text-sm text-muted-foreground">Módulo 04 · CFDI 4.0 vía FacturAPI</p>
        </div>
        {!facturapiConfigured && (
          <a
            href="/config"
            className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 hover:bg-amber-100"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            Configurar FacturAPI →
          </a>
        )}
      </div>

      {!facturapiConfigured && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-0.5">Modo simulación — sin token FacturAPI configurado</p>
            <p className="text-xs">
              Puedes generar facturas de prueba y ver su vista previa, pero no se timbrarán ante el SAT.
              Configura tu token en <a href="/config" className="underline font-medium">Configuración → FacturAPI</a> para activar el timbrado real.
            </p>
          </div>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="por-facturar" className="gap-1.5">
            <Receipt className="h-3.5 w-3.5" /> Por facturar
          </TabsTrigger>
          <TabsTrigger value="historial" className="gap-1.5">
            <ListChecks className="h-3.5 w-3.5" /> Historial
          </TabsTrigger>
          {(role === 'SUPER' || role === 'OWNER') && (
            <TabsTrigger value="resumen" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" /> Resumen mensual
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="por-facturar" className="mt-4">
          <TabPorFacturar
            facturapiConfigured={facturapiConfigured}
            onFacturar={openFacturar}
          />
        </TabsContent>

        <TabsContent value="historial" className="mt-4">
          <TabHistorial canCancel={canCancel} />
        </TabsContent>

        {(role === 'SUPER' || role === 'OWNER') && (
          <TabsContent value="resumen" className="mt-4">
            <TabResumen />
          </TabsContent>
        )}
      </Tabs>

      <FacturarDialog
        key={facturarTarget?.id || 'none'}
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o)
          if (!o) setFacturarTarget(null)
        }}
        consultation={facturarTarget}
        facturapiConfigured={facturapiConfigured}
      />
    </div>
  )
}
