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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Pencil, Trash2, ListChecks, Clock, DollarSign, Percent } from 'lucide-react'
import { toast } from 'sonner'
import { fmtMoney } from '@/lib/format'

const IVA_TYPES: Record<string, string> = {
  EXENTO: 'Exento',
  IVA0: 'IVA 0%',
  IVA16: 'IVA 16%',
}

type Service = {
  id: string
  name: string
  description: string | null
  durationMin: number
  price: number
  commissionPct: number
  ivaType: string
  active: boolean
}

export default function ServiciosPage() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['servicios', showInactive],
    queryFn: () =>
      fetch(`/api/servicios?includeInactive=${showInactive ? '1' : '0'}`).then((r) => r.json()),
  })

  const saveMutation = useMutation({
    mutationFn: async (svc: any) => {
      if (editing) {
        const res = await fetch(`/api/servicios/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(svc),
        })
        if (!res.ok) throw new Error('Error al actualizar')
        return res.json()
      } else {
        const res = await fetch('/api/servicios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(svc),
        })
        if (!res.ok) throw new Error('Error al crear')
        return res.json()
      }
    },
    onSuccess: () => {
      toast.success(editing ? 'Servicio actualizado' : 'Servicio creado')
      qc.invalidateQueries({ queryKey: ['servicios'] })
      setOpen(false)
      setEditing(null)
    },
    onError: (e: any) => toast.error(e.message || 'Error'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/servicios/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al desactivar')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Servicio desactivado')
      qc.invalidateQueries({ queryKey: ['servicios'] })
    },
    onError: (e: any) => toast.error(e.message),
  })

  const rows: Service[] = data?.rows || []

  function onNew() {
    setEditing(null)
    setOpen(true)
  }

  function onEdit(s: Service) {
    setEditing(s)
    setOpen(true)
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ListChecks className="h-6 w-6" /> Servicios
          </h1>
          <p className="text-sm text-muted-foreground">Catálogo de servicios clínicos con precio, duración y comisión</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs flex items-center gap-2 cursor-pointer">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} />
            Ver inactivos
          </label>
          <Button onClick={onNew} size="sm" style={{ backgroundColor: '#0a3143' }}>
            <Plus className="h-4 w-4 mr-1" /> Nuevo servicio
          </Button>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              No hay servicios. Crea el primero.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Servicio</TableHead>
                    <TableHead className="w-32">Duración</TableHead>
                    <TableHead className="w-32">Precio</TableHead>
                    <TableHead className="w-28">Comisión</TableHead>
                    <TableHead className="w-28">IVA</TableHead>
                    <TableHead className="w-20">Estado</TableHead>
                    <TableHead className="w-24 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium">{s.name}</div>
                        {s.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1">{s.description}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3 text-muted-foreground" /> {s.durationMin} min
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">{fmtMoney(s.price)}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-sm">
                          <Percent className="h-3 w-3 text-muted-foreground" /> {s.commissionPct}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{IVA_TYPES[s.ivaType] || s.ivaType}</Badge>
                      </TableCell>
                      <TableCell>
                        {s.active ? (
                          <Badge className="bg-emerald-100 text-emerald-700">Activo</Badge>
                        ) : (
                          <Badge variant="secondary">Inactivo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => onEdit(s)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {s.active && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(s.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
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
      </Card>

      <ServiceDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSave={(svc) => saveMutation.mutate(svc)}
        saving={saveMutation.isPending}
      />
    </div>
  )
}

function ServiceDialog({
  open,
  onOpenChange,
  editing,
  onSave,
  saving,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: Service | null
  onSave: (svc: any) => void
  saving: boolean
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [durationMin, setDurationMin] = useState(30)
  const [price, setPrice] = useState(0)
  const [commissionPct, setCommissionPct] = useState(0)
  const [ivaType, setIvaType] = useState('EXENTO')
  const [active, setActive] = useState(true)

  // Reset on open
  useState(() => {
    if (editing) {
      setName(editing.name)
      setDescription(editing.description || '')
      setDurationMin(editing.durationMin)
      setPrice(editing.price)
      setCommissionPct(editing.commissionPct)
      setIvaType(editing.ivaType)
      setActive(editing.active)
    } else {
      setName('')
      setDescription('')
      setDurationMin(30)
      setPrice(0)
      setCommissionPct(0)
      setIvaType('EXENTO')
      setActive(true)
    }
  })

  // Use useEffect-like via key on dialog
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent key={editing?.id || 'new'} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar servicio' : 'Nuevo servicio'}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSave({ name, description, durationMin, price, commissionPct, ivaType, active })
          }}
          className="space-y-3"
        >
          <div className="space-y-1">
            <Label>Nombre *</Label>
            <Input
              required
              defaultValue={editing?.name || ''}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Consulta general"
            />
          </div>
          <div className="space-y-1">
            <Label>Descripción</Label>
            <Textarea
              defaultValue={editing?.description || ''}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Duración (min)</Label>
              <Input
                type="number"
                min={5}
                step={5}
                defaultValue={editing?.durationMin ?? 30}
                onChange={(e) => setDurationMin(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label>Precio (MXN)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                defaultValue={editing?.price ?? 0}
                onChange={(e) => setPrice(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Comisión podólogo (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.1"
                defaultValue={editing?.commissionPct ?? 0}
                onChange={(e) => setCommissionPct(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label>Tipo de IVA</Label>
              <Select defaultValue={editing?.ivaType || 'EXENTO'} onValueChange={setIvaType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXENTO">Exento</SelectItem>
                  <SelectItem value="IVA0">IVA 0%</SelectItem>
                  <SelectItem value="IVA16">IVA 16%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {editing && (
            <label className="flex items-center gap-2 text-sm">
              <Switch defaultChecked={editing.active} onCheckedChange={setActive} />
              Activo
            </label>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} style={{ backgroundColor: '#0a3143' }}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
