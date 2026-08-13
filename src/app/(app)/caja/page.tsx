'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import {
  Wallet,
  Lock,
  LockOpen,
  Plus,
  Send,
  Printer,
  TrendingUp,
  TrendingDown,
  Scale,
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  CreditCard,
  ArrowRightLeft,
  Receipt,
  AlertTriangle,
  Gift,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { fmtMoney, fmtDateTime, fmtTime, METHOD_LABELS } from '@/lib/format'
import { cn } from '@/lib/utils'
import { CorteReport } from './_components/corte-report'
import {
  type CajaApiResponse,
  type CashMovement,
  SOURCE_LABELS,
  EGRESO_CATEGORIES,
  PAYMENT_METHODS,
} from './_components/types'

export default function CajaPage() {
  const { data: session } = useSession()
  const user = session?.user as any
  const qc = useQueryClient()

  const [openingFund, setOpeningFund] = useState('')
  const [egresoOpen, setEgresoOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [waOpen, setWaOpen] = useState(false)
  const [corteOpen, setCorteOpen] = useState(false)

  // Cargar datos de la caja de hoy
  const cajaQ = useQuery<CajaApiResponse>({
    queryKey: ['caja-hoy'],
    queryFn: async () => {
      const r = await fetch('/api/caja')
      if (!r.ok) throw new Error('No se pudo cargar la caja')
      return r.json()
    },
    staleTime: 45_000, // 45s — datos operativos de caja
  })

  // Cargar configuración (nombre de la clínica, dirección, teléfono)
  const configQ = useQuery<any>({
    queryKey: ['config-clinica'],
    queryFn: async () => {
      const r = await fetch('/api/config')
      if (!r.ok) throw new Error('No se pudo cargar configuración')
      return r.json()
    },
    staleTime: 60_000,
  })

  // ── Abrir caja
  const openMutation = useMutation({
    mutationFn: async (openingFund: number) => {
      const r = await fetch('/api/caja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openingFund }),
      })
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e.error || 'No se pudo abrir la caja')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('Caja abierta')
      qc.invalidateQueries({ queryKey: ['caja-hoy'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setOpeningFund('')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // ── Cerrar caja
  const closeMutation = useMutation({
    mutationFn: async (payload: { countedCash: number; notes: string; signatureData?: string | null }) => {
      const r = await fetch(`/api/caja/${cajaQ.data?.session?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e.error || 'No se pudo cerrar la caja')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('Caja cerrada')
      qc.invalidateQueries({ queryKey: ['caja-hoy'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setCloseOpen(false)
      // Mostrar el corte automáticamente tras cerrar
      setTimeout(() => setCorteOpen(true), 200)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // ── Registrar egreso
  const egresoMutation = useMutation({
    mutationFn: async (payload: { amount: number; category: string; description: string; method: string }) => {
      const r = await fetch('/api/caja/egreso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e.error || 'No se pudo registrar el egreso')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('Egreso registrado')
      qc.invalidateQueries({ queryKey: ['caja-hoy'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setEgresoOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // ── Enviar WhatsApp
  const waMutation = useMutation({
    mutationFn: async (phone: string) => {
      const r = await fetch('/api/caja/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e.error || 'No se pudo generar el mensaje')
      }
      return r.json()
    },
    onSuccess: (data: { url: string }) => {
      window.open(data.url, '_blank')
      toast.success('Abriendo WhatsApp...')
      setWaOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // ── Render: cargando
  if (cajaQ.isPending || !cajaQ.data) {
    return (
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  const { session: cashSession, movements, summary } = cajaQ.data

  // Recalcular la diferencia en vivo (los valores guardados en session.difference
  // pueden haber sido calculados con un bug anterior donde openingFund = 0).
  // Diferencia real = efectivo contado - saldo esperado (efectivo en cajón)
  const liveDifference = cashSession?.closed
    ? Math.round(((cashSession.countedCash ?? 0) - summary.saldoEsperado) * 100) / 100
    : null

  // ── Render: sin sesión (caja cerrada — abrir)
  if (!cashSession) {
    return (
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6" style={{ color: 'var(--primary)' }} /> Caja
          </h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString('es-MX', { timeZone: 'America/Hermosillo', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </header>

        <Card className="max-w-md mx-auto shadow-sm">
          <CardHeader className="text-center">
            <div
              className="mx-auto h-14 w-14 rounded-full flex items-center justify-center mb-2"
              style={{ backgroundColor: 'rgba(10, 49, 67, 0.08)' }}
            >
              <Lock className="h-7 w-7" style={{ color: 'var(--primary)' }} />
            </div>
            <CardTitle>Caja cerrada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              No hay una sesión de caja abierta para hoy. Registra el fondo inicial para empezar a operar.
            </p>
            <div className="space-y-2">
              <Label htmlFor="opening-fund">Fondo inicial (efectivo)</Label>
              <Input
                id="opening-fund"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={openingFund}
                onChange={(e) => setOpeningFund(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              style={{ backgroundColor: 'var(--primary)' }}
              disabled={openMutation.isPending || !openingFund}
              onClick={() => openMutation.mutate(Number(openingFund))}
            >
              <LockOpen className="h-4 w-4 mr-2" />
              {openMutation.isPending ? 'Abriendo...' : 'Abrir caja'}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Render: caja abierta
  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6" style={{ color: 'var(--primary)' }} /> Caja
          </h1>
          <p className="text-sm text-muted-foreground">
            {new Date(cajaQ.data.date + 'T00:00:00').toLocaleDateString('es-MX', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            className={cn(
              'text-xs',
              cashSession.closed ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-700 border-emerald-300',
            )}
          >
            {cashSession.closed ? 'Cerrada' : 'Abierta'}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Fondo inicial: <strong className="text-foreground">{fmtMoney(cashSession.openingFund)}</strong>
          </span>
        </div>
      </header>

      {/* Resumen KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Ingresos"
          value={fmtMoney(summary.ingresos)}
          icon={TrendingUp}
          color="text-emerald-700 bg-emerald-50"
        />
        <KpiCard
          label="Egresos"
          value={fmtMoney(summary.egresos)}
          icon={TrendingDown}
          color="text-red-700 bg-red-50"
        />
        <KpiCard
          label="Saldo esperado"
          value={fmtMoney(summary.saldoEsperado)}
          icon={Scale}
          color="text-slate-700 bg-slate-100"
        />
        {cashSession.closed ? (
          <KpiCard
            label="Diferencia"
            value={fmtMoney(liveDifference ?? 0)}
            icon={AlertTriangle}
            color={
              (liveDifference ?? 0) === 0
                ? 'text-emerald-700 bg-emerald-50'
                : 'text-amber-700 bg-amber-50'
            }
          />
        ) : (
          <KpiCard
            label="Movimientos"
            value={String(movements.length)}
            icon={Receipt}
            color="text-primary bg-[#0a3143]/10"
          />
        )}
      </div>

      {/* Por método (cards pequeñas) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MethodCard icon={Banknote} label="Efectivo" value={summary.byMethod.EFECTIVO} />
        <MethodCard icon={CreditCard} label="Tarjeta" value={summary.byMethod.TARJETA} />
        <MethodCard icon={ArrowRightLeft} label="Transferencia" value={summary.byMethod.TRANSFERENCIA} />
        <MethodCard icon={Gift} label="Tarjeta de regalo" value={summary.byMethod.TARJETA_DE_REGALO ?? 0} />
        <MethodCard icon={Wallet} label="Otro" value={summary.byMethod.OTRO} />
      </div>

      {/* Acciones */}
      <div className="flex flex-wrap gap-2">
        {!cashSession.closed && (
          <>
            <Button onClick={() => setEgresoOpen(true)} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" /> Registrar egreso
            </Button>
            <Button onClick={() => setWaOpen(true)} variant="outline" size="sm">
              <Send className="h-4 w-4 mr-1" /> Enviar por WhatsApp
            </Button>
            <Button
              onClick={() => setCloseOpen(true)}
              size="sm"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              <Lock className="h-4 w-4 mr-1" /> Cerrar caja
            </Button>
          </>
        )}
        {cashSession.closed && (
          <>
            <Button onClick={() => setCorteOpen(true)} variant="outline" size="sm">
              <Printer className="h-4 w-4 mr-1" /> Ver corte / Imprimir
            </Button>
            <Button onClick={() => setWaOpen(true)} variant="outline" size="sm">
              <Send className="h-4 w-4 mr-1" /> Enviar por WhatsApp
            </Button>
          </>
        )}
      </div>

      {/* Movimientos */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Movimientos del día</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {movements.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              Sin movimientos registrados todavía.
            </div>
          ) : (
            <div className="max-h-[480px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="w-20">Hora</TableHead>
                    <TableHead className="w-24">Tipo</TableHead>
                    <TableHead className="w-32">Fuente</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="w-28">Método</TableHead>
                    <TableHead className="w-28 text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((m) => (
                    <MovementRow key={m.id} m={m} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo: Registrar egreso */}
      <EgresoDialog
        open={egresoOpen}
        onOpenChange={setEgresoOpen}
        onSubmit={(v) => egresoMutation.mutate(v)}
        isPending={egresoMutation.isPending}
      />

      {/* Diálogo: Cerrar caja */}
      <CloseDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        summary={summary}
        onClose={(v) => closeMutation.mutate(v)}
        isPending={closeMutation.isPending}
      />

      {/* Diálogo: WhatsApp */}
      <WhatsAppDialog
        open={waOpen}
        onOpenChange={setWaOpen}
        onSend={(phone) => waMutation.mutate(phone)}
        isPending={waMutation.isPending}
      />

      {/* Diálogo: Corte imprimible */}
      <Dialog open={corteOpen} onOpenChange={setCorteOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-4 pb-2 sticky top-0 bg-background z-10 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle>Corte de Caja — {fmtDate(cajaQ.data.date)}</DialogTitle>
              <Button size="sm" variant="outline" onClick={() => {
                const corte = document.querySelector('.corte-print') as HTMLElement
                if (!corte) { toast.error('No se pudo encontrar el reporte'); return }
                const html = corte.outerHTML
                const w = window.open('', '_blank', 'width=800,height=600')
                if (!w) { toast.error('Permite popups para imprimir'); return }
                w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Corte de Caja</title><style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;padding:20px;color:#111}@page{size:A4;margin:14mm}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:6px 8px;text-align:left;border-bottom:1px solid #ddd}th{font-weight:700;background:#f5f5f5}.header{text-align:center;border-bottom:2px solid #0a3143;padding-bottom:10px;margin-bottom:16px}.title{font-size:18px;font-weight:700;color:#0a3143}.totals{background:#0a3143;color:#fff;padding:12px;border-radius:6px;margin-top:12px}.totals div{display:flex;justify-content:space-between;padding:4px 0}.signature{margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px}.signature div{border-top:1px solid #333;padding-top:6px;text-align:center;font-size:11px}</style></head><body>${html}<div style="margin-top:20px;text-align:center"><button onclick="window.print()" style="padding:10px 24px;font-size:14px;cursor:pointer;background:#0a3143;color:#fff;border:none;border-radius:6px">Imprimir</button></div></body></html>`)
                w.document.close()
                w.onload = () => setTimeout(() => w.print(), 300)
              }}>
                <Printer className="h-4 w-4 mr-1" /> Imprimir
              </Button>
            </div>
          </DialogHeader>
          <div className="p-2">
            <CorteReport
              data={cajaQ.data}
              responsable={cashSession.closedBy || user?.name || 'Responsable'}
              clinicName={configQ.data?.clinic?.name || 'PodoClinic'}
              clinicAddress={configQ.data?.clinic?.address}
              clinicPhone={configQ.data?.clinic?.phone}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================
// Sub-componentes
// ============================================================

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: string
  icon: any
  color: string
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold mt-1">{value}</p>
          </div>
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function MethodCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-3 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-sm font-semibold truncate">{fmtMoney(value)}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function MovementRow({ m }: { m: CashMovement }) {
  const isIngreso = m.type === 'INGRESO'
  const isInitial = m.source === 'EFECTIVO_INICIAL'
  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{new Date(m.time).toLocaleTimeString('es-MX', { timeZone: 'America/Hermosillo', hour: '2-digit', minute: '2-digit' })}</TableCell>
      <TableCell>
        {isInitial ? (
          <Badge variant="outline" className="text-[10px] bg-slate-50">Fondo</Badge>
        ) : isIngreso ? (
          <Badge className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
            <ArrowUpCircle className="h-3 w-3 mr-0.5" /> Ingreso
          </Badge>
        ) : (
          <Badge className="text-[10px] bg-red-100 text-red-700 hover:bg-red-100">
            <ArrowDownCircle className="h-3 w-3 mr-0.5" /> Egreso
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-xs">{SOURCE_LABELS[m.source] || m.source}</TableCell>
      <TableCell className="text-sm">{m.description || '—'}</TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {m.method ? METHOD_LABELS[m.method] || m.method : '—'}
      </TableCell>
      <TableCell
        className={cn('text-right font-mono font-semibold', isIngreso ? 'text-emerald-700' : 'text-red-700')}
      >
        {isIngreso ? '+' : '−'}
        {fmtMoney(m.amount)}
      </TableCell>
    </TableRow>
  )
}

function EgresoDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSubmit: (v: { amount: number; category: string; description: string; method: string }) => void
  isPending: boolean
}) {
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('OTRO')
  const [description, setDescription] = useState('')
  const [method, setMethod] = useState('EFECTIVO')

  const handle = () => {
    const a = Number(amount)
    if (!a || a <= 0) {
      toast.error('Monto inválido')
      return
    }
    if (!description.trim()) {
      toast.error('Descripción requerida')
      return
    }
    onSubmit({ amount: a, category, description: description.trim(), method })
    setAmount('')
    setDescription('')
    setCategory('OTRO')
    setMethod('EFECTIVO')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar egreso</DialogTitle>
          <DialogDescription>Registra un gasto o salida de efectivo de la caja actual.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="eg-amount">Monto</Label>
            <Input
              id="eg-amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Categoría</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EGRESO_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="eg-desc">Descripción</Label>
            <Textarea
              id="eg-desc"
              placeholder="Detalle del gasto..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Método de pago</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handle} disabled={isPending} style={{ backgroundColor: 'var(--primary)' }}>
            {isPending ? 'Guardando...' : 'Registrar egreso'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CloseDialog({
  open,
  onOpenChange,
  summary,
  onClose,
  isPending,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  summary: CajaApiResponse['summary']
  onClose: (v: { countedCash: number; notes: string; signatureData?: string | null }) => void
  isPending: boolean
}) {
  // Usar saldoEsperado (calculado en vivo) en vez de session.expectedCash
  // (que podría ser null o estar calculado con un bug anterior)
  const expected = summary.saldoEsperado ?? 0
  const [counted, setCounted] = useState('')
  const [notes, setNotes] = useState('')

  const countedNum = Number(counted) || 0
  const difference = Math.round((countedNum - expected) * 100) / 100

  const handle = () => {
    if (isNaN(countedNum) || countedNum < 0) {
      toast.error('Efectivo contado inválido')
      return
    }
    onClose({ countedCash: countedNum, notes: notes.trim() })
    setCounted('')
    setNotes('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cerrar caja</DialogTitle>
          <DialogDescription>Verifica el efectivo y cierra la sesión de caja del día.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fondo inicial:</span>
              <span className="font-medium">{fmtMoney(summary.openingFund)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ingresos en efectivo:</span>
              <span className="font-medium">{fmtMoney(summary.byMethod.EFECTIVO)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Egresos en efectivo:</span>
              <span className="font-medium">{fmtMoney(summary.egresosEfectivo ?? summary.egresos ?? 0)}</span>
            </div>
            <Separator className="my-1" />
            <div className="flex justify-between">
              <span className="font-medium">Efectivo esperado:</span>
              <span className="font-bold" style={{ color: 'var(--primary)' }}>
                {fmtMoney(expected)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="counted-cash">Efectivo contado (real)</Label>
            <Input
              id="counted-cash"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={counted}
              onChange={(e) => setCounted(e.target.value)}
            />
          </div>

          {counted && (
            <div
              className={cn(
                'rounded-lg p-3 text-sm flex items-center justify-between',
                difference === 0
                  ? 'bg-emerald-50 text-emerald-800'
                  : difference > 0
                    ? 'bg-amber-50 text-amber-800'
                    : 'bg-red-50 text-red-800',
              )}
            >
              <span>Diferencia:</span>
              <span className="font-bold">{fmtMoney(difference)}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="close-notes">Notas (opcional)</Label>
            <Textarea
              id="close-notes"
              placeholder="Observaciones del cierre..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handle} disabled={isPending} style={{ backgroundColor: 'var(--primary)' }}>
            <Lock className="h-4 w-4 mr-1" />
            {isPending ? 'Cerrando...' : 'Cerrar caja'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function WhatsAppDialog({
  open,
  onOpenChange,
  onSend,
  isPending,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSend: (phone: string) => void
  isPending: boolean
}) {
  const [phone, setPhone] = useState('')

  const handle = () => {
    const cleaned = phone.replace(/[^0-9]/g, '')
    if (cleaned.length < 10) {
      toast.error('Teléfono inválido (mínimo 10 dígitos)')
      return
    }
    onSend(cleaned)
    setPhone('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar corte por WhatsApp</DialogTitle>
          <DialogDescription>
            Se generará un mensaje con el resumen del corte y se abrirá WhatsApp para que lo envíes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono (10 dígitos)</Label>
            <Input
              id="phone"
              inputMode="tel"
              placeholder="6621234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Se agregará el prefijo +52 automáticamente si son 10 dígitos.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handle} disabled={isPending} style={{ backgroundColor: 'var(--primary)' }}>
            <Send className="h-4 w-4 mr-1" />
            {isPending ? 'Generando...' : 'Abrir WhatsApp'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
