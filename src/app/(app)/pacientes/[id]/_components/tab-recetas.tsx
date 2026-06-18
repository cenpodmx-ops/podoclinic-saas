'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { fmtDate } from '@/lib/format'
import type { Patient, PrescriptionRow, PrescriptionMedication } from './types'
import { Printer, FileText, Pill } from 'lucide-react'
import { toast } from 'sonner'

function parseMeds(json: string): PrescriptionMedication[] {
  try {
    return JSON.parse(json || '[]')
  } catch {
    return []
  }
}

function printPrescription(patient: Patient, rx: PrescriptionRow) {
  const meds = parseMeds(rx.medicationsJson)
  const w = window.open('', '_blank', 'width=800,height=900')
  if (!w) {
    toast.error('Habilita las ventanas emergentes para imprimir.')
    return
  }
  const clinic = patient.clinic
  const html = `
    <!DOCTYPE html>
    <html><head><title>Receta — ${patient.firstName} ${patient.lastName}</title>
    <style>
      body { font-family: 'Times New Roman', Georgia, serif; padding: 40px; color: #111; max-width: 800px; margin: 0 auto; }
      .header { text-align: center; border-bottom: 3px solid #0a3143; padding-bottom: 12px; margin-bottom: 16px; }
      .header h1 { color: #0a3143; margin: 0; font-size: 24px; letter-spacing: 0.1em; }
      .header p { margin: 2px 0; font-size: 12px; color: #555; }
      .info { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 20px; padding: 8px 0; border-bottom: 1px solid #ddd; }
      .info div { line-height: 1.6; }
      .info strong { color: #0a3143; }
      .section-title { font-size: 11px; text-transform: uppercase; color: #0a3143; letter-spacing: 0.1em; border-bottom: 1px solid #ddd; padding-bottom: 2px; margin-top: 16px; margin-bottom: 8px; }
      .rx-symbol { font-size: 36px; color: #0a3143; font-family: serif; margin: 8px 0; }
      .meds { font-size: 14px; line-height: 1.8; }
      .meds .med { margin-bottom: 8px; padding-left: 12px; border-left: 2px solid #0a3143; }
      .med .name { font-weight: bold; }
      .indications { font-size: 13px; margin-top: 12px; line-height: 1.6; }
      .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; color: #666; }
      .signature { margin-top: 60px; text-align: center; font-size: 12px; }
      .signature .line { border-top: 1px solid #333; width: 260px; margin: 0 auto 4px; }
      @media print { body { padding: 20px; } }
    </style></head>
    <body>
      <div class="header">
        <h1>${clinic.name}</h1>
        <p>Podología Clínica · Hermosillo, Sonora</p>
        <p>Fecha: ${fmtDate(rx.date)}</p>
      </div>
      <div class="info">
        <div>
          <strong>Paciente:</strong> ${patient.firstName} ${patient.lastName}<br/>
          <strong>Expediente:</strong> ${patient.expNumber}
          ${patient.birthDate ? `<br/><strong>Fecha de nacimiento:</strong> ${fmtDate(patient.birthDate)}` : ''}
        </div>
        <div>
          <strong>Podólogo:</strong> ${rx.podologist?.name || '—'}<br/>
          ${patient.phone ? `<strong>Tel:</strong> ${patient.phone}` : ''}
        </div>
      </div>

      ${rx.diagnosis ? `<div class="section-title">Diagnóstico</div><div>${rx.diagnosis}</div>` : ''}

      <div class="rx-symbol">℞</div>
      <div class="section-title">Medicamentos</div>
      <div class="meds">
        ${meds.length === 0 ? '<em>Sin medicamentos registrados.</em>' : meds.map((m) => `
          <div class="med">
            <div class="name">${m.name || '—'}</div>
            <div>
              ${m.dose ? `Dosis: ${m.dose}. ` : ''}
              ${m.via ? `Vía: ${m.via}. ` : ''}
              ${m.duration ? `Duración: ${m.duration}.` : ''}
            </div>
          </div>
        `).join('')}
      </div>

      ${rx.indications ? `<div class="section-title">Indicaciones</div><div class="indications">${rx.indications}</div>` : ''}

      <div class="signature">
        <div class="line"></div>
        <div>${rx.podologist?.name || ''}</div>
        <div style="font-size: 10px; color: #999;">Cédula profesional</div>
      </div>

      <div class="footer">
        <span>${clinic.name}</span>
        <span>Receta generada el ${new Date().toLocaleString('es-MX')}</span>
      </div>

      <script>window.onload = () => window.print()</script>
    </body></html>
  `
  w.document.write(html)
  w.document.close()
}

function PrescriptionCard({ patient, rx }: { patient: Patient; rx: PrescriptionRow }) {
  const meds = parseMeds(rx.medicationsJson)
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Receta · {fmtDate(rx.date)}
            </p>
            <p className="text-xs text-muted-foreground">
              {rx.podologist?.name || 'Sin podólogo'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => printPrescription(patient, rx)}>
            <Printer className="h-3 w-3" /> Reimprimir
          </Button>
        </div>
        {rx.diagnosis && (
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Diagnóstico</p>
            <p className="text-sm">{rx.diagnosis}</p>
          </div>
        )}
        {meds.length > 0 && (
          <div>
            <p className="text-[10px] uppercase text-muted-foreground mb-1">Medicamentos</p>
            <div className="space-y-1">
              {meds.map((m, i) => (
                <div key={i} className="flex items-start gap-2 text-sm rounded border bg-muted/30 px-2 py-1">
                  <Pill className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <span className="font-medium">{m.name}</span>
                    {m.dose && <span className="text-muted-foreground"> · {m.dose}</span>}
                    {m.via && <Badge variant="outline" className="ml-1 text-[10px]">{m.via}</Badge>}
                    {m.duration && <span className="text-muted-foreground"> · {m.duration}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {rx.indications && (
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Indicaciones</p>
            <p className="text-sm whitespace-pre-wrap">{rx.indications}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function TabRecetas({ patient }: { patient: Patient }) {
  const rxs = patient.prescriptions || []
  if (rxs.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-muted-foreground text-sm">
          Sin recetas registradas.
        </CardContent>
      </Card>
    )
  }
  return (
    <div className="space-y-2">
      {rxs.map((rx) => (
        <PrescriptionCard key={rx.id} patient={patient} rx={rx} />
      ))}
    </div>
  )
}
