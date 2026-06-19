'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { fmtDate, fmtTime, STATUS_COLORS, STATUS_LABELS } from '@/lib/format'
import type { Patient } from './types'
import { CalendarDays, Clock, UserCircle } from 'lucide-react'

export function TabCitas({ patient }: { patient: Patient }) {
  const appts = patient.appointments || []

  if (appts.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-muted-foreground text-sm">
          Sin citas registradas.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {appts.map((a) => {
        const isPast = new Date(a.startTime).getTime() < Date.now()
        return (
          <Card key={a.id}>
            <CardContent className="p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-primary/10 p-2 text-center min-w-[56px]">
                  <p className="text-[10px] uppercase text-muted-foreground">{fmtDate(a.date).slice(3, 5)}</p>
                  <p className="text-lg font-bold leading-tight" style={{ color: '#0a3143' }}>
                    {fmtDate(a.date).slice(0, 2)}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium flex items-center gap-2 flex-wrap">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    {fmtDate(a.date)}
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {fmtTime(a.startTime)} - {fmtTime(a.endTime)}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {a.reason || 'Sin motivo'}
                    {a.serviceName && ` · ${a.serviceName}`}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <UserCircle className="h-3 w-3" />
                    {a.podologist?.name || 'Sin podólogo asignado'}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant="outline" className={STATUS_COLORS[a.status] || ''}>
                  {STATUS_LABELS[a.status] || a.status}
                </Badge>
                {isPast && (
                  <span className="text-[10px] text-muted-foreground">Pasada</span>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
