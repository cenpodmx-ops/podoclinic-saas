'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { MessageCircle, Plus, UserPlus, Filter, ExternalLink, ChevronDown } from 'lucide-react'
import { LEAD_STATUS_LABELS, LEAD_STATUS_STYLE, type Lead } from './types'
import { fmtDate } from '@/lib/format'

export function TabLeads() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string>('__all')
  const [nuevoOpen, setNuevoOpen] = useState(false)
  const [convertLead, setConvertLead] = useState<Lead | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['crm-leads', statusFilter],
    queryFn: async () => {
      const q = statusFilter !== '__all' ? `?status=${statusFilter}` : ''
      const r = await fetch(`/api/crm/leads${q}`)
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e.error || 'Error al cargar leads')
      }
      return r.json()
    },
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const r = await fetch(`/api/crm/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e.error || 'Error al actualizar lead')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('Lead actualizado')
      qc.invalidateQueries({ queryKey: ['crm-leads'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const convert = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/crm/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ convertToPatient: true }),
      })
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e.error || 'Error al convertir lead')
      }
      return r.json()
    },
    onSuccess: (data) => {
      toast.success('Lead convertido a paciente', {
        description: `Expediente: ${data.patient?.expNumber || ''}`,
      })
      setConvertLead(null)
      qc.invalidateQueries({ queryKey: ['crm-leads'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const leads: Lead[] = data?.rows || []

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Leads ({leads.length})</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Prospectos sin expediente. Conviértelos en pacientes cuando agenden.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] h-9">
                  <Filter className="h-3.5 w-3.5 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Todos</SelectItem>
                  <SelectItem value="NUEVO">Nuevos</SelectItem>
                  <SelectItem value="CONTACTADO">Contactados</SelectItem>
                  <SelectItem value="AGENDADO">Agendados</SelectItem>
                  <SelectItem value="PERDIDO">Perdidos</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => setNuevoOpen(true)} style={{ backgroundColor: '#0a3143' }}>
                <Plus className="h-4 w-4 mr-1" /> Nuevo lead
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              <UserPlus className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No hay leads. Crea el primero con “Nuevo lead”.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Interés</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Creado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">
                        {l.name}
                        {l.patient && (
                          <Badge variant="outline" className="ml-2 bg-emerald-50 text-emerald-700 border-emerald-300">
                            {l.patient.expNumber}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {l.phone && <div>{l.phone}</div>}
                        {l.email && <div className="text-xs text-muted-foreground">{l.email}</div>}
                        {!l.phone && !l.email && '—'}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{l.interest || '—'}</TableCell>
                      <TableCell>
                        <Select
                          value={l.status}
                          onValueChange={(v) => updateStatus.mutate({ id: l.id, status: v })}
                        >
                          <SelectTrigger className="h-7 w-[130px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(LEAD_STATUS_LABELS).map(([k, label]) => (
                              <SelectItem key={k} value={k}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(l.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {l.waUrl ? (
                            <Button asChild size="sm" variant="ghost" title="WhatsApp">
                              <a href={l.waUrl} target="_blank" rel="noopener noreferrer">
                                <MessageCircle className="h-4 w-4" style={{ color: '#25D366' }} />
                              </a>
                            </Button>
                          ) : null}
                          {!l.patientId && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setConvertLead(l)}
                              title="Convertir a paciente"
                            >
                              <UserPlus className="h-3.5 w-3.5 mr-1" />
                              Convertir
                            </Button>
                          )}
                          {l.patientId && (
                            <Button asChild size="sm" variant="ghost" title="Ver paciente">
                              <a href={`/pacientes/${l.patientId}`}>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {nuevoOpen && <NuevoLeadDialog onClose={() => setNuevoOpen(false)} />}

      <AlertDialog open={!!convertLead} onOpenChange={(o) => !o && setConvertLead(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Convertir a paciente?</AlertDialogTitle>
            <AlertDialogDescription>
              Se creará un expediente para <strong>{convertLead?.name}</strong> con los datos de contacto del lead.
              El lead se marcará como <strong>AGENDADO</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => convertLead && convert.mutate(convertLead.id)}
              style={{ backgroundColor: '#0a3143' }}
            >
              <UserPlus className="h-4 w-4 mr-1" /> Convertir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function NuevoLeadDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [interest, setInterest] = useState('')
  const [notes, setNotes] = useState('')

  const create = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, interest, notes }),
      })
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e.error || 'Error al crear lead')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('Lead creado')
      qc.invalidateQueries({ queryKey: ['crm-leads'] })
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo lead</DialogTitle>
          <DialogDescription>Registra un prospecto para dar seguimiento.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="lead-name">Nombre *</Label>
            <Input id="lead-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Juan Pérez" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="lead-phone">Teléfono</Label>
              <Input id="lead-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="6621234567" />
            </div>
            <div>
              <Label htmlFor="lead-email">Email</Label>
              <Input id="lead-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="juan@ejemplo.com" />
            </div>
          </div>
          <div>
            <Label htmlFor="lead-interest">Interés</Label>
            <Input id="lead-interest" value={interest} onChange={(e) => setInterest(e.target.value)} placeholder="Consulta general, Onicomicosis, etc." />
          </div>
          <div>
            <Label htmlFor="lead-notes">Notas</Label>
            <Textarea id="lead-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Llamó por Facebook, refiere la Dra..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => create.mutate()}
            disabled={!name.trim() || create.isPending}
            style={{ backgroundColor: '#0a3143' }}
          >
            {create.isPending ? 'Guardando...' : 'Guardar lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
