'use client'

/**
 * Tab 3 — Exploración podológica (acceso rápido).
 * Muestra la última exploración de la historia clínica y permite editarla.
 */
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Save, Pencil, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { ExploracionPodologicaSection } from './exploracion-podologica-section'
import type { HistoriaClinicaInicial, Patient } from './types'

export function ExploracionPodologicaTab({ patient }: { patient: Patient }) {
  const { data: hcData, isLoading } = useQuery<{ historiaClinicaInicial?: HistoriaClinicaInicial }>({
    queryKey: ['historia-clinica', patient.id],
    queryFn: () =>
      fetch(`/api/pacientes/${patient.id}/historia-clinica`)
        .then((r) => r.json())
        .then((d) => d?.data || d || {}),
    enabled: !!patient.id,
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <ExploracionBody
      key={hcData ? 'loaded' : 'empty'}
      patient={patient}
      initial={hcData?.historiaClinicaInicial?.exploracionPodologica || {}}
      hcFull={hcData?.historiaClinicaInicial || {}}
    />
  )
}

function ExploracionBody({
  patient,
  initial,
  hcFull,
}: {
  patient: Patient
  initial: HistoriaClinicaInicial['exploracionPodologica']
  hcFull: HistoriaClinicaInicial
}) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [local, setLocal] = useState<HistoriaClinicaInicial['exploracionPodologica']>(initial || {})
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/pacientes/${patient.id}/historia-clinica`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...hcFull,
          exploracionPodologica: local,
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'Error al guardar')
      }
      toast.success('Exploración podológica guardada')
      setEditing(false)
      qc.invalidateQueries({ queryKey: ['historia-clinica', patient.id] })
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-3 rounded-md border bg-muted/30">
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="outline" style={{ color: '#0a3143' }}>
            Sección 12 NOM-004
          </Badge>
          <span className="text-muted-foreground text-xs">
            Exploración podológica del expediente. Edita o re-explora al paciente.
          </span>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={save} disabled={saving} style={{ backgroundColor: '#0a3143' }}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" />{' '}
              {local && Object.keys(local).length > 0 ? 'Re-explorar' : 'Capturar exploración'}
            </Button>
          )}
        </div>
      </div>

      {editing ? (
        <ExploracionPodologicaSection value={local} onChange={setLocal} />
      ) : (
        <>
          {!local || Object.keys(local).length === 0 ? (
            <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
              <Eye className="h-6 w-6 mx-auto mb-2 opacity-50" />
              Sin exploración podológica registrada. Haz clic en "Capturar exploración".
            </div>
          ) : (
            <ExploracionPodologicaSection value={local} onChange={() => {}} />
          )}
        </>
      )}
    </div>
  )
}
