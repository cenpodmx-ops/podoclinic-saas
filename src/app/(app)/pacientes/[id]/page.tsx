'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft,
  Phone,
  Mail,
  MessageCircle,
  Pencil,
  CalendarPlus,
  Loader2,
  UserCircle,
  FileText,
  Activity,
  ClipboardList,
  Stethoscope,
  FileSignature,
  Camera,
  FolderOpen,
  FileUp,
  History,
  ClipboardCheck,
  ShieldAlert,
  Printer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { PatientFormDialog } from '@/components/cenpod/patient-form-dialog'
import type { Patient } from './_components/types'
import { HealthAlerts } from './_components/health-alerts'
import { EncabezadoInstitucional } from './_components/encabezado-institucional'
import { AlertasBanner } from './_components/alertas-banner'
import { ResumenTab } from './_components/resumen-tab'
import { HistoriaClinicaForm } from './_components/historia-clinica-form'
import { ExploracionPodologicaTab } from './_components/exploracion-podologica-tab'
import { DiagnosticosSection } from './_components/diagnosticos-section'
import { ProcedimientosTab } from './_components/procedimientos-tab'
import { EvolucionesTab } from './_components/evoluciones-tab'
import { RecetasIndicacionesTab } from './_components/recetas-indicaciones-tab'
import { ConsentimientosTab } from './_components/consentimientos-tab'
import { FotografiasTab } from './_components/fotografias-tab'
import { ArchivosTab } from './_components/archivos-tab'
import { ReferenciasTab } from './_components/referencias-tab'
import { AuditoriaTab } from './_components/auditoria-tab'

function whatsappHref(phone: string | null, name: string) {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10) return null
  const num = digits.startsWith('52') ? digits : `52${digits}`
  const text = encodeURIComponent(`Hola ${name}, te contactamos de CENPOD.`)
  return `https://wa.me/${num}?text=${text}`
}

export default function PacienteDetallePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role as string | undefined
  const isSuper = role === 'SUPER'
  const sessionUserName = (session?.user as any)?.name as string | undefined
  const [tab, setTab] = useState('resumen')
  const [editOpen, setEditOpen] = useState(false)

  const { data: patient, isLoading, isError, error } = useQuery<Patient>({
    queryKey: ['paciente', params.id],
    queryFn: () =>
      fetch(`/api/pacientes/${params.id}`).then((r) => {
        if (!r.ok) throw new Error('Error al cargar expediente')
        return r.json()
      }),
    enabled: !!params.id,
  })

  function refresh() {
    qc.invalidateQueries({ queryKey: ['paciente', params.id] })
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (isError || !patient) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto">
        <Card>
          <CardContent className="p-10 text-center">
            <p className="text-muted-foreground">No se pudo cargar el expediente.</p>
            <p className="text-xs mt-2 text-muted-foreground">{(error as Error)?.message}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push('/pacientes')}
            >
              <ArrowLeft className="h-4 w-4" /> Volver a pacientes
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const fullName = `${patient.firstName} ${patient.lastName}`
  const wa = whatsappHref(patient.phone, fullName)

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-6 max-w-[1600px] mx-auto pb-20 md:pb-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/pacientes')}
          className="-ml-2"
        >
          <ArrowLeft className="h-4 w-4" /> Pacientes
        </Button>
      </div>

      {/* Encabezado institucional NOM-004 sección 2 */}
      <div className="mt-3">
        <EncabezadoInstitucional
          clinicId={patient.clinicId}
          sucursalNombre={isSuper ? patient.clinic.name : undefined}
          profesionalNombre={sessionUserName}
        />
      </div>

      {/* Alertas clínicas NOM-004 sección 25 */}
      <div className="mt-3">
        <AlertasBanner patientId={patient.id} />
      </div>

      {/* Header del paciente */}
      <Card className="mt-3">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className="h-14 w-14 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                style={{ backgroundColor: '#0a3143' }}
              >
                {patient.firstName.charAt(0)}
                {patient.lastName.charAt(0)}
              </div>
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-bold">{fullName}</h1>
                <p className="text-sm text-muted-foreground">
                  Expediente <span className="font-mono">{patient.expNumber}</span>
                  {isSuper && <> · {patient.clinic.name}</>}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {patient.phone && (
                    <Badge variant="outline" className="gap-1">
                      <Phone className="h-3 w-3" /> {patient.phone}
                    </Badge>
                  )}
                  {patient.email && (
                    <Badge variant="outline" className="gap-1">
                      <Mail className="h-3 w-3" /> {patient.email}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="print:hidden"
              >
                <Printer className="h-4 w-4" /> Imprimir
              </Button>
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border bg-green-50 text-green-700 border-green-300 hover:bg-green-100"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              )}
              <Link href={`/agenda?nueva=1&paciente=${patient.id}`}>
                <Button variant="outline" size="sm">
                  <CalendarPlus className="h-4 w-4" /> Agendar cita
                </Button>
              </Link>
              <Button onClick={() => setEditOpen(true)} size="sm" style={{ backgroundColor: '#0a3143' }}>
                <Pencil className="h-4 w-4" /> Editar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alertas de salud (diabético, alergias, etc.) */}
      <div className="mt-3">
        <HealthAlerts patient={patient} />
      </div>

      {/* 12 Tabs NOM-004 sección 26 */}
      <Tabs value={tab} onValueChange={setTab} className="w-full mt-4">
        <TabsList className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 w-full h-auto gap-1 print:hidden">
          <TabsTrigger value="resumen" className="flex-col py-2 gap-0.5 text-[10px] md:text-xs">
            <UserCircle className="h-4 w-4" /> Resumen
          </TabsTrigger>
          <TabsTrigger value="historia" className="flex-col py-2 gap-0.5 text-[10px] md:text-xs">
            <FileText className="h-4 w-4" /> Historia
          </TabsTrigger>
          <TabsTrigger value="exploracion" className="flex-col py-2 gap-0.5 text-[10px] md:text-xs">
            <Activity className="h-4 w-4" /> Exploración
          </TabsTrigger>
          <TabsTrigger value="diagnosticos" className="flex-col py-2 gap-0.5 text-[10px] md:text-xs">
            <ShieldAlert className="h-4 w-4" /> Diagnós.
          </TabsTrigger>
          <TabsTrigger value="procedimientos" className="flex-col py-2 gap-0.5 text-[10px] md:text-xs">
            <ClipboardList className="h-4 w-4" /> Proced.
          </TabsTrigger>
          <TabsTrigger value="evoluciones" className="flex-col py-2 gap-0.5 text-[10px] md:text-xs">
            <Stethoscope className="h-4 w-4" /> Evoluc.
          </TabsTrigger>
          <TabsTrigger value="recetas" className="flex-col py-2 gap-0.5 text-[10px] md:text-xs">
            <FileText className="h-4 w-4" /> Recetas
          </TabsTrigger>
          <TabsTrigger value="consentimientos" className="flex-col py-2 gap-0.5 text-[10px] md:text-xs">
            <FileSignature className="h-4 w-4" /> Consent.
          </TabsTrigger>
          <TabsTrigger value="fotografias" className="flex-col py-2 gap-0.5 text-[10px] md:text-xs">
            <Camera className="h-4 w-4" /> Fotos
          </TabsTrigger>
          <TabsTrigger value="archivos" className="flex-col py-2 gap-0.5 text-[10px] md:text-xs">
            <FolderOpen className="h-4 w-4" /> Archivos
          </TabsTrigger>
          <TabsTrigger value="referencias" className="flex-col py-2 gap-0.5 text-[10px] md:text-xs">
            <FileUp className="h-4 w-4" /> Refer.
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="flex-col py-2 gap-0.5 text-[10px] md:text-xs">
            <History className="h-4 w-4" /> Auditoría
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="mt-4">
          <ResumenTab patient={patient} onEdit={refresh} onGoToTab={setTab} />
        </TabsContent>
        <TabsContent value="historia" className="mt-4">
          <HistoriaClinicaForm patient={patient} />
        </TabsContent>
        <TabsContent value="exploracion" className="mt-4">
          <ExploracionPodologicaTab patient={patient} />
        </TabsContent>
        <TabsContent value="diagnosticos" className="mt-4">
          <DiagnosticoTabWrapper patient={patient} />
        </TabsContent>
        <TabsContent value="procedimientos" className="mt-4">
          <ProcedimientosTab patient={patient} />
        </TabsContent>
        <TabsContent value="evoluciones" className="mt-4">
          <EvolucionesTab patient={patient} />
        </TabsContent>
        <TabsContent value="recetas" className="mt-4">
          <RecetasIndicacionesTab patient={patient} />
        </TabsContent>
        <TabsContent value="consentimientos" className="mt-4">
          <ConsentimientosTab patient={patient} />
        </TabsContent>
        <TabsContent value="fotografias" className="mt-4">
          <FotografiasTab patient={patient} />
        </TabsContent>
        <TabsContent value="archivos" className="mt-4">
          <ArchivosTab patient={patient} />
        </TabsContent>
        <TabsContent value="referencias" className="mt-4">
          <ReferenciasTab patient={patient} />
        </TabsContent>
        <TabsContent value="auditoria" className="mt-4">
          <AuditoriaTab patient={patient} />
        </TabsContent>
      </Tabs>

      <PatientFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        patient={patient}
        onSaved={refresh}
      />
    </div>
  )
}

