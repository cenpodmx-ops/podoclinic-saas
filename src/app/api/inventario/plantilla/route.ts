import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'

// ============================================================
// MÓDULO 06 — Plantilla CSV de importación
// GET /api/inventario/plantilla → text/csv
// Headers: name, category, costPrice, salePrice, ivaType, stock, minStock, supplier
// ============================================================

export async function GET() {
  const { user, response } = await requireSession()
  if (response) return response

  if (user!.role === 'PODOLOGIST') {
    return bad('Acceso denegado', 403)
  }

  const headers = ['name', 'category', 'costPrice', 'salePrice', 'ivaType', 'stock', 'minStock', 'supplier']
  const example1 = ['Crema antifúngica 30g', 'MEDICAMENTO', '85', '160', 'IVA0', '20', '5', 'Distribuidora CENPOD']
  const example2 = ['Tijera podológica quirúrgica', 'EQUIPO', '320', '0', 'EXENTO', '3', '1', 'MedSupply MX']

  const csv = [headers.join(','), example1.join(','), example2.join(',')].join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="plantilla_inventario_cenpod.csv"',
    },
  })
}
