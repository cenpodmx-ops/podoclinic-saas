'use client'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ClipboardCheck } from 'lucide-react'
import { SectionCard } from './section-card'
import type { HistoriaClinicaInicial } from './types'

type Props = {
  value: HistoriaClinicaInicial['exploracionGeneral']
  onChange: (v: HistoriaClinicaInicial['exploracionGeneral']) => void
}

const RADIO_OPTS = (
  options: string[],
  current: string | undefined,
  onPick: (v: string) => void,
) => (
  <div className="flex flex-wrap gap-2">
    {options.map((opt) => {
      const active = current === opt
      return (
        <button
          type="button"
          key={opt}
          onClick={() => onPick(active ? '' : opt)}
          className={`rounded-md border px-3 py-1 text-xs transition-colors ${
            active
              ? 'text-white border-transparent'
              : 'bg-background text-muted-foreground border-muted-foreground/30 hover:bg-muted/60'
          }`}
          style={active ? { backgroundColor: '#0a3143' } : undefined}
        >
          {opt}
        </button>
      )
    })}
  </div>
)

export function ExploracionGeneralSection({ value, onChange }: Props) {
  const v = value || {}
  const set = (k: keyof NonNullable<HistoriaClinicaInicial['exploracionGeneral']>, val: any) =>
    onChange({ ...v, [k]: val })

  return (
    <SectionCard number="11" title="Exploración física general" icon={ClipboardCheck}>
      <div className="space-y-3">
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Estado de alerta</Label>
          <div className="mt-1">
            {RADIO_OPTS(['Alerta', 'Somnoliento', 'Estuporoso', 'Comatoso'], v.estadoAlerta, (x) => set('estadoAlerta', x))}
          </div>
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Orientación</Label>
          <div className="mt-1">
            {RADIO_OPTS(
              ['Orientado en tiempo, espacio y persona', 'Desorientado', 'No valorable'],
              v.orientacion,
              (x) => set('orientacion', x),
            )}
          </div>
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Habitus exterior</Label>
          <div className="mt-1">
            {RADIO_OPTS(
              ['Bien nutrido', 'Caquéctico', 'Obeso', 'Sobrepeso', 'Bajo peso'],
              v.habitus,
              (x) => set('habitus', x),
            )}
          </div>
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Estado general</Label>
          <div className="mt-1">
            {RADIO_OPTS(['Bueno', 'Regular', 'Malo'], v.estadoGeneral, (x) => set('estadoGeneral', x))}
          </div>
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Marcha</Label>
          <div className="mt-1">
            {RADIO_OPTS(
              ['Normal', 'Antálgica', 'Atáxica', 'Cojeza', 'Con ayuda'],
              v.marcha,
              (x) => set('marcha', x),
            )}
          </div>
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Uso de apoyo</Label>
          <div className="mt-1">
            {RADIO_OPTS(['Ninguno', 'Bastón', 'Andadera', 'Muletas', 'Silla de ruedas'], v.usoApoyo, (x) => set('usoApoyo', x))}
          </div>
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
      </div>
    </SectionCard>
  )
}
