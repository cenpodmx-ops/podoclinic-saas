'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Download, FileSpreadsheet, Upload, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

type ParsedRow = {
  row: number
  name: string
  category: string
  costPrice: number
  salePrice: number
  ivaType: string
  stock: number
  minStock: number
  supplier: string | null
}

type ImportError = { row: number; error: string }

export function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const qc = useQueryClient()
  const [preview, setPreview] = useState<ParsedRow[] | null>(null)
  const [errors, setErrors] = useState<ImportError[]>([])
  const [fileName, setFileName] = useState('')

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/inventario/importar', { method: 'POST', body: fd })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Error al importar')
      return j as { imported: number; errors: ImportError[] }
    },
    onSuccess: (data) => {
      toast.success(`${data.imported} producto(s) importado(s)`)
      qc.invalidateQueries({ queryKey: ['inventario-list'] })
      qc.invalidateQueries({ queryKey: ['inventario-bajo'] })
      setPreview(null)
      setErrors(data.errors || [])
      setFileName('')
      if (data.imported > 0 && data.errors.length === 0) {
        onOpenChange(false)
      }
    },
    onError: (e: any) => toast.error(e.message || 'Error al importar'),
  })

  const parseMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      // Reuse importar endpoint but in dry-run? Simpler: call it and observe result.
      // For preview we just read the file client-side for a quick view; the server is the source of truth.
      return file
    },
    onSuccess: (file) => {
      setFileName(file.name)
      // Read file client-side to build a preview
      const reader = new FileReader()
      reader.onload = () => {
        const text = String(reader.result || '')
        const rows = parseCsvPreview(text)
        setPreview(rows.slice(0, 50))
      }
      reader.readAsText(file)
    },
  })

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setErrors([])
    parseMutation.mutate(f)
  }

  function downloadTemplate() {
    window.location.href = '/api/inventario/plantilla'
  }

  function confirmImport() {
    // Re-read the file from input to send to server
    const input = document.getElementById('inv-file-input') as HTMLInputElement | null
    const f = input?.files?.[0]
    if (!f) {
      toast.error('Selecciona un archivo primero')
      return
    }
    importMutation.mutate(f)
  }

  function close() {
    setPreview(null)
    setErrors([])
    setFileName('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); else onOpenChange(v) }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Importar productos desde Excel/CSV
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Instrucciones</AlertTitle>
            <AlertDescription className="text-xs">
              Descarga la plantilla, llénala con tus productos y súbela aquí. Columnas requeridas:
              <span className="font-mono"> name, category (MEDICAMENTO/PRODUCTO/MATERIAL/EQUIPO), costPrice, salePrice, ivaType (EXENTO/IVA0/IVA16), stock, minStock, supplier</span>.
              Soporta archivos <span className="font-semibold">.xlsx, .xls, .csv</span>.
            </AlertDescription>
          </Alert>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-1" /> Descargar plantilla
            </Button>
            <label>
              <input
                id="inv-file-input"
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={onFile}
              />
              <Button type="button" size="sm" asChild>
                <span>
                  <Upload className="h-4 w-4 mr-1" /> Seleccionar archivo
                </span>
              </Button>
            </label>
            {fileName && (
              <Badge variant="outline" className="h-8 px-2 flex items-center gap-1">
                <FileSpreadsheet className="h-3 w-3" /> {fileName}
              </Badge>
            )}
          </div>

          {preview && preview.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">
                Vista previa ({preview.length} fila{preview.length !== 1 ? 's' : ''})
              </h4>
              <div className="border rounded-md overflow-x-auto max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead className="w-28">Categoría</TableHead>
                      <TableHead className="w-20">Costo</TableHead>
                      <TableHead className="w-20">Precio</TableHead>
                      <TableHead className="w-20">IVA</TableHead>
                      <TableHead className="w-16">Stock</TableHead>
                      <TableHead className="w-16">Min</TableHead>
                      <TableHead>Proveedor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((r) => (
                      <TableRow key={r.row}>
                        <TableCell className="text-xs text-muted-foreground">{r.row}</TableCell>
                        <TableCell className="font-medium text-xs">{r.name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{r.category}</Badge></TableCell>
                        <TableCell className="text-xs">${r.costPrice.toFixed(2)}</TableCell>
                        <TableCell className="text-xs">${r.salePrice.toFixed(2)}</TableCell>
                        <TableCell className="text-xs">{r.ivaType}</TableCell>
                        <TableCell className="text-xs">{r.stock}</TableCell>
                        <TableCell className="text-xs">{r.minStock}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.supplier || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {errors.length > 0 && (
            <Alert className="border-red-300 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertTitle className="text-red-800">Errores de importación</AlertTitle>
              <AlertDescription>
                <ul className="mt-1 text-xs space-y-0.5 max-h-40 overflow-y-auto">
                  {errors.map((e, i) => (
                    <li key={i} className="text-red-700">
                      {e.row > 0 ? `Fila ${e.row}: ` : ''}{e.error}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {importMutation.data && importMutation.data.imported > 0 && (
            <Alert className="border-emerald-300 bg-emerald-50">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertTitle className="text-emerald-800">Importación completa</AlertTitle>
              <AlertDescription className="text-emerald-700 text-xs">
                {importMutation.data.imported} producto(s) importado(s) correctamente.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close}>Cerrar</Button>
          <Button
            disabled={!preview || importMutation.isPending}
            onClick={confirmImport}
            style={{ backgroundColor: '#0a3143' }}
          >
            {importMutation.isPending ? 'Importando...' : `Confirmar importación`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function parseCsvPreview(text: string): ParsedRow[] {
  const lines = splitCsv(text)
  if (lines.length < 2) return []
  const headers = lines[0].map((h) => h.trim().toLowerCase())
  const out: ParsedRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i]
    if (!row.length || (row.length === 1 && !row[0])) continue
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => { obj[h] = row[idx] ?? '' })
    out.push({
      row: i + 1,
      name: obj.name || obj.nombre || '',
      category: (obj.category || obj.categoria || '').toUpperCase(),
      costPrice: Number(obj.costprice || obj.costo || 0) || 0,
      salePrice: Number(obj.saleprice || obj.precio || 0) || 0,
      ivaType: (obj.ivatype || obj.iva || 'EXENTO').toUpperCase(),
      stock: parseInt(obj.stock || '0') || 0,
      minStock: parseInt(obj.minstock || obj.minimo || '0') || 0,
      supplier: obj.supplier || obj.proveedor || null,
    })
  }
  return out
}

function splitCsv(text: string): string[][] {
  const lines: string[][] = []
  let cur: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
      } else { field += c }
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',' || c === ';' || c === '\t') { cur.push(field); field = '' }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++
        cur.push(field); field = ''
        if (cur.length > 1 || cur[0] !== '') lines.push(cur)
        cur = []
      } else { field += c }
    }
  }
  if (field !== '' || cur.length > 0) {
    cur.push(field)
    if (cur.length > 1 || cur[0] !== '') lines.push(cur)
  }
  return lines
}
