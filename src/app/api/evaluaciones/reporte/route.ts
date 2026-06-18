import { NextRequest } from 'next/server'
import { requireSession, ok, bad } from '@/lib/api'
import { computePodologistMonthlyReport } from '../route'

// ============================================================
// MÓDULO 16 — EVALUACIÓN DE PODÓLOGOS
// GET /api/evaluaciones/reporte?podologistId=&period=
// Devuelve el reporte mensual completo de un podólogo (para PDF/print).
// 403 si RECEPTION / PODOLOGIST.
// ============================================================

export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'RECEPTION' || user!.role === 'PODOLOGIST') {
    return bad('Acceso denegado', 403)
  }

  const url = req.nextUrl
  const podologistId = url.searchParams.get('podologistId')
  const period = url.searchParams.get('period')
  if (!podologistId) return bad('Falta podologistId')
  if (!period || !/^\d{4}-\d{2}$/.test(period)) return bad('Periodo inválido (use YYYY-MM)')

  const report = await computePodologistMonthlyReport(
    podologistId,
    period,
    user!.clinicId,
    user!.role === 'SUPER',
  )
  if (!report) return bad('Podólogo no encontrado o sin acceso', 404)

  return ok(report)
}
