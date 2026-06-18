'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import {
  Wrench,
  Plus,
  AlertTriangle,
  CalendarClock,
  History,
  Trash2,
  Pencil,
  CheckCircle2,
} from 'lucide-react'
import { fmtMoney, fmtDate } from '@/lib/format'

type Equipo = {
  id: string
  name: string
  brand: string | null
  model: string | null
  serialNumber: string | null
  acquisitionDate: string | null
  serviceProvider: string | null
  lastCalibration: string | null
  nextMaintenance: string | null
  notes: string | null
  clinicName?: string
  maintenancesCount: number
  daysUntilMaintenance: number | null
  status: 'OK' | 'PROXIMO' | 'VENCIDO' | 'SIN_FECHA'
}

type EquipoDetail = Equipo & {
  createdAt: string
  updatedAt: string
  clinic: { name: string; phone: string | null; address: string | null }
  maintenances: Mantenimiento[]
}

type Mantenimiento = {
  id: string
  date: string
  type: 'CALIBRACION' | 'MANTENIMIENTO' | 'REPARACION'
  description: string | null
  technician: string | null
  cost: number
}

const STATUS_CONFIG: Record<Equipo['status'], { label: string; color: string; bg: string }> = {
  OK: { label: 'Al día', color: 'text-emerald-700', bg: 'bg-emerald-100 border-emerald-300' },
  PROXIMO: { label: 'Próximo', color: 'text-orange-700', bg: 'bg-orange-100 border-orange-300' },
  VENCIDO: { label: 'Vencido', color: 'text-red-700', bg: 'bg-red-100 border-red-300' },
  SIN_FECHA: { label: 'Sin programa', color: 'text-slate-600', bg: 'bg-slate-100 border-slate-300' },
}

const TYPE_LABELS: Record<Mantenimiento['type'], string> = {
  CALIBRACION: 'Calibración',
  MANTENIMIENTO: 'Mantenimiento',
  REPARACION: 'Reparación',
}

const TYPE_COLORS: Record<Mantenimiento['type'], string> = {
  CALIBRACION: 'bg-blue-100 text-blue-800 border-blue-300',
  MANTENIMIENTO: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  REPARACION: 'bg-amber-100 text-amber-800 border-amber-300',
}

