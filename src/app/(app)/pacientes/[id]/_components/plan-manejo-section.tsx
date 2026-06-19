'use client'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ClipboardList } from 'lucide-react'
import { SectionCard } from './section-card'
import { ChipMultiSelect } from './chip-multi-select'
import { MANEJO_REALIZADO, TRATAMIENTO_INDICADO } from './constants'
import type { HistoriaClinicaInicial } from './types'

type Props = {
  value: HistoriaClinicaInicial['planManejo']
  onChange: (v: HistoriaClinicaInicial['planManejo']) => void
}

export function PlanManejoSection({ value, onChange }: Props) {
  const v = value || {}
  const set = (k: keyof NonNullable<HistoriaClinicaInicial['planManejo']>, val: any) =>
    onChange({ ...v, [k]: val })

  return (
    <SectionCard number="16" title="Plan terapéutico" icon={ClipboardList}>
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Manejo realizado en esta consulta
        </Label>
        <div className="mt-2">
          <ChipMultiSelect
            options={MANEJO_REALIZADO}
            selected={v.manejoRealizado || []}
            onChange={(arr) => set('manejoRealizado', arr)}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Tratamiento indicado
        </Label>
        <div className="mt-2">
          <ChipMultiSelect
            options={TRATAMIENTO_INDICADO}
            selected={v.tratamientoIndicado || []}
            onChange={(arr) => set('tratamientoIndicado', arr)}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs uppercase text-muted-foreground">
          Indicaciones al paciente
        </Label>
        <Textarea
          rows={4}
          className="mt-1"
          placeholder="Indicaciones de cuidado en casa, signos de alarma, cuándo acudir de urgencia, control..."
          value={v.indicacionesPaciente || ''}
          onChange={(e) => set('indicacionesPaciente', e.target.value)}
        />
      </div>
    </SectionCard>
  )
}
