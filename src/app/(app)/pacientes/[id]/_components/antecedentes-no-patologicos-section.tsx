'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Cigarette, Wine, Dumbbell, Footprints } from 'lucide-react'
import { SectionCard } from './section-card'
import type { HistoriaClinicaInicial } from './types'

type Props = {
  value: HistoriaClinicaInicial['antecedentesNoPatologicos']
  onChange: (v: HistoriaClinicaInicial['antecedentesNoPatologicos']) => void
}

export function AntecedentesNoPatologicosSection({ value, onChange }: Props) {
  const v = value || {}
  const tabaq = v.tabaquismo || { activo: false }
  const alcohol = v.alcohol || { activo: false }

  return (
    <SectionCard number="8" title="Antecedentes no patológicos" icon={Cigarette}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Tabaquismo */}
        <div className="rounded-md border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase font-semibold flex items-center gap-1">
              <Cigarette className="h-3 w-3" /> Tabaquismo
            </Label>
            <Switch
              checked={!!tabaq.activo}
              onCheckedChange={(c) =>
                onChange({ ...v, tabaquismo: { ...tabaq, activo: c } })
              }
            />
          </div>
          {tabaq.activo && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Cigarrillos/día</Label>
                <Input
                  type="number"
                  className="mt-1 h-8"
                  value={tabaq.cigarrillosDia || ''}
                  onChange={(e) =>
                    onChange({
                      ...v,
                      tabaquismo: { ...tabaq, cigarrillosDia: Number(e.target.value) || 0 },
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Años fumando</Label>
                <Input
                  type="number"
                  className="mt-1 h-8"
                  value={tabaq.anos || ''}
                  onChange={(e) =>
                    onChange({
                      ...v,
                      tabaquismo: { ...tabaq, anos: Number(e.target.value) || 0 },
                    })
                  }
                />
              </div>
              <label className="col-span-2 flex items-center gap-2 text-xs">
                <Switch
                  checked={!!tabaq.exfumador}
                  onCheckedChange={(c) =>
                    onChange({ ...v, tabaquismo: { ...tabaq, exfumador: c } })
                  }
                />
                Exfumador
              </label>
            </div>
          )}
        </div>

        {/* Alcohol */}
        <div className="rounded-md border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase font-semibold flex items-center gap-1">
              <Wine className="h-3 w-3" /> Alcohol
            </Label>
            <Switch
              checked={!!alcohol.activo}
              onCheckedChange={(c) => onChange({ ...v, alcohol: { ...alcohol, activo: c } })}
            />
          </div>
          {alcohol.activo && (
            <div>
              <Label className="text-xs">Frecuencia</Label>
              <Input
                className="mt-1 h-8"
                placeholder="Ocasional, semanal, diario..."
                value={alcohol.frecuencia || ''}
                onChange={(e) =>
                  onChange({ ...v, alcohol: { ...alcohol, frecuencia: e.target.value } })
                }
              />
            </div>
          )}
        </div>
      </div>

      <div>
        <Label className="text-xs uppercase text-muted-foreground">Sustancias tóxicas</Label>
        <Input
          className="mt-1"
          value={v.sustancias || ''}
          onChange={(e) => onChange({ ...v, sustancias: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs uppercase text-muted-foreground flex items-center gap-1">
            <Dumbbell className="h-3 w-3" /> Actividad física
          </Label>
          <Input
            className="mt-1"
            placeholder="Sedentario, ocasional, frecuente..."
            value={v.actividadFisica || ''}
            onChange={(e) => onChange({ ...v, actividadFisica: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground flex items-center gap-1">
            <Footprints className="h-3 w-3" /> Tipo de calzado habitual
          </Label>
          <Input
            className="mt-1"
            placeholder="Tenis, zapato cerrado, sandalias..."
            value={v.tipoCalzado || ''}
            onChange={(e) => onChange({ ...v, tipoCalzado: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <label className="flex items-center gap-2 rounded border px-2 py-2 text-sm cursor-pointer">
          <Switch
            checked={!!v.bipedestacionProlongada}
            onCheckedChange={(c) => onChange({ ...v, bipedestacionProlongada: c })}
          />
          Bipedestación prolongada
        </label>
        <label className="flex items-center gap-2 rounded border px-2 py-2 text-sm cursor-pointer">
          <Switch
            checked={!!v.banosPublicos}
            onCheckedChange={(c) => onChange({ ...v, banosPublicos: c })}
          />
          Baños públicos
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Higiene diaria</Label>
          <Input
            className="mt-1"
            placeholder="Diaria, interdiaria, deficiente..."
            value={v.higiene || ''}
            onChange={(e) => onChange({ ...v, higiene: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Corte de uñas</Label>
          <Input
            className="mt-1"
            placeholder="Recto, curvo, frequency..."
            value={v.corteUnas || ''}
            onChange={(e) => onChange({ ...v, corteUnas: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">¿Quién corta las uñas?</Label>
          <Input
            className="mt-1"
            placeholder="Mismo, familiar, podólogo..."
            value={v.quienCorta || ''}
            onChange={(e) => onChange({ ...v, quienCorta: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Sudoración (hiperhidrosis)</Label>
          <Input
            className="mt-1"
            placeholder="Normal, aumentada, disminuida..."
            value={v.sudoracion || ''}
            onChange={(e) => onChange({ ...v, sudoracion: e.target.value })}
          />
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs uppercase text-muted-foreground">Ocupación de riesgo</Label>
          <Input
            className="mt-1"
            placeholder="Trabajo que implica bipedestación prolongada, frío, humedad, etc."
            value={v.ocupacionRiesgo || ''}
            onChange={(e) => onChange({ ...v, ocupacionRiesgo: e.target.value })}
          />
        </div>
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
