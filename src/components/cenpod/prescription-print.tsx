'use client'

import { useMemo } from 'react'
import { fmtDate } from '@/lib/format'

// ============================================================
// PrescriptionPrintPreview
// Componente reusable que pinta la receta EXACTAMENTE como se
// verá al imprimir (espejo del HTML que devuelve /api/recetas/[id]/print).
// Se usa en el dialog de vista previa y en el flujo de "nueva receta".
// ============================================================

export type MedicationPreview = {
  name: string
  dose?: string
  via?: string
  duration?: string
  productId?: string
}

export type ClinicPreview = {
  id?: string
  name?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  logoUrl?: string | null
  rfc?: string | null
  razonSocial?: string | null
}

export type PatientPreview = {
  id?: string
  firstName?: string
  lastName?: string
  name?: string
  expNumber?: string
  birthDate?: string | null
  sex?: string | null
  phone?: string | null
  address?: string | null
}

export type PodologistPreview = {
  id?: string
  name?: string
  specialty?: string | null
  cedula?: string | null
  certNumber?: string | null
}

export type PrescriptionPreviewData = {
  id?: string
  date: string
  diagnosis?: string | null
  medications: MedicationPreview[]
  indications?: string | null
  patient?: PatientPreview | null
  podologist?: PodologistPreview | null
  clinic?: ClinicPreview | null
}

function calcAge(birth: string | null | undefined): number | null {
  if (!birth) return null
  const d = new Date(birth)
  if (isNaN(d.getTime())) return null
  const diff = Date.now() - d.getTime()
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000))
}

function sexLabel(s: string | null | undefined): string {
  if (!s) return ''
  if (s === 'M') return 'Masculino'
  if (s === 'F') return 'Femenino'
  return 'Otro'
}

export function PrescriptionPrintPreview({ data }: { data: PrescriptionPreviewData }) {
  const age = useMemo(() => calcAge(data.patient?.birthDate), [data.patient?.birthDate])
  const patientName = data.patient?.name || (data.patient ? `${data.patient.firstName || ''} ${data.patient.lastName || ''}`.trim() : '—')
  const podName = data.podologist?.name || '—'
  const podCed = data.podologist?.cedula || ''
  const podSpec = data.podologist?.specialty || ''
  const podCert = data.podologist?.certNumber || ''
  const clinic = data.clinic || null
  const folio = (data.id || '').slice(-8).toUpperCase()

  return (
    <div className="rx-preview-sheet">
      {/* Header */}
      <div className="rx-preview-header">
        <div className="rx-preview-header-inner">
          {clinic?.logoUrl && (
            <img src={clinic.logoUrl} alt="logo" className="rx-preview-logo" />
          )}
          <div className="rx-preview-clinic">
            <div className="rx-preview-clinic-name">{clinic?.name || 'Clínica'}</div>
            {clinic?.razonSocial && <div className="rx-preview-clinic-sub">{clinic.razonSocial}</div>}
            {clinic?.address && <div className="rx-preview-clinic-line">{clinic.address}</div>}
            <div className="rx-preview-clinic-line">
              {clinic?.phone && <>Tel. {clinic.phone}</>}
              {clinic?.phone && clinic?.email && <> · </>}
              {clinic?.email}
            </div>
            {clinic?.rfc && <div className="rx-preview-clinic-line">RFC: {clinic.rfc}</div>}
          </div>
        </div>
      </div>

      {/* Title row */}
      <div className="rx-preview-title-row">
        <div className="rx-preview-title">Receta Médica</div>
        {folio && <div className="rx-preview-folio">Folio: {folio}</div>}
      </div>

      {/* Meta grid */}
      <div className="rx-preview-meta">
        <div><strong>Paciente</strong> {patientName}</div>
        <div><strong>Fecha</strong> {fmtDate(data.date)}</div>
        <div><strong>Expediente</strong> {data.patient?.expNumber || '—'}</div>
        <div><strong>Edad</strong> {age !== null ? `${age} años` : '—'}</div>
        {data.patient?.sex && <div><strong>Sexo</strong> {sexLabel(data.patient.sex)}</div>}
        {data.patient?.phone && <div><strong>Teléfono</strong> {data.patient.phone}</div>}
        <div><strong>Podólogo</strong> {podName}</div>
        {podCed && <div><strong>Cédula</strong> {podCed}</div>}
      </div>

      {/* Diagnosis */}
      {data.diagnosis && (
        <div className="rx-preview-section">
          <div className="rx-preview-section-title">Diagnóstico</div>
          <div className="rx-preview-section-body">{data.diagnosis}</div>
        </div>
      )}

      {/* Rx symbol */}
      <div className="rx-preview-rx-symbol">℞</div>

      {/* Medications */}
      <div className="rx-preview-section">
        <div className="rx-preview-section-title">Prescripción</div>
        <table className="rx-preview-meds-table">
          <thead>
            <tr>
              <th className="rx-num">#</th>
              <th>Medicamento</th>
              <th>Dosis</th>
              <th>Vía</th>
              <th>Duración</th>
            </tr>
          </thead>
          <tbody>
            {data.medications.length === 0 ? (
              <tr><td colSpan={5} className="rx-empty">Sin medicamentos registrados.</td></tr>
            ) : (
              data.medications.map((m, i) => (
                <tr key={i}>
                  <td className="rx-num">{i + 1}</td>
                  <td className="rx-med-name">{m.name}</td>
                  <td>{m.dose || '—'}</td>
                  <td>{m.via || '—'}</td>
                  <td>{m.duration || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Indications */}
      {data.indications && (
        <div className="rx-preview-section">
          <div className="rx-preview-section-title">Indicaciones generales</div>
          <div className="rx-preview-section-body rx-preview-indications">{data.indications}</div>
        </div>
      )}

      {/* Signature */}
      <div className="rx-preview-signature">
        <div className="rx-sig-line" />
        <div className="rx-sig-name">{podName}</div>
        <div className="rx-sig-meta">
          {podSpec || 'Podología'}
          {podCed && <> · Cédula: {podCed}</>}
          {podCert && <> · Cert: {podCert}</>}
        </div>
        <div className="rx-sig-label">Cédula profesional</div>
      </div>

      {/* Footer */}
      <div className="rx-preview-footer">
        <div>{clinic?.name} · Receta {folio}</div>
        <div>Generada el {new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
      </div>
    </div>
  )
}
