'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, History, Eye, Pencil, Trash2, FilePlus, FileDown, FileSearch } from 'lucide-react'
import { fmtDateTime } from '@/lib/format'
import type { Patient, AuditLogRow } from './types'

const ACTION_ICON: Record<string, any> = {
  VIEW: Eye,
  EDIT: Pencil,
  CREATE: FilePlus,
  DELETE: Trash2,
  EXPORT: FileDown,
  CREATE_PROCEDURE: FilePlus,
  CREATE_CONSENT: FilePlus,
  CREATE_REFERRAL: FilePlus,
}

const ACTION_COLOR: Record<string, string> = {
  VIEW: 'bg-slate-100 text-slate-700 border-slate-300',
  EDIT: 'bg-amber-100 text-amber-800 border-amber-300',
  CREATE: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  CREATE_PROCEDURE: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  CREATE_CONSENT: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  CREATE_REFERRAL: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  DELETE: 'bg-red-100 text-red-800 border-red-300',
  EXPORT: 'bg-purple-100 text-purple-800 border-purple-300',
}

export function AuditoriaTab({ patient }: { patient: Patient }) {
  const { data, isPending: isLoading } = useQuery<AuditLogRow[]>({
    queryKey: ['auditoria', patient.id],
    queryFn: () =>
      fetch(`/api/auditoria?patientId=${patient.id}`)
        .then((r) => r.json())
        .then((d) => d?.data || d || []),
    enabled: !!patient.id,
    retry: false,
  })

  const logs = Array.isArray(data)
    ? data
    : Array.isArray(patient.auditLogs)
      ? patient.auditLogs
      : []

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground flex items-center gap-1">
          <History className="h-4 w-4" /> {logs.length} evento(s) de auditoría
        </p>
        <Badge variant="outline" className="text-[10px]">
          Solo lectura
        </Badge>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            <FileSearch className="h-6 w-6 mx-auto mb-2 opacity-50" />
            Sin eventos de auditoría registrados.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-auto max-h-[600px] rounded-md">
            <Table className="min-w-[900px]">
              <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                <TableRow>
                  <TableHead className="w-36 whitespace-nowrap">Fecha/hora</TableHead>
                  <TableHead className="w-44 whitespace-nowrap">Usuario</TableHead>
                  <TableHead className="w-32 whitespace-nowrap">Acción</TableHead>
                  <TableHead className="w-32 whitespace-nowrap">Sección</TableHead>
                  <TableHead className="min-w-[280px] max-w-[420px]">Detalles</TableHead>
                  <TableHead className="w-24 whitespace-nowrap">IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const Icon = ACTION_ICON[log.action] || Eye
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap">{fmtDateTime(log.createdAt)}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{log.userName || '—'}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] gap-1 whitespace-nowrap ${ACTION_COLOR[log.action] || ''}`}
                        >
                          <Icon className="h-3 w-3" />
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{log.section || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground break-words">
                        {log.details || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                        {log.ip || '—'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  )
}
