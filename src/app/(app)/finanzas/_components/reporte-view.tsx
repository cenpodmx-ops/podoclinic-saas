'use client'

import { fmtMoney, fmtDate } from '@/lib/format'
import type { ReporteResponse } from './types'

type Props = {
  data: ReporteResponse
  clinicName: string
}

const METHOD_LABELS: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  DEBITO: 'Tarjeta de débito',
  CREDITO: 'Tarjeta de crédito',
  TRANSFERENCIA: 'Transferencia',
  TARJETA_DE_REGALO: 'Tarjeta de regalo',
  OTRO: 'Otro',
}

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADA: 'Confirmada',
  EN_CONSULTA: 'En consulta',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
  NO_ASISTIO: 'No asistió',
  BLOQUEADA: 'Bloqueada',
}

/**
 * Vista imprimible de un reporte financiero (A4).
 * Visible en pantalla dentro del diálogo y para impresión.
 * Usa la clase `.reporte-print` (ver globals.css).
 */
export function ReporteView({ data, clinicName }: Props) {
  if (!data || !data.title) return null

  const rangeText =
    data.range && data.range.from
      ? `${fmtDate(data.range.from)} — ${fmtDate(data.range.to)}`
      : data.generatedAt
        ? `Generado: ${fmtDate(data.generatedAt)}`
        : ''

  return (
    <div className="reporte-print bg-white text-slate-900 p-8 mx-auto" style={{ maxWidth: 900 }}>
      {/* Encabezado */}
      <div className="flex items-center justify-between border-b-2 border-primary pb-3 mb-4">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="CENPOD" className="h-12" />
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--primary)' }}>
              {clinicName || 'PodoClinic'}
            </h1>
            <p className="text-xs text-slate-600">Sistema de Gestión CENPOD</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold uppercase tracking-wider" style={{ color: 'var(--primary)' }}>
            {data.title}
          </div>
          {rangeText && <div className="text-xs text-slate-600">{rangeText}</div>}
        </div>
      </div>

      {/* Contenido según tipo de reporte */}
      <ReporteBody data={data} />

      <p className="text-center text-[10px] text-slate-400 mt-8 border-t border-slate-200 pt-3">
        Documento generado por PodoClinic · {new Date().toLocaleString('es-MX')}
      </p>
    </div>
  )
}

