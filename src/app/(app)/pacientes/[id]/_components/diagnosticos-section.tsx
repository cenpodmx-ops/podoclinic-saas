'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { ShieldAlert, AlertTriangle } from 'lucide-react'
import { SectionCard } from './section-card'
import { ChipMultiSelect } from './chip-multi-select'
import { DIAGNOSTICOS_SUGERIDOS } from './constants'
import type { HistoriaClinicaInicial } from './types'

type Props = {
  value: HistoriaClinicaInicial['diagnosticos']
  onChange: (v: HistoriaClinicaInicial['diagnosticos']) => void
  isDiabetic?: boolean
}

export function DiagnosticosSection({ value, onChange, isDiabetic }: Props) {
  const v = value || {}
  const set = (k: keyof NonNullable<HistoriaClinicaInicial['diagnosticos']>, val: any) =>
    onChange({ ...v, [k]: val })

  return (
    <SectionCard number="14" title="Diagnósticos" icon={ShieldAlert}>
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Diagnóstico principal
        </Label>
        <Input
          className="mt-1"
          placeholder="Ej: Onicocriptosis grado II del hallux derecho"
          value={v.diagnosticoPrincipal || ''}
          onChange={(e) => set('diagnosticoPrincipal', e.target.value)}
        />
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Diagnósticos sugeridos (clic para agregar)
        </Label>
        <div className="mt-2">
          <ChipMultiSelect
            options={DIAGNOSTICOS_SUGERIDOS}
            selected={v.secundarios || []}
            onChange={(arr) => set('secundarios', arr)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Lateralidad</Label>
          <select
            className="mt-1 w-full h-9 rounded border bg-background px-2 text-sm"
            value={v.lateralidad || ''}
            onChange={(e) => set('lateralidad', e.target.value)}
          >
            <option value="">—</option>
            <option value="Derecho">Derecho</option>
            <option value="Izquierdo">Izquierdo</option>
            <option value="Bilateral">Bilateral</option>
          </select>
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Región</Label>
          <Input
            className="mt-1"
            placeholder="Ej: Hallux, planta, talón..."
            value={v.region || ''}
            onChange={(e) => set('region', e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">CIE-10</Label>
          <Input
            className="mt-1"
            placeholder="Ej: L60.0 (uña encarnada)"
            value={v.cie10 || ''}
            onChange={(e) => set('cie10', e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs uppercase text-muted-foreground">Problemas activos</Label>
        <Textarea
          rows={2}
          className="mt-1"
          placeholder="Problemas activos que requieren seguimiento..."
          value={v.problemasActivos || ''}
          onChange={(e) => set('problemasActivos', e.target.value)}
        />
      </div>

      <div>
        <Label className="text-xs uppercase text-muted-foreground">Observaciones</Label>
        <Textarea
          rows={2}
          className="mt-1"
          value={v.observaciones || ''}
          onChange={(e) => set('observaciones', e.target.value)}
        />
      </div>

      {isDiabetic && (
        <div className="flex items-start gap-2 rounded-md border border-orange-300 bg-orange-50 p-2 text-orange-900 text-xs">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Paciente diabético</p>
            <p>Considera complementar con diagnóstico de pie diabético y clasificación de Wagner/IDSA.</p>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

/** Tab independiente para visualización rápida de diagnósticos (Tab 4). */
export function DiagnosticosTab({
  value,
  onSave,
  isDiabetic,
}: {
  value: HistoriaClinicaInicial['diagnosticos']
  onSave: (v: HistoriaClinicaInicial['diagnosticos']) => Promise<void>
  isDiabetic?: boolean
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Diagnósticos actuales</h3>
        <Badge variant="outline" style={{ color: '#0a3143' }}>
          {value?.secundarios?.length || 0} secundarios
        </Badge>
      </div>
      <DiagnosticosSection value={value} onChange={onSave} isDiabetic={isDiabetic} />
    </div>
  )
}
