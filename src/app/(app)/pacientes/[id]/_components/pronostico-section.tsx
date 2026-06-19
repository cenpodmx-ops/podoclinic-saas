'use client'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { TrendingUp } from 'lucide-react'
import { SectionCard } from './section-card'
import type { HistoriaClinicaInicial } from './types'

type Props = {
  value: HistoriaClinicaInicial['pronostico']
  onChange: (v: HistoriaClinicaInicial['pronostico']) => void
}

const TIPOS = [
  { value: 'BUENO', label: 'Bueno', color: '#16a34a' },
  { value: 'RESERVADO', label: 'Reservado', color: '#d97706' },
  { value: 'GUARDADO', label: 'Guardado', color: '#dc2626' },
]

export function PronosticoSection({ value, onChange }: Props) {
  const v = value || {}
  return (
    <SectionCard number="15" title="Pronóstico" icon={TrendingUp}>
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tipo</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {TIPOS.map((t) => {
            const active = v.tipo === t.value
            return (
              <button
                type="button"
                key={t.value}
                onClick={() => onChange({ ...v, tipo: active ? '' : t.value })}
                className="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: active ? t.color : 'transparent',
                  borderColor: active ? t.color : 'rgba(0,0,0,0.15)',
                  color: active ? 'white' : 'inherit',
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <Label className="text-xs uppercase text-muted-foreground">Descripción</Label>
        <Textarea
          rows={3}
          className="mt-1"
          placeholder="Justifica y detalla el pronóstico del paciente..."
          value={v.descripcion || ''}
          onChange={(e) => onChange({ ...v, descripcion: e.target.value })}
        />
      </div>
    </SectionCard>
  )
}