export default function EquiposPage() {
  const qc = useQueryClient()
  const [newOpen, setNewOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editEquip, setEditEquip] = useState<Equipo | null>(null)
  const [maintFor, setMaintFor] = useState<Equipo | null>(null)

  const { data: equipos, isLoading } = useQuery({
    queryKey: ['equipos'],
    queryFn: async () => {
      const r = await fetch('/api/equipos')
      if (!r.ok) throw new Error('Error al cargar equipos')
      return r.json() as Promise<Equipo[]>
    },
  })

  const list = equipos || []
  const vencidos = list.filter((e) => e.status === 'VENCIDO')
  const proximos = list.filter((e) => e.status === 'PROXIMO')

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1500px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wrench className="h-6 w-6" style={{ color: '#0a3143' }} />
            Control de Equipos
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestión de equipos médicos y mantenimiento preventivo
          </p>
        </div>
        <Button onClick={() => setNewOpen(true)} style={{ backgroundColor: '#0a3143' }}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo equipo
        </Button>
      </div>

      {/* Alertas */}
      {vencidos.length > 0 && (
        <Alert className="border-red-300 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-700" />
          <AlertTitle className="text-red-800">
            {vencidos.length} equipo{vencidos.length > 1 ? 's' : ''} con mantenimiento vencido
          </AlertTitle>
          <AlertDescription className="text-red-700">
            {vencidos.map((e) => e.name).join(' · ')}
          </AlertDescription>
        </Alert>
      )}
      {proximos.length > 0 && (
        <Alert className="border-orange-300 bg-orange-50">
          <CalendarClock className="h-4 w-4 text-orange-700" />
          <AlertTitle className="text-orange-800">
            {proximos.length} equipo{proximos.length > 1 ? 's' : ''} con mantenimiento próximo (≤ 30 días)
          </AlertTitle>
          <AlertDescription className="text-orange-700">
            {proximos.map((e) => e.name).join(' · ')}
          </AlertDescription>
        </Alert>
      )}

      {/* Resumen rápido */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Total equipos" value={list.length} icon={Wrench} bg="#0a3143" />
        <SummaryCard label="Al día" value={list.filter((e) => e.status === 'OK').length} icon={CheckCircle2} bg="#15803d" />
        <SummaryCard label="Próximos (30d)" value={proximos.length} icon={CalendarClock} bg="#d97706" />
        <SummaryCard label="Vencidos" value={vencidos.length} icon={AlertTriangle} bg="#dc2626" />
      </div>

      {/* Grid de equipos */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            <Wrench className="h-10 w-10 mx-auto mb-3 opacity-40" />
            Aún no hay equipos registrados. Crea el primero con el botón <strong>Nuevo equipo</strong>.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((e) => {
            const cfg = STATUS_CONFIG[e.status]
            return (
              <Card
                key={e.id}
                className="shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col"
                onClick={() => setSelectedId(e.id)}
              >
                <CardContent className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-md" style={{ backgroundColor: '#0a3143' }}>
                        <Wrench className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">{e.name}</h3>
                        {e.brand && e.model && (
                          <p className="text-[10px] text-muted-foreground">{e.brand} · {e.model}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className={`${cfg.bg} ${cfg.color} text-[10px]`}>
                      {cfg.label}
                    </Badge>
                  </div>

                  <div className="space-y-1 text-xs flex-1">
                    {e.serialNumber && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Serie</span>
                        <span className="font-mono">{e.serialNumber}</span>
                      </div>
                    )}
                    {e.serviceProvider && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Proveedor</span>
                        <span className="truncate ml-2 max-w-[150px]">{e.serviceProvider}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Últ. calibración</span>
                      <span>{e.lastCalibration ? fmtDate(e.lastCalibration) : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Próx. mant.</span>
                      <span className={e.status === 'VENCIDO' ? 'text-red-700 font-semibold' : e.status === 'PROXIMO' ? 'text-orange-700 font-semibold' : ''}>
                        {e.nextMaintenance ? fmtDate(e.nextMaintenance) : 'Sin programar'}
                      </span>
                    </div>
                    {e.daysUntilMaintenance !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Días restantes</span>
                        <span className={e.daysUntilMaintenance < 0 ? 'text-red-700 font-bold' : e.daysUntilMaintenance <= 30 ? 'text-orange-700 font-bold' : ''}>
                          {e.daysUntilMaintenance > 0 ? `${e.daysUntilMaintenance}d` : `Vencido ${Math.abs(e.daysUntilMaintenance)}d`}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <History className="h-3 w-3" /> {e.maintenancesCount} mant.
                    </Badge>
                    <div className="flex gap-1" onClick={(ev) => ev.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMaintFor(e)}
                        title="Registrar mantenimiento"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditEquip(e)}
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialogs */}
      <EquipoFormDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ['equipos'] })
          setNewOpen(false)
          toast.success('Equipo creado')
        }}
      />

      <EquipoFormDialog
        equipo={editEquip}
        open={!!editEquip}
        onClose={() => setEditEquip(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ['equipos'] })
          qc.invalidateQueries({ queryKey: ['equipo', editEquip?.id] })
          setEditEquip(null)
          toast.success('Equipo actualizado')
        }}
      />

      <EquipoDetailDialog
        equipoId={selectedId}
        onClose={() => setSelectedId(null)}
        onRegisterMaint={(e) => {
          setMaintFor(e)
          setSelectedId(null)
        }}
        onEdit={(e) => {
          setEditEquip(e)
          setSelectedId(null)
        }}
        onDeleted={() => {
          qc.invalidateQueries({ queryKey: ['equipos'] })
          setSelectedId(null)
        }}
      />

      <MantenimientoDialog
        equipo={maintFor}
        onClose={() => setMaintFor(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ['equipos'] })
          if (selectedId) qc.invalidateQueries({ queryKey: ['equipo', selectedId] })
          setMaintFor(null)
          toast.success('Mantenimiento registrado')
        }}
      />
    </div>
  )
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  bg,
}: {
  label: string
  value: number
  icon: any
  bg: string
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-0.5">{value}</p>
        </div>
        <div className="p-2 rounded-lg text-white" style={{ backgroundColor: bg }}>
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  )
}

