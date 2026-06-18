'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Pencil, Loader2, Phone, Mail, MapPin, Calendar, User, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { fmtDate, fmtMoney } from '@/lib/format'
import type { Patient } from './types'
import { PatientFormDialog } from '@/components/cenpod/patient-form-dialog'

const RISK_BADGE: Record<string, string> = {
  BAJO: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  MEDIO: 'bg-amber-100 text-amber-800 border-amber-300',
  ALTO: 'bg-red-100 text-red-800 border-red-300',
}

function DataField({ label, value, icon: Icon }: { label: string; value?: string | null; icon?: any }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </p>
      <p className="text-sm font-medium">{value || '—'}</p>
    </div>
  )
}

export function TabResumen({ patient, onUpdate }: { patient: Patient; onUpdate?: () => void }) {
  const [editOpen, setEditOpen] = useState(false)
  const [savingRisk, setSavingRisk] = useState(false)
  const [summaryEdit, setSummaryEdit] = useState(false)
  const [summaryText, setSummaryText] = useState(patient.clinicalSummary || '')
  const [notesEdit, setNotesEdit] = useState(false)
  const [notesText, setNotesText] = useState(patient.generalNotes || '')
  const [savingSummary, setSavingSummary] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)

  async function patchField(data: Record<string, any>, label: string, savingStateSetter?: (b: boolean) => void) {
    if (savingStateSetter) savingStateSetter(true)
    try {
      const res = await fetch(`/api/pacientes/${patient.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'Error al guardar')
      }
      toast.success(label)
      onUpdate?.()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      if (savingStateSetter) savingStateSetter(false)
    }
  }

  const age = patient.birthDate
    ? Math.floor((Date.now() - new Date(patient.birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : null

  return (
    <div className="space-y-4">
      {/* Datos personales */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" /> Datos personales
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3 w-3" /> Editar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <DataField label="Expediente" value={patient.expNumber} icon={FileText} />
          <DataField label="Fecha de nacimiento" value={patient.birthDate ? `${fmtDate(patient.birthDate)}${age !== null ? ` (${age} años)` : ''}` : null} icon={Calendar} />
          <DataField label="Sexo" value={patient.sex === 'M' ? 'Mujer' : patient.sex === 'H' ? 'Hombre' : patient.sex === 'O' ? 'Otro' : null} />
          <DataField label="Teléfono" value={patient.phone} icon={Phone} />
          <DataField label="Correo" value={patient.email} icon={Mail} />
          <DataField label="CURP" value={patient.curp} />
          <DataField label="RFC" value={patient.rfc} />
          <DataField label="Dirección" value={patient.address} icon={MapPin} />
          <DataField label="Paciente desde" value={fmtDate(patient.createdAt)} icon={Calendar} />
        </CardContent>
      </Card>

      {/* Riesgo podológico + datos clínicos básicos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Riesgo podológico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={RISK_BADGE[patient.riskLevel || ''] || 'bg-muted text-muted-foreground'}>
                {patient.riskLevel || 'Sin clasificar'}
              </Badge>
            </div>
            <div>
              <Label className="text-xs">Cambiar nivel</Label>
              <Select
                value={patient.riskLevel || ''}
                onValueChange={async (v) => {
                  await patchField({ riskLevel: v }, 'Riesgo actualizado', setSavingRisk)
                }}
                disabled={savingRisk}
              >
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Selecciona..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BAJO">Bajo</SelectItem>
                  <SelectItem value="MEDIO">Medio</SelectItem>
                  <SelectItem value="ALTO">Alto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-md border p-2">
              <Label className="cursor-pointer text-sm">Paciente diabético</Label>
              <Switch
                checked={patient.isDiabetic}
                onCheckedChange={(v) => patchField({ isDiabetic: v }, 'Alerta diabético actualizada')}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Resumen clínico</span>
              {!summaryEdit ? (
                <Button variant="ghost" size="sm" onClick={() => { setSummaryText(patient.clinicalSummary || ''); setSummaryEdit(true) }}>
                  <Pencil className="h-3 w-3" /> Editar
                </Button>
              ) : (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setSummaryEdit(false)}>Cancelar</Button>
                  <Button
                    size="sm"
                    disabled={savingSummary}
                    onClick={() => patchField({ clinicalSummary: summaryText }, 'Resumen guardado', setSavingSummary).then(() => setSummaryEdit(false))}
                    style={{ backgroundColor: '#0a3143' }}
                  >
                    {savingSummary && <Loader2 className="h-3 w-3 animate-spin" />} Guardar
                  </Button>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!summaryEdit ? (
              <p className="text-sm whitespace-pre-wrap min-h-[3rem]">
                {patient.clinicalSummary || <span className="text-muted-foreground">Sin resumen clínico.</span>}
              </p>
            ) : (
              <Textarea
                rows={4}
                value={summaryText}
                onChange={(e) => setSummaryText(e.target.value)}
                placeholder="Resumen del estado clínico del paciente, evolución, observaciones generales..."
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Datos fiscales */}
      {(patient.razonSocial || patient.rfc || patient.regimenFiscal || patient.cfdiUso || patient.emailFactura) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Datos fiscales</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <DataField label="Razón social" value={patient.razonSocial} />
            <DataField label="RFC" value={patient.rfc} />
            <DataField label="Régimen fiscal" value={patient.regimenFiscal} />
            <DataField label="Uso CFDI" value={patient.cfdiUso} />
            <DataField label="Correo de factura" value={patient.emailFactura} />
          </CardContent>
        </Card>
      )}

      {/* Notas generales */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Notas generales</span>
            {!notesEdit ? (
              <Button variant="ghost" size="sm" onClick={() => { setNotesText(patient.generalNotes || ''); setNotesEdit(true) }}>
                <Pencil className="h-3 w-3" /> Editar
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setNotesEdit(false)}>Cancelar</Button>
                <Button
                  size="sm"
                  disabled={savingNotes}
                  onClick={() => patchField({ generalNotes: notesText }, 'Notas guardadas', setSavingNotes).then(() => setNotesEdit(false))}
                  style={{ backgroundColor: '#0a3143' }}
                >
                  {savingNotes && <Loader2 className="h-3 w-3 animate-spin" />} Guardar
                </Button>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!notesEdit ? (
            <p className="text-sm whitespace-pre-wrap min-h-[3rem]">
              {patient.generalNotes || <span className="text-muted-foreground">Sin notas.</span>}
            </p>
          ) : (
            <Textarea
              rows={4}
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder="Observaciones, preferencias del paciente..."
            />
          )}
        </CardContent>
      </Card>

      <PatientFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        patient={patient}
        onSaved={() => {
          onUpdate?.()
        }}
      />
    </div>
  )
}
