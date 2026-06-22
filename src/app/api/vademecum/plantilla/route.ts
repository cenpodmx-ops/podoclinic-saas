import { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'

// ============================================================
// GET /api/vademecum/plantilla
// Devuelve una plantilla Excel (.xlsx) con los headers esperados
// y una fila de ejemplo para que el usuario sepa cómo llenarlo.
// ============================================================

export async function GET(_req: NextRequest) {
  const headers = [
    'name',
    'genericName',
    'category',
    'dose',
    'via',
    'defaultDuration',
    'indication',
    'notes',
  ]

  const exampleRow = {
    name: 'Ibuprofeno 400mg',
    genericName: 'Ibuprofeno',
    category: 'Antiinflamatorio',
    dose: '400 mg',
    via: 'Oral',
    defaultDuration: '5 días',
    indication: 'Tomar 1 tableta cada 8 horas con alimentos. No exceder 3 tabletas en 24 horas.',
    notes: 'Contraindicado en úlcera péptica activa',
  }

  const secondExample = {
    name: 'Amoxicilina 500mg',
    genericName: 'Amoxicilina',
    category: 'Antibiótico',
    dose: '500 mg',
    via: 'Oral',
    defaultDuration: '7 días',
    indication: 'Tomar 1 cápsula cada 8 horas. Completar todo el tratamiento aunque mejoren los síntomas.',
    notes: 'Preguntar alergia a penicilina',
  }

  const ws = XLSX.utils.json_to_sheet([exampleRow, secondExample], { header: headers })
  // Anchos de columna
  ;(ws as any)['!cols'] = [
    { wch: 22 }, // name
    { wch: 18 }, // genericName
    { wch: 18 }, // category
    { wch: 10 }, // dose
    { wch: 12 }, // via
    { wch: 15 }, // defaultDuration
    { wch: 70 }, // indication
    { wch: 40 }, // notes
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Vademécum')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new Response(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla_vademecum.xlsx"',
      'Cache-Control': 'no-store',
    },
  })
}
