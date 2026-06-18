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
  Stethoscope,
  CalendarDays,
  Pill,
  FolderOpen,
  Bell,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { PatientFormDialog } from '@/components/cenpod/patient-form-dialog'
import { fmtMoney } from '@/lib/format'
import type { Patient } from './_components/types'
import { HealthAlerts } from './_components/health-alerts'
import { TabResumen } from './_components/tab-resumen'
import { TabHistoria } from './_components/tab-historia'
import { TabConsultas } from './_components/tab-consultas'
import { TabCitas } from './_components/tab-citas'
import { TabRecetas } from './_components/tab-recetas'
import { TabArchivos } from './_components/tab-archivos'
import { TabSeguimiento } from './_components/tab-seguimiento'

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
  const [tab, setTab] = useState('resumen')
  const [editOpen, setEditOpen] = useState(false)

  const { data: patient, isLoading, isError, error } = useQuery<Patient>({
    queryKey: ['paciente', params.id],
    queryFn: () => fetch(`/api/pacientes/${params.id}`).then((r) => {
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
            <Button variant="outline" className="mt-4" onClick={() => router.push('/pacientes')}>
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
    <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto pb-20 md:pb-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs">
        <Button variant="ghost" size="sm" onClick={() => router.push('/pacientes')} className="-ml-2">
          <ArrowLeft className="h-4 w-4" /> Pacientes
        </Button>
      </div>

      {/* Header */}
      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className="h-14 w-14 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                style={{ backgroundColor: '#0a3143' }}
              >
                {patient.firstName.charAt(0)}{patient.lastName.charAt(0)}
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
                  {patient.totalSpent > 0 && (
                    <Badge variant="outline" className="gap-1" style={{ color: '#0a3143' }}>
                      Total: {fmtMoney(patient.totalSpent)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
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

      {/* Alertas de salud */}
      <HealthAlerts patient={patient} />

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid grid-cols-4 md:grid-cols-7 w-full h-auto">
          <TabsTrigger value="resumen" className="flex-col py-2 gap-0.5 text-[11px] md:text-sm md:flex-row">
            <UserCircle className="h-4 w-4" /> <span>Resumen</span>
          </TabsTrigger>
          <TabsTrigger value="historia" className="flex-col py-2 gap-0.5 text-[11px] md:text-sm md:flex-row">
            <FileText className="h-4 w-4" /> <span>Historia</span>
          </TabsTrigger>
          <TabsTrigger value="consultas" className="flex-col py-2 gap-0.5 text-[11px] md:text-sm md:flex-row">
            <Stethoscope className="h-4 w-4" /> <span className="flex items-center gap-1">Consultas {patient.consultations.length > 0 && <span className="text-[10px] bg-primary/10 text-primary rounded-full px-1.5">{patient.consultations.length}</span>}</span>
          </TabsTrigger>
          <TabsTrigger value="citas" className="flex-col py-2 gap-0.5 text-[11px] md:text-sm md:flex-row">
            <CalendarDays className="h-4 w-4" /> <span className="flex items-center gap-1">Citas {patient.appointments.length > 0 && <span className="text-[10px] bg-primary/10 text-primary rounded-full px-1.5">{patient.appointments.length}</span>}</span>
          </TabsTrigger>
          <TabsTrigger value="recetas" className="flex-col py-2 gap-0.5 text-[11px] md:text-sm md:flex-row">
            <Pill className="h-4 w-4" /> <span className="flex items-center gap-1">Recetas {patient.prescriptions.length > 0 && <span className="text-[10px] bg-primary/10 text-primary rounded-full px-1.5">{patient.prescriptions.length}</span>}</span>
          </TabsTrigger>
          <TabsTrigger value="archivos" className="flex-col py-2 gap-0.5 text-[11px] md:text-sm md:flex-row">
            <FolderOpen className="h-4 w-4" /> <span className="flex items-center gap-1">Archivos {patient.files.length > 0 && <span className="text-[10px] bg-primary/10 text-primary rounded-full px-1.5">{patient.files.length}</span>}</span>
          </TabsTrigger>
          <TabsTrigger value="seguimiento" className="flex-col py-2 gap-0.5 text-[11px] md:text-sm md:flex-row">
            <Bell className="h-4 w-4" /> <span className="flex items-center gap-1">Seguim. {patient.followUps.length > 0 && <span className="text-[10px] bg-primary/10 text-primary rounded-full px-1.5">{patient.followUps.length}</span>}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="mt-4">
          <TabResumen patient={patient} onUpdate={refresh} />
        </TabsContent>
        <TabsContent value="historia" className="mt-4">
          <TabHistoria patient={patient} onUpdate={refresh} />
        </TabsContent>
        <TabsContent value="consultas" className="mt-4">
          <TabConsultas patient={patient} />
        </TabsContent>
        <TabsContent value="citas" className="mt-4">
          <TabCitas patient={patient} />
        </TabsContent>
        <TabsContent value="recetas" className="mt-4">
          <TabRecetas patient={patient} />
        </TabsContent>
        <TabsContent value="archivos" className="mt-4">
          <TabArchivos patient={patient} />
        </TabsContent>
        <TabsContent value="seguimiento" className="mt-4">
          <TabSeguimiento patient={patient} />
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
