'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Users } from 'lucide-react'
import { SectionCard } from './section-card'
import { ENFERMEDADES_HEREDOFAMILIARES } from './constants'
import type { HistoriaClinicaInicial } from './types'

type Props = {
  value: HistoriaClinicaInicial['antecedentesFamiliares']
  onChange: (v: HistoriaClinicaInicial['antecedentesFamiliares']) => void
}

type Condicion = {
  presente: boolean
  familiar?: string
  edadPresentacion?: string
  observaciones?: string
}

export function AntecedentesFamiliaresSection({ value, onChange }: Props) {
  const v = value || {}
  const condiciones = v.condiciones || {}

  function toggle(key: string, checked: boolean) {
    const next: Condicion = {
      ...(condiciones[key] || { presente: false }),
      presente: checked,
    }
    onChange({ ...v, condiciones: { ...condiciones, [key]: next } })
  }

  function setField(key: string, field: keyof Condicion, val: string) {
    const cur = condiciones[key] || { presente: true }
    onChange({
      ...v,
      condiciones: { ...condiciones, [key]: { ...cur, [field]: val } },
    })
  }

  const checkedCount = Object.values(condiciones).filter((c) => c?.presente).length

  return (
    <SectionCard number="6" title="Antecedentes heredofamiliares" icon={Users} badge={checkedCount ? `${checkedCount}` : undefined}>
      <p className="text-xs text-muted-foreground">
        Marca las condiciones presentes en familiares del paciente. Para cada una, indica el familiar
        afectado, edad de presentación y observaciones.
      </p>
      <div className="space-y-2">
        {ENFERMEDADES_HEREDOFAMILIARES.map((enf) => {
          const cur = condiciones[enf] || { presente: false }
          return (
            <div
              key={enf}
              className={`rounded-md border p-2 transition-colors ${
                cur.presente ? 'border-primary/40 bg-primary/5' : 'bg-background'
              }`}
            >
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={cur.presente}
                  onCheckedChange={(c) => toggle(enf, !!c)}
                  id={`fh-${enf}`}
                />
                <Label htmlFor={`fh-${enf}`} className="text-sm font-medium cursor-pointer">
                  {enf}
                </Label>
              </div>
              {cur.presente && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2 pl-6">
                  <Input
                    placeholder="Familiar (padre, madre, etc.)"
                    className="text-xs h-8"
                    value={cur.familiar || ''}
                    onChange={(e) => setField(enf, 'familiar', e.target.value)}
                  />
                  <Input
                    placeholder="Edad presentación"
                    className="text-xs h-8"
                    value={cur.edadPresentacion || ''}
                    onChange={(e) => setField(enf, 'edadPresentacion', e.target.value)}
                  />
                  <Input
                    placeholder="Observaciones"
                    className="text-xs h-8"
                    value={cur.observaciones || ''}
                    onChange={(e) => setField(enf, 'observaciones', e.target.value)}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div>
        <Label className="text-xs uppercase text-muted-foreground">Observaciones generales</Label>
        <Textarea
          rows={2}
          className="mt-1"
          value={v.observaciones || ''}
          onChange={(e) => onChange({ ...v, observaciones: e.target.value })}
        />
      </div>
    </SectionCard>
  )
}
