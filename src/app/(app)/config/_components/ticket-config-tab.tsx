'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Save, Upload, Trash2, Printer } from 'lucide-react'
import { toast } from 'sonner'

// ============================================================
// TicketConfigTab
// Configuración del ticket de consulta (independiente de recetas).
// ============================================================

type TicketConfig = {
  logoUrl?: string | null
  logoSize?: number
  clinicName?: string
  address?: string
  phone?: string
  showLogo?: boolean
  showAddress?: boolean
  showPhone?: boolean
  showClinicName?: boolean
  footerMessage?: string
}

const DEFAULTS: TicketConfig = {
  logoUrl: null,
  logoSize: 60,
  clinicName: '',
  address: '',
  phone: '',
  showLogo: true,
  showAddress: true,
  showPhone: true,
  showClinicName: true,
  footerMessage: '¡Gracias por su visita!',
}

export function TicketConfigTab() {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<TicketConfig>(DEFAULTS)
  const [formLoaded, setFormLoaded] = useState(false)

  const { data, isLoading } = useQuery<{ ticketConfig: TicketConfig; clinic: { name: string; address: string; phone: string } }>({
    queryKey: ['ticket-config'],
    queryFn: () => fetch('/api/config/ticket').then((r) => r.json()),
  })

  if (!isLoading && data && !formLoaded) {
    const tc = data.ticketConfig
    setForm({
      logoUrl: tc.logoUrl ?? null,
      logoSize: tc.logoSize ?? 60,
      clinicName: tc.clinicName || data.clinic.name || '',
      address: tc.address || data.clinic.address || '',
      phone: tc.phone || data.clinic.phone || '',
      showLogo: tc.showLogo ?? true,
      showAddress: tc.showAddress ?? true,
      showPhone: tc.showPhone ?? true,
      showClinicName: tc.showClinicName ?? true,
      footerMessage: tc.footerMessage || '¡Gracias por su visita!',
    })
    setFormLoaded(true)
  }

  const saveMutation = useMutation({
    mutationFn: (body: TicketConfig) =>
      fetch('/api/config/ticket', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      toast.success('Configuración del ticket guardada')
      qc.invalidateQueries({ queryKey: ['ticket-config'] })
    },
    onError: () => toast.error('Error al guardar'),
  })

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/config/ticket', { method: 'POST', body: fd })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Error al subir')
      return j as { url: string }
    },
    onSuccess: (data) => {
      setForm((f) => ({ ...f, logoUrl: data.url }))
      toast.success('Logo del ticket subido')
    },
    onError: (e: any) => toast.error(e.message || 'Error al subir logo'),
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadMutation.mutate(file)
  }

  function update<K extends keyof TicketConfig>(key: K, value: TicketConfig[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  if (isLoading || !formLoaded) {
    return <Skeleton className="h-96" />
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Printer className="h-4 w-4" /> Ticket de consulta
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Configura el ticket que se imprime al finalizar una consulta. El logo y los datos de aquí
          son <strong>independientes</strong> de los de la receta — puedes usar un logo en negro
          para el ticket y otro en blanco para la receta.
        </p>

        {/* Logo */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Logo del ticket</Label>
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={form.showLogo} onCheckedChange={(v) => update('showLogo', v)} />
              Mostrar logo
            </label>
          </div>

          {form.showLogo && (
            <div className="rounded-md border p-4 space-y-3 bg-muted/20">
              <div className="flex items-center justify-center bg-white rounded border p-3" style={{ minHeight: 80 }}>
                {form.logoUrl ? (
                  <img
                    src={form.logoUrl}
                    alt="Logo ticket"
                    style={{ maxHeight: form.logoSize || 60 }}
                    className="object-contain"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">Sin logo — sube uno abajo</span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadMutation.isPending}
                >
                  <Upload className="h-3.5 w-3.5 mr-1" />
                  {uploadMutation.isPending ? 'Subiendo...' : form.logoUrl ? 'Cambiar logo' : 'Subir logo'}
                </Button>
                {form.logoUrl && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => update('logoUrl', null)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Quitar
                  </Button>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Tamaño del logo</Label>
                  <span className="text-xs text-muted-foreground font-mono">{form.logoSize}px</span>
                </div>
                <Slider
                  value={[form.logoSize || 60]}
                  onValueChange={(v) => update('logoSize', v[0])}
                  min={30}
                  max={120}
                  step={5}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                💡 Tip: sube un logo en <strong>negro</strong> para mejor visibilidad en impresoras térmicas.
              </p>
            </div>
          )}
        </div>

        <Separator />

        {/* Datos de la empresa */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Datos de la empresa</Label>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Nombre de la clínica</Label>
              <label className="flex items-center gap-1.5 text-[11px]">
                <Switch checked={form.showClinicName} onCheckedChange={(v) => update('showClinicName', v)} />
                Mostrar
              </label>
            </div>
            <Input
              value={form.clinicName}
              onChange={(e) => update('clinicName', e.target.value)}
              placeholder="CENPOD Ocotillo"
              disabled={!form.showClinicName}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Dirección</Label>
              <label className="flex items-center gap-1.5 text-[11px]">
                <Switch checked={form.showAddress} onCheckedChange={(v) => update('showAddress', v)} />
                Mostrar
              </label>
            </div>
            <Input
              value={form.address}
              onChange={(e) => update('address', e.target.value)}
              placeholder="Av. Obregón 123, Hermosillo, Sonora"
              disabled={!form.showAddress}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Teléfono</Label>
              <label className="flex items-center gap-1.5 text-[11px]">
                <Switch checked={form.showPhone} onCheckedChange={(v) => update('showPhone', v)} />
                Mostrar
              </label>
            </div>
            <Input
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              placeholder="6621234567"
              disabled={!form.showPhone}
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label className="text-sm font-medium">Mensaje al final del ticket</Label>
          <Input
            value={form.footerMessage}
            onChange={(e) => update('footerMessage', e.target.value)}
            placeholder="¡Gracias por su visita!"
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending}
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <Save className="h-4 w-4 mr-1" />
            {saveMutation.isPending ? 'Guardando...' : 'Guardar configuración'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
