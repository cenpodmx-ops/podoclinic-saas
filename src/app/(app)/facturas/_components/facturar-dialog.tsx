'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Eye,
  FileText,
  Mail,
  MessageCircle,
  Save,
  Send,
  ShieldAlert,
} from 'lucide-react'
import { fmtMoney, fmtDateTime } from '@/lib/format'
import {
  PAYMENT_FORM_OPTIONS,
  USE_CFDI_OPTIONS,
  TAX_SYSTEM_OPTIONS,
  type CitableConsultation,
  type CreateInvoiceResponse,
  type InvoiceItem,
  type IvaType,
} from '../_lib/types'

interface FacturarDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  consultation: CitableConsultation | null
  facturapiConfigured: boolean
}

type Tab = 'datos' | 'preview'

export function FacturarDialog({
  open,
  onOpenChange,
  consultation,
  facturapiConfigured,
}: FacturarDialogProps) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('datos')
  const [created, setCreated] = useState<CreateInvoiceResponse | null>(null)

  // Datos fiscales editables (inicializados con lo que ya sabemos del paciente)
  const [rfc, setRfc] = useState(consultation?.patientRfc || '')
  const [razonSocial, setRazonSocial] = useState(consultation?.patientName || '')
  const [regimenFiscal, setRegimenFiscal] = useState('')
  const [cfdiUso, setCfdiUso] = useState('G03')
  const [emailFactura, setEmailFactura] = useState('')
  const [paymentForm, setPaymentForm] = useState('01')
  const [syncedPatientId, setSyncedPatientId] = useState<string | null>(null)

  // Traer detalle del paciente para precargar datos fiscales
  const patientQ = useQuery<any>({
    queryKey: ['paciente-factura', consultation?.patientId],
    queryFn: async () => {
      const r = await fetch(`/api/pacientes/${consultation!.patientId}`)
      if (!r.ok) throw new Error('No se pudo cargar el paciente')
      return r.json()
    },
    enabled: !!consultation?.patientId && open,
    staleTime: 0,
  })

  // Sync condicional (sin useEffect): cuando llegan los datos del paciente, actualizar los campos
  if (patientQ.data && syncedPatientId !== patientQ.data.id) {
    setSyncedPatientId(patientQ.data.id)
    setRfc(patientQ.data.rfc || '')
    setRazonSocial(patientQ.data.razonSocial || `${patientQ.data.firstName} ${patientQ.data.lastName}`)
    setRegimenFiscal(patientQ.data.regimenFiscal || '')
    setCfdiUso(patientQ.data.cfdiUso || 'G03')
    setEmailFactura(patientQ.data.emailFactura || patientQ.data.email || '')
  }

  // Traer detalle de la consulta para items
  const consultaQ = useQuery<{
    items: InvoiceItem[]
    consultPrice: number
    productsTotal: number
    discount: number
    total: number
    paymentMethod: string | null
    patient: any
  }>({
    queryKey: ['consulta-detalle-factura', consultation?.id],
    queryFn: async () => {
      const r = await fetch(`/api/consultas/${consultation!.id}`)
      if (!r.ok) throw new Error('No se pudo cargar la consulta')
      return r.json()
    },
    enabled: !!consultation?.id && open,
    staleTime: 0,
  })

  // Items derivados para la factura (con descuento proporcional)
  const invoiceItems: InvoiceItem[] = useMemo(() => {
    if (!consultaQ.data) return []
    const items: InvoiceItem[] = []

    // Los items ya incluyen el servicio de consulta si se seleccionó.
    // NO agregar "Consulta médica podológica" por separado — eso duplicaba el cargo.
    // Solo usar los items que vienen de la consulta.
    for (const it of consultaQ.data.items || []) {
      const type = (it.type === 'MEDICAMENTO' || it.type === 'SERVICIO' ? it.type : 'PRODUCTO') as InvoiceItem['type']
      items.push({
        name: it.name,
        qty: it.qty,
        price: it.price,
        type,
        ivaType: (type === 'MEDICAMENTO' ? 'IVA0' : type === 'PRODUCTO' ? 'IVA16' : 'EXENTO') as IvaType,
      })
    }

    // Si NO hay items (caso raro), usar el consultPrice como fallback
    if (items.length === 0 && consultaQ.data.consultPrice > 0) {
      items.push({
        name: 'Consulta médica podológica',
        qty: 1,
        price: consultaQ.data.consultPrice,
        type: 'SERVICIO',
        ivaType: 'EXENTO' as IvaType,
      })
    }

    // Aplicar descuento proporcional
    const discount = consultaQ.data.discount || 0
    if (discount > 0 && items.length > 0) {
      const gross = items.reduce((s, i) => s + i.qty * i.price, 0)
      if (gross > 0) {
        const ratio = Math.max(0, 1 - discount / gross)
        for (const it of items) it.price = Math.round(it.price * ratio * 100) / 100
      }
    }
    return items
  }, [consultaQ.data])

  const totals = useMemo(() => {
    const subtotal = invoiceItems.reduce((s, i) => s + i.qty * i.price, 0)
    const iva = invoiceItems
      .filter((i) => i.ivaType === 'IVA16')
      .reduce((s, i) => s + i.qty * i.price * 0.16, 0)
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      iva: Math.round(iva * 100) / 100,
      total: Math.round((subtotal + iva) * 100) / 100,
    }
  }, [invoiceItems])

  // Mutación: guardar datos fiscales del paciente antes de timbrar
  const saveFiscalMut = useMutation({
    mutationFn: async () => {
      if (!consultation) return
      const r = await fetch(`/api/pacientes/${consultation.patientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rfc, razonSocial, regimenFiscal, cfdiUso, emailFactura }),
      })
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e.error || 'No se pudieron guardar los datos fiscales')
      }
      return r.json()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // Mutación: crear/timbrar factura
  const createMut = useMutation({
    mutationFn: async () => {
      if (!consultation) throw new Error('Sin consulta seleccionada')
      await saveFiscalMut.mutateAsync()
      const r = await fetch('/api/facturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consultationId: consultation.id,
          paymentForm,
          useCfdi: cfdiUso,
        }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Error al timbrar la factura')
      return data as CreateInvoiceResponse
    },
    onSuccess: (data) => {
      setCreated(data)
      setTab('preview')
      qc.invalidateQueries({ queryKey: ['facturas-citables'] })
      qc.invalidateQueries({ queryKey: ['facturas-list'] })
      qc.invalidateQueries({ queryKey: ['facturas-resumen'] })
      if (data.simulated) {
        toast.success('Factura generada en modo simulación')
      } else {
        toast.success(`Factura timbrada: ${data.folio || ''}`)
      }
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (!consultation) return null

  const rfcValid = !!rfc.trim() && rfc.trim().length >= 12
  const canTimbrar = rfcValid && !!razonSocial.trim() && !created

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" style={{ color: '#0a3143' }} />
            Generar factura
          </DialogTitle>
          <DialogDescription>
            Consulta de {consultation.patientName} · {format(new Date(consultation.date), 'dd/MM/yyyy')}
          </DialogDescription>
        </DialogHeader>

        {!facturapiConfigured && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-0.5">Modo simulación — sin token configurado</p>
              <p>
                La factura se generará pero no se timbrará ante el SAT. Configura tu token de FacturAPI en{' '}
                <a href="/config" className="underline font-medium">Configuración → FacturAPI</a>.
              </p>
            </div>
          </div>
        )}

        {created ? (
          <SuccessPanel
            created={created}
            consultation={consultation}
            simulated={created.simulated}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <>
            <div className="flex gap-1 border-b">
              <button
                type="button"
                className={`px-3 py-1.5 text-sm font-medium border-b-2 -mb-px ${tab === 'datos' ? 'border-[#0a3143] text-[#0a3143]' : 'border-transparent text-muted-foreground'}`}
                onClick={() => setTab('datos')}
              >
                1 · Datos fiscales
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 text-sm font-medium border-b-2 -mb-px ${tab === 'preview' ? 'border-[#0a3143] text-[#0a3143]' : 'border-transparent text-muted-foreground'}`}
                onClick={() => setTab('preview')}
              >
                2 · Vista previa
              </button>
            </div>

            {tab === 'datos' && (
              <div className="space-y-4">
                <div className="rounded-lg border p-4 space-y-4 bg-muted/20">
                  <div className="text-sm font-semibold flex items-center gap-1.5">
                    <span>Datos fiscales del paciente</span>
                    {!rfcValid && (
                      <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                        RFC requerido
                      </Badge>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">RFC *</Label>
                      <Input
                        value={rfc}
                        onChange={(e) => setRfc(e.target.value.toUpperCase())}
                        placeholder="XAXX010101000"
                        className="font-mono uppercase"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Razón social *</Label>
                      <Input
                        value={razonSocial}
                        onChange={(e) => setRazonSocial(e.target.value)}
                        placeholder="Nombre o denominación social"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Régimen fiscal SAT</Label>
                      <Select value={regimenFiscal || '__none'} onValueChange={(v) => setRegimenFiscal(v === '__none' ? '' : v)}>
                        <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">— Sin especificar —</SelectItem>
                          {TAX_SYSTEM_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Uso CFDI</Label>
                      <Select value={cfdiUso} onValueChange={setCfdiUso}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {USE_CFDI_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Email para factura</Label>
                      <Input
                        type="email"
                        value={emailFactura}
                        onChange={(e) => setEmailFactura(e.target.value)}
                        placeholder="cliente@correo.com"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Forma de pago</Label>
                      <Select value={paymentForm} onValueChange={setPaymentForm}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PAYMENT_FORM_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {consultaQ.isLoading && (
                  <div className="text-sm text-muted-foreground">Cargando items de la consulta…</div>
                )}
                {consultaQ.data && (
                  <div className="rounded-lg border p-3">
                    <div className="text-sm font-semibold mb-2">Resumen de la consulta</div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Concepto</TableHead>
                          <TableHead className="text-center">Cant.</TableHead>
                          <TableHead className="text-right">Precio</TableHead>
                          <TableHead className="text-right">Importe</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {consultaQ.data.consultPrice > 0 && (
                          <TableRow>
                            <TableCell>Consulta médica podológica</TableCell>
                            <TableCell className="text-center">1</TableCell>
                            <TableCell className="text-right">{fmtMoney(consultaQ.data.consultPrice)}</TableCell>
                            <TableCell className="text-right">{fmtMoney(consultaQ.data.consultPrice)}</TableCell>
                          </TableRow>
                        )}
                        {(consultaQ.data.items || []).map((it, i) => (
                          <TableRow key={i}>
                            <TableCell>{it.name}</TableCell>
                            <TableCell className="text-center">{it.qty}</TableCell>
                            <TableCell className="text-right">{fmtMoney(it.price)}</TableCell>
                            <TableCell className="text-right">{fmtMoney(it.qty * it.price)}</TableCell>
                          </TableRow>
                        ))}
                        {!!consultaQ.data.discount && consultaQ.data.discount > 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-right text-muted-foreground">Descuento</TableCell>
                            <TableCell className="text-right text-red-600">-{fmtMoney(consultaQ.data.discount)}</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <Button
                  className="w-full"
                  style={{ backgroundColor: '#0a3143' }}
                  onClick={() => setTab('preview')}
                  disabled={!consultaQ.data}
                >
                  <Eye className="h-4 w-4 mr-2" /> Ver vista previa
                </Button>
              </div>
            )}

            {tab === 'preview' && (
              <div className="space-y-4">
                <InvoicePreview
                  items={invoiceItems}
                  subtotal={totals.subtotal}
                  iva={totals.iva}
                  total={totals.total}
                  rfc={rfc}
                  razonSocial={razonSocial}
                  cfdiUso={cfdiUso}
                  paymentForm={paymentForm}
                  simulated={!facturapiConfigured}
                />

                <div className="flex flex-col sm:flex-row gap-2 justify-between">
                  <Button variant="outline" onClick={() => setTab('datos')}>
                    ← Editar datos
                  </Button>
                  <Button
                    style={{ backgroundColor: '#0a3143' }}
                    onClick={() => createMut.mutate()}
                    disabled={!canTimbrar || createMut.isPending}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {createMut.isPending
                      ? 'Timbrando…'
                      : facturapiConfigured
                        ? 'Timbrar ante el SAT'
                        : 'Generar (simulación)'}
                  </Button>
                </div>
                {!rfcValid && (
                  <p className="text-xs text-amber-700 text-center">
                    Se requiere RFC válido (mínimo 12 caracteres) para generar la factura.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ──────────────────────────────────────────────────────────
// Vista previa de la factura
// ──────────────────────────────────────────────────────────

function InvoicePreview({
  items,
  subtotal,
  iva,
  total,
  rfc,
  razonSocial,
  cfdiUso,
  paymentForm,
  simulated,
}: {
  items: InvoiceItem[]
  subtotal: number
  iva: number
  total: number
  rfc: string
  razonSocial: string
  cfdiUso: string
  paymentForm: string
  simulated: boolean
}) {
  const PRODUCT_KEYS: Record<string, string> = {
    SERVICIO: '82111501',
    MEDICAMENTO: '61102201',
    PRODUCTO: '41111501',
  }
  return (
    <div className="rounded-lg border-2 border-[#0a3143]/30 p-4 bg-white">
      {simulated && (
        <div className="mb-3 rounded-md bg-amber-50 border border-amber-200 text-amber-900 px-2 py-1 text-xs text-center font-semibold">
          ⚠ Modo simulación — no se timbrará ante el SAT
        </div>
      )}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-bold text-base text-[#0a3143]">CENPOD</div>
          <div className="text-xs text-muted-foreground">Factura · CFDI 4.0</div>
        </div>
        <div className="text-right text-xs">
          <Badge variant="outline" className={simulated ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}>
            {simulated ? 'SIMULACIÓN' : 'POR TIMBRAR'}
          </Badge>
        </div>
      </div>
      <Separator className="my-2" />
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div>
          <div className="text-muted-foreground">Receptor:</div>
          <div className="font-semibold">{razonSocial || '—'}</div>
          <div className="font-mono">{rfc || '—'}</div>
        </div>
        <div className="text-right">
          <div className="text-muted-foreground">Uso CFDI:</div>
          <div className="font-semibold">{cfdiUso}</div>
          <div className="text-muted-foreground">Forma de pago: <span className="font-semibold">{paymentForm}</span></div>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-[#0a3143]/5">
            <TableHead className="text-xs">Clave</TableHead>
            <TableHead className="text-xs">Descripción</TableHead>
            <TableHead className="text-xs text-center">Cant.</TableHead>
            <TableHead className="text-xs text-center">IVA</TableHead>
            <TableHead className="text-xs text-right">Precio</TableHead>
            <TableHead className="text-xs text-right">Importe</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground text-xs py-4">Sin items</TableCell>
            </TableRow>
          )}
          {items.map((it, i) => (
            <TableRow key={i}>
              <TableCell className="text-xs font-mono text-muted-foreground">{PRODUCT_KEYS[it.type]}</TableCell>
              <TableCell className="text-xs">{it.name}</TableCell>
              <TableCell className="text-xs text-center">{it.qty}</TableCell>
              <TableCell className="text-xs text-center">{it.ivaType === 'IVA16' ? '16%' : it.ivaType === 'IVA0' ? '0%' : 'Ex.'}</TableCell>
              <TableCell className="text-xs text-right">{fmtMoney(it.price)}</TableCell>
              <TableCell className="text-xs text-right font-medium">{fmtMoney(it.qty * it.price)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Separator className="my-2" />
      <div className="flex justify-end gap-6 text-sm">
        <div className="space-y-1">
          <div className="flex justify-between gap-8"><span className="text-muted-foreground">Subtotal:</span><span className="font-mono">{fmtMoney(subtotal)}</span></div>
          <div className="flex justify-between gap-8"><span className="text-muted-foreground">IVA (16%):</span><span className="font-mono">{fmtMoney(iva)}</span></div>
          <div className="flex justify-between gap-8 font-bold text-base text-[#0a3143] border-t pt-1"><span>Total:</span><span className="font-mono">{fmtMoney(total)} MXN</span></div>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// Panel de éxito con botones de envío
// ──────────────────────────────────────────────────────────

function SuccessPanel({
  created,
  consultation,
  simulated,
  onClose,
}: {
  created: CreateInvoiceResponse
  consultation: CitableConsultation
  simulated: boolean
  onClose: () => void
}) {
  const pdfHref = simulated ? `/api/facturas/${created.id}/pdf?html=1` : `/api/facturas/${created.id}?format=pdf`

  const waUrl = useMemo(() => {
    const phone = normalizePhone(consultation.patientPhone)
    if (!phone) return null
    const msg = `Hola ${consultation.patientName}, tu factura ${created.folio || ''} está lista. Puedes consultarla aquí: ${typeof window !== 'undefined' ? window.location.origin : ''}${pdfHref}`
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
  }, [consultation, created, pdfHref])

  const mailto = useMemo(() => {
    const subject = `Factura ${created.folio || ''} — CENPOD`
    const body = `Hola ${consultation.patientName},\n\nTu factura ${created.folio || ''} por ${fmtMoney(created.total)} MXN está lista.\n\nPuedes consultarla en: ${typeof window !== 'undefined' ? window.location.origin : ''}${pdfHref}\n\nSaludos,\nCENPOD`
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }, [consultation, created, pdfHref])

  return (
    <div className="space-y-4">
      <div className="text-center py-4">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <FileText className="h-7 w-7 text-emerald-600" />
        </div>
        <div className="text-lg font-bold text-[#0a3143]">
          {simulated ? 'Factura generada (simulación)' : 'Factura timbrada ✓'}
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          {created.folio && <span>Folio: <strong className="font-mono">{created.folio}</strong> · </span>}
          {fmtDateTime(created.date)}
        </div>
        <div className="mt-3 inline-flex flex-wrap gap-3 justify-center text-sm">
          <span>Total: <strong>{fmtMoney(created.total)} MXN</strong></span>
          <span className="text-muted-foreground">·</span>
          <span>Subtotal: {fmtMoney(created.subtotal)}</span>
          <span className="text-muted-foreground">·</span>
          <span>IVA: {fmtMoney(created.iva)}</span>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="text-sm font-semibold">Acciones</div>
        <div className="flex flex-col gap-2">
          <Button asChild variant="default" style={{ backgroundColor: '#0a3143' }} className="w-full justify-center">
            <a href={pdfHref} target="_blank" rel="noreferrer">
              <FileText className="h-4 w-4 mr-2 shrink-0" /> Ver / imprimir PDF
            </a>
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline" disabled={!waUrl} className="justify-center">
              <a href={waUrl || '#'} target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4 mr-2 shrink-0" /> WhatsApp
              </a>
            </Button>
            <Button asChild variant="outline" className="justify-center">
              <a href={mailto}>
                <Mail className="h-4 w-4 mr-2 shrink-0" /> Email
              </a>
            </Button>
          </div>
          {!simulated && created.xmlUrl && (
            <Button asChild variant="ghost" size="sm" className="w-full justify-center">
              <a href={created.xmlUrl} target="_blank" rel="noreferrer">
                <Save className="h-3.5 w-3.5 mr-1.5 shrink-0" /> Descargar XML
              </a>
            </Button>
          )}
        </div>
        {!waUrl && (
          <p className="text-xs text-amber-700">El paciente no tiene teléfono configurado — no se puede enviar por WhatsApp.</p>
        )}
      </div>

      <Button variant="outline" className="w-full" onClick={onClose}>
        Cerrar
      </Button>
    </div>
  )
}

function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null
  let s = String(raw).replace(/[^\d]/g, '')
  if (!s) return null
  if (s.startsWith('52') && s.length >= 12) return s
  if (s.length === 10) return `52${s}`
  if (s.length === 11 && s.startsWith('1')) return `52${s.slice(1)}`
  return s
}
