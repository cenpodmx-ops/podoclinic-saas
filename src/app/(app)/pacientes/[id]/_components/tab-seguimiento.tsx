'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { fmtDate } from '@/lib/format'
import type { Patient } from './types'
import { Bell, Clock, CheckCircle2, AlertCircle, CalendarClock } from 'lucide-react'

const STATUS_STYLE: Record<string, { label: string; cls: string; icon: any }> = {
  PENDIENTE: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-800 border-amber-300', icon: Clock },
  CONTACTADO: { label: 'Contactado', cls: 'bg-blue-100 text-blue-800 border-blue-300', icon: CheckCircle2 },
  AGENDADO: { label: 'Agendado', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: CalendarClock },
  VENCIDO: { label: 'Vencido', cls: 'bg-red-100 text-red-800 border-red-300', icon: AlertCircle },
}

export function TabSeguimiento({ patient }: { patient: Patient }) {
  const followUps = patient.followUps || []

  if (followUps.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-muted-foreground text-sm">
          <Bell className="h-6 w-6 mx-auto mb-2 opacity-50" />
          Sin seguimientos programados.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {followUps.map((f) => {
        const st = STATUS_STYLE[f.status] || STATUS_STYLE.PENDIENTE
        const Icon = st.icon
        const isOverdue = f.status === 'VENCIDO' || (f.status === 'PENDIENTE' && new Date(f.dueDate) < new Date())
        return (
          <Card key={f.id} className={isOverdue ? 'border-red-300' : ''}>
            <CardContent className="p-3 flex items-start justify-between gap-2">
              <div className="flex items-start gap-3 min-w-0">
                <div className={`p-2 rounded-md ${st.cls}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    Seguimiento · {fmtDate(f.dueDate)}
                    {isOverdue && <span className="text-red-700 ml-2">(vencido)</span>}
                  </p>
                  {f.notes && <p className="text-xs text-muted-foreground mt-0.5">{f.notes}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Creado: {fmtDate(f.createdAt)}
                    {f.whatsappSent && ' · WhatsApp enviado'}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className={st.cls}>{st.label}</Badge>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
