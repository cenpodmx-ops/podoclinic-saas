'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Megaphone, Users, BarChart3 } from 'lucide-react'
import { TabSegmentacion } from './_components/tab-segmentacion'
import { TabLeads } from './_components/tab-leads'
import { TabReportes } from './_components/tab-reportes'

export default function CRMPage() {
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Megaphone className="h-6 w-6" style={{ color: 'var(--primary)' }} />
          CRM
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Segmentación de pacientes, gestión de leads y campañas de WhatsApp.
        </p>
      </div>

      <Tabs defaultValue="segmentacion" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="segmentacion" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Segmentación</span>
            <span className="sm:hidden">Segm.</span>
          </TabsTrigger>
          <TabsTrigger value="leads" className="gap-1.5">
            <Megaphone className="h-3.5 w-3.5" />
            Leads
          </TabsTrigger>
          <TabsTrigger value="reportes" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Reportes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="segmentacion" className="mt-4">
          <TabSegmentacion />
        </TabsContent>

        <TabsContent value="leads" className="mt-4">
          <TabLeads />
        </TabsContent>

        <TabsContent value="reportes" className="mt-4">
          <TabReportes />
        </TabsContent>
      </Tabs>
    </div>
  )
}
