'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Save, Plus, Pencil, Building2, Users, MessageSquare, FileText, KeyRound, UserCog, Pill } from 'lucide-react'
import { toast } from 'sonner'
import { fmtMoney } from '@/lib/format'
import { PrescriptionEditor } from '@/components/cenpod/prescription-editor'

const TPL_VARS = [
  '{{nombre_paciente}}', '{{fecha}}', '{{hora}}', '{{podologo}}',
  '{{clinica}}', '{{link_reserva}}',
]

export default function ConfigPage() {
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-sm text-muted-foreground">Personaliza el sistema para tu clínica</p>
      </div>

      <Tabs defaultValue="clinica">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="clinica" className="gap-1"><Building2 className="h-3.5 w-3.5" /> Clínica</TabsTrigger>
          <TabsTrigger value="equipo" className="gap-1"><Users className="h-3.5 w-3.5" /> Equipo</TabsTrigger>
          <TabsTrigger value="plantillas" className="gap-1"><MessageSquare className="h-3.5 w-3.5" /> Plantillas WhatsApp</TabsTrigger>
          <TabsTrigger value="recetas" className="gap-1"><Pill className="h-3.5 w-3.5" /> Recetas</TabsTrigger>
          <TabsTrigger value="facturacion" className="gap-1"><KeyRound className="h-3.5 w-3.5" /> FacturAPI</TabsTrigger>
          <TabsTrigger value="diagnosticos" className="gap-1"><FileText className="h-3.5 w-3.5" /> Diagnósticos</TabsTrigger>
          <TabsTrigger value="usuarios" className="gap-1"><UserCog className="h-3.5 w-3.5" /> Usuarios</TabsTrigger>
        </TabsList>

        <TabsContent value="clinica"><ClinicaTab /></TabsContent>
        <TabsContent value="equipo"><EquipoTab /></TabsContent>
        <TabsContent value="plantillas"><PlantillasTab /></TabsContent>
        <TabsContent value="recetas"><RecetasTab /></TabsContent>
        <TabsContent value="facturacion"><FacturacionTab /></TabsContent>
        <TabsContent value="diagnosticos"><DiagnosticosTab /></TabsContent>
        <TabsContent value="usuarios"><UsuariosTab /></TabsContent>
      </Tabs>
    </div>
  )
}

function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: () => fetch('/api/config').then((r) => r.json()),
  })
}

