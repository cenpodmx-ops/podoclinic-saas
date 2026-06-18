'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight, Wallet, Stethoscope } from 'lucide-react'
import { fmtMoney, fmtDate, fmtDateTime, METHOD_LABELS } from '@/lib/format'
import type { Patient, ConsultationRow } from './types'

function tryParseItems(json: string): any[] {
  try {
    return JSON.parse(json || '[]')
  } catch {
    return []
  }
}

function ConsultationCard({ c }: { c: ConsultationRow }) {
  const [open, setOpen] = useState(false)
  const items = tryParseItems(c.itemsJson)
  const methodLabel = c.paymentMethod ? METHOD_LABELS[c.paymentMethod] || c.paymentMethod : '—'

  return (
    <div className="rounded-md border">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left p-3 flex items-center justify-between hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {c.reason || 'Consulta sin motivo registrado'}
            </p>
            <p className="text-xs text-muted-foreground">
              {fmtDate(c.date)} · {c.podologist?.name || 'Sin podólogo'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {c.paid ? (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">Pagada</Badge>
          ) : (
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">No pagada</Badge>
          )}
          <span className="text-sm font-medium" style={{ color: '#0a3143' }}>{fmtMoney(c.total)}</span>
        </div>
      </button>
      {open && (
        <div className="border-t p-3 bg-muted/20 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Diagnóstico</p>
              <p>{c.diagnosis || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Tratamiento</p>
              <p>{c.treatment || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Método de pago</p>
              <p>{methodLabel}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Seguimiento</p>
              <p>{c.followUpDays ? `${c.followUpDays} días` : '—'}</p>
            </div>
          </div>

          {items.length > 0 && (
            <div>
              <p className="text-[10px] uppercase text-muted-foreground mb-1">Items cobrados</p>
              <div className="rounded border bg-background overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-1.5">Tipo</th>
                      <th className="text-left p-1.5">Nombre</th>
                      <th className="text-right p-1.5">Cant.</th>
                      <th className="text-right p-1.5">Precio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-1.5">{it.type || '—'}</td>
                        <td className="p-1.5">{it.name}</td>
                        <td className="p-1.5 text-right">{it.qty ?? 1}</td>
                        <td className="p-1.5 text-right">{fmtMoney(it.price || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-4 text-xs">
            <span>Consulta: <strong>{fmtMoney(c.consultPrice)}</strong></span>
            <span>Productos: <strong>{fmtMoney(c.productsTotal)}</strong></span>
            {c.discount > 0 && <span>Descuento: <strong>-{fmtMoney(c.discount)}</strong></span>}
            <span>Total: <strong style={{ color: '#0a3143' }}>{fmtMoney(c.total)}</strong></span>
          </div>

          {c.notes && (
            <div>
              <p className="text-[10px] uppercase text-muted-foreground mb-1">Notas</p>
              <p className="text-sm whitespace-pre-wrap">{c.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function TabConsultas({ patient }: { patient: Patient }) {
  const consults = patient.consultations || []

  const stats = useMemo(() => {
    const total = consults.reduce((s, c) => s + c.total, 0)
    const paidTotal = consults.filter((c) => c.paid).reduce((s, c) => s + c.total, 0)
    const unpaidTotal = consults.filter((c) => !c.paid).reduce((s, c) => s + c.total, 0)

    // Podólogo más frecuente
    const byPod: Record<string, { name: string; count: number }> = {}
    for (const c of consults) {
      const key = c.podologistId || 'sin'
      const name = c.podologist?.name || 'Sin asignar'
      byPod[key] = byPod[key] || { name, count: 0 }
      byPod[key].count++
    }
    const topPod = Object.values(byPod).sort((a, b) => b.count - a.count)[0]

    return { total, paidTotal, unpaidTotal, topPod, count: consults.length }
  }, [consults])

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Stethoscope className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Consultas</p>
            </div>
            <p className="text-2xl font-bold">{stats.count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total gastado</p>
            </div>
            <p className="text-2xl font-bold" style={{ color: '#0a3143' }}>{fmtMoney(stats.total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Pagado</p>
            <p className="text-xl font-semibold text-emerald-700">{fmtMoney(stats.paidTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Pendiente</p>
            <p className="text-xl font-semibold text-red-700">{fmtMoney(stats.unpaidTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {stats.topPod && (
        <div className="text-sm text-muted-foreground">
          Podólogo con quien se ha atendido más: <strong className="text-foreground">{stats.topPod.name}</strong> ({stats.topPod.count} consultas)
        </div>
      )}

      {/* Lista */}
      {consults.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground text-sm">
            Sin consultas registradas.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {consults.map((c) => (
            <ConsultationCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  )
}
