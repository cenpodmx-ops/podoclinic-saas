'use client'

import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { CalendarDays, Clock, Stethoscope, Phone, AlertTriangle, FileText } from 'lucide-react'
import { STATUS_COLORS, STATUS_LABELS, fmtTime } from '@/lib/format'

export default function MiAgendaPage() {
  const { data: session } = useSession()
  const user = session?.user as any
  const today = format(new Date(), 'yyyy-MM-dd')

  const queryParams = new URLSearchParams({
    date: today,
    podologistId: user?.podologistId || '',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['mi-agenda', today, user?.podologistId],
    queryFn: () => fetch(`/api/citas?${queryParams.toString()}`).then((r) => r.json()),
    enabled: !!user?.podologistId,
  })

  const appointments: any[] = data?.appointments || []

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <CalendarDays className="h-5 w-5" style={{ color: 'var(--primary)' }} />
            Mi agenda de hoy
          </h1>
          <p className="text-sm text-muted-foreground capitalize">
            {format(new Date(), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}
          </p>
          {user?.name && (
            <p className="text-xs text-muted-foreground mt-0.5">{user.name}</p>
          )}
        </div>
      </div>

      {/* Summary */}
      {!isLoading && appointments.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <Card className="shadow-none">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>{appointments.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Citas hoy</p>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-emerald-700">
                {appointments.filter((a) => a.status === 'CONFIRMADA' || a.status === 'EN_CONSULTA').length}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase">Activas</p>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-slate-700">
                {appointments.filter((a) => a.status === 'FINALIZADA').length}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase">Finalizadas</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <Card className="shadow-none border-dashed">
          <CardContent className="p-10 text-center">
            <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium">No tienes citas asignadas para hoy</p>
            <p className="text-xs text-muted-foreground">Disfruta tu día libre o revisa la agenda general.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {appointments.map((a) => (
            <Card key={a.id} className="shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center justify-center min-w-16 px-2 py-1 rounded-md bg-muted/40">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-sm font-mono font-semibold mt-0.5">{fmtTime(a.startTime)}</p>
                    <p className="text-[10px] text-muted-foreground">{fmtTime(a.endTime)}</p>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold truncate">
                        {a.patient.firstName} {a.patient.lastName}
                      </p>
                      <Badge className={`text-[10px] ${STATUS_COLORS[a.status] || ''}`}>
                        {STATUS_LABELS[a.status] || a.status}
                      </Badge>
                    </div>
                    {a.reason && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{a.reason}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                      {a.serviceName && (
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" /> {a.serviceName}
                        </span>
                      )}
                      {a.patient.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {a.patient.phone}
                        </span>
                      )}
                      {a.patient.isDiabetic && (
                        <span className="flex items-center gap-1 text-amber-700">
                          <AlertTriangle className="h-3 w-3" /> Diabético
                        </span>
                      )}
                    </div>
                  </div>

                  {a.status === 'CONFIRMADA' || a.status === 'EN_CONSULTA' ? (
                    <Button asChild size="sm" variant="outline" className="hidden sm:flex">
                      <Link href={`/consulta?cita=${a.id}`}>
                        <Stethoscope className="h-3.5 w-3.5 mr-1" /> Consulta
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
