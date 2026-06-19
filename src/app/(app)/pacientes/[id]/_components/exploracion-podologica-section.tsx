'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Footprints } from 'lucide-react'
import { SectionCard } from './section-card'
import type { HistoriaClinicaInicial } from './types'

type Props = {
  value: HistoriaClinicaInicial['exploracionPodologica']
  onChange: (v: HistoriaClinicaInicial['exploracionPodologica']) => void
}

const PIE_FIELDS: { key: string; label: string; options: string[] }[] = [
  { key: 'coloracion', label: 'Coloración', options: ['Normal', 'Pálida', 'Cianótica', 'Eritematosa', 'Hiperpigmentada'] },
  { key: 'temperatura', label: 'Temperatura', options: ['Normotérmica', 'Fría', 'Caliente'] },
  { key: 'hidratacion', label: 'Hidratación', options: ['Normal', 'Seca', 'Xerosis', 'Hiperhidrosis'] },
  { key: 'integridad', label: 'Integridad', options: ['Íntegra', 'Fisuras', 'Úlceras', 'Maceración', 'Lesiones'] },
]

const DEDOS = ['Hallux', '2° dedo', '3° dedo', '4° dedo', '5° dedo']
const UNGUEAL_PATOS = [
  'Onicocriptosis',
  'Onicogrifosis',
  'Onicomicosis',
  'Onicorrexis',
  'Onicólisis',
  'Paquioniquia',
]

