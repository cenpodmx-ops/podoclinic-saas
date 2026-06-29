'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, HeartPulse, Pill, Phone, Cake, Wallet } from 'lucide-react'
import type { PatientSummary } from '../_lib/types'
import { fmtMoney } from '@/lib/format'
import { format } from 'date-fns'

export function PatientCard({ patient }: { patient: PatientSummary }) {
  const age = patient.birthDate
    ? Math.floor((Date.now() - new Date(patient.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null

  return (
    <Card className="shadow-sm border-l-4" style={{ borderLeftColor: '#0a3143' }}>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold">
                {patient.firstName} {patient.lastName}
              </h2>
              <Badge variant="outline" className="font-mono text-xs">
                Exp. {patient.expNumber}
              </Badge>
              {patient.riskLevel && (
                <Badge
                  variant="outline"
                  className={
                    patient.riskLevel === 'ALTO'
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : patient.riskLevel === 'MEDIO'
                        ? 'border-amber-300 bg-amber-50 text-amber-800'
                        : 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  }
                >
                  Riesgo {patient.riskLevel}
                </Badge>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {patient.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {patient.phone}
                </span>
              )}
              {age !== null && (
                <span className="inline-flex items-center gap-1">
                  <Cake className="h-3 w-3" /> {age} años
                </span>
              )}
              {patient.sex && <span className="uppercase">{patient.sex === 'M' ? 'Mujer' : patient.sex === 'F' ? 'Hombre' : 'Otro'}</span>}
              <span className="inline-flex items-center gap-1">
                <Wallet className="h-3 w-3" /> Acumulado: {fmtMoney(patient.totalSpent)}
              </span>
            </div>
          </div>
        </div>

        {/* Alertas de salud */}
        {(patient.isDiabetic || patient.allergies || patient.chronicConditions || patient.currentMeds) && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {patient.isDiabetic && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-2 py-1.5 text-xs text-red-800">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span className="font-semibold">Paciente diabético</span>
              </div>
            )}
            {patient.allergies && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-2 py-1.5 text-xs text-red-800">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-semibold">Alergias:</span> {patient.allergies}
                </span>
              </div>
            )}
            {patient.chronicConditions && (
              <div className="flex items-center gap-2 rounded-md bg-orange-50 border border-orange-200 px-2 py-1.5 text-xs text-orange-800">
                <HeartPulse className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-semibold">Condiciones:</span> {patient.chronicConditions}
                </span>
              </div>
            )}
            {patient.currentMeds && (
              <div className="flex items-center gap-2 rounded-md bg-orange-50 border border-orange-200 px-2 py-1.5 text-xs text-orange-800">
                <Pill className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-semibold">Meds actuales:</span> {patient.currentMeds}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function TicketPreview({
  data,
  onClose,
}: {
  data: {
    clinic: { name: string; address?: string | null; phone?: string | null; logoUrl?: string | null } | null
    date: Date
    patientName: string
    expNumber: string
    podologistName: string
    items: { name: string; qty: number; price: number }[]
    consultPrice: number
    productsTotal: number
    discount: number
    total: number
    paymentMethod?: string | null
    followUpDays?: number | null
  }
  onClose?: () => void
}) {
  const { clinic, date, patientName, expNumber, podologistName, items, consultPrice, productsTotal, discount, total, paymentMethod, followUpDays } = data

  return (
    <div className="ticket-print mx-auto">
      <div className="ticket-header">
        {clinic?.logoUrl && (
          <div className="ticket-logo-bar">
            <img src={clinic.logoUrl} alt={clinic.name} />
          </div>
        )}
        <div className="ticket-clinic-name">{clinic?.name || 'CENPOD'}</div>
        {clinic?.address && <div>{clinic.address}</div>}
        {clinic?.phone && <div>Tel: {clinic.phone}</div>}
      </div>

      <div className="ticket-row">
        <span>Folio:</span>
        <span className="ticket-bold">{date.getTime().toString().slice(-8)}</span>
      </div>
      <div className="ticket-row">
        <span>Fecha:</span>
        <span>{format(date, 'dd/MM/yyyy HH:mm')}</span>
      </div>
      <div className="ticket-row">
        <span>Paciente:</span>
        <span className="ticket-bold">{patientName}</span>
      </div>
      <div className="ticket-row">
        <span>Expediente:</span>
        <span>{expNumber}</span>
      </div>
      <div className="ticket-row">
        <span>Podólogo:</span>
        <span>{podologistName}</span>
      </div>

      <table>
        <thead>
          <tr>
            <th>Concepto</th>
            <th style={{ textAlign: 'center' }}>Cant.</th>
            <th style={{ textAlign: 'right' }}>Importe</th>
          </tr>
        </thead>
        <tbody>
          {consultPrice > 0 && (
            <tr>
              <td>Consulta</td>
              <td style={{ textAlign: 'center' }}>1</td>
              <td style={{ textAlign: 'right' }}>${consultPrice.toFixed(2)}</td>
            </tr>
          )}
          {items.map((it, i) => (
            <tr key={i}>
              <td>{it.name}</td>
              <td style={{ textAlign: 'center' }}>{it.qty}</td>
              <td style={{ textAlign: 'right' }}>${(it.qty * it.price).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ticket-totals">
        <div className="ticket-row">
          <span>Subtotal:</span>
          <span>${(consultPrice + productsTotal).toFixed(2)}</span>
        </div>
        {discount > 0 && (
          <div className="ticket-row">
            <span>Descuento:</span>
            <span>-${discount.toFixed(2)}</span>
          </div>
        )}
        <div className="ticket-total-row">
          <span>TOTAL:</span>
          <span>${total.toFixed(2)}</span>
        </div>
        {paymentMethod && (
          <div className="ticket-row" style={{ marginTop: 4 }}>
            <span>Método de pago:</span>
            <span>{paymentMethod}</span>
          </div>
        )}
        {followUpDays && followUpDays > 0 && (
          <div className="ticket-row" style={{ marginTop: 4 }}>
            <span>Seguimiento:</span>
            <span>{followUpDays} días</span>
          </div>
        )}
      </div>

      <div className="ticket-footer">
        <div className="ticket-bold">¡Gracias por su visita!</div>
        <div style={{ marginTop: 2 }}>CENPOD · Salud podológica</div>
      </div>

      {onClose && (
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <button
            onClick={onClose}
            style={{
              fontSize: 11,
              border: '1px solid #999',
              padding: '4px 10px',
              background: 'transparent',
              borderRadius: 3,
              cursor: 'pointer',
            }}
            className="no-print"
          >
            Cerrar
          </button>
        </div>
      )}
    </div>
  )
}