function ClinicaTab() {
  const { data, isLoading } = useConfig()
  const qc = useQueryClient()
  const [form, setForm] = useState<any>(null)

  // Cuando carga la data, inicializa el form
  const clinic = data?.clinic
  if (!isLoading && clinic && !form) {
    setForm({
      name: clinic.name || '',
      address: clinic.address || '',
      phone: clinic.phone || '',
      email: clinic.email || '',
      logoUrl: clinic.logoUrl || '',
      openingTime: clinic.openingTime || '08:00',
      closingTime: clinic.closingTime || '20:00',
      slotMinutes: clinic.slotMinutes || 30,
      rfc: clinic.rfc || '',
      razonSocial: clinic.razonSocial || '',
      regimenFiscal: clinic.regimenFiscal || '',
    })
  }

  const save = useMutation({
    mutationFn: (body: any) =>
      fetch('/api/config/clinica', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      toast.success('Datos de la clínica guardados')
      qc.invalidateQueries({ queryKey: ['config'] })
    },
    onError: () => toast.error('Error al guardar'),
  })

  if (isLoading || !form) return <Skeleton className="h-96" />

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Datos de la clínica</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Nombre</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Teléfono</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Dirección</Label>
          <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>URL del logo</Label>
            <Input value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="/logo-dark.png" />
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>Apertura</Label>
            <Input type="time" value={form.openingTime} onChange={(e) => setForm({ ...form, openingTime: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Cierre</Label>
            <Input type="time" value={form.closingTime} onChange={(e) => setForm({ ...form, closingTime: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Slot de agenda (min)</Label>
            <Select value={String(form.slotMinutes)} onValueChange={(v) => setForm({ ...form, slotMinutes: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 min</SelectItem>
                <SelectItem value="20">20 min</SelectItem>
                <SelectItem value="30">30 min</SelectItem>
                <SelectItem value="45">45 min</SelectItem>
                <SelectItem value="60">60 min</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="pt-4 border-t">
          <h3 className="font-medium mb-3">Datos fiscales</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>RFC</Label>
              <Input value={form.rfc} onChange={(e) => setForm({ ...form, rfc: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Razón social</Label>
              <Input value={form.razonSocial} onChange={(e) => setForm({ ...form, razonSocial: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Régimen fiscal</Label>
              <Input value={form.regimenFiscal} onChange={(e) => setForm({ ...form, regimenFiscal: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => save.mutate(form)} disabled={save.isPending} style={{ backgroundColor: '#0a3143' }}>
            <Save className="h-4 w-4 mr-1" /> {save.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function EquipoTab() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['podologos'],
    queryFn: () => fetch('/api/podologos?includeInactive=1').then((r) => r.json()),
  })

  const save = useMutation({
    mutationFn: async (body: any) => {
      if (editing) {
        const res = await fetch(`/api/podologos/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error('Error')
        return res.json()
      } else {
        const res = await fetch('/api/podologos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error('Error')
        return res.json()
      }
    },
    onSuccess: () => {
      toast.success(editing ? 'Podólogo actualizado' : 'Podólogo creado')
      qc.invalidateQueries({ queryKey: ['podologos'] })
      setOpen(false)
      setEditing(null)
    },
    onError: () => toast.error('Error al guardar'),
  })

  const deactivate = useMutation({
    mutationFn: (id: string) => fetch(`/api/podologos/${id}`, { method: 'DELETE' }).then((r) => r.json()),
    onSuccess: () => {
      toast.success('Podólogo desactivado')
      qc.invalidateQueries({ queryKey: ['podologos'] })
    },
  })

  const rows: any[] = Array.isArray(data) ? data : (data?.rows || [])

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Equipo de podólogos</CardTitle>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true) }} style={{ backgroundColor: '#0a3143' }}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">Sin podólogos registrados</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Especialidad</TableHead>
                  <TableHead>Cédula</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Horario</TableHead>
                  <TableHead>Comisión</TableHead>
                  <TableHead>Meta mensual</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-sm">{p.specialty || '—'}</TableCell>
                    <TableCell className="text-sm">{p.cedula || '—'}</TableCell>
                    <TableCell className="text-sm">{p.phone || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.openingTime && p.closingTime
                        ? `${p.openingTime}–${p.closingTime}${p.slotMinutes ? ` · ${p.slotMinutes}min` : ''}`
                        : <span className="text-muted-foreground/60">Default clínica</span>}
                    </TableCell>
                    <TableCell><Badge variant="outline">{p.commissionPct}%</Badge></TableCell>
                    <TableCell className="text-sm">
                      {p.monthlyGoalConsults ? `${p.monthlyGoalConsults} citas` : '—'}
                      {p.monthlyGoalRevenue ? ` / ${fmtMoney(p.monthlyGoalRevenue)}` : ''}
                    </TableCell>
                    <TableCell>
                      {p.active ? <Badge className="bg-emerald-100 text-emerald-700">Activo</Badge> : <Badge variant="secondary">Inactivo</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setOpen(true) }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {p.active && (
                        <Button variant="ghost" size="icon" className="text-red-600" onClick={() => deactivate.mutate(p.id)}>
                          <Plus className="h-4 w-4 rotate-45" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <PodologoDialog open={open} onOpenChange={setOpen} editing={editing} onSave={save.mutate} saving={save.isPending} />
    </Card>
  )
}

function PodologoDialog({ open, onOpenChange, editing, onSave, saving }: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent key={editing?.id || 'new'} className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar podólogo' : 'Nuevo podólogo'}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget as any)
            const body = Object.fromEntries(fd.entries()) as any
            body.commissionPct = Number(body.commissionPct)
            if (body.monthlyGoalConsults) body.monthlyGoalConsults = Number(body.monthlyGoalConsults)
            if (body.monthlyGoalRevenue) body.monthlyGoalRevenue = Number(body.monthlyGoalRevenue)
            // slotMinutes: __default = null (usar el de la clínica)
            if (body.slotMinutes === '__default') {
              body.slotMinutes = null
            } else if (body.slotMinutes) {
              body.slotMinutes = Number(body.slotMinutes)
            }
            // openingTime/closingTime vacíos = null
            if (!body.openingTime) delete body.openingTime
            if (!body.closingTime) delete body.closingTime
            // active: Switch envía "on" vía FormData, convertir a boolean real
            // Si no está en el form (podólogo nuevo), defaultar a true
            if (editing) {
              body.active = body.active === 'on' || body.active === true || body.active === 'true'
            } else {
              delete body.active // nuevos podólogos se crean como active=true por default del schema
            }
            onSave(body)
          }}
          className="space-y-3"
        >
          <div className="space-y-1">
            <Label>Nombre completo *</Label>
            <Input name="name" required defaultValue={editing?.name || ''} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Especialidad</Label>
              <Input name="specialty" defaultValue={editing?.specialty || ''} />
            </div>
            <div className="space-y-1">
              <Label>Cédula profesional</Label>
              <Input name="cedula" defaultValue={editing?.cedula || ''} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Teléfono</Label>
              <Input name="phone" defaultValue={editing?.phone || ''} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input name="email" type="email" defaultValue={editing?.email || ''} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Comisión (%)</Label>
              <Input name="commissionPct" type="number" min={0} max={100} step="0.1" defaultValue={editing?.commissionPct ?? 0} />
            </div>
            <div className="space-y-1">
              <Label>Meta citas/mes</Label>
              <Input name="monthlyGoalConsults" type="number" min={0} defaultValue={editing?.monthlyGoalConsults ?? ''} />
            </div>
            <div className="space-y-1">
              <Label>Meta $/mes</Label>
              <Input name="monthlyGoalRevenue" type="number" min={0} step="0.01" defaultValue={editing?.monthlyGoalRevenue ?? ''} />
            </div>
          </div>

          {/* Horario individual del podólogo */}
          <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
            <p className="text-xs font-medium text-muted-foreground">Horario individual (opcional — si lo dejas vacío, usa el de la clínica)</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Inicio</Label>
                <Input name="openingTime" type="time" defaultValue={editing?.openingTime || ''} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fin</Label>
                <Input name="closingTime" type="time" defaultValue={editing?.closingTime || ''} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Duración cita</Label>
                <Select name="slotMinutes" defaultValue={String(editing?.slotMinutes || '__default')}>
                  <SelectTrigger><SelectValue placeholder="Default" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default">Default clínica</SelectItem>
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="20">20 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="45">45 min</SelectItem>
                    <SelectItem value="60">60 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {editing && (
            <label className="flex items-center gap-2 text-sm">
              <Switch name="active" defaultChecked={editing.active} />
              Activo
            </label>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving} style={{ backgroundColor: '#0a3143' }}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PlantillasTab() {
  const { data, isLoading } = useConfig()
  const qc = useQueryClient()
  const [form, setForm] = useState<any>(null)

  const cfg = data?.config
  if (!isLoading && cfg && !form) {
    setForm({
      tplConfirm: cfg.tplConfirm || '',
      tplReminder: cfg.tplReminder || '',
      tplGoogleReview: cfg.tplGoogleReview || '',
      tplBirthday: cfg.tplBirthday || '',
      tplInactive: cfg.tplInactive || '',
      tplFollowUp: cfg.tplFollowUp || '',
    })
  }

  const save = useMutation({
    mutationFn: (body: any) =>
      fetch('/api/config/plantillas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      toast.success('Plantillas guardadas')
      qc.invalidateQueries({ queryKey: ['config'] })
    },
  })

  if (isLoading || !form) return <Skeleton className="h-96" />

  const fields = [
    { key: 'tplConfirm', label: 'Confirmación de cita' },
    { key: 'tplReminder', label: 'Recordatorio (24h antes)' },
    { key: 'tplGoogleReview', label: 'Reseña Google (post-consulta)' },
    { key: 'tplBirthday', label: 'Cumpleaños' },
    { key: 'tplInactive', label: 'Paciente inactivo' },
    { key: 'tplFollowUp', label: 'Seguimiento post-consulta' },
  ]

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Plantillas de mensajes WhatsApp</CardTitle>
        <p className="text-xs text-muted-foreground">
          Estas plantillas se usan en los botones de WhatsApp (wa.me) del sistema. Variables disponibles:
          {' '}{TPL_VARS.map((v) => <code key={v} className="bg-muted px-1 rounded text-[10px] mx-0.5">{v}</code>)}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label>{f.label}</Label>
            <Textarea
              rows={3}
              value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              placeholder="Escribe el mensaje..."
            />
            <div className="flex flex-wrap gap-1">
              {TPL_VARS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setForm({ ...form, [f.key]: (form[f.key] || '') + ' ' + v })}
                  className="text-[10px] px-1.5 py-0.5 rounded border hover:bg-muted"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="flex justify-end">
          <Button onClick={() => save.mutate(form)} disabled={save.isPending} style={{ backgroundColor: '#0a3143' }}>
            <Save className="h-4 w-4 mr-1" /> {save.isPending ? 'Guardando...' : 'Guardar plantillas'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function FacturacionTab() {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  const { data: faStatus, isLoading } = useQuery({
    queryKey: ['facturapi-status'],
    queryFn: () => fetch('/api/config/facturapi').then((r) => r.json()),
  })

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMensaje(null)
    const formData = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/config/facturapi', { method: 'POST', body: formData })
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || 'Error')
      setMensaje({ tipo: 'exito', texto: j.message || 'Configuración guardada correctamente.' })
      qc.invalidateQueries({ queryKey: ['facturapi-status'] })
      qc.invalidateQueries({ queryKey: ['config'] })
      // Limpiar el form
      ;(e.target as HTMLFormElement).reset()
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err.message || 'Error' })
    } finally {
      setLoading(false)
    }
  }

  if (isLoading) return <Skeleton className="h-64" />

  const configured = faStatus?.configured
  const hasCert = faStatus?.hasCertificate
  const org = faStatus?.organization
  const clinic = faStatus?.clinic

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4" /> Facturación con FacturAPI (CFDI 4.0)
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Cada sucursal configura sus datos fiscales y sellos digitales (CSD). Todo se gestiona desde aquí, sin tocar el panel de FacturAPI.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Estado actual */}
        <div className="rounded-lg border p-4 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="font-medium text-sm">Estado de esta sucursal</p>
            <div className="flex gap-2">
              {configured ? (
                <Badge className="bg-emerald-100 text-emerald-700">Organización creada ✓</Badge>
              ) : (
                <Badge variant="secondary">Sin configurar</Badge>
              )}
              {hasCert ? (
                <Badge className="bg-emerald-100 text-emerald-700">CSD cargados ✓</Badge>
              ) : (
                <Badge variant="secondary">Sin CSD</Badge>
              )}
            </div>
          </div>
          {org && (
            <div className="text-xs text-muted-foreground space-y-0.5 pt-2 border-t border-dashed">
              <p><strong>Organización:</strong> {org.legal_name || org.name}</p>
              <p><strong>RFC emisor:</strong> {org.tax_id || '—'}</p>
              <p><strong>Régimen:</strong> {org.tax_system || '—'}</p>
              {org.pending_steps && org.pending_steps.length > 0 && (
                <p className="text-amber-700">
                  <strong>Pendiente:</strong> {org.pending_steps.map((s: any) => s.description).join(', ')}
                </p>
              )}
            </div>
          )}
          {clinic && (
            <div className="text-xs text-muted-foreground pt-1">
              <p>RFC: {clinic.rfc || '—'} · Razón social: {clinic.razonSocial || '—'} · Régimen: {clinic.regimenFiscal || '—'}</p>
            </div>
          )}
          {configured && hasCert && (
            <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
              <p className="font-medium">¡Configuración activa!</p>
              <p>Ya puedes facturar. Los CSD están cargados. Usa el formulario de abajo solo si necesitas actualizar.</p>
            </div>
          )}
          {!configured && (
            <p className="text-xs text-amber-700">
              Completa el formulario de abajo con tus datos fiscales y sube tus Sellos Digitales (CSD) para activar la facturación.
            </p>
          )}
        </div>

        {/* Mensaje de feedback */}
        {mensaje && (
          <div className={`p-3 rounded text-sm ${mensaje.tipo === 'exito' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
            {mensaje.texto}
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <h3 className="text-sm font-medium">
            {configured ? 'Actualizar datos fiscales y/o sellos' : 'Datos fiscales de la sucursal'}
          </h3>

          {/* Datos fiscales */}
          <div className="grid md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Razón social *</Label>
              <Input
                name="razon_social"
                required
                defaultValue={clinic?.razonSocial || org?.legal_name || ''}
                placeholder="Ej. Grupo CENPOD Clínica 1"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Régimen fiscal *</Label>
              <Select name="regimen_fiscal" defaultValue={clinic?.regimenFiscal || org?.tax_system || '612'}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="601">601 · General de Ley Personas Morales</SelectItem>
                  <SelectItem value="612">612 · Personas Físicas con Actividades Empresariales</SelectItem>
                  <SelectItem value="626">626 · Régimen Simplificado de Confianza (RESICO)</SelectItem>
                  <SelectItem value="603">603 · Personas Morales con Fines no Lucrativos</SelectItem>
                  <SelectItem value="608">608 · Demás ingresos</SelectItem>
                  <SelectItem value="616">616 · Sin obligaciones fiscales</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Código postal fiscal *</Label>
              <Input
                name="cp"
                required
                maxLength={5}
                placeholder="83000"
              />
            </div>
          </div>

          {/* CSD */}
          <div className="rounded-lg border border-dashed border-gray-300 bg-muted/30 p-4 space-y-3">
            <p className="text-xs font-bold text-muted-foreground">
              Sellos Digitales (CSD) {configured && hasCert && '— solo subir si actualizas'}
            </p>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Certificado (.cer) {!configured && '*'}</Label>
                <Input
                  name="cer_file"
                  type="file"
                  accept=".cer"
                  required={!configured}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Llave privada (.key) {!configured && '*'}</Label>
                <Input
                  name="key_file"
                  type="file"
                  accept=".key"
                  required={!configured}
                  className="text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Contraseña de los sellos {!configured && '*'}
                {configured && ' (solo si actualizas archivos)'}
              </Label>
              <Input
                name="password"
                type="password"
                required={!configured}
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end">
            <Button type="submit" disabled={loading} style={{ backgroundColor: '#0a3143' }}>
              <Save className="h-4 w-4 mr-1" />
              {loading
                ? 'Configurando...'
                : configured
                  ? 'Actualizar datos fiscales'
                  : 'Guardar configuración'}
            </Button>
          </div>
        </form>

        {/* Instrucciones */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900 space-y-2">
          <p className="font-medium">¿De dónde obtengo mis CSD?</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Entra al <strong>SAT</strong> con tu RFC y contraseña (sat.gob.mx).</li>
            <li>Ve a <strong>Otros trámites → Certificados de Sello Digital</strong> y descarga el .cer y .key.</li>
            <li>La contraseña es la que creaste al generar los sellos en el SAT.</li>
            <li>Sube ambos archivos aquí junto con la contraseña.</li>
            <li>El sistema crea automáticamente tu organización en FacturAPI y registra los sellos.</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}

function RecetasTab() {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Pill className="h-4 w-4" /> Diseño de recetas
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Personaliza cómo se ven las recetas médicas al imprimirlas. Los cambios se reflejan en vivo en la vista previa y se aplican a todas las recetas de esta clínica.
        </p>
      </CardHeader>
      <CardContent>
        <PrescriptionEditor />
      </CardContent>
    </Card>
  )
}

function DiagnosticosTab() {
  const { data, isLoading } = useConfig()
  const qc = useQueryClient()
  const [list, setList] = useState<string[] | null>(null)
  const [newItem, setNewItem] = useState('')

  const cfg = data?.config
  if (!isLoading && cfg && list === null) {
    try {
      setList(JSON.parse(cfg.diagnosesList || '[]'))
    } catch {
      setList([])
    }
  }

  const save = useMutation({
    mutationFn: (body: any) =>
      fetch('/api/config/plantillas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      toast.success('Lista guardada')
      qc.invalidateQueries({ queryKey: ['config'] })
    },
  })

  if (isLoading || list === null) return <Skeleton className="h-64" />

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Lista de diagnósticos predefinidos</CardTitle>
        <p className="text-xs text-muted-foreground">Aparecen como opciones rápidas al registrar una consulta</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newItem.trim()) {
                e.preventDefault()
                setList([...list, newItem.trim()])
                setNewItem('')
              }
            }}
            placeholder="Ej. Onicomicosis"
          />
          <Button
            variant="outline"
            onClick={() => {
              if (newItem.trim()) {
                setList([...list, newItem.trim()])
                setNewItem('')
              }
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {list.map((d, i) => (
            <Badge key={i} variant="secondary" className="text-sm py-1.5 pr-1">
              {d}
              <button
                onClick={() => setList(list.filter((_, idx) => idx !== i))}
                className="ml-1 hover:text-red-600"
              >
                ×
              </button>
            </Badge>
          ))}
          {list.length === 0 && <p className="text-sm text-muted-foreground">Sin diagnósticos. Agrega arriba.</p>}
        </div>
        <div className="flex justify-end">
          <Button onClick={() => save.mutate({ diagnosesList: list })} disabled={save.isPending} style={{ backgroundColor: '#0a3143' }}>
            <Save className="h-4 w-4 mr-1" /> Guardar lista
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// TAB: USUARIOS — Gestión de accesos al sistema
// ============================================================

const ROLES_OPTIONS = [
  { value: 'SUPER', label: 'Súper Dueño', desc: 'Acceso total a todas las clínicas' },
  { value: 'OWNER', label: 'Dueño de Clínica', desc: 'Acceso total a su clínica' },
  { value: 'RECEPTION', label: 'Recepción', desc: 'Agenda, pacientes, caja' },
  { value: 'PODOLOGIST', label: 'Podólogo', desc: 'Solo su agenda del día' },
] as const

function UsuariosTab() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => fetch('/api/usuarios').then((r) => r.json()),
  })
  const usuarios: any[] = data?.data || []

  const { data: podologosData } = useQuery({
    queryKey: ['podologos', 'all'],
    queryFn: () => fetch('/api/podologos?includeInactive=1').then((r) => r.json()),
  })
  const podologos: any[] = Array.isArray(podologosData) ? podologosData : []

  const { data: clinicasData } = useQuery({
    queryKey: ['clinicas-list'],
    queryFn: () => fetch('/api/clinicas').then((r) => r.json()),
  })
  const clinicas: any[] = clinicasData?.data || []

  const saveMutation = useMutation({
    mutationFn: async (body: any) => {
      if (editing) {
        const res = await fetch(`/api/usuarios/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const e = await res.json()
          throw new Error(e.error || 'Error al actualizar')
        }
        return res.json()
      } else {
        const res = await fetch('/api/usuarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const e = await res.json()
          throw new Error(e.error || 'Error al crear')
        }
        return res.json()
      }
    },
    onSuccess: () => {
      toast.success(editing ? 'Usuario actualizado' : 'Usuario creado')
      qc.invalidateQueries({ queryKey: ['usuarios'] })
      setOpen(false)
      setEditing(null)
    },
    onError: (e: any) => toast.error(e.message || 'Error'),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/usuarios/${id}`, { method: 'DELETE' }).then((r) => r.json()),
    onSuccess: () => {
      toast.success('Usuario desactivado')
      qc.invalidateQueries({ queryKey: ['usuarios'] })
    },
    onError: (e: any) => toast.error(e.message),
  })

  const roleLabel = (r: string) => ROLES_OPTIONS.find((o) => o.value === r)?.label || r
  const roleBadge = (r: string) => {
    if (r === 'SUPER') return <Badge className="bg-purple-100 text-purple-800">Súper Dueño</Badge>
    if (r === 'OWNER') return <Badge className="bg-blue-100 text-blue-800">Dueño</Badge>
    if (r === 'RECEPTION') return <Badge className="bg-emerald-100 text-emerald-800">Recepción</Badge>
    if (r === 'PODOLOGIST') return <Badge className="bg-amber-100 text-amber-800">Podólogo</Badge>
    return <Badge variant="secondary">{r}</Badge>
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Usuarios del sistema</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Gestiona quién puede entrar al sistema y con qué permisos. Las contraseñas se guardan encriptadas (bcrypt).
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true) }} style={{ backgroundColor: '#0a3143' }}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo usuario
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : usuarios.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">Sin usuarios registrados</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Clínica</TableHead>
                  <TableHead>Podólogo vinculado</TableHead>
                  <TableHead>Último acceso</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usuarios.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-sm">{u.email}</TableCell>
                    <TableCell>{roleBadge(u.role)}</TableCell>
                    <TableCell className="text-sm">{u.clinic?.name || '—'}</TableCell>
                    <TableCell className="text-sm">{u.podologist?.name || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Nunca'}
                    </TableCell>
                    <TableCell>
                      {u.active ? <Badge className="bg-emerald-100 text-emerald-700">Activo</Badge> : <Badge variant="secondary">Inactivo</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(u); setOpen(true) }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {u.active && (
                        <Button variant="ghost" size="icon" className="text-red-600" onClick={() => deactivateMutation.mutate(u.id)}>
                          <Plus className="h-4 w-4 rotate-45" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <UsuarioDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        clinicas={clinicas}
        podologos={podologos}
        onSave={saveMutation.mutate}
        saving={saveMutation.isPending}
      />
    </Card>
  )
}

function UsuarioDialog({
  open, onOpenChange, editing, clinicas, podologos, onSave, saving,
}: any) {
  const isSuper = editing?.role === 'SUPER' || (!editing && false)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent key={editing?.id || 'new'} className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget as any)
            const body: any = {
              name: fd.get('name'),
              email: fd.get('email'),
              role: fd.get('role'),
              clinicId: fd.get('clinicId') || undefined,
              podologistId: fd.get('podologistId') || undefined,
              // Al crear: siempre activo. Al editar: respeta el switch.
              active: editing ? fd.get('active') === 'on' : true,
            }
            const password = fd.get('password')
            if (password) body.password = password
            onSave(body)
          }}
          className="space-y-3"
        >
          <div className="space-y-1">
            <Label>Nombre completo *</Label>
            <Input name="name" required defaultValue={editing?.name || ''} />
          </div>
          <div className="space-y-1">
            <Label>Correo electrónico *</Label>
            <Input name="email" type="email" required defaultValue={editing?.email || ''} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{editing ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}</Label>
              <Input name="password" type="password" minLength={editing ? 0 : 6} required={!editing} placeholder={editing ? '••••••' : 'Mínimo 6 caracteres'} />
            </div>
            <div className="space-y-1">
              <Label>Rol *</Label>
              <Select name="role" defaultValue={editing?.role || 'RECEPTION'}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <div>
                        <div className="font-medium">{r.label}</div>
                        <div className="text-[10px] text-muted-foreground">{r.desc}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Clínica *</Label>
            <Select name="clinicId" defaultValue={editing?.clinicId || ''}>
              <SelectTrigger><SelectValue placeholder="Selecciona una clínica" /></SelectTrigger>
              <SelectContent>
                {clinicas.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Podólogo vinculado — solo si rol es PODOLOGIST */}
          <div className="space-y-1">
            <Label>Podólogo vinculado (solo si rol = Podólogo)</Label>
            <Select name="podologistId" defaultValue={editing?.podologistId || ''}>
              <SelectTrigger><SelectValue placeholder="— Ninguno —" /></SelectTrigger>
              <SelectContent>
                {podologos.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}{p.specialty ? ` · ${p.specialty}` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Si eliges rol Podólogo, debes vincularlo a un podólogo existente (créalo antes en la pestaña Equipo).
            </p>
          </div>

          {editing && (
            <label className="flex items-center gap-2 text-sm">
              <Switch name="active" defaultChecked={editing.active} />
              Activo
            </label>
          )}

          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            <strong>Recordatorio:</strong> Las contraseñas se encriptan automáticamente con bcrypt.
            {editing ? ' Si dejas el campo de contraseña vacío, se conserva la actual.' : ''}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving} style={{ backgroundColor: '#0a3143' }}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
