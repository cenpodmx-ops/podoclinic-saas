'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { format, addDays, parseISO, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import {
  ChevronLeft, ChevronRight, CalendarDays, CalendarRange, Plus, Printer, Ban, CalendarCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { AgendaGrid } from './_components/agenda-grid'
import { AppointmentPanel } from './_components/appointment-panel'
import { NewAppointmentDialog } from './_components/new-appointment-dialog'
import { EditAppointmentDialog } from './_components/edit-appointment-dialog'
import { BlockDialog } from './_components/block-dialog'
import type { AppointmentItem, BlockItem, PodologistOption } from './_components/types'
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/format'

export default function AgendaPage() {
  const router = useRouter()
  const sp = useSearchParams()
  const { data: session } = useSession()
  const qc = useQueryClient()
  const user = session?.user as any
  const canManage = user && ['SUPER', 'OWNER', 'RECEPTION'].includes(user.role)

  // ---- State ----
  const [mounted, setMounted] = useState(false)
  const [view, setView] = useState<'day' | 'week'>('day')
  const [date, setDate] = useState<string>('') // se setea en useEffect para evitar mismatch SSR
  const [podologistId, setPodologistId] = useState<string>('all') // 'all' = Todos

  // Setear fecha actual solo en cliente (evita hydration mismatch)
  useEffect(() => {
    setMounted(true)
    setDate(format(new Date(), 'yyyy-MM-dd'))
  }, [])

  const [newOpen, setNewOpen] = useState(false)
  const [newInitial, setNewInitial] = useState<{ podologistId?: string; date?: string; startTime?: string } | undefined>(undefined)
  const [rescheduleAppt, setRescheduleAppt] = useState<AppointmentItem | null>(null)
  const [editAppt, setEditAppt] = useState<AppointmentItem | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [panelAppt, setPanelAppt] = useState<AppointmentItem | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [blockOpen, setBlockOpen] = useState(false)
  const [blockToDelete, setBlockToDelete] = useState<BlockItem | null>(null)
  const [deletingBlock, setDeletingBlock] = useState(false)

  // ---- Podologos ----
  const { data: podologos = [] } = useQuery<PodologistOption[]>({
    queryKey: ['podologos'],
    queryFn: () => fetch('/api/podologos').then((r) => r.json()),
  })

  // ---- Citas ----
  const queryParams = new URLSearchParams({
    date,
    view,
  })
  if (podologistId && podologistId !== 'all') queryParams.set('podologistId', podologistId)

  const { data, isLoading } = useQuery({
    queryKey: ['citas', date, podologistId, view, user?.role],
    queryFn: () => fetch(`/api/citas?${queryParams.toString()}`).then((r) => r.json()),
    enabled: !!user && !!date,
    placeholderData: (prev) => prev,
  })

  // ---- Auto-open new dialog if ?nueva=1 ----
  useEffect(() => {
    if (sp.get('nueva') === '1') {
      setNewOpen(true)
      // Clean URL
      const newUrl = window.location.pathname
      window.history.replaceState({}, '', newUrl)
    }
  }, [sp])

  // ---- Handlers ----
  function shiftDate(days: number) {
    const d = parseISO(date)
    setDate(format(addDays(d, days), 'yyyy-MM-dd'))
  }
  function goToday() {
    setDate(format(new Date(), 'yyyy-MM-dd'))
  }

  function openNewFromSlot(pId: string, time: string) {
    if (!canManage) return
    setNewInitial({ podologistId: pId || podologos[0]?.id, date, startTime: time })
    setNewOpen(true)
  }
  function openNewButton() {
    setNewInitial({ date, startTime: '09:00' })
    setNewOpen(true)
  }

  function openPanel(a: AppointmentItem) {
    setPanelAppt(a)
    setPanelOpen(true)
  }
  function openEdit(a: AppointmentItem) {
    setEditAppt(a)
    setPanelOpen(false)
    setEditOpen(true)
  }
  function openReschedule(a: AppointmentItem) {
    setRescheduleAppt(a)
    setNewInitial({ date: format(new Date(a.date), 'yyyy-MM-dd'), startTime: format(new Date(a.startTime), 'HH:mm') })
    setPanelOpen(false)
    setNewOpen(true)
  }

  async function deleteBlock() {
    if (!blockToDelete) return
    setDeletingBlock(true)
    try {
      const res = await fetch(`/api/bloqueos/${blockToDelete.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'Error al eliminar')
      }
      toast.success('Bloqueo eliminado')
      qc.invalidateQueries({ queryKey: ['citas'] })
      setBlockToDelete(null)
    } catch (e: any) {
      toast.error(e.message || 'Error')
    } finally {
      setDeletingBlock(false)
    }
  }

  // ---- Print ----
  function print() {
    window.print()
  }

  const dateLabel = useMemo(() => {
    if (!date) return '—'
    const d = parseISO(date)
    if (isNaN(d.getTime())) return '—'
    if (view === 'week') {
      const ws = addDays(startOfWeekMon(d), 0)
      const we = addDays(ws, 6)
      return `${format(ws, 'd MMM', { locale: es })} – ${format(we, 'd MMM yyyy', { locale: es })}`
    }
    return format(d, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })
  }, [date, view])

  // KPIs for the day
  const appts = data?.appointments || []
  const stats = {
    total: appts.length,
    pendientes: appts.filter((a: AppointmentItem) => a.status === 'PENDIENTE').length,
    confirmadas: appts.filter((a: AppointmentItem) => a.status === 'CONFIRMADA').length,
    enConsulta: appts.filter((a: AppointmentItem) => a.status === 'EN_CONSULTA').length,
    finalizadas: appts.filter((a: AppointmentItem) => a.status === 'FINALIZADA').length,
    canceladas: appts.filter((a: AppointmentItem) => a.status === 'CANCELADA').length,
  }

  // Guard: hasta que se monte en cliente (evita hydration mismatch con new Date())
  if (!mounted) {
    return (
      <div className="p-6 space-y-4 max-w-[1600px] mx-auto">
        <div className="h-9 w-64 bg-muted animate-pulse rounded" />
        <div className="h-10 w-full bg-muted animate-pulse rounded" />
        <div className="h-96 bg-muted animate-pulse rounded" />
      </div>
    )
  }

  return (
    <div className="p-3 md:p-6 space-y-4 max-w-[1600px] mx-auto">
      {/* ===== VISTA DE IMPRESIÓN ===== */}
      <div className="hidden print:block">
        <div className="print-agenda">
          <h1>AGENDA DIARIA</h1>
          <div className="sub">
            {dateLabel} — {data?.clinic?.name || user?.clinicName || 'CENPOD'}
          </div>

          {/* Generar horas del día desde apertura hasta cierre */}
          {(() => {
            const opening = data?.clinic?.openingTime || '08:00'
            const closing = data?.clinic?.closingTime || '20:00'
            const slotMin = data?.clinic?.slotMinutes || 60
            const [oh, om] = opening.split(':').map(Number)
            const [ch, cm] = closing.split(':').map(Number)
            const startMin = oh * 60 + om
            const endMin = ch * 60 + cm
            const allSlots: string[] = []
            let cur = startMin
            while (cur < endMin) {
              const h = Math.floor(cur / 60)
              const m = cur % 60
              allSlots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
              cur += slotMin
            }

            // Agrupar citas por podólogo
            const podologosMap: Record<string, { name: string; appts: typeof appts }> = {}
            for (const a of appts) {
              const key = a.podologist?.id || 'sin'
              const name = a.podologist?.name || 'Sin asignar'
              if (!podologosMap[key]) podologosMap[key] = { name, appts: [] }
              podologosMap[key].appts.push(a)
            }

            // Si no hay podólogos con citas, mostrar "General"
            const grupos = Object.values(podologosMap)
            if (grupos.length === 0) {
              grupos.push({ name: 'General', appts: [] })
            }

            return grupos.map((grupo, gi) => (
              <div key={gi} style={{ marginBottom: '20px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#0a3143', padding: '8px 0 4px', borderBottom: '2px solid #0a3143', marginBottom: '0' }}>
                  {grupo.name}
                </div>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '70px', textAlign: 'center' }}>Hora</th>
                      <th>Paciente</th>
                      <th style={{ width: '110px' }}>Teléfono</th>
                      <th style={{ width: '25%' }}>Motivo</th>
                      <th style={{ width: '100px' }}>Estatus</th>
                      <th style={{ width: '25%' }}>Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allSlots.map((slot) => {
                      const apptAtSlot = grupo.appts.find((a) => {
                        const s = String(a.startTime)
                        const m = s.match(/T(\d{2}:\d{2})/)
                        return m && m[1] === slot
                      })
                      if (apptAtSlot) {
                        return (
                          <tr key={slot}>
                            <td style={{ fontWeight: 'bold', textAlign: 'center', color: '#0a3143' }}>{slot}</td>
                            <td style={{ fontWeight: '600' }}>{apptAtSlot.patient.firstName} {apptAtSlot.patient.lastName}</td>
                            <td>{apptAtSlot.patient.phone || '—'}</td>
                            <td>{apptAtSlot.reason || apptAtSlot.serviceName || '—'}</td>
                            <td className={`status-${apptAtSlot.status}`}>{STATUS_LABELS[apptAtSlot.status] || apptAtSlot.status}</td>
                            <td>{apptAtSlot.notes || ''}</td>
                          </tr>
                        )
                      }
                      return (
                        <tr key={slot}>
                          <td style={{ fontWeight: 'bold', textAlign: 'center', color: '#999' }}>{slot}</td>
                          <td style={{ color: '#ccc' }}>—</td>
                          <td></td>
                          <td></td>
                          <td></td>
                          <td></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ))
          })()}

          <div className="footer">
            Impreso el {new Date().toLocaleString('es-MX')} • Sistema CENPOD • {data?.clinic?.name || user?.clinicName || 'CENPOD'}
          </div>
        </div>
      </div>

      {/* ===== VISTA NORMAL (pantalla) ===== */}
      <div className="print:hidden">
        {/* Row 1: Date + view + actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => shiftDate(view === 'week' ? -7 : -1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => shiftDate(view === 'week' ? 7 : 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToday}>
              <CalendarCheck className="h-4 w-4 mr-1" /> Hoy
            </Button>
          </div>

          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          />

          <div className="flex items-center rounded-md border p-0.5">
            <Button
              size="sm" variant={view === 'day' ? 'default' : 'ghost'}
              onClick={() => setView('day')}
              className="h-7"
              style={view === 'day' ? { backgroundColor: '#0a3143' } : {}}
            >
              <CalendarDays className="h-3.5 w-3.5 mr-1" /> Día
            </Button>
            <Button
              size="sm" variant={view === 'week' ? 'default' : 'ghost'}
              onClick={() => setView('week')}
              className="h-7"
              style={view === 'week' ? { backgroundColor: '#0a3143' } : {}}
            >
              <CalendarRange className="h-3.5 w-3.5 mr-1" /> Semana
            </Button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {canManage && (
              <Button variant="outline" size="sm" onClick={() => setBlockOpen(true)}>
                <Ban className="h-4 w-4 mr-1" /> Bloquear
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={print}>
              <Printer className="h-4 w-4 mr-1" /> Imprimir
            </Button>
            {canManage && (
              <Button size="sm" onClick={openNewButton} style={{ backgroundColor: '#0a3143' }}>
                <Plus className="h-4 w-4 mr-1" /> Nueva cita
              </Button>
            )}
          </div>
        </div>

        {/* Row 2: Date label + podologist selector + KPIs */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg md:text-xl font-semibold capitalize">{dateLabel}</h1>
              <p className="text-xs text-muted-foreground">{data?.clinic?.name || user?.clinicName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden md:inline">Podólogo:</span>
            <Select value={podologistId} onValueChange={setPodologistId}>
              <SelectTrigger className="h-9 w-[200px]">
                <SelectValue placeholder="Todos los podólogos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los podólogos</SelectItem>
                {podologos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPIs row */}
        <div className="flex flex-wrap gap-1.5 text-xs">
          <Badge variant="outline">Total: {stats.total}</Badge>
          <Badge className={`text-[10px] ${STATUS_COLORS.PENDIENTE}`}>Pendientes: {stats.pendientes}</Badge>
          <Badge className={`text-[10px] ${STATUS_COLORS.CONFIRMADA}`}>Confirmadas: {stats.confirmadas}</Badge>
          {stats.enConsulta > 0 && <Badge className={`text-[10px] ${STATUS_COLORS.EN_CONSULTA}`}>En consulta: {stats.enConsulta}</Badge>}
          <Badge className={`text-[10px] ${STATUS_COLORS.FINALIZADA}`}>Finalizadas: {stats.finalizadas}</Badge>
          {stats.canceladas > 0 && <Badge className={`text-[10px] ${STATUS_COLORS.CANCELADA}`}>Canceladas: {stats.canceladas}</Badge>}
        </div>
      </div>

      {/* Grid */}
      <AgendaGrid
        view={view}
        date={date}
        data={data}
        isLoading={isLoading}
        podologos={podologos}
        selectedPodologistId={podologistId}
        onSlotClick={openNewFromSlot}
        onAppointmentClick={openPanel}
        onBlockClick={(b) => setBlockToDelete(b)}
      />

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        {['pendiente', 'confirmada', 'en-consulta', 'finalizada', 'cancelada', 'no-asistio', 'bloqueada'].map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className={`inline-block w-3 h-3 rounded appt-${s}`} />
            <span className="capitalize">{s.replace('-', ' ')}</span>
          </div>
        ))}
      </div>

      <div className="print:hidden">
        <AppointmentPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        appointment={panelAppt}
        podologos={podologos}
        onEdit={openEdit}
        onReschedule={openReschedule}
        canManage={!!canManage}
      />

      {/* New / Reschedule dialog */}
      <NewAppointmentDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        podologos={podologos}
        initial={newInitial}
        reschedule={rescheduleAppt ? {
          appointmentId: rescheduleAppt.id,
          patient: rescheduleAppt.patient,
          podologistId: rescheduleAppt.podologist?.id,
          serviceId: rescheduleAppt.serviceId || undefined,
          reason: rescheduleAppt.reason || undefined,
          notes: rescheduleAppt.notes || undefined,
        } : undefined}
      />

      {/* Edit dialog */}
      <EditAppointmentDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        appointment={editAppt}
        podologos={podologos}
      />

      {/* Block dialog */}
      <BlockDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        podologos={podologos}
        defaultDate={date}
      />

      {/* Block delete confirm */}
      <AlertDialog open={!!blockToDelete} onOpenChange={(o) => !o && setBlockToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar bloqueo?</AlertDialogTitle>
            <AlertDialogDescription>
              El bloqueo {(blockToDelete && (REASON_LABELS[blockToDelete.reason] || blockToDelete.reason)) || ''} será eliminado y el horario volverá a estar disponible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteBlock} disabled={deletingBlock}
              className="bg-red-600 hover:bg-red-700 text-white">
              {deletingBlock ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  )
}

const REASON_LABELS: Record<string, string> = {
  VACACIONES: 'Vacaciones',
  CAPACITACION: 'Capacitación',
  INCAPACIDAD: 'Incapacidad',
  OTRO: 'Otro',
}

function startOfWeekMon(d: Date) {
  const out = new Date(d)
  const day = out.getDay() // 0=Sun ... 1=Mon
  const diff = (day === 0 ? -6 : 1 - day)
  out.setDate(out.getDate() + diff)
  out.setHours(0, 0, 0, 0)
  return out
}
