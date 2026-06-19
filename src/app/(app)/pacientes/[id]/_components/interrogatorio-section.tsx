'use client'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Stethoscope } from 'lucide-react'
import { SectionCard } from './section-card'
import {
  SINTOMAS_CARDIOVASCULARES,
  SINTOMAS_ENDOCRINOS,
  SINTOMAS_NEUROLOGICOS,
  SINTOMAS_DERMATOLOGICOS,
  SINTOMAS_MUSCULOESQUELETICOS,
} from './constants'
import type { HistoriaClinicaInicial } from './types'

type Props = {
  value: HistoriaClinicaInicial['interrogatorioAparatos']
  onChange: (v: HistoriaClinicaInicial['interrogatorioAparatos']) => void
}

const APARATOS: { key: keyof NonNullable<HistoriaClinicaInicial['interrogatorioAparatos']>; label: string; opciones: string[] }[] = [
  { key: 'cardiovascular', label: 'Cardiovascular', opciones: SINTOMAS_CARDIOVASCULARES },
  { key: 'endocrino', label: 'Endocrino', opciones: SINTOMAS_ENDOCRINOS },
  { key: 'neurologico', label: 'Neurológico', opciones: SINTOMAS_NEUROLOGICOS },
  { key: 'dermatologico', label: 'Dermatológico', opciones: SINTOMAS_DERMATOLOGICOS },
  { key: 'musculoesqueletico', label: 'Musculoesquelético', opciones: SINTOMAS_MUSCULOESQUELETICOS },
]

export function InterrogatorioSection({ value, onChange }: Props) {
  const v = value || {}

  function setSinDatos(key: any, checked: boolean) {
    onChange({ ...v, [key]: { ...(v as any)[key] || {}, sinDatosPatologicos: checked } })
  }
  function toggleCheck(key: any, opt: string, checked: boolean) {
    const cur = ((v as any)[key] || {}) as any
    const cbs = { ...(cur.checkboxes || {}) }
    if (checked) cbs[opt] = true
    else delete cbs[opt]
    onChange({ ...v, [key]: { ...cur, checkboxes: cbs } })
  }
  function setNotas(key: any, notas: string) {
    onChange({ ...v, [key]: { ...((v as any)[key] || {}), notas } })
  }

  return (
    <SectionCard number="9" title="Interrogatorio por aparatos" icon={Stethoscope}>
      {/* General */}
      <div className="rounded-md border p-3 space-y-2">
        <Label className="text-xs uppercase font-semibold">General</Label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox
            checked={!!v.general?.sinDatosPatologicos}
            onCheckedChange={(c) => setSinDatos('general', !!c)}
          />
          Sin datos patológicos
        </label>
        <Textarea
          rows={2}
          placeholder="Notas generales (estado general, fiebre, pérdida de peso, astenia, adinamia)..."
          value={v.general?.notas || ''}
          onChange={(e) => setNotas('general', e.target.value)}
        />
      </div>

      {APARATOS.map((ap) => {
        const cur = (v as any)[ap.key] || {}
        const sinDatos = !!cur.sinDatosPatologicos
        return (
          <div
            key={ap.key}
            className={`rounded-md border p-3 space-y-2 ${sinDatos ? 'opacity-60' : ''}`}
          >
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase font-semibold">{ap.label}</Label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={sinDatos}
                  onCheckedChange={(c) => setSinDatos(ap.key, !!c)}
                />
                Sin datos patológicos
              </label>
            </div>
            {!sinDatos && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {ap.opciones.map((opt) => (
                    <label
                      key={opt}
                      className="flex items-center gap-2 rounded border px-2 py-1.5 hover:bg-muted/40 cursor-pointer text-sm"
                    >
                      <Checkbox
                        checked={!!cur.checkboxes?.[opt]}
                        onCheckedChange={(c) => toggleCheck(ap.key, opt, !!c)}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
                <Textarea
                  rows={2}
                  placeholder="Notas adicionales..."
                  value={cur.notas || ''}
                  onChange={(e) => setNotas(ap.key, e.target.value)}
                />
              </>
            )}
          </div>
        )
      })}
    </SectionCard>
  )
}
