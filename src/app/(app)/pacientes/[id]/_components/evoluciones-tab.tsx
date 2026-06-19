'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { ChevronDown, ChevronRight, Loader2, Stethoscope, Plus, Pencil, Save } from 'lucide-react'
import { toast } from 'sonner'
import { fmtDate, fmtDateTime } from '@/lib/format'
import type { Patient, ConsultationRow } from './types'

type Soap = { S?: string; O?: string; A?: string; P?: string }

function parseSoap(json?: string | null): Soap {
  if (!json) return {}
  try {
    return JSON.parse(json)
  } catch {
    return {}
  }
}

function ConsultaCard({
  c,
  patientName,
  onEdit,
}: {
  c: ConsultationRow
  patientName: string
  onEdit: (c: ConsultationRow) => void
}) {
  const [open, setOpen] = useState(false)
  const soap = parseSoap(c.soapJson)
  const hasSoap = !!(soap.S || soap.O || soap.A || soap.P)

  return (
    <div className="rounded-md border">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left p-3 flex items-center justify-between hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {c.reason || 'Evolución sin motivo registrado'}
            </p>
            <p className="text-xs text-muted-foreground">
              {fmtDate(c.date)} · {c.podologist?.name || 'Sin podólogo'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasSoap ? (
            <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300">
              Con SOAP
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">
              Sin SOAP
            </Badge>
          )}
        </div>
      </button>
      {open && (
        <div className="border-t p-3 bg-muted/20 space-y-2">
          {hasSoap ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              {soap.S && (
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">S — Subjetivo</p>
                  <p className="whitespace-pre-wrap">{soap.S}</p>
                </div>
              )}
              {soap.O && (
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">O — Objetivo</p>
                  <p className="whitespace-pre-wrap">{soap.O}</p>
                </div>
              )}
              {soap.A && (
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">A — Análisis</p>
                  <p className="whitespace-pre-wrap">{soap.A}</p>
                </div>
              )}
              {soap.P && (
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">P — Plan</p>
                  <p className="whitespace-pre-wrap">{soap.P}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Esta consulta no tiene nota SOAP. Puedes agregarla.
            </p>
          )}
          {c.diagnosis && (
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Diagnóstico</p>
              <p className="text-sm">{c.diagnosis}</p>
            </div>
          )}
          {c.notes && (
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Notas</p>
              <p className="text-sm whitespace-pre-wrap">{c.notes}</p>
            </div>
          )}
          <div className="text-[10px] text-muted-foreground pt-1 border-t">
            Creada: {fmtDateTime(c.createdAt)}
          </div>
          <Button size="sm" variant="outline" onClick={() => onEdit(c)}>
            <Pencil className="h-3 w-3" /> {hasSoap ? 'Editar nota SOAP' : 'Agregar nota SOAP'}
          </Button>
        </div>
      )}
      {/* hide unused var */}
      <span className="hidden">{patientName}</span>
    </div>
  )
}

function SoapEditor({
  consult,
  onClose,
  onSaved,
}: {
  consult: ConsultationRow
  onClose: () => void
  onSaved: () => void
}) {
  const [soap, setSoap] = useState<Soap>(parseSoap(consult.soapJson))
  const [saving, setSaving] = useState(false)
  const qc = useQueryClient()

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/consultas/${consult.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ soapJson: JSON.stringify(soap) }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'Error al guardar')
      }
      toast.success('Nota SOAP guardada')
      qc.invalidateQueries({ queryKey: ['paciente', consult.patientId || ''] })
      onSaved()
      onClose()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nota de evolución SOAP</DialogTitle>
          <DialogDescription>
            Consulta del {fmtDate(consult.date)} · {consult.podologist?.name || 'Sin podólogo'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs uppercase font-semibold text-blue-700">
              S — Subjetivo (lo que dice el paciente)
            </Label>
            <Textarea
              rows={3}
              className="mt-1"
              value={soap.S || ''}
              onChange={(e) => setSoap({ ...soap, S: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs uppercase font-semibold text-emerald-700">
              O — Objetivo (hallazgos de la exploración)
            </Label>
            <Textarea
              rows={3}
              className="mt-1"
              value={soap.O || ''}
              onChange={(e) => setSoap({ ...soap, O: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs uppercase font-semibold text-amber-700">
              A — Análisis (diagnóstico / evolución)
            </Label>
            <Textarea
              rows={3}
              className="mt-1"
              value={soap.A || ''}
              onChange={(e) => setSoap({ ...soap, A: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs uppercase font-semibold text-rose-700">
              P — Plan (tratamiento / indicaciones)
            </Label>
            <Textarea
              rows={3}
              className="mt-1"
              value={soap.P || ''}
              onChange={(e) => setSoap({ ...soap, P: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving} style={{ backgroundColor: '#0a3143' }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar SOAP
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function EvolucionesTab({ patient }: { patient: Patient }) {
  const [editing, setEditing] = useState<ConsultationRow | null>(null)
  const consults = patient.consultations || []
  const fullName = `${patient.firstName} ${patient.lastName}`

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground flex items-center gap-1">
          <Stethoscope className="h-4 w-4" /> {consults.length} evolución(es)
        </p>
        <a href="/consulta">
          <Button size="sm" style={{ backgroundColor: '#0a3143' }}>
            <Plus className="h-4 w-4" /> Nueva evolución
          </Button>
        </a>
      </div>

      {consults.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Sin evoluciones registradas.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {consults.map((c) => (
            <ConsultaCard
              key={c.id}
              c={c}
              patientName={fullName}
              onEdit={(cc) => setEditing(cc)}
            />
          ))}
        </div>
      )}

      {editing && (
        <SoapEditor
          consult={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            /* invalidate via parent refetch */
          }}
        />
      )}
    </div>
  )
}
