'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { CATEGORIES, CATEGORY_LABELS, IVA_TYPES, IVA_LABELS, type Product } from './types'

export function ProductFormDialog({
  open,
  onOpenChange,
  editing,
  canEdit,
  onSave,
  saving,
  sessionKey,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: Product | null
  canEdit: boolean
  onSave: (data: any) => void
  saving: boolean
  sessionKey: number
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? (canEdit ? 'Editar producto' : 'Detalle de producto') : 'Nuevo producto'}
          </DialogTitle>
        </DialogHeader>
        {open && (
          <FormBody
            key={sessionKey}
            editing={editing}
            canEdit={canEdit}
            onSave={onSave}
            saving={saving}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function FormBody({
  editing,
  canEdit,
  onSave,
  saving,
  onClose,
}: {
  editing: Product | null
  canEdit: boolean
  onSave: (data: any) => void
  saving: boolean
  onClose: () => void
}) {
  const [name, setName] = useState(editing?.name || '')
  const [description, setDescription] = useState(editing?.description || '')
  const [code, setCode] = useState(editing?.code || '')
  const [category, setCategory] = useState(editing?.category || 'MEDICAMENTO')
  const [costPrice, setCostPrice] = useState(editing?.costPrice ?? 0)
  const [salePrice, setSalePrice] = useState(editing?.salePrice ?? 0)
  const [ivaType, setIvaType] = useState(editing?.ivaType || 'EXENTO')
  const [stock, setStock] = useState(editing?.stock ?? 0)
  const [minStock, setMinStock] = useState(editing?.minStock ?? 0)
  const [supplier, setSupplier] = useState(editing?.supplier || '')
  const [active, setActive] = useState(editing?.active ?? true)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSave({ name, description, code, category, costPrice, salePrice, ivaType, stock, minStock, supplier, active })
      }}
      className="space-y-3"
    >
      <div className="space-y-1">
        <Label>Nombre *</Label>
        <Input
          required
          disabled={!canEdit}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Crema antifúngica 30g"
        />
      </div>
      <div className="space-y-1">
        <Label>Descripción</Label>
        <Textarea
          disabled={!canEdit}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Código</Label>
          <Input
            disabled={!canEdit}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="SKU opcional"
          />
        </div>
        <div className="space-y-1">
          <Label>Categoría *</Label>
          <Select
            disabled={!canEdit}
            value={category}
            onValueChange={setCategory}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Costo (MXN)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            disabled={!canEdit}
            value={costPrice}
            onChange={(e) => setCostPrice(Number(e.target.value))}
          />
        </div>
        <div className="space-y-1">
          <Label>Precio de venta (MXN)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            disabled={!canEdit}
            value={salePrice}
            onChange={(e) => setSalePrice(Number(e.target.value))}
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label>Stock</Label>
          <Input
            type="number"
            min={0}
            disabled={!canEdit}
            value={stock}
            onChange={(e) => setStock(Number(e.target.value))}
          />
        </div>
        <div className="space-y-1">
          <Label>Stock mínimo</Label>
          <Input
            type="number"
            min={0}
            disabled={!canEdit}
            value={minStock}
            onChange={(e) => setMinStock(Number(e.target.value))}
          />
        </div>
        <div className="space-y-1">
          <Label>IVA</Label>
          <Select
            disabled={!canEdit}
            value={ivaType}
            onValueChange={setIvaType}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {IVA_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{IVA_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label>Proveedor</Label>
        <Input
          disabled={!canEdit}
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          placeholder="Distribuidora / laboratorio"
        />
      </div>
      {editing && canEdit && (
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={active}
            onCheckedChange={setActive}
          />
          Producto activo (disponible para venta)
        </label>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cerrar
        </Button>
        {canEdit && (
          <Button type="submit" disabled={saving} style={{ backgroundColor: 'var(--primary)' }}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        )}
      </DialogFooter>
    </form>
  )
}
