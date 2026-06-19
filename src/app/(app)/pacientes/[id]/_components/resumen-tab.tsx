'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Pencil, Loader2, Phone, Mail, MapPin, Calendar, User, FileText, Droplet, AlertTriangle, Pill, HeartPulse, CalendarClock, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { fmtDate, fmtMoney } from '@/lib/format'
import type { Patient } from './types'
import { PatientFormDialog } from '@/components/cenpod/patient-form-dialog'

const RISK_BADGE: Record<string, string> = {
  BAJO: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  MEDIO: 'bg-amber-100 text-amber-800 border-amber-300',
  MODERADO: 'bg-amber-100 text-amber-800 border-amber-300',
  ALTO: 'bg-red-100 text-red-800 border-red-300',
  URGENTE: 'bg-red-600 text-white border-red-700',
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

export function ResumenTab({
  patient,
  onEdit,
  onGoToTab,
}: {
  patient: Patient
  onEdit: () => void
  onGoToTab: (tab: string) => void
}) {
  const qc = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [savingRisk, setSavingRisk] = useState(false)
  const { data: alertas } = useQuery<any[]>({
    queryKey: ['paciente-alertas', patient.id],
    queryFn: () =>
      fetch(`/api/pacientes/${patient.id}/alertas`)
        .then((r) => r.json())
        .then((d) => (Array.isArray(d) ? d : d?.data || []))
        .catch(() => []),
    retry: false,
  })

  const age = patient.birthDate
    ? Math.floor((Date.now() - new Date(patient.birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : null

  const ultimaConsulta = patient.consultations?.[0]
  const proximaCita = patient.appointments?.find(
    (a) => new Date(a.startTime).getTime() > Date.now() && a.status !== 'CANCELADA',
  )
  const hc = patient.historiaClinicaInicial
  const diagnosticosActivos =
    hc?.diagnosticos?.diagnosticoPrincipal || (hc?.diagnosticos?.secundarios?.length || 0) > 0

  async function patchRisk(v: string) {
    setSavingRisk(true)
    try {
      const res = await fetch(`/api/pacientes/${patient.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ riskLevel: v }),
      })
      if (!res.ok) throw new Error('Error al guardar')
      toast.success('Riesgo actualizado')
      qc.invalidateQueries({ queryKey: ['paciente', patient.id] })
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSavingRisk(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Datos personales + edición */}
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
          <DataField
            label="Fecha nacimiento"
            value={patient.birthDate ? `${fmtDate(patient.birthDate)}${age !== null ? ` (${age} años)` : ''}` : null}
            icon={Calendar}
          />
          <DataField
            label="Sexo"
            value={
              patient.sex === 'M' ? 'Mujer' : patient.sex === 'H' ? 'Hombre' : patient.sex === 'O' ? 'Otro' : null
            }
          />
          <DataField label="Teléfono" value={patient.phone} icon={Phone} />
          <DataField label="Correo" value={patient.email} icon={Mail} />
          <DataField label="CURP" value={patient.curp} />
          <DataField label="RFC" value={patient.rfc} />
          <DataField label="Dirección" value={patient.address} icon={MapPin} />
          <DataField label="Paciente desde" value={fmtDate(patient.createdAt)} icon={Calendar} />
        </CardContent>
      </Card>

      {/* Cuadrícula resumen clínico */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Alergias y condiciones */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Salud / alertas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between rounded-md border p-2">
              <span className="text-sm flex items-center gap-2">
                <Droplet className={`h-4 w-4 ${patient.isDiabetic ? 'text-red-600' : 'text-muted-foreground'}`} />
                Diabético
              </span>
              <Badge variant="outline" className={patient.isDiabetic ? 'bg-red-600 text-white border-red-700' : ''}>
                {patient.isDiabetic ? 'SÍ' : 'NO'}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border p-2">
              <span className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                Alergias
              </span>
              <Badge variant="outline" className={patient.allergies ? 'bg-orange-100 text-orange-800 border-orange-300' : ''}>
                {patient.allergies ? 'SÍ' : 'NO'}
              </Badge>
            </div>
            {patient.allergies && (
              <p className="text-xs text-muted-foreground pl-2">{patient.allergies}</p>
            )}
            <div className="flex items-center justify-between rounded-md border p-2">
              <span className="text-sm flex items-center gap-2">
                <Pill className="h-4 w-4 text-amber-600" />
                Anticoagulantes
              </span>
              <Badge variant="outline">
                {hc?.antecedentesPatologicos?.anticoagulantes &&
                (hc.antecedentesPatologicos.anticoagulantes.warfarina ||
                  hc.antecedentesPatologicos.anticoagulantes.aspirina ||
                  hc.antecedentesPatologicos.anticoagulantes.clopidogrel)
                  ? 'SÍ'
                  : 'NO'}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border p-2">
              <span className="text-sm flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-rose-600" />
                Cond. crónicas
              </span>
              <Badge variant="outline" className={patient.chronicConditions ? 'bg-rose-50 text-rose-800 border-rose-300' : ''}>
                {patient.chronicConditions ? 'SÍ' : 'NO'}
              </Badge>
            </div>
            {patient.chronicConditions && (
              <p className="text-xs text-muted-foreground pl-2">{patient.chronicConditions}</p>
            )}
          </CardContent>
        </Card>

        {/* Riesgo podológico */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Riesgo podológico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={RISK_BADGE[patient.riskLevel || ''] || 'bg-muted text-muted-foreground'}
              >
                {patient.riskLevel || 'Sin clasificar'}
              </Badge>
              {hc?.evaluacionRiesgo?.requiereReferencia && (
                <Badge variant="outline" className="bg-red-600 text-white border-red-700">
                  Referencia
                </Badge>
              )}
            </div>
            {hc?.evaluacionRiesgo?.justificacion && (
              <p className="text-xs text-muted-foreground">{hc.evaluacionRiesgo.justificacion}</p>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Cambiar nivel</p>
              <Select
                value={patient.riskLevel || ''}
                onValueChange={patchRisk}
                disabled={savingRisk}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BAJO">Bajo</SelectItem>
                  <SelectItem value="MODERADO">Moderado</SelectItem>
                  <SelectItem value="ALTO">Alto</SelectItem>
                  <SelectItem value="URGENTE">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {savingRisk && <Loader2 className="h-3 w-3 animate-spin" />}
          </CardContent>
        </Card>

        {/* Actividad reciente */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Actividad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <button
              onClick={() => onGoToTab('evoluciones')}
              className="w-full text-left rounded-md border p-2 hover:bg-muted/40 transition-colors"
            >
              <p className="text-[10px] uppercase text-muted-foreground">Última consulta</p>
              {ultimaConsulta ? (
                <>
                  <p className="font-medium">{fmtDate(ultimaConsulta.date)}</p>
                  <p className="text-xs text-muted-foreground">
                    {ultimaConsulta.podologist?.name} · {ultimaConsulta.reason || 'Sin motivo'}
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Sin consultas</p>
              )}
            </button>
            <button
              onClick={() => onGoToTab('citas')}
              className="w-full text-left rounded-md border p-2 hover:bg-muted/40 transition-colors flex items-center justify-between"
            >
              <div>
                <p className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                  <CalendarClock className="h-3 w-3" /> Próxima cita
                </p>
                {proximaCita ? (
                  <>
                    <p className="font-medium">{fmtDate(proximaCita.date)}</p>
                    <p className="text-xs text-muted-foreground">{proximaCita.podologist?.name}</p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Sin próxima cita</p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="rounded-md border p-2">
              <p className="text-[10px] uppercase text-muted-foreground">Total gastado</p>
              <p className="font-bold" style={{ color: '#0a3143' }}>
                {fmtMoney(patient.totalSpent)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Diagnósticos activos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Diagnósticos activos</span>
            <Button variant="ghost" size="sm" onClick={() => onGoToTab('diagnosticos')}>
              Ver / editar <ChevronRight className="h-3 w-3" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!diagnosticosActivos ? (
            <p className="text-sm text-muted-foreground">
              Sin diagnósticos capturados en la historia clínica inicial.
            </p>
          ) : (
            <div className="space-y-2">
              {hc?.diagnosticos?.diagnosticoPrincipal && (
                <div className="rounded-md border p-2">
                  <p className="text-[10px] uppercase text-muted-foreground">Principal</p>
                  <p className="font-medium">{hc.diagnosticos.diagnosticoPrincipal}</p>
                  {(hc.diagnosticos.cie10 || hc.diagnosticos.lateralidad || hc.diagnosticos.region) && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[hc.diagnosticos.cie10, hc.diagnosticos.lateralidad, hc.diagnosticos.region]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                </div>
              )}
              {hc?.diagnosticos?.secundarios && hc.diagnosticos.secundarios.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground mb-1">Secundarios</p>
                  <div className="flex flex-wrap gap-1.5">
                    {hc.diagnosticos.secundarios.map((d) => (
                      <Badge key={d} variant="outline" style={{ color: '#0a3143' }}>
                        {d}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alertas clínicas (si existen) */}
      {alertas && alertas.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" /> Alertas clínicas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alertas.map((a, i) => (
              <div
                key={i}
                className={`rounded-md p-2 text-sm ${
                  a.level === 'RED'
                    ? 'bg-red-600 text-white'
                    : a.level === 'ORANGE'
                      ? 'bg-orange-100 text-orange-900'
                      : 'bg-yellow-100 text-yellow-900'
                }`}
              >
                <p className="font-bold">{a.title}</p>
                {a.description && <p className="text-xs opacity-90">{a.description}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Datos fiscales si existen */}
      {(patient.razonSocial || patient.rfc || patient.regimenFiscal) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Datos fiscales</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <DataField label="Razón social" value={patient.razonSocial} />
            <DataField label="RFC" value={patient.rfc} />
            <DataField label="Régimen" value={patient.regimenFiscal} />
          </CardContent>
        </Card>
      )}

      <PatientFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        patient={patient}
        onSaved={() => {
          onEdit()
          qc.invalidateQueries({ queryKey: ['paciente', patient.id] })
        }}
      />
    </div>
  )
}
