'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Construction } from 'lucide-react'

export function ComingSoon({ title, module }: { title: string; module: string }) {
  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <h1 className="text-2xl font-bold mb-4">{title}</h1>
      <Card className="shadow-sm">
        <CardContent className="p-12 text-center">
          <Construction className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-medium mb-2">Módulo en desarrollo</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            El <strong>{module}</strong> está programado para una fase posterior del proyecto.
            El núcleo del sistema (Agenda, Consulta, Pacientes, Servicios) ya está funcional.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
