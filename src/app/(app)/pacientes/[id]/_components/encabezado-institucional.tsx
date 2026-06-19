'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, MapPin, Phone, FileText, User, Clock } from 'lucide-react'

type ClinicInfo = {
  id: string
  name: string
  slug: string
  address?: string | null
  phone?: string | null
  email?: string | null
  logoUrl?: string | null
  rfc?: string | null
  razonSocial?: string | null
}

export function EncabezadoInstitucional({
  clinicId,
  profesionalNombre,
  sucursalNombre,
}: {
  clinicId?: string
  profesionalNombre?: string
  sucursalNombre?: string
}) {
  const [now, setNow] = useState<string>('')

  useEffect(() => {
    const tick = () => {
      const d = new Date()
      setNow(
        d.toLocaleString('es-MX', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      )
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [])

  const { data } = useQuery<{ clinic: ClinicInfo | null }>({
    queryKey: ['clinic-config', clinicId || 'default'],
    queryFn: () =>
      fetch(`/api/config${clinicId ? `?clinicId=${clinicId}` : ''}`).then((r) => r.json()),
    enabled: true,
  })

  const clinic = data?.clinic
  const display = clinic?.name || sucursalNombre || 'CENPOD Podología'
  const address = clinic?.address
  const phone = clinic?.phone
  const rfc = clinic?.rfc
  const logo = clinic?.logoUrl

  return (
    <div
      className="rounded-lg text-white p-3 md:p-4 print:p-2"
      style={{ backgroundColor: '#0a3143' }}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Izquierda: logo + nombre + datos fiscales */}
        <div className="flex items-start gap-3 min-w-0">
          {logo ? (
            <img
              src={logo}
              alt={display}
              className="w-12 h-12 rounded-md bg-white/95 object-contain p-1 shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-md bg-white/15 flex items-center justify-center shrink-0">
              <Building2 className="h-6 w-6" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-bold text-sm md:text-base leading-tight truncate">
              {display}
            </p>
            <div className="text-[10px] md:text-[11px] opacity-90 space-y-0.5 mt-0.5">
              {address && (
                <p className="flex items-center gap-1 truncate">
                  <MapPin className="h-3 w-3 shrink-0" /> {address}
                </p>
              )}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {phone}
                  </span>
                )}
                {rfc && (
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" /> RFC: {rfc}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Derecha: sucursal + profesional + fecha */}
        <div className="text-[10px] md:text-[11px] opacity-95 space-y-0.5 md:text-right shrink-0">
          {sucursalNombre && (
            <p>
              <span className="opacity-70">Sucursal:</span> <strong>{sucursalNombre}</strong>
            </p>
          )}
          {profesionalNombre && (
            <p className="flex items-center gap-1 md:justify-end">
              <User className="h-3 w-3" />
              <span className="opacity-70">Profesional:</span> <strong>{profesionalNombre}</strong>
            </p>
          )}
          <p className="flex items-center gap-1 md:justify-end">
            <Clock className="h-3 w-3" />
            <span className="opacity-70">Fecha/hora:</span> <strong>{now}</strong>
          </p>
        </div>
      </div>
    </div>
  )
}
