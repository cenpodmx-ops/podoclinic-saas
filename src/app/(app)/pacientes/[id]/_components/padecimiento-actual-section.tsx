'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Activity } from 'lucide-react'
import { SectionCard } from './section-card'
import { ChipMultiSelect } from './chip-multi-select'
import {
  LOCALIZACION_ANATOMICA,
  MECANISMO_PROBABLE,
  SINTOMAS_ASOCIADOS,
  TRATAMIENTOS_PREVIOS,
} from './constants'
import type { HistoriaClinicaInicial } from './types'

type Props = {
  value: HistoriaClinicaInicial['padecimientoActual']
  onChange: (v: HistoriaClinicaInicial['padecimientoActual']) => void
}

function evaColor(v: number) {
  if (v <= 3) return '#16a34a'
  if (v <= 6) return '#d97706'
  return '#dc2626'
}

export function PadecimientoActualSection({ value, onChange }: Props) {
  const v = value || {}
  const eva = v.eva ?? 0
  return (
    <SectionCard number="5" title="Padecimiento actual" icon={Activity}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Inicio</Label>
          <Input
            className="mt-1"
            placeholder="Ej: Hace 3 días"
            value={v.inicio || ''}
            onChange={(e) => onChange({ ...v, inicio: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Tiempo de evolución</Label>
          <Input
            className="mt-1"
            placeholder="Ej: Progresivo, agudo, crónico"
            value={v.tiempoEvolucion || ''}
            onChange={(e) => onChange({ ...v, tiempoEvolucion: e.target.value })}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Localización anatómica
        </Label>
        <div className="mt-2">
          <ChipMultiSelect
            options={LOCALIZACION_ANATOMICA}
            selected={v.localizacion || []}
            onChange={(arr) => onChange({ ...v, localizacion: arr })}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Mecanismo probable
        </Label>
        <div className="mt-2">
          <ChipMultiSelect
            options={MECANISMO_PROBABLE}
            selected={v.mecanismoProbable || []}
            onChange={(arr) => onChange({ ...v, mecanismoProbable: arr })}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Síntomas asociados
        </Label>
        <div className="mt-2">
          <ChipMultiSelect
            options={SINTOMAS_ASOCIADOS}
            selected={v.sintomasAsociados || []}
            onChange={(arr) => onChange({ ...v, sintomasAsociados: arr })}
          />
        </div>
      </div>

      {/* EVA slider */}
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Escala Visual Análoga (EVA) — dolor
          </Label>
          <span
            className="text-sm font-bold px-2 py-0.5 rounded text-white"
            style={{ backgroundColor: evaColor(eva) }}
          >
            {eva} / 10
          </span>
        </div>
        <div
          className="mt-2 h-2 rounded-full"
          style={{
            background: `linear-gradient(90deg, #16a34a 0%, #d97706 50%, #dc2626 100%)`,
          }}
        />
        <Slider
          min={0}
          max={10}
          step={1}
          value={[eva]}
          onValueChange={(arr) => onChange({ ...v, eva: arr[0] })}
          className="mt-2"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <span>0 — sin dolor</span>
          <span>5 — moderado</span>
          <span>10 — insoportable</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Factores que agravan</Label>
          <Textarea
            rows={2}
            className="mt-1"
            placeholder="Ej: caminar, calzado estrecho, bipedestación..."
            value={v.factoresAgravan || ''}
            onChange={(e) => onChange({ ...v, factoresAgravan: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Factores que alivian</Label>
          <Textarea
            rows={2}
            className="mt-1"
            placeholder="Ej: reposo, descalzo, AINEs..."
            value={v.factoresAlivian || ''}
            onChange={(e) => onChange({ ...v, factoresAlivian: e.target.value })}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Tratamientos previos
        </Label>
        <div className="mt-2">
          <ChipMultiSelect
            options={TRATAMIENTOS_PREVIOS}
            selected={v.tratamientosPrevios || []}
            onChange={(arr) => onChange({ ...v, tratamientosPrevios: arr })}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs uppercase text-muted-foreground">Evolución</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {['Mejoría', 'Estable', 'Empeoramiento', 'Fluctuante'].map((opt) => {
            const active = v.evolucion === opt
            return (
              <button
                type="button"
                key={opt}
                onClick={() => onChange({ ...v, evolucion: active ? '' : opt })}
                className={`rounded-md border px-3 py-1 text-xs ${
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
