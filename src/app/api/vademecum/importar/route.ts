import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import * as XLSX from 'xlsx'

// ============================================================
// POST /api/vademecum/importar
// Importa medicamentos al vademécum desde Excel/CSV.
// multipart/form-data con campo "file" (.xlsx, .xls, .csv)
//
// Headers esperados (cualquier orden, case-insensitive):
//   name | nombre | nombre comercial        (obligatorio)
//   genericName | generico | nombre generico
//   category | categoria
//   dose | dosis
//   via
//   defaultDuration | duracion
//   indication | indicacion
//   notes | notas
//
// Retorna: {imported, errors:[{row, error}]}
// Permisos: solo SUPER/OWNER
// ============================================================

// Normalizar headers a minúsculas sin espacios
function norm(s: any): string {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, '')
}

const VALID_VIAS = ['oral', 'topica', 'tópica', 'intravenosa', 'intramuscular', 'sublingual', 'inhalatoria', 'otica', 'ótica', 'oftalmica', 'oftálmica']

function normalizeVia(v: string): string {
  const t = v.trim().toLowerCase()
  if (!t) return ''
  // Acentos comunes
  if (t === 'tópica' || t === 'topica') return 'Tópica'
  if (t === 'ótic' || t === 'otica' || t === 'ótica') return 'Ótica'
  if (t === 'oftálmica' || t === 'oftalmica') return 'Oftálmica'
  // Capitalizar primera letra
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response

  if (user!.role === 'PODOLOGIST' || user!.role === 'RECEPTION') {
    return bad('No tienes permisos para importar medicamentos al vademécum', 403)
  }

  const clinicId = user!.clinicId

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return bad('Se esperaba multipart/form-data con un campo "file"')
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return bad('Falta el archivo (campo "file")')
  }

  const filename = file.name.toLowerCase()
  const isXlsx = filename.endsWith('.xlsx') || filename.endsWith('.xls')
  const isCsv = filename.endsWith('.csv')

  if (!isXlsx && !isCsv) {
    return bad('Formato no soportado. Sube un archivo .xlsx, .xls o .csv')
  }

  const bytes = new Uint8Array(await file.arrayBuffer())

  let rows: Record<string, any>[] = []
  try {
    if (isXlsx) {
      const wb = XLSX.read(bytes, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      if (!ws) return bad('El archivo Excel no tiene hojas')
      rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' })
    } else {
      const text = new TextDecoder('utf-8').decode(bytes)
      rows = parseCsv(text)
    }
  } catch (e: any) {
    return bad(`Error al leer el archivo: ${e?.message || e}`)
  }

  if (rows.length === 0) {
    return bad('El archivo no contiene filas de datos')
  }

  const errors: { row: number; error: string }[] = []
  const valid: any[] = []
  const seenNames = new Set<string>()

  rows.forEach((r, idx) => {
    const rowNo = idx + 2 // +1 header, +1 1-indexed

    // Normalizar keys del row a minúsculas
    const row: Record<string, any> = {}
    for (const k of Object.keys(r)) {
      row[norm(k)] = r[k]
    }

    // Nombre (obligatorio) — aceptar name, nombre, nombrecomercial
    const name = String(row.name ?? row.nombre ?? row.nombrecomercial ?? '').trim()
    if (!name) {
      errors.push({ row: rowNo, error: 'Falta el nombre del medicamento' })
      return
    }

    // Validar duplicados dentro del archivo (case-insensitive)
    const key = name.toLowerCase()
    if (seenNames.has(key)) {
      errors.push({ row: rowNo, error: `Nombre duplicado en el archivo: "${name}"` })
      return
    }
    seenNames.add(key)

    const genericName = String(row.genericname ?? row.generico ?? row.nombregenerico ?? '').trim() || null
    const category = String(row.category ?? row.categoria ?? '').trim() || null
    const dose = String(row.dose ?? row.dosis ?? '').trim() || null
    const viaRaw = String(row.via ?? '').trim()
    const via = viaRaw ? normalizeVia(viaRaw) : null
    if (viaRaw && !VALID_VIAS.includes(viaRaw.toLowerCase())) {
      // No bloqueamos, solo normalizamos — pero lo dejamos pasar con capitalización
    }
    const defaultDuration = String(row.defaultduration ?? row.duracion ?? row.duracionsugerida ?? '').trim() || null
    const indication = String(row.indication ?? row.indicacion ?? row.indicaciongeneral ?? '').trim() || null
    const notes = String(row.notes ?? row.notas ?? '').trim() || null

    valid.push({
      name,
      genericName,
      category,
      dose,
      via,
      defaultDuration,
      indication,
      notes,
    })
  })

  if (valid.length === 0) {
    return bad('No hay filas válidas para importar', 400)
  }

  // Verificar duplicados en la BD (por nombre, case-insensitive)
  const existing = await db.vademecum.findMany({
    where: {
      clinicId,
      name: { in: valid.map((v) => v.name) },
    },
    select: { name: true },
  })
  const existingNames = new Set(existing.map((e) => e.name.toLowerCase()))

  const toCreate: any[] = []
  const skippedDuplicates: { row: number; error: string }[] = []
  valid.forEach((v, idx) => {
    const rowNo = idx + 2
    if (existingNames.has(v.name.toLowerCase())) {
      skippedDuplicates.push({ row: rowNo, error: `Ya existe en el vademécum: "${v.name}" (omitido)` })
    } else {
      toCreate.push({ ...v, clinicId })
    }
  })

  // Insertar en lotes (skipDuplicates por si acaso)
  let imported = 0
  if (toCreate.length > 0) {
    try {
      const result = await db.vademecum.createMany({
        data: toCreate.map((v) => ({
          clinicId: v.clinicId,
          name: v.name,
          genericName: v.genericName,
          category: v.category,
          dose: v.dose,
          via: v.via,
          defaultDuration: v.defaultDuration,
          indication: v.indication,
          notes: v.notes,
        })),
      })
      imported = result.count
    } catch (e: any) {
      return bad(`Error al guardar en la base de datos: ${e?.message || e}`)
    }
  }

  return ok({
    imported,
    skipped: skippedDuplicates.length,
    errors: [...errors, ...skippedDuplicates],
  })
}

// ============================================================
// Parser CSV simple (acepta , y ; como separador)
// ============================================================
function parseCsv(text: string): Record<string, any>[] {
  // Detectar separador: contar , y ; en la primera línea
  const firstLine = text.split(/\r?\n/)[0] || ''
  const commaCount = (firstLine.match(/,/g) || []).length
  const semicolonCount = (firstLine.match(/;/g) || []).length
  const sep = semicolonCount > commaCount ? ';' : ','

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return []

  const headers = splitCsvLine(lines[0], sep).map((h) => h.trim().replace(/^"|"$/g, ''))
  const rows: Record<string, any>[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i], sep).map((c) => c.trim().replace(/^"|"$/g, ''))
    const row: Record<string, any> = {}
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? ''
    })
    rows.push(row)
  }
  return rows
}

function splitCsvLine(line: string, sep: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (c === sep && !inQuotes) {
      result.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  result.push(cur)
  return result
}