function EquipoFormDialog({
  equipo,
  open,
  onClose,
  onSaved,
}: {
  equipo?: Equipo | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!equipo
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [acquisitionDate, setAcquisitionDate] = useState('')
  const [serviceProvider, setServiceProvider] = useState('')
  const [lastCalibration, setLastCalibration] = useState('')
  const [nextMaintenance, setNextMaintenance] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Sync form when equipo changes (open edit)
  useEffect(() => {
    if (equipo) {
      setName(equipo.name)
      setBrand(equipo.brand || '')
      setModel(equipo.model || '')
      setSerialNumber(equipo.serialNumber || '')
      setAcquisitionDate(equipo.acquisitionDate ? equipo.acquisitionDate.slice(0, 10) : '')
      setServiceProvider(equipo.serviceProvider || '')
      setLastCalibration(equipo.lastCalibration ? equipo.lastCalibration.slice(0, 10) : '')
      setNextMaintenance(equipo.nextMaintenance ? equipo.nextMaintenance.slice(0, 10) : '')
      setNotes(equipo.notes || '')
    } else {
      // Reset for new
      setName('')
      setBrand('')
      setModel('')
      setSerialNumber('')
      setAcquisitionDate('')
      setServiceProvider('')
      setLastCalibration('')
      setNextMaintenance('')
      setNotes('')
    }
  }, [equipo])

  const submit = async () => {
    if (!name.trim()) {
      toast.error('Nombre requerido')
      return
    }
    setSaving(true)
    try {
      const body: any = {
        name,
        brand,
        model,
        serialNumber,
        acquisitionDate: acquisitionDate || undefined,
        serviceProvider,
        lastCalibration: lastCalibration || undefined,
        nextMaintenance: nextMaintenance || undefined,
        notes,
      }
      const url = isEdit ? `/api/equipos/${equipo!.id}` : '/api/equipos'
      const method = isEdit ? 'PATCH' : 'POST'
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const e = await r.json()
        throw new Error(e.error || 'Error al guardar')
      }
      onSaved()
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar equipo' : 'Nuevo equipo'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Actualiza los datos del equipo.' : 'Registra un nuevo equipo médico.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-xs">Nombre *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Despulpador podológico" />
          </div>
          <div>
            <Label className="text-xs">Marca</Label>
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Modelo</Label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Número de serie</Label>
            <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Fecha de adquisición</Label>
            <Input type="date" value={acquisitionDate} onChange={(e) => setAcquisitionDate(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Proveedor de servicio</Label>
            <Input value={serviceProvider} onChange={(e) => setServiceProvider(e.target.value)} placeholder="Empresa de mantenimiento" />
          </div>
          <div>
            <Label className="text-xs">Última calibración</Label>
            <Input type="date" value={lastCalibration} onChange={(e) => setLastCalibration(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Próximo mantenimiento</Label>
            <Input type="date" value={nextMaintenance} onChange={(e) => setNextMaintenance(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Notas</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving} style={{ backgroundColor: '#0a3143' }}>
            {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear equipo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EquipoDetailDialog({
  equipoId,
  onClose,
  onRegisterMaint,
  onEdit,
  onDeleted,
}: {
  equipoId: string | null
  onClose: () => void
  onRegisterMaint: (e: Equipo) => void
  onEdit: (e: Equipo) => void
  onDeleted: () => void
}) {
  const { data: detail, isLoading } = useQuery({
    queryKey: ['equipo', equipoId],
    queryFn: async () => {
      const r = await fetch(`/api/equipos/${equipoId}`)
      if (!r.ok) throw new Error('Error al cargar equipo')
      return r.json() as Promise<EquipoDetail>
    },
    enabled: !!equipoId,
  })

  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleDelete = async () => {
    if (!detail) return
    try {
      const r = await fetch(`/api/equipos/${detail.id}`, { method: 'DELETE' })
      if (!r.ok) {
        const e = await r.json()
        throw new Error(e.error || 'Error al eliminar')
      }
      toast.success('Equipo eliminado')
      onDeleted()
    } catch (e: any) {
      toast.error(e.message || 'Error al eliminar')
    }
  }

  return (
    <Dialog open={!!equipoId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" style={{ color: '#0a3143' }} />
            {isLoading ? 'Cargando…' : detail?.name}
          </DialogTitle>
          <DialogDescription>
            {detail && (detail.brand || detail.model) && `${detail.brand || ''} ${detail.model || ''}`.trim()}
            {detail?.serialNumber && ` · Serie: ${detail.serialNumber}`}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !detail ? (
          <div className="space-y-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <DataBox label="Estado" value={STATUS_CONFIG[detail.status].label} highlight={detail.status} />
              <DataBox label="Últ. calibración" value={detail.lastCalibration ? fmtDate(detail.lastCalibration) : '—'} />
              <DataBox label="Próx. mantenimiento" value={detail.nextMaintenance ? fmtDate(detail.nextMaintenance) : 'Sin programar'} />
              <DataBox label="Días restantes" value={detail.daysUntilMaintenance === null ? '—' : detail.daysUntilMaintenance < 0 ? `Vencido ${Math.abs(detail.daysUntilMaintenance)}d` : `${detail.daysUntilMaintenance}d`} />
              <DataBox label="Adquisición" value={detail.acquisitionDate ? fmtDate(detail.acquisitionDate) : '—'} />
              <DataBox label="Proveedor" value={detail.serviceProvider || '—'} />
              <DataBox label="Total mantenim." value={String(detail.maintenances.length)} />
              <DataBox label="Sucursal" value={detail.clinic?.name || '—'} />
            </div>

            {detail.notes && (
              <div className="border rounded-md p-3 bg-muted/30">
                <div className="text-[10px] uppercase text-muted-foreground mb-1">Notas</div>
                <div className="text-sm">{detail.notes}</div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <History className="h-4 w-4" /> Historial de mantenimientos ({detail.maintenances.length})
              </h4>
              <div className="border rounded-md max-h-72 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Técnico</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Costo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.maintenances.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-6">
                          Sin mantenimientos registrados
                        </TableCell>
                      </TableRow>
                    ) : (
                      detail.maintenances.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="text-xs">{fmtDate(m.date)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] ${TYPE_COLORS[m.type]}`}>
                              {TYPE_LABELS[m.type]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{m.technician || '—'}</TableCell>
                          <TableCell className="text-xs">{m.description || '—'}</TableCell>
                          <TableCell className="text-right text-xs">{fmtMoney(m.cost)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex flex-wrap justify-between gap-2 pt-2 border-t">
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-700">¿Confirmar eliminación?</span>
                  <Button size="sm" variant="destructive" onClick={handleDelete}>Sí, eliminar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-4 w-4 mr-1" /> Eliminar
                </Button>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => onEdit(detail)}>
                  <Pencil className="h-4 w-4 mr-1" /> Editar
                </Button>
                <Button size="sm" onClick={() => onRegisterMaint(detail)} style={{ backgroundColor: '#0a3143' }}>
                  <Plus className="h-4 w-4 mr-1" /> Registrar mantenimiento
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function DataBox({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  let cls = ''
  if (highlight === 'VENCIDO') cls = 'text-red-700 font-bold'
  else if (highlight === 'PROXIMO') cls = 'text-orange-700 font-bold'
  else if (highlight === 'OK') cls = 'text-emerald-700 font-bold'
  return (
    <div className="border rounded-md p-2 bg-muted/30">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={`text-sm mt-0.5 ${cls}`}>{value}</div>
    </div>
  )
}

function MantenimientoDialog({
  equipo,
  onClose,
  onSaved,
}: {
  equipo: Equipo | null
  onClose: () => void
  onSaved: () => void
}) {
  const [type, setType] = useState<Mantenimiento['type']>('MANTENIMIENTO')
  const [description, setDescription] = useState('')
  const [technician, setTechnician] = useState('')
  const [cost, setCost] = useState('')
  const [saving, setSaving] = useState(false)

  // Reset on open
  useEffect(() => {
    if (equipo) {
      setType('MANTENIMIENTO')
      setDescription('')
      setTechnician('')
      setCost('')
    }
  }, [equipo])

  const submit = async () => {
    if (!equipo) return
    setSaving(true)
    try {
      const r = await fetch(`/api/equipos/${equipo.id}/mantenimientos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          description,
          technician,
          cost: cost ? Number(cost) : 0,
        }),
      })
      if (!r.ok) {
        const e = await r.json()
        throw new Error(e.error || 'Error al registrar')
      }
      onSaved()
    } catch (e: any) {
      toast.error(e.message || 'Error al registrar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!equipo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar mantenimiento</DialogTitle>
          <DialogDescription>
            {equipo?.name} · se actualizarán las fechas del equipo según el tipo
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as Mantenimiento['type'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MANTENIMIENTO">Mantenimiento (próx. en 6 meses)</SelectItem>
                <SelectItem value="CALIBRACION">Calibración (próx. en 12 meses)</SelectItem>
                <SelectItem value="REPARACION">Reparación (no actualiza fechas)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Técnico responsable</Label>
            <Input value={technician} onChange={(e) => setTechnician(e.target.value)} placeholder="Nombre del técnico" />
          </div>
          <div>
            <Label className="text-xs">Descripción</Label>
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Trabajo realizado, piezas cambiadas, observaciones…" />
          </div>
          <div>
            <Label className="text-xs">Costo (MXN)</Label>
            <Input type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving} style={{ backgroundColor: '#0a3143' }}>
            {saving ? 'Registrando…' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
