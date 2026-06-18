import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import * as XLSX from 'xlsx'

// ============================================================
// MÓDULO 06 — Importar productos desde Excel/CSV
// POST multipart/form-data con campo "file" (.xlsx, .xls, .csv)
// Headers esperados: name, category, costPrice, salePrice, ivaType, stock, minStock, supplier
// Retorna: {imported, errors:[{row, error}]}
// PODOLOGIST y RECEPTION: 403
// ============================================================

const CATEGORIES = ['MEDICAMENTO', 'PRODUCTO', 'MATERIAL', 'EQUIPO']
const IVA_TYPES = ['EXENTO', 'IVA0', 'IVA16']

export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response

  if (user!.role === 'PODOLOGIST' || user!.role === 'RECEPTION') {
    return bad('No tienes permisos para importar productos', 403)
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
      // CSV: decodear como utf-8
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
  const seenCodes = new Set<string>()

  rows.forEach((r, idx) => {
    const rowNo = idx + 2 // +1 header, +1 1-indexed
    const name = String(r.name ?? r.nombre ?? '').trim()
    if (!name) {
      errors.push({ row: rowNo, error: 'Falta el nombre' })
      return
    }

    const category = String(r.category ?? r.categoria ?? '').trim().toUpperCase()
    if (!CATEGORIES.includes(category)) {
      errors.push({ row: rowNo, error: `Categoría inválida: "${category}". Debe ser una de: ${CATEGORIES.join(', ')}` })
      return
    }

    const ivaType = String(r.ivaType ?? r.iva ?? 'EXENTO').trim().toUpperCase()
    if (!IVA_TYPES.includes(ivaType)) {
      errors.push({ row: rowNo, error: `IVA inválido: "${ivaType}". Debe ser uno de: ${IVA_TYPES.join(', ')}` })
      return
    }

    const costPrice = Number(r.costPrice ?? r.costo ?? 0) || 0
    const salePrice = Number(r.salePrice ?? r.precio ?? 0) || 0
    const stock = Math.max(0, parseInt(r.stock ?? '0') || 0)
    const minStock = Math.max(0, parseInt(r.minStock ?? r.minimo ?? '0') || 0)
    const supplier = String(r.supplier ?? r.proveedor ?? '').trim() || null
    const code = String(r.code ?? r.codigo ?? '').trim() || null
    const description = String(r.description ?? r.descripcion ?? '').trim() || null

    if (code) {
      if (seenCodes.has(code)) {
        errors.push({ row: rowNo, error: `Código duplicado dentro del archivo: ${code}` })
        return
      }
      seenCodes.add(code)
    }

    valid.push({
      clinicId,
      name,
      description,
      code,
      category,
      costPrice,
      salePrice,
      ivaType,
      stock,
      minStock,
      supplier,
    })
  })

  // Validar codes duplicados en DB
  if (valid.length > 0) {
    const codes = valid.map((v) => v.code).filter(Boolean)
    if (codes.length > 0) {
      const existing = await db.product.findMany({
        where: { clinicId, code: { in: codes } },
        select: { code: true },
      })
      const existingCodes = new Set(existing.map((p) => p.code))
      for (let i = 0; i < valid.length; i++) {
        if (valid[i].code && existingCodes.has(valid[i].code)) {
          const rowNo = rows.findIndex((r) => String(r.code ?? r.codigo ?? '').trim() === valid[i].code) + 2
          errors.push({ row: rowNo, error: `Código ya existente en BD: ${valid[i].code}` })
          valid[i] = null as any
        }
      }
    }
  }

  const toCreate = valid.filter(Boolean)
  let imported = 0

  // Crear en lotes con su StockMovement ENTRADA si stock>0
  for (const v of toCreate) {
    try {
      const product = await db.product.create({ data: v })
      if (product.stock > 0) {
        await db.stockMovement.create({
          data: {
            productId: product.id,
            clinicId,
            type: 'ENTRADA',
            quantity: product.stock,
            reason: 'Importación inicial',
            cost: product.costPrice || null,
            supplier: product.supplier || null,
          },
        })
      }
      imported++
    } catch (e: any) {
      errors.push({
        row: -1,
        error: `Error al guardar ${v.name}: ${e?.message || e}`,
      })
    }
  }

  return ok({ imported, errors })
}

// ── Parser CSV simple (soporta comillas y comas dentro de comillas)
function parseCsv(text: string): Record<string, any>[] {
  const lines: string[][] = []
  let cur: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else {
      if (c === '"') {
        inQuotes = true
      } else if (c === ',' || c === ';' || c === '\t') {
        cur.push(field)
        field = ''
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++
        cur.push(field)
        field = ''
        if (cur.length > 1 || cur[0] !== '') lines.push(cur)
        cur = []
      } else {
        field += c
      }
    }
  }
  if (field !== '' || cur.length > 0) {
    cur.push(field)
    if (cur.length > 1 || cur[0] !== '') lines.push(cur)
  }

  if (lines.length === 0) return []
  const headers = lines[0].map((h) => h.trim())
  const out: Record<string, any>[] = []
  for (let i = 1; i < lines.length; i++) {
    const row: Record<string, any> = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = lines[i][j] ?? ''
    }
    out.push(row)
  }
  return out
}