/** Wrapper del Tab 4 — Diagnósticos. Carga la historia clínica y muestra la sección 14. */
function DiagnosticoTabWrapper({ patient }: { patient: Patient }) {
  const [local, setLocal] = useState<any>(null)
  const fetched = useQuery<{ historiaClinicaInicial?: any }>({
    queryKey: ['historia-clinica', patient.id],
    queryFn: () =>
      fetch(`/api/pacientes/${patient.id}/historia-clinica`)
        .then((r) => r.json())
        .then((d) => d?.data || d || {}),
    retry: false,
  })

  if (fetched.isLoading) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const hc = fetched.data?.historiaClinicaInicial || {}
  const current = local ?? hc.diagnosticos ?? {}
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" style={{ color: '#0a3143' }} />
          Diagnósticos del expediente
        </h3>
        <Badge variant="outline" style={{ color: '#0a3143' }}>
          Sección 14 NOM-004
        </Badge>
      </div>
      <DiagnosticosSection
        value={current}
        onChange={(v) => setLocal(v)}
        isDiabetic={patient.isDiabetic}
      />
      <DiagnosticoSave patientId={patient.id} value={local} hc={hc} />
    </div>
  )
}

function DiagnosticoSave({
  patientId,
  value,
  hc,
}: {
  patientId: string
  value: any
  hc: any
}) {
  const qc = useQueryClient()
  const [saving, setSaving] = useState(false)
  async function save() {
    if (!value) return
    setSaving(true)
    try {
      const res = await fetch(`/api/pacientes/${patientId}/historia-clinica`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...hc, diagnosticos: value }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'Error al guardar')
      }
      toast.success('Diagnósticos guardados')
      qc.invalidateQueries({ queryKey: ['historia-clinica', patientId] })
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }
  if (!value) return null
  return (
    <div className="flex justify-end">
      <Button size="sm" onClick={save} disabled={saving} style={{ backgroundColor: '#0a3143' }}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
        Guardar diagnósticos
      </Button>
    </div>
  )
}

