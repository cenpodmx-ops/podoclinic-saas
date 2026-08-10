'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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
  const [deleteMotivo, setDeleteMotivo] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

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
    // Para el paciente: solo primer nombre (no nombre completo)
    const patientFirstName = a.patient.firstName || ''
    // Para el podólogo: solo primer nombre + artículo correcto (el/la)
    // gender='F' → "la podóloga", gender='M' → "el podólogo", null → "el/la podólogo(a)"
    const podFullName = a.podologist?.name || ''
    const podFirstName = podFullName.split(' ')[0] || ''
    const podGender = (a.podologist as any)?.gender
    const articulo = podGender === 'F' ? 'la' : podGender === 'M' ? 'el' : 'el/la'
    const podologoFrase = podFirstName ? `${articulo} podólog${podGender === 'F' ? 'a' : podGender === 'M' ? 'o' : 'o(a)'} ${podFirstName}` : 'su podólogo'

    return tpl
      .replace(/\{\{nombre_paciente\}\}/g, patientFirstName)
      .replace(/\{\{fecha\}\}/g, fmtDate(a.date))
      .replace(/\{\{hora\}\}/g, fmtTime(a.startTime))
      .replace(/\{\{podologo\}\}/g, podologoFrase)
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
      // Si la cita está finalizada o tiene consulta, enviar motivo
      const requiresMotivo = !canDelete
      const res = await fetch(`/api/citas/${a.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requiresMotivo ? { motivo: deleteMotivo || undefined } : {}),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'Error al eliminar')
      }
      toast.success('Cita eliminada')
      setDeleteDialogOpen(false)
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
  const canDeleteWithMotivo = isFinalizada || isEnConsulta || isConfirmada || isNoAsistio

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

              {(canDelete || canDeleteWithMotivo) && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-red-700 border-red-300 hover:bg-red-50"
                    onClick={() => { setDeleteMotivo(''); setDeleteDialogOpen(true) }}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Eliminar cita
                  </Button>
                  <Dialog open={deleteDialogOpen} onOpenChange={(v) => { setDeleteDialogOpen(v); if (!v) setDeleteMotivo('') }}>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>
                          {canDeleteWithMotivo ? '¿Eliminar cita finalizada?' : '¿Eliminar cita?'}
                        </DialogTitle>
                        <DialogDescription>
                          Esta acción no se puede deshacer. La cita de {a.patient.firstName} {a.patient.lastName} del {fmtDate(a.date)} será eliminada permanentemente.
                        </DialogDescription>
                      </DialogHeader>
                      {canDeleteWithMotivo && (
                        <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-amber-900 space-y-3">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                            <div className="space-y-1">
                              <p className="text-xs font-semibold">Esta cita ya está {a.status.toLowerCase()}.</p>
                              <p className="text-xs text-amber-800">
                                Se revertirán: cobro en caja, descuento de inventario y total acumulado del paciente.
                              </p>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="delete-motivo" className="text-xs font-semibold text-amber-900">
                              Motivo de eliminación <span className="text-red-600">*</span>
                            </Label>
                            <Textarea
                              id="delete-motivo"
                              value={deleteMotivo}
                              onChange={(e) => setDeleteMotivo(e.target.value)}
                              placeholder="Ej: Cita de prueba, error de registro, paciente canceló después de pago..."
                              className="bg-white border-amber-300 text-sm resize-none"
                              rows={3}
                              autoFocus
                            />
                          </div>
                        </div>
                      )}
                      <DialogFooter className="gap-2">
                        <Button
                          variant="outline"
                          onClick={() => { setDeleteDialogOpen(false); setDeleteMotivo('') }}
                        >
                          Cancelar
                        </Button>
                        <Button
                          onClick={eliminar}
                          disabled={busy || (canDeleteWithMotivo && !deleteMotivo.trim())}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                          Eliminar
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
