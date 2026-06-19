'use client'

import { Droplet, AlertTriangle, Pill, HeartPulse } from 'lucide-react'
import type { Patient } from './types'

/**
 * Banners de alertas de salud. Deben ser IMPOSIBLES de pasar por alto.
 * - Diabético: rojo sólido
 * - Alergias: naranja
 * - Medicamentos actuales: amarillo
 * - Enfermedades crónicas: rojo claro
 */
export function HealthAlerts({ patient }: { patient: Patient }) {
  const hasAny =
    patient.isDiabetic ||
    !!patient.allergies?.trim() ||
    !!patient.currentMeds?.trim() ||
    !!patient.chronicConditions?.trim()
  if (!hasAny) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
      {patient.isDiabetic && (
        <div className="flex items-start gap-2 rounded-md border-2 border-red-600 bg-red-600 text-white p-3 shadow-sm">
          <Droplet className="h-6 w-6 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold tracking-wide uppercase">Diabético</p>
            <p className="text-xs opacity-90">Requiere manejo especial y precaución en procedimientos.</p>
          </div>
        </div>
      )}

      {patient.allergies?.trim() && (
        <div className="flex items-start gap-2 rounded-md border-2 border-orange-500 bg-orange-100 text-orange-900 p-3 shadow-sm">
          <AlertTriangle className="h-6 w-6 mt-0.5 shrink-0 text-orange-600" />
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-wide uppercase">Alergias</p>
            <p className="text-xs break-words">{patient.allergies}</p>
          </div>
        </div>
      )}

      {patient.currentMeds?.trim() && (
        <div className="flex items-start gap-2 rounded-md border-2 border-amber-400 bg-amber-50 text-amber-900 p-3 shadow-sm">
          <Pill className="h-6 w-6 mt-0.5 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-wide uppercase">Medicamentos</p>
            <p className="text-xs break-words">{patient.currentMeds}</p>
          </div>
        </div>
      )}

      {patient.chronicConditions?.trim() && (
        <div className="flex items-start gap-2 rounded-md border-2 border-rose-300 bg-rose-50 text-rose-900 p-3 shadow-sm">
          <HeartPulse className="h-6 w-6 mt-0.5 shrink-0 text-rose-600" />
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-wide uppercase">Cond. crónicas</p>
            <p className="text-xs break-words">{patient.chronicConditions}</p>
          </div>
        </div>
      )}
    </div>
  )
}
