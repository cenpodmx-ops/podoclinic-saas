'use client'

import { fmtMoney, fmtDateTime, fmtDate, METHOD_LABELS } from '@/lib/format'
import type { CajaApiResponse } from './types'

type Props = {
  data: CajaApiResponse
  responsable: string
  clinicName: string
  clinicAddress?: string
  clinicPhone?: string
}

/**
 * Vista imprimible del corte de caja.
 * Visible en pantalla dentro del diálogo y para impresión A4.
 * Usa la clase `.corte-print` (ver globals.css) — al imprimir, todo lo
 * demás se oculta y solo se imprime este componente.
 */
export function CorteReport({ data, responsable, clinicName, clinicAddress, clinicPhone }: Props) {
  const { session, movements, summary } = data

  // Movimientos imprimibles (excluir fondo inicial del listado detallado)
  const printableMovements = movements.filter((m) => m.source !== 'EFECTIVO_INICIAL')

  return (
    <div className="corte-print bg-white text-slate-900 p-8 mx-auto" style={{ maxWidth: 800 }}>
      {/* Encabezado */}
      <div className="flex items-center justify-between border-b-2 border-[#0a3143] pb-3 mb-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: '#0a3143' }}>
              {clinicName || 'CENPOD'}
            </h1>
            {clinicAddress && <p className="text-xs text-slate-600">{clinicAddress}</p>}
            {clinicPhone && <p className="text-xs text-slate-600">Tel. {clinicPhone}</p>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold uppercase tracking-wider" style={{ color: '#0a3143' }}>
            Corte de Caja
          </div>
          <div className="text-xs text-slate-600">{fmtDate(data.date)}</div>
          <div className="text-xs text-slate-600">
            {session?.closed ? `Cerrada: ${session.closedAt ? fmtDateTime(session.closedAt) : ''}` : 'Abierta'}
          </div>
        </div>
      </div>

      {/* Responsable */}
      <div className="mb-4">
        <table className="w-full text-xs">
          <tbody>
            <tr>
              <td className="border border-slate-300 px-2 py-1 bg-slate-50 font-semibold w-1/4">
                Responsable:
              </td>
              <td className="border border-slate-300 px-2 py-1">{responsable}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Resumen */}
      <h2>Resumen</h2>
      <div className="resumen-grid">
        <div className="resumen-item">
          <span>Fondo inicial:</span>
          <strong>{fmtMoney(summary.openingFund)}</strong>
        </div>
        <div className="resumen-item">
          <span>Ingresos totales:</span>
          <strong>{fmtMoney(summary.ingresos)}</strong>
        </div>
        <div className="resumen-item">
          <span>Egresos totales:</span>
          <strong>{fmtMoney(summary.egresos)}</strong>
        </div>
        <div className="resumen-item">
          <span>Saldo esperado:</span>
          <strong>{fmtMoney(summary.saldoEsperado)}</strong>
        </div>
      </div>

      {/* Por método */}
      <h2>Ingresos por Método</h2>
      <table>
        <thead>
          <tr>
            <th>Método</th>
            <th className="text-right">Monto</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(summary.byMethod).map(([k, v]) => (
            <tr key={k}>
              <td>{METHOD_LABELS[k] || k}</td>
              <td className="text-right">{fmtMoney(v)}</td>
            </tr>
          ))}
          <tr style={{ fontWeight: 700, backgroundColor: '#f1f5f9' }}>
            <td>TOTAL INGRESOS</td>
            <td className="text-right">{fmtMoney(summary.ingresos)}</td>
          </tr>
        </tbody>
      </table>

      {/* Movimientos detallados */}
      <h2>Movimientos del Día</h2>
      <table>
        <thead>
          <tr>
            <th>Hora</th>
            <th>Tipo</th>
            <th>Fuente</th>
            <th>Descripción</th>
            <th>Método</th>
            <th className="text-right">Monto</th>
          </tr>
        </thead>
        <tbody>
          {printableMovements.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center text-slate-500 py-3">
                Sin movimientos registrados
              </td>
            </tr>
          )}
          {printableMovements.map((m) => (
            <tr key={m.id}>
              <td>{fmtDateTime(m.time).split(' ')[1]}</td>
              <td>{m.type === 'INGRESO' ? 'Ingreso' : 'Egreso'}</td>
              <td>{m.source}</td>
              <td>{m.description || '—'}</td>
              <td>{m.method ? METHOD_LABELS[m.method] || m.method : '—'}</td>
              <td className="text-right" style={{ color: m.type === 'INGRESO' ? '#16a34a' : '#dc2626' }}>
                {m.type === 'INGRESO' ? '+' : '−'}
                {fmtMoney(m.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Cierre (si aplica) */}
      {session?.closed && (
        <>
          <h2>Cierre de Caja</h2>
          <div className="resumen-grid">
            <div className="resumen-item">
              <span>Efectivo esperado:</span>
              <strong>{fmtMoney(summary.expectedCash ?? 0)}</strong>
            </div>
            <div className="resumen-item">
              <span>Efectivo contado:</span>
              <strong>{fmtMoney(summary.countedCash ?? 0)}</strong>
            </div>
            <div className="resumen-item" style={{ gridColumn: '1 / 3' }}>
              <span>Diferencia:</span>
              <strong
                style={{
                  color: (summary.difference ?? 0) === 0 ? '#16a34a' : '#dc2626',
                }}
              >
                {fmtMoney(summary.difference ?? 0)}
              </strong>
            </div>
          </div>
          {session.notes && (
            <p className="text-xs mt-2 border border-slate-300 rounded p-2 bg-slate-50">
              <strong>Notas:</strong> {session.notes}
            </p>
          )}
        </>
      )}

      {/* Firmas */}
      <div className="flex justify-around mt-12">
        <div className="signature-line">
          <div>{responsable}</div>
          <div className="text-[10px] text-slate-500">Responsable de Caja</div>
        </div>
        <div className="signature-line">
          <div>&nbsp;</div>
          <div className="text-[10px] text-slate-500">Autorizado</div>
        </div>
      </div>

      <p className="text-center text-[10px] text-slate-400 mt-8">
        Documento generado por Sistema CENPOD · {fmtDateTime(new Date().toISOString())}
      </p>
    </div>
  )
}
