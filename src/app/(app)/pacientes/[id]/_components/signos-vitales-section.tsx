'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Activity, AlertCircle } from 'lucide-react'
import { SectionCard } from './section-card'
import type { HistoriaClinicaInicial } from './types'

type Props = {
  value: HistoriaClinicaInicial['signosVitales']
  onChange: (v: HistoriaClinicaInicial['signosVitales']) => void
}

function criticalCheck(field: string, val?: number): { alert: boolean; msg?: string } {
  if (val === undefined || val === null || isNaN(val)) return { alert: false }
  switch (field) {
    case 'taSistolica':
      if (val >= 180 || val <= 90) return { alert: true, msg: 'TA sistólica crítica' }
      break
    case 'taDiastolica':
      if (val >= 120 || val <= 50) return { alert: true, msg: 'TA diastólica crítica' }
      break
    case 'fc':
      if (val >= 120 || val <= 40) return { alert: true, msg: 'Frecuencia cardiaca crítica' }
      break
    case 'fr':
      if (val >= 25 || val <= 8) return { alert: true, msg: 'Frecuencia respiratoria crítica' }
      break
    case 'temperatura':
      if (val >= 39 || val <= 35) return { alert: true, msg: 'Temperatura crítica' }
      break
    case 'spo2':
      if (val < 92) return { alert: true, msg: 'SpO₂ baja' }
      break
    case 'glucosaCapilar':
      if (val >= 250 || val <= 60) return { alert: true, msg: 'Glucosa crítica' }
      break
  }
  return { alert: false }
}

export function SignosVitalesSection({ value, onChange }: Props) {
  const v = value || {}
  const set = (k: keyof NonNullable<HistoriaClinicaInicial['signosVitales']>, val: any) =>
    onChange({ ...v, [k]: val })

  // IMC auto-calc
  const peso = v.peso ? Number(v.peso) : 0
  const talla = v.talla ? Number(v.talla) : 0
  const imc = peso && talla ? Number((peso / (talla * talla)).toFixed(1)) : undefined
  const imcColor =
    imc === undefined
      ? ''
      : imc < 18.5
        ? 'text-blue-700'
        : imc < 25
          ? 'text-emerald-700'
          : imc < 30
            ? 'text-amber-700'
            : 'text-red-700'

  const alerts: string[] = []
  ;(Object.keys(v) as any[]).forEach((k) => {
    const c = criticalCheck(k, (v as any)[k])
    if (c.alert && c.msg) alerts.push(c.msg)
  })

  return (
    <SectionCard number="10" title="Signos vitales y somatometría" icon={Activity}>
      {alerts.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border-2 border-red-500 bg-red-50 p-2 text-red-800 text-xs">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold uppercase">Valores críticos detectados</p>
            <ul className="list-disc list-inside mt-0.5">
              {alerts.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs">TA sistólica (mmHg)</Label>
          <Input
            type="number"
            className="mt-1 h-9"
            value={v.taSistolica ?? ''}
            onChange={(e) => set('taSistolica', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
        <div>
          <Label className="text-xs">TA diastólica (mmHg)</Label>
          <Input
            type="number"
            className="mt-1 h-9"
            value={v.taDiastolica ?? ''}
            onChange={(e) => set('taDiastolica', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
        <div>
          <Label className="text-xs">FC (lpm)</Label>
          <Input
            type="number"
            className="mt-1 h-9"
            value={v.fc ?? ''}
            onChange={(e) => set('fc', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
        <div>
          <Label className="text-xs">FR (rpm)</Label>
          <Input
            type="number"
            className="mt-1 h-9"
            value={v.fr ?? ''}
            onChange={(e) => set('fr', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
        <div>
          <Label className="text-xs">Temperatura (°C)</Label>
          <Input
            type="number"
            step="0.1"
            className="mt-1 h-9"
            value={v.temperatura ?? ''}
            onChange={(e) => set('temperatura', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
        <div>
          <Label className="text-xs">SpO₂ (%)</Label>
          <Input
            type="number"
            className="mt-1 h-9"
            value={v.spo2 ?? ''}
            onChange={(e) => set('spo2', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
        <div>
          <Label className="text-xs">Peso (kg)</Label>
          <Input
            type="number"
            step="0.1"
            className="mt-1 h-9"
            value={v.peso ?? ''}
            onChange={(e) => set('peso', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
        <div>
          <Label className="text-xs">Talla (m)</Label>
          <Input
            type="number"
            step="0.01"
            className="mt-1 h-9"
            value={v.talla ?? ''}
            onChange={(e) => set('talla', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
        <div className="rounded-md border bg-muted/30 p-2">
          <p className="text-[10px] uppercase text-muted-foreground">IMC (auto)</p>
          <p className={`text-xl font-bold ${imcColor}`}>{imc ?? '—'}</p>
          {imc !== undefined && (
            <Badge variant="outline" className="text-[10px]">
              {imc < 18.5 ? 'Bajo peso' : imc < 25 ? 'Normal' : imc < 30 ? 'Sobrepeso' : 'Obesidad'}
            </Badge>
          )}
        </div>
        <div>
          <Label className="text-xs">Glucosa capilar (mg/dL)</Label>
          <Input
            type="number"
            className="mt-1 h-9"
            value={v.glucosaCapilar ?? ''}
            onChange={(e) => set('glucosaCapilar', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
        <div>
          <Label className="text-xs">EVA dolor (0-10)</Label>
          <div className="flex items-center gap-2 mt-1">
            <Slider
              min={0}
              max={10}
              step={1}
              value={[v.eva ?? 0]}
              onValueChange={(arr) => set('eva', arr[0])}
            />
            <span className="text-sm font-bold w-8 text-right">{v.eva ?? 0}</span>
          </div>
        </div>
      </div>
    </SectionCard>
  )
}
