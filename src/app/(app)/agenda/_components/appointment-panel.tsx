'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Phone, Clock, CalendarDays, Stethoscope, MessageCircle, Star, Pencil, CalendarClock,
  Trash2, ExternalLink, User, AlertTriangle, Loader2, CheckCircle2, PlayCircle, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { STATUS_COLORS, STATUS_LABELS, fmtTime, fmtDate, fmtMoney } from '@/lib/format'
import type { AppointmentItem, PodologistOption } from './types'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  appointment: AppointmentItem | null
  podologos: PodologistOption[]
  onEdit: (appt: AppointmentItem) => void
  onReschedule: (appt: AppointmentItem) => void
  canManage: boolean
}

const DEFAULT_TPL_CONFIRM =
  'Hola {{nombre_paciente}}, te recordamos tu cita en CENPOD {{clinica}} el día {{fecha}} a las {{hora}} con {{podologo}}. Confirmamos tu asistencia respondiendo a este mensaje.'
const DEFAULT_TPL_GOOGLE =
  '¡Gracias por tu visita, {{nombre_paciente}}! Nos encantaría que nos califiques: https://g.page/r/CENPOD/review'

export function AppointmentPanel({ open, onOpenChange, appointment, podologos, onEdit, onReschedule, canManage }: Props) {
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)

  // Clinic config for WhatsApp templates
  const { data: cfg } = useQuery<any>({
    queryKey: ['config'],
    queryFn: () => fetch('/api/config').then((r) => r.json()),
    enabled: open,
  })

  if (!appointment) return null
  const a = appointment
  const phone = a.patient.phone?.replace(/\D/g, '') || ''
  const clinicName = cfg?.clinic?.name || ''
  const tplConfirm = cfg?.config?.tplConfirm || DEFAULT_TPL_CONFIRM
  const tplGoogle = cfg?.config?.tplGoogleReview || DEFAULT_TPL_GOOGLE

  function fillTemplate(tpl: string) {
    return tpl
      .replace(/\{\{nombre_paciente\}\}/g, `${a.patient.firstName} ${a.patient.lastName}`)
      .replace(/\{\{fecha\}\}/g, fmtDate(a.date))
      .replace(/\{\{hora\}\}/g, fmtTime(a.startTime))
      .replace(/\{\{podologo\}\}/g, a.podologist?.name || 'su podólogo')
      .replace(/\{\{clinica\}\}/g, clinicName)
      .replace(/\{\{link_reserva\}\}/g, 'https://cenpod.com/reservar')
  }

  function openWhatsApp(tpl: string) {
    if (!phone) {
      toast.error('El paciente no tiene teléfono registrado')
      return
    }
    const text = encodeURIComponent(fillTemplate(tpl))
    window.open(`https://wa.me/52${phone}?text=${text}`, '_blank')
  }

  async function changeStatus(status: string, label: string) {
    setBusy(true)
    // Optimistic: update local cache
    const optimistic = (old: any) => {
      if (!old) return old
      return {
        ...old,
        appointments: old.appointments.map((x: any) => x.id === a.id ? { ...x, status } : x),
      }
    }
    qc.setQueriesData({ queryKey: ['citas'] }, optimistic)
    try {
      const res = await fetch(`/api/citas/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'Error al actualizar')
      }
      toast.success(`Cita ${label.toLowerCase()}`)
      qc.invalidateQueries({ queryKey: ['citas'] })
    } catch (e: any) {
      toast.error(e.message || 'Error')
      qc.invalidateQueries({ queryKey: ['citas'] })
    } finally {
      setBusy(false)
    }
  }

  async function eliminar() {
    setBusy(true)
    try {
      const res = await fetch(`/api/citas/${a.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'Error al eliminar')
      }
      toast.success('Cita eliminada')
      onOpenChange(false)
      qc.invalidateQueries({ queryKey: ['citas'] })
    } catch (e: any) {
      toast.error(e.message || 'Error')
    } finally {
      setBusy(false)
    }
  }

  const isPendiente = a.status === 'PENDIENTE'
  const isConfirmada = a.status === 'CONFIRMADA'
  const isEnConsulta = a.status === 'EN_CONSULTA'
  const isFinalizada = a.status === 'FINALIZADA'
  const isCancelada = a.status === 'CANCELADA'
  const isNoAsistio = a.status === 'NO_ASISTIO'
  const canDelete = isPendiente || isCancelada

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
        <SheetHeader className="px-4 pt-4 pb-2 border-b">
          <SheetTitle className="text-base">Detalle de cita</SheetTitle>
          <SheetDescription className="sr-only">Información y acciones</SheetDescription>
        </SheetHeader>

        <div className="p-4 space-y-4">
          {/* Patient header */}
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary/10 text-primary">
                {a.patient.firstName.charAt(0)}{a.patient.lastName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <Link
                href={`/pacientes/${a.patient.id}`}
                className="font-semibold text-base hover:underline truncate block"
              >
                {a.patient.firstName} {a.patient.lastName}
              </Link>
              <p className="text-xs text-muted-foreground">Exp. {a.patient.expNumber}</p>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <Badge className={`text-[10px] ${STATUS_COLORS[a.status] || ''}`}>
                  {STATUS_LABELS[a.status] || a.status}
                </Badge>
                {a.source === 'WEB' && <Badge variant="outline" className="text-[10px]">Web</Badge>}
              </div>
            </div>
          </div>

          {/* WhatsApp confirm */}
          {canManage && phone && !isFinalizada && !isCancelada && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-emerald-700 border-emerald-300 hover:bg-emerald-50"
              onClick={() => openWhatsApp(tplConfirm)}
            >
              <MessageCircle className="h-4 w-4 mr-1" /> Confirmar por WhatsApp
            </Button>
          )}

          {/* Quick info */}
          <div className="rounded-md border p-3 space-y-2 text-sm bg-muted/20">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span>{fmtDate(a.date)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono">{fmtTime(a.startTime)} – {fmtTime(a.endTime)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-muted-foreground" />
              <span>{a.podologist?.name || 'Sin asignar'}</span>
            </div>
            {a.serviceName && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Servicio</span>
                <span className="font-medium">{a.serviceName}</span>
              </div>
            )}
            {a.price != null && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Precio</span>
                <span className="font-medium">{fmtMoney(a.price)}</span>
              </div>
            )}
            {a.patient.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${a.patient.phone}`} className="hover:underline">{a.patient.phone}</a>
              </div>
            )}
          </div>

          {/* Reason / notes */}
          {a.reason && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Motivo</p>
              <p className="text-sm">{a.reason}</p>
            </div>
          )}
          {a.notes && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Notas</p>
              <p className="text-sm whitespace-pre-wrap bg-amber-50 border border-amber-200 rounded p-2">
                {a.notes}
              </p>
            </div>
          )}

          <Separator />

          {/* Status actions */}
          {canManage ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Cambiar estado</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm" variant="outline"
                  disabled={busy || isConfirmada}
                  onClick={() => changeStatus('CONFIRMADA', 'Confirmada')}
                  className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Confirmar
                </Button>
                <Button asChild size="sm" variant="outline" disabled={busy || isEnConsulta}
                  className="text-blue-700 border-blue-300 hover:bg-blue-50">
                  <Link href={`/consulta?cita=${a.id}`}>
                    <PlayCircle className="h-4 w-4 mr-1" /> Iniciar consulta
                  </Link>
                </Button>
                <Button
                  size="sm" variant="outline"
                  disabled={busy || isFinalizada}
                  onClick={() => changeStatus('FINALIZADA', 'Finalizada')}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Finalizar
                </Button>
                <Button
                  size="sm" variant="outline"
                  disabled={busy || isCancelada}
                  onClick={() => changeStatus('CANCELADA', 'Cancelada')}
                  className="text-red-700 border-red-300 hover:bg-red-50"
                >
                  <XCircle className="h-4 w-4 mr-1" /> Cancelar
                </Button>
                <Button
                  size="sm" variant="outline"
                  disabled={busy || isNoAsistio}
                  onClick={() => changeStatus('NO_ASISTIO', 'No asistió')}
                  className="text-orange-700 border-orange-300 hover:bg-orange-50"
                >
                  <AlertTriangle className="h-4 w-4 mr-1" /> No asistió
                </Button>
              </div>
            </div>
          ) : null}

          {/* Google review */}
          {canManage && isFinalizada && phone && (
            <Button
              variant="outline" size="sm" className="w-full text-amber-700 border-amber-300 hover:bg-amber-50"
              onClick={() => openWhatsApp(tplGoogle)}
            >
              <Star className="h-4 w-4 mr-1" /> Pedir reseña Google
            </Button>
          )}

          {/* Edit / Reschedule / Delete */}
          {canManage && (
            <>
              <Separator />
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => onEdit(a)}>
                  <Pencil className="h-4 w-4 mr-1" /> Editar
                </Button>
                <Button variant="outline" size="sm" onClick={() => onReschedule(a)}>
                  <CalendarClock className="h-4 w-4 mr-1" /> Reagendar
                </Button>
              </div>

              {canDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full text-red-700 border-red-300 hover:bg-red-50">
                      <Trash2 className="h-4 w-4 mr-1" /> Eliminar cita
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar cita?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción no se puede deshacer. La cita de {a.patient.firstName} {a.patient.lastName} del {fmtDate(a.date)} será eliminada permanentemente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={eliminar}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Eliminar'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
