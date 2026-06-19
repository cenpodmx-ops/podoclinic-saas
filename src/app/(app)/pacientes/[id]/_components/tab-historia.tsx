'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Pencil, Loader2, Printer } from 'lucide-react'
import { toast } from 'sonner'
import type { Patient } from './types'

function FieldEditor({
  label,
  value,
  onSaved,
  patientId,
  field,
}: {
  label: string
  value: string | null
  patientId: string
  field: keyof Patient
  onSaved: () => void
}) {
  const [edit, setEdit] = useState(false)
  const [text, setText] = useState(value || '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/pacientes/${patientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: text }),
      })
      if (!res.ok) throw new Error('Error al guardar')
      toast.success('Antecedente guardado')
      setEdit(false)
      onSaved()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
        {!edit ? (
          <Button variant="ghost" size="sm" onClick={() => { setText(value || ''); setEdit(true) }}>
            <Pencil className="h-3 w-3" /> Editar
          </Button>
        ) : (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => setEdit(false)}>Cancelar</Button>
            <Button size="sm" disabled={saving} onClick={save} style={{ backgroundColor: '#0a3143' }}>
              {saving && <Loader2 className="h-3 w-3 animate-spin" />} Guardar
            </Button>
          </div>
        )}
      </div>
      {!edit ? (
        <p className="text-sm whitespace-pre-wrap min-h-[2.5rem] rounded-md border bg-muted/30 p-2">
          {value || <span className="text-muted-foreground italic">Sin registros.</span>}
        </p>
      ) : (
        <Textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Captura ${label.toLowerCase()}...`}
        />
      )}
    </div>
  )
}

export function TabHistoria({ patient, onUpdate }: { patient: Patient; onUpdate?: () => void }) {
  function printHistoria() {
    const w = window.open('', '_blank', 'width=800,height=900')
    if (!w) {
      toast.error('Habilita las ventanas emergentes para imprimir.')
      return
    }
    const html = `
      <!DOCTYPE html>
      <html><head><title>Historia clínica — ${patient.firstName} ${patient.lastName}</title>
      <style>
        body { font-family: -apple-system, system-ui, sans-serif; padding: 32px; color: #1a1a1a; }
        h1 { color: #0a3143; font-size: 18px; margin-bottom: 4px; }
        h2 { color: #0a3143; font-size: 13px; margin-top: 20px; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
        .meta { font-size: 12px; color: #666; margin-bottom: 16px; }
        .field { margin-bottom: 12px; }
        .field-label { font-size: 10px; text-transform: uppercase; color: #888; letter-spacing: 0.05em; }
        .field-value { font-size: 13px; white-space: pre-wrap; }
        hr { border: none; border-top: 1px solid #ddd; margin: 16px 0; }
      </style></head>
      <body>
        <h1>Historia Clínica</h1>
        <p class="meta">
          <strong>${patient.firstName} ${patient.lastName}</strong> ·
          Exp. ${patient.expNumber} ·
          ${patient.birthDate ? `Fecha de nacimiento: ${new Date(patient.birthDate).toLocaleDateString('es-MX')}` : ''}
          ${patient.sex ? ` · Sexo: ${patient.sex === 'M' ? 'Mujer' : patient.sex === 'H' ? 'Hombre' : 'Otro'}` : ''}
        </p>
        <hr/>
        <h2>Antecedentes hereditarios</h2>
        <div class="field-value">${patient.antecedentsHereditary || '—'}</div>
        <h2>Antecedentes personales patológicos</h2>
        <div class="field-value">${patient.antecedentsPathologic || '—'}</div>
        <h2>Antecedentes personales no patológicos</h2>
        <div class="field-value">${patient.antecedentsNonPathologic || '—'}</div>
        <h2>Exploración física inicial</h2>
        <div class="field-value">${patient.physicalExploration || '—'}</div>
        <script>window.onload = () => window.print()</script>
      </body></html>
    `
    w.document.write(html)
    w.document.close()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={printHistoria}>
          <Printer className="h-4 w-4" /> Imprimir historia
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Antecedentes hereditarios</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldEditor label="" value={patient.antecedentsHereditary} patientId={patient.id} field="antecedentsHereditary" onSaved={() => onUpdate?.()} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Antecedentes personales patológicos</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldEditor label="" value={patient.antecedentsPathologic} patientId={patient.id} field="antecedentsPathologic" onSaved={() => onUpdate?.()} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Antecedentes personales no patológicos</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldEditor label="" value={patient.antecedentsNonPathologic} patientId={patient.id} field="antecedentsNonPathologic" onSaved={() => onUpdate?.()} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Exploración física inicial</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldEditor label="" value={patient.physicalExploration} patientId={patient.id} field="physicalExploration" onSaved={() => onUpdate?.()} />
        </CardContent>
      </Card>
    </div>
  )
}
