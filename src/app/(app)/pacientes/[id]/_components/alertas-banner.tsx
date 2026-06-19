'use client'

import { useQuery } from '@tanstack/react-query'
import { AlertOctagon, AlertTriangle, Info } from 'lucide-react'
import type { AlertaRow } from './types'

const LEVELS: Record<
  AlertaRow['level'],
  { bg: string; border: string; text: string; icon: any; label: string }
> = {
  RED: {
    bg: 'bg-red-600',
    border: 'border-red-700',
    text: 'text-white',
    icon: AlertOctagon,
    label: 'URGENTE',
  },
  ORANGE: {
    bg: 'bg-orange-100',
    border: 'border-orange-400',
    text: 'text-orange-900',
    icon: AlertTriangle,
    label: 'ADVERTENCIA',
  },
  YELLOW: {
    bg: 'bg-yellow-100',
    border: 'border-yellow-400',
    text: 'text-yellow-900',
    icon: Info,
    label: 'INFO',
  },
}

export function AlertasBanner({ patientId }: { patientId: string }) {
  const { data } = useQuery<AlertaRow[]>({
    queryKey: ['paciente-alertas', patientId],
    queryFn: () =>
      fetch(`/api/pacientes/${patientId}/alertas`)
        .then((r) => r.json())
        .then((d) => (Array.isArray(d) ? d : d?.data || []))
        .catch(() => []),
    enabled: !!patientId,
    retry: false,
  })

  if (!data || data.length === 0) return null

  return (
    <div className="space-y-2">
      {data.map((a, i) => {
        const cfg = LEVELS[a.level] || LEVELS.YELLOW
        const Icon = cfg.icon
        return (
          <div
            key={i}
            className={`flex items-start gap-3 rounded-md border-2 ${cfg.bg} ${cfg.border} ${cfg.text} p-3 shadow-sm`}
          >
            <Icon className="h-5 w-5 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold tracking-wide uppercase flex items-center gap-2">
                {a.title}
                <span className="text-[9px] bg-black/20 px-1.5 py-0.5 rounded">{cfg.label}</span>
              </p>
              {a.description && (
                <p className="text-xs mt-0.5 opacity-95 break-words">{a.description}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
