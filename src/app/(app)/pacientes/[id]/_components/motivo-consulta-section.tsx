'use client'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MessageSquare } from 'lucide-react'
import { SectionCard } from './section-card'
import { ChipMultiSelect } from './chip-multi-select'
import { MOTIVOS_CONSULTA } from './constants'
import type { HistoriaClinicaInicial } from './types'

type Props = {
  value: HistoriaClinicaInicial['motivoConsulta']
  onChange: (v: HistoriaClinicaInicial['motivoConsulta']) => void
}

export function MotivoConsultaSection({ value, onChange }: Props) {
  const v = value || {}
  return (
    <SectionCard number="4" title="Motivo de consulta" icon={MessageSquare} defaultOpen>
      <div className="space-y-3">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Motivos de consulta (selecciona uno o varios)
          </Label>
          <div className="mt-2">
            <ChipMultiSelect
              options={MOTIVOS_CONSULTA}
              selected={v.motivosSeleccionados || []}
              onChange={(arr) => onChange({ ...v, motivosSeleccionados: arr })}
            />
          </div>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Descripción textual en palabras del paciente
          </Label>
          <Textarea
            rows={3}
            className="mt-1"
            placeholder="Ej: 'Me duele el dedo gordo del pie derecho desde hace tres días, se me inflama y no puedo calzar...'"
            value={v.descripcionTextual || ''}
            onChange={(e) => onChange({ ...v, descripcionTextual: e.target.value })}
          />
        </div>
      </div>
    </SectionCard>
  )
}