function PieCard({
  title,
  data,
  onChange,
}: {
  title: string
  data: any
  onChange: (next: any) => void
}) {
  const set = (k: string, val: string) => onChange({ ...data, [k]: val })
  return (
    <div className="rounded-md border p-3 space-y-2">
      <p className="text-xs uppercase font-semibold" style={{ color: '#0a3143' }}>
        {title}
      </p>
      <div className="space-y-2">
        {PIE_FIELDS.map((f) => (
          <div key={f.key}>
            <Label className="text-[11px] text-muted-foreground">{f.label}</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {f.options.map((opt) => {
                const active = data?.[f.key] === opt
                return (
                  <button
                    type="button"
                    key={opt}
                    onClick={() => set(f.key, active ? '' : opt)}
                    className={`rounded border px-2 py-0.5 text-[11px] transition-colors ${
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
        ))}
        <div>
          <Label className="text-[11px] text-muted-foreground">Lesiones / observaciones</Label>
          <Textarea
            rows={2}
            className="mt-1 text-xs"
            value={data?.lesiones || ''}
            onChange={(e) => set('lesiones', e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}

export function ExploracionPodologicaSection({ value, onChange }: Props) {
  const v = value || {}
  const set = (k: keyof NonNullable<HistoriaClinicaInicial['exploracionPodologica']>, val: any) =>
    onChange({ ...v, [k]: val })

  const dedos = v.exploracionUngueal?.dedos || {}

  function toggleDedoPatologia(dedoKey: string, pato: string, checked: boolean) {
    const cur = dedos[dedoKey] || {}
    const next = { ...cur, [pato]: checked }
    set('exploracionUngueal', {
      ...(v.exploracionUngueal || {}),
      dedos: { ...dedos, [dedoKey]: next },
    })
  }

  return (
    <SectionCard number="12" title="Exploración podológica" icon={Footprints} defaultOpen>
      {/* 12.1 Inspección dermatológica */}
      <div>
        <Label className="text-xs uppercase font-semibold text-muted-foreground">
          12.1 Inspección dermatológica
        </Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
          <PieCard
            title="Pie derecho"
            data={v.inspeccionDermatologica?.pieDerecho || {}}
            onChange={(next) =>
              set('inspeccionDermatologica', {
                ...(v.inspeccionDermatologica || {}),
                pieDerecho: next,
              })
            }
          />
          <PieCard
            title="Pie izquierdo"
            data={v.inspeccionDermatologica?.pieIzquierdo || {}}
            onChange={(next) =>
              set('inspeccionDermatologica', {
                ...(v.inspeccionDermatologica || {}),
                pieIzquierdo: next,
              })
            }
          />
        </div>
      </div>

      {/* 12.2 Exploración ungueal */}
      <div>
        <Label className="text-xs uppercase font-semibold text-muted-foreground">
          12.2 Exploración ungueal
        </Label>
        <p className="text-xs text-muted-foreground mt-1">
          Marca las patologías presentes en cada dedo y el grado (I-IV) si aplica.
        </p>
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left p-2">Dedo</th>
                {UNGUEAL_PATOS.map((p) => (
                  <th key={p} className="p-2 text-center">
                    {p}
                  </th>
                ))}
                <th className="p-2 text-center">Grado</th>
              </tr>
            </thead>
            <tbody>
              {DEDOS.map((dedo) => {
                const d = dedos[dedo] || {}
                return (
                  <tr key={dedo} className="border-t">
                    <td className="p-2 font-medium">{dedo}</td>
                    {UNGUEAL_PATOS.map((p) => (
                      <td key={p} className="p-2 text-center">
                        <Checkbox
                          checked={!!d[p]}
                          onCheckedChange={(c) => toggleDedoPatologia(dedo, p, !!c)}
                        />
                      </td>
                    ))}
                    <td className="p-2">
                      <Input
                        className="h-7 text-xs"
                        placeholder="I-IV"
                        value={d.grado || ''}
                        onChange={(e) => {
                          set('exploracionUngueal', {
                            ...(v.exploracionUngueal || {}),
                            dedos: { ...dedos, [dedo]: { ...d, grado: e.target.value } },
                          })
                        }}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 12.3 Exploración vascular */}
      <div>
        <Label className="text-xs uppercase font-semibold text-muted-foreground">
          12.3 Exploración vascular
        </Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
          <div className="rounded-md border p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Pie derecho</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px]">Pulso pedio</Label>
                <select
                  className="mt-1 w-full h-8 rounded border bg-background px-2 text-xs"
                  value={v.exploracionVascular?.pulsoPedioDerecho || ''}
                  onChange={(e) =>
                    set('exploracionVascular', {
                      ...(v.exploracionVascular || {}),
                      pulsoPedioDerecho: e.target.value,
                    })
                  }
                >
                  <option value="">—</option>
                  <option value="Presente">Presente</option>
                  <option value="Disminuido">Disminuido</option>
                  <option value="Ausente">Ausente</option>
                </select>
              </div>
              <div>
                <Label className="text-[11px]">Pulso tibial posterior</Label>
                <select
                  className="mt-1 w-full h-8 rounded border bg-background px-2 text-xs"
                  value={v.exploracionVascular?.pulsoTibialDerecho || ''}
                  onChange={(e) =>
                    set('exploracionVascular', {
                      ...(v.exploracionVascular || {}),
                      pulsoTibialDerecho: e.target.value,
                    })
                  }
                >
                  <option value="">—</option>
                  <option value="Presente">Presente</option>
                  <option value="Disminuido">Disminuido</option>
                  <option value="Ausente">Ausente</option>
                </select>
              </div>
              <div>
                <Label className="text-[11px]">Llenado capilar (s)</Label>
                <Input
                  className="h-8 text-xs"
                  value={v.exploracionVascular?.llenadoCapilarDerecho || ''}
                  onChange={(e) =>
                    set('exploracionVascular', {
                      ...(v.exploracionVascular || {}),
                      llenadoCapilarDerecho: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-[11px]">ITB</Label>
                <Input
                  type="number"
                  step="0.01"
                  className="h-8 text-xs"
                  value={v.exploracionVascular?.itbDerecho ?? ''}
                  onChange={(e) =>
                    set('exploracionVascular', {
                      ...(v.exploracionVascular || {}),
                      itbDerecho: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                />
              </div>
            </div>
          </div>
          <div className="rounded-md border p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Pie izquierdo</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px]">Pulso pedio</Label>
                <select
                  className="mt-1 w-full h-8 rounded border bg-background px-2 text-xs"
                  value={v.exploracionVascular?.pulsoPedioIzquierdo || ''}
                  onChange={(e) =>
                    set('exploracionVascular', {
                      ...(v.exploracionVascular || {}),
                      pulsoPedioIzquierdo: e.target.value,
                    })
                  }
                >
                  <option value="">—</option>
                  <option value="Presente">Presente</option>
                  <option value="Disminuido">Disminuido</option>
                  <option value="Ausente">Ausente</option>
                </select>
              </div>
              <div>
                <Label className="text-[11px]">Pulso tibial posterior</Label>
                <select
                  className="mt-1 w-full h-8 rounded border bg-background px-2 text-xs"
                  value={v.exploracionVascular?.pulsoTibialIzquierdo || ''}
                  onChange={(e) =>
                    set('exploracionVascular', {
                      ...(v.exploracionVascular || {}),
                      pulsoTibialIzquierdo: e.target.value,
                    })
                  }
                >
                  <option value="">—</option>
                  <option value="Presente">Presente</option>
                  <option value="Disminuido">Disminuido</option>
                  <option value="Ausente">Ausente</option>
                </select>
              </div>
              <div>
                <Label className="text-[11px]">Llenado capilar (s)</Label>
                <Input
                  className="h-8 text-xs"
                  value={v.exploracionVascular?.llenadoCapilarIzquierdo || ''}
                  onChange={(e) =>
                    set('exploracionVascular', {
                      ...(v.exploracionVascular || {}),
                      llenadoCapilarIzquierdo: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-[11px]">ITB</Label>
                <Input
                  type="number"
                  step="0.01"
                  className="h-8 text-xs"
                  value={v.exploracionVascular?.itbIzquierdo ?? ''}
                  onChange={(e) =>
                    set('exploracionVascular', {
                      ...(v.exploracionVascular || {}),
                      itbIzquierdo: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                />
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Edema</Label>
            <select
              className="mt-1 w-full h-8 rounded border bg-background px-2 text-xs"
              value={v.exploracionVascular?.edema || ''}
              onChange={(e) =>
                set('exploracionVascular', { ...(v.exploracionVascular || {}), edema: e.target.value })
              }
            >
              <option value="">—</option>
              <option value="Ausente">Ausente</option>
              <option value="Leve">Leve</option>
              <option value="Moderado">Moderado</option>
              <option value="Severo">Severo</option>
            </select>
          </div>
        </div>
      </div>

      {/* 12.4 Exploración neurológica */}
      <div>
        <Label className="text-xs uppercase font-semibold text-muted-foreground">
          12.4 Exploración neurológica
        </Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
          <div className="rounded-md border p-2">
            <Label className="text-[11px]">Monofilamento (pie derecho)</Label>
            <select
              className="mt-1 w-full h-8 rounded border bg-background px-2 text-xs"
              value={v.exploracionNeurologica?.monofilamentoDerecho || ''}
              onChange={(e) =>
                set('exploracionNeurologica', {
                  ...(v.exploracionNeurologica || {}),
                  monofilamentoDerecho: e.target.value,
                })
              }
            >
              <option value="">—</option>
              <option value="Normal (10 puntos)">Normal (10 puntos)</option>
              <option value="Disminuido (7-9)">Disminuido (7-9)</option>
              <option value="Ausente (&lt;7)">Ausente (&lt;7)</option>
            </select>
          </div>
          <div className="rounded-md border p-2">
            <Label className="text-[11px]">Monofilamento (pie izquierdo)</Label>
            <select
              className="mt-1 w-full h-8 rounded border bg-background px-2 text-xs"
              value={v.exploracionNeurologica?.monofilamentoIzquierdo || ''}
              onChange={(e) =>
                set('exploracionNeurologica', {
                  ...(v.exploracionNeurologica || {}),
                  monofilamentoIzquierdo: e.target.value,
                })
              }
            >
              <option value="">—</option>
              <option value="Normal (10 puntos)">Normal (10 puntos)</option>
              <option value="Disminuido (7-9)">Disminuido (7-9)</option>
              <option value="Ausente (&lt;7)">Ausente (&lt;7)</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Sensibilidad general</Label>
            <Input
              className="h-8 text-xs mt-1"
              value={v.exploracionNeurologica?.sensibilidad || ''}
              onChange={(e) =>
                set('exploracionNeurologica', {
                  ...(v.exploracionNeurologica || {}),
                  sensibilidad: e.target.value,
                })
              }
            />
          </div>
          <label className="flex items-center gap-2 rounded border px-2 h-9 mt-5 text-sm cursor-pointer">
            <Checkbox
              checked={!!v.exploracionNeurologica?.parestesias}
              onCheckedChange={(c) =>
                set('exploracionNeurologica', {
                  ...(v.exploracionNeurologica || {}),
                  parestesias: !!c,
                })
              }
            />
            Parestesias
          </label>
        </div>
      </div>

      {/* 12.5 Exploración musculoesquelética */}
      <div>
        <Label className="text-xs uppercase font-semibold text-muted-foreground">
          12.5 Exploración musculoesquelética
        </Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Tipo de pie</Label>
            <select
              className="mt-1 w-full h-8 rounded border bg-background px-2 text-xs"
              value={v.exploracionMusculoesqueletica?.tipoPie || ''}
              onChange={(e) =>
                set('exploracionMusculoesqueletica', {
                  ...(v.exploracionMusculoesqueletica || {}),
                  tipoPie: e.target.value,
                })
              }
            >
              <option value="">—</option>
              <option value="Normal">Normal</option>
              <option value="Plano">Plano</option>
              <option value="Cavo">Cavo</option>
              <option value="Equino">Equino</option>
              <option value="Valgo">Valgo</option>
              <option value="Varo">Varo</option>
            </select>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Arco</Label>
            <select
              className="mt-1 w-full h-8 rounded border bg-background px-2 text-xs"
              value={v.exploracionMusculoesqueletica?.arco || ''}
              onChange={(e) =>
                set('exploracionMusculoesqueletica', {
                  ...(v.exploracionMusculoesqueletica || {}),
                  arco: e.target.value,
                })
              }
            >
              <option value="">—</option>
              <option value="Normal">Normal</option>
              <option value="Disminuido">Disminuido</option>
              <option value="Aumentado">Aumentado</option>
              <option value="Ausente">Ausente</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-[11px] text-muted-foreground">Deformidades</Label>
            <Input
              className="h-8 text-xs mt-1"
              placeholder="Hallux valgus, dedos en garra, juanete..."
              value={v.exploracionMusculoesqueletica?.deformidades || ''}
              onChange={(e) =>
                set('exploracionMusculoesqueletica', {
                  ...(v.exploracionMusculoesqueletica || {}),
                  deformidades: e.target.value,
                })
              }
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Dolor a la palpación</Label>
            <Input
              className="h-8 text-xs mt-1"
              value={v.exploracionMusculoesqueletica?.dolor || ''}
              onChange={(e) =>
                set('exploracionMusculoesqueletica', {
                  ...(v.exploracionMusculoesqueletica || {}),
                  dolor: e.target.value,
                })
              }
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">ROM (rango de movimiento)</Label>
            <Input
              className="h-8 text-xs mt-1"
              value={v.exploracionMusculoesqueletica?.rom || ''}
              onChange={(e) =>
                set('exploracionMusculoesqueletica', {
                  ...(v.exploracionMusculoesqueletica || {}),
                  rom: e.target.value,
                })
              }
            />
          </div>
        </div>
      </div>
    </SectionCard>
  )
}