function ReporteBody({ data }: { data: ReporteResponse }) {
  // Detección por título o por campos presentes
  const title = (data.title || '').toLowerCase()

  if (title.includes('citas')) return <CitasBody data={data} />
  if (title.includes('inventario')) return <InventarioBody data={data} />
  if (title.includes('comision')) return <ComisionesBody data={data} />
  if (title.includes('ingreso')) return <IngresosBody data={data} />
  return (
    <pre className="text-xs bg-slate-50 p-3 rounded">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

function CitasBody({ data }: { data: any }) {
  return (
    <>
      <h2>Resumen</h2>
      <div className="resumen-grid">
        <div className="resumen-item">
          <span>Total de citas:</span>
          <strong>{data.total}</strong>
        </div>
        {Object.entries(data.byStatus || {}).map(([k, v]: [string, any]) => (
          <div className="resumen-item" key={k}>
            <span>{STATUS_LABELS[k] || k}:</span>
            <strong>{v}</strong>
          </div>
        ))}
      </div>

      <h2>Detalle</h2>
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Paciente</th>
            <th>Podólogo</th>
            <th>Servicio</th>
            <th>Status</th>
            <th className="text-right">Precio</th>
          </tr>
        </thead>
        <tbody>
          {(data.rows || []).map((r: any, i: number) => (
            <tr key={i}>
              <td>{r.fecha}</td>
              <td>{r.hora}</td>
              <td>{r.paciente}</td>
              <td>{r.podologo}</td>
              <td>{r.servicio}</td>
              <td>{STATUS_LABELS[r.status] || r.status}</td>
              <td className="text-right">{fmtMoney(r.precio)}</td>
            </tr>
          ))}
          {(!data.rows || data.rows.length === 0) && (
            <tr>
              <td colSpan={7} className="text-center text-slate-500 py-3">
                Sin citas en el periodo
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  )
}

function InventarioBody({ data }: { data: any }) {
  return (
    <>
      <h2>Resumen</h2>
      <div className="resumen-grid">
        <div className="resumen-item">
          <span>Productos:</span>
          <strong>{data.totalProducts}</strong>
        </div>
        <div className="resumen-item">
          <span>Unidades en stock:</span>
          <strong>{data.totalUnits}</strong>
        </div>
        <div className="resumen-item">
          <span>Valor al costo:</span>
          <strong>{fmtMoney(data.totalCostValue)}</strong>
        </div>
        <div className="resumen-item">
          <span>Valor a venta:</span>
          <strong>{fmtMoney(data.totalSaleValue)}</strong>
        </div>
        <div className="resumen-item">
          <span>Ganancia potencial:</span>
          <strong>{fmtMoney(data.potentialProfit)}</strong>
        </div>
        <div className="resumen-item">
          <span>Stock bajo:</span>
          <strong style={{ color: data.lowStockCount > 0 ? '#dc2626' : '#16a34a' }}>
            {data.lowStockCount} productos
          </strong>
        </div>
      </div>

      <h2>Detalle</h2>
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>Categoría</th>
            <th className="text-right">Stock</th>
            <th className="text-right">Mín</th>
            <th className="text-right">Costo</th>
            <th className="text-right">Venta</th>
            <th className="text-right">Valor Venta</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {(data.rows || []).map((r: any, i: number) => (
            <tr key={i}>
              <td>{r.codigo}</td>
              <td>{r.nombre}</td>
              <td>{r.categoria}</td>
              <td className="text-right">{r.stock}</td>
              <td className="text-right">{r.minStock}</td>
              <td className="text-right">{fmtMoney(r.costoUnitario)}</td>
              <td className="text-right">{fmtMoney(r.precioVenta)}</td>
              <td className="text-right">{fmtMoney(r.valorVenta)}</td>
              <td
                style={{
                  color: r.estado === 'AGOTADO' ? '#dc2626' : r.estado === 'BAJO' ? '#d97706' : '#16a34a',
                  fontWeight: 600,
                }}
              >
                {r.estado}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function ComisionesBody({ data }: { data: any }) {
  return (
    <>
      <h2>Resumen</h2>
      <div className="resumen-grid">
        <div className="resumen-item">
          <span>Total consultas:</span>
          <strong>{data.totalConsults}</strong>
        </div>
        <div className="resumen-item">
          <span>Total generado:</span>
          <strong>{fmtMoney(data.totalGenerated)}</strong>
        </div>
        <div className="resumen-item">
          <span>Total comisiones:</span>
          <strong style={{ color: 'var(--primary)' }}>{fmtMoney(data.totalCommission)}</strong>
        </div>
      </div>

      <h2>Detalle por Podólogo</h2>
      <table>
        <thead>
          <tr>
            <th>Podólogo</th>
            <th className="text-right">Consultas</th>
            <th className="text-right">Total generado</th>
            <th className="text-right">% Comisión</th>
            <th className="text-right">Monto a pagar</th>
          </tr>
        </thead>
        <tbody>
          {(data.rows || []).map((r: any, i: number) => (
            <tr key={i}>
              <td>{r.name}</td>
              <td className="text-right">{r.consultCount}</td>
              <td className="text-right">{fmtMoney(r.totalGenerated)}</td>
              <td className="text-right">{r.commissionPct}%</td>
              <td className="text-right font-bold" style={{ color: 'var(--primary)' }}>
                {fmtMoney(r.commissionAmount)}
              </td>
            </tr>
          ))}
          {(!data.rows || data.rows.length === 0) && (
            <tr>
              <td colSpan={5} className="text-center text-slate-500 py-3">
                Sin consultas pagadas en el periodo
              </td>
            </tr>
          )}
        </tbody>
        {data.rows && data.rows.length > 0 && (
          <tfoot>
            <tr style={{ fontWeight: 700, backgroundColor: '#f1f5f9' }}>
              <td>TOTAL</td>
              <td className="text-right">{data.totalConsults}</td>
              <td className="text-right">{fmtMoney(data.totalGenerated)}</td>
              <td></td>
              <td className="text-right">{fmtMoney(data.totalCommission)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </>
  )
}

function IngresosBody({ data }: { data: any }) {
  return (
    <>
      <h2>Resumen</h2>
      <div className="resumen-grid">
        <div className="resumen-item">
          <span>Total ingresos:</span>
          <strong style={{ color: '#16a34a' }}>{fmtMoney(data.totalIngresos)}</strong>
        </div>
        <div className="resumen-item">
          <span>Total egresos:</span>
          <strong style={{ color: '#dc2626' }}>{fmtMoney(data.totalEgresos)}</strong>
        </div>
        <div className="resumen-item" style={{ gridColumn: '1 / 3' }}>
          <span>Neto:</span>
          <strong style={{ color: data.neto >= 0 ? 'var(--primary)' : '#dc2626' }}>{fmtMoney(data.neto)}</strong>
        </div>
      </div>

      <h2>Ingresos por Fuente</h2>
      <table>
        <thead>
          <tr>
            <th>Fuente</th>
            <th className="text-right">Monto</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(data.bySource || {}).map(([k, v]: [string, any]) => (
            <tr key={k}>
              <td>{k}</td>
              <td className="text-right">{fmtMoney(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Ingresos por Método</h2>
      <table>
        <thead>
          <tr>
            <th>Método</th>
            <th className="text-right">Monto</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(data.byMethod || {}).map(([k, v]: [string, any]) => (
            <tr key={k}>
              <td>{METHOD_LABELS[k] || k}</td>
              <td className="text-right">{fmtMoney(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {Object.keys(data.byCategory || {}).length > 0 && (
        <>
          <h2>Egresos por Categoría</h2>
          <table>
            <thead>
              <tr>
                <th>Categoría</th>
                <th className="text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.byCategory || {}).map(([k, v]: [string, any]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td className="text-right">{fmtMoney(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  )
}
