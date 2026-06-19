'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { HeartPulse } from 'lucide-react'
import { SectionCard } from './section-card'
import { ENFERMEDADES_PATOLOGICAS } from './constants'
import type { HistoriaClinicaInicial } from './types'

type Props = {
  value: HistoriaClinicaInicial['antecedentesPatologicos']
  onChange: (v: HistoriaClinicaInicial['antecedentesPatologicos']) => void
}

export function AntecedentesPatologicosSection({ value, onChange }: Props) {
  const v = value || {}
  const condiciones = v.condiciones || {}
  const diabetes = v.diabetes || {}
  const alergias = v.alergias || {}
  const anticoagulantes = v.anticoagulantes || {}
  const [showDiabetes, setShowDiabetes] = useState(!!v.diabetes)

  function toggleCond(key: string, checked: boolean) {
    onChange({ ...v, condiciones: { ...condiciones, [key]: checked } })
  }

  const isDiabetes = !!condiciones['Diabetes mellitus']

  return (
    <SectionCard number="7" title="Antecedentes personales patológicos" icon={HeartPulse}>
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Enfermedades crónicas
        </Label>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
          {ENFERMEDADES_PATOLOGICAS.map((enf) => (
            <label
              key={enf}
              className="flex items-center gap-2 rounded border px-2 py-1.5 hover:bg-muted/40 cursor-pointer text-sm"
            >
              <Checkbox
                checked={!!condiciones[enf]}
                onCheckedChange={(c) => toggleCond(enf, !!c)}
              />
              {enf}
            </label>
          ))}
        </div>
      </div>

      {/* Sub-sección diabetes */}
      {isDiabetes && (
        <div className="rounded-md border-2 border-red-200 bg-red-50/50 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase font-semibold text-red-700">
              Detalle de diabetes mellitus
            </Label>
            <button
              type="button"
              onClick={() => setShowDiabetes((s) => !s)}
              className="text-xs text-red-700 underline"
            >
              {showDiabetes ? 'Contraer' : 'Expandir'}
            </button>
          </div>
          {showDiabetes && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Año de diagnóstico</Label>
                <Input
                  className="mt-1 h-8"
                  value={diabetes.anioDiagnostico || ''}
                  onChange={(e) =>
                    onChange({ ...v, diabetes: { ...diabetes, anioDiagnostico: e.target.value } })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Tratamiento</Label>
                <Input
                  className="mt-1 h-8"
                  placeholder="Dieta, oral, insulina..."
                  value={diabetes.tratamiento || ''}
                  onChange={(e) =>
                    onChange({ ...v, diabetes: { ...diabetes, tratamiento: e.target.value } })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Última glucosa (mg/dL)</Label>
                <Input
                  className="mt-1 h-8"
                  type="number"
                  value={diabetes.ultimaGlucosa || ''}
                  onChange={(e) =>
                    onChange({ ...v, diabetes: { ...diabetes, ultimaGlucosa: e.target.value } })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">HbA1c (%)</Label>
                <Input
                  className="mt-1 h-8"
                  step="0.1"
                  value={diabetes.hba1c || ''}
                  onChange={(e) =>
                    onChange({ ...v, diabetes: { ...diabetes, hba1c: e.target.value } })
                  }
                />
              </div>
              <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([
                  ['neuropatia', 'Neuropatía'],
                  ['retinopatia', 'Retinopatía'],
                  ['nefropatia', 'Nefropatía'],
                  ['pieDiabetico', 'Pie diabético'],
                ] as const).map(([key, label]) => (
                  <div
                    key={key}
                    className="flex items-center gap-2 rounded border bg-white px-2 py-1.5"
                  >
                    <Switch
                      checked={!!diabetes[key]}
                      onCheckedChange={(c) =>
                        onChange({ ...v, diabetes: { ...diabetes, [key]: c } })
                      }
                    />
                    <span className="text-xs">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Cirugías previas</Label>
          <Textarea
            rows={2}
            className="mt-1"
            placeholder="Procedimiento, año, complicaciones..."
            value={v.cirugias || ''}
            onChange={(e) => onChange({ ...v, cirugias: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Hospitalizaciones</Label>
          <Textarea
            rows={2}
            className="mt-1"
            placeholder="Motivo, fecha, duración..."
            value={v.hospitalizaciones || ''}
            onChange={(e) => onChange({ ...v, hospitalizaciones: e.target.value })}
          />
        </div>
      </div>

      {/* Alergias */}
      <div className="rounded-md border border-orange-200 bg-orange-50/50 p-3 space-y-2">
        <Label className="text-xs uppercase font-semibold text-orange-700">Alergias</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Medicamentos</Label>
            <Input
              className="mt-1 h-8"
              placeholder="Penicilina, sulfas..."
              value={alergias.medicamentos || ''}
              onChange={(e) =>
                onChange({ ...v, alergias: { ...alergias, medicamentos: e.target.value } })
              }
            />
          </div>
          <div>
            <Label className="text-xs">Anestésicos</Label>
            <Input
              className="mt-1 h-8"
              placeholder="Lidocaína, bupivacaína..."
              value={alergias.anestesicos || ''}
              onChange={(e) =>
                onChange({ ...v, alergias: { ...alergias, anestesicos: e.target.value } })
              }
            />
          </div>
          <div>
            <Label className="text-xs">Antisépticos</Label>
            <Input
              className="mt-1 h-8"
              placeholder="Yodo, clorhexidina..."
              value={alergias.antisempticos || ''}
              onChange={(e) =>
                onChange({ ...v, alergias: { ...alergias, antisempticos: e.target.value } })
              }
            />
          </div>
          <div className="flex items-center gap-2 rounded border bg-white px-2 h-9 mt-5">
            <Switch
              checked={!!alergias.latex}
              onCheckedChange={(c) =>
                onChange({ ...v, alergias: { ...alergias, latex: c } })
              }
            />
            <span className="text-xs">Alergia al látex</span>
          </div>
        </div>
      </div>

      <div>
        <Label className="text-xs uppercase text-muted-foreground">Medicamentos actuales</Label>
        <Textarea
          rows={2}
          className="mt-1"
          placeholder="Nombre, dosis, frecuencia..."
          value={v.medicamentosActuales || ''}
          onChange={(e) => onChange({ ...v, medicamentosActuales: e.target.value })}
        />
      </div>

      {/* Anticoagulantes */}
      <div className="rounded-md border border-amber-200 bg-amber-50/50 p-3 space-y-2">
        <Label className="text-xs uppercase font-semibold text-amber-700">
          Anticoagulantes / antiagregantes
        </Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {([
            ['warfarina', 'Warfarina'],
            ['aspirina', 'Aspirina'],
            ['clopidogrel', 'Clopidogrel'],
          ] as const).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2 rounded border bg-white px-2 py-1.5">
              <Switch
                checked={!!anticoagulantes[key]}
                onCheckedChange={(c) =>
                  onChange({ ...v, anticoagulantes: { ...anticoagulantes, [key]: c } })
                }
              />
              <span className="text-xs">{label}</span>
            </div>
          ))}
          <Input
            placeholder="Otro"
            className="h-8 text-xs"
            value={anticoagulantes.otro || ''}
            onChange={(e) =>
              onChange({ ...v, anticoagulantes: { ...anticoagulantes, otro: e.target.value } })
            }
          />
        </div>
      </div>

      <div>
        <Label className="text-xs uppercase text-muted-foreground">
          Embarazo / lactancia (si aplica)
        </Label>
        <Input
          className="mt-1"
          value={v.embarazoLactancia || ''}
          onChange={(e) => onChange({ ...v, embarazoLactancia: e.target.value })}
        />
      </div>

      <div>
        <Label className="text-xs uppercase text-muted-foreground">Observaciones</Label>
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
