'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Download, FileSpreadsheet, Upload, AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { toast } from 'sonner'

// ============================================================
// ImportVademecumDialog
// Diálogo para importar medicamentos al vademécum desde Excel/CSV.
// Soporta .xlsx, .xls y .csv.
// Headers esperados: name, genericName, category, dose, via,
// defaultDuration, indication, notes (ver /api/vademecum/plantilla).
// ============================================================

type ImportError = { row: number; error: string }

type ImportResult = {
  imported: number
  skipped?: number
  errors: ImportError[]
}

export function ImportVademecumDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const qc = useQueryClient()
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/vademecum/importar', { method: 'POST', body: fd })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Error al importar')
      return j as ImportResult
    },
    onSuccess: (data) => {
      setResult(data)
      setFileName('')
      if (data.imported > 0) {
        toast.success(`${data.imported} medicamento(s) importado(s) al vademécum`)
        qc.invalidateQueries({ queryKey: ['vademecum'] })
      }
    },
    onError: (e: any) => toast.error(e.message || 'Error al importar'),
  })

  function handleFile(file: File) {
    setFileName(file.name)
    setResult(null)
    importMutation.mutate(file)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  function handleDownloadPlantilla() {
    window.open('/api/vademecum/plantilla', '_blank')
  }

  function handleClose() {
    onOpenChange(false)
    // Reset state después de cerrar
    setTimeout(() => {
      setFileName('')
      setResult(null)
    }, 200)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Importar vademécum desde Excel
          </DialogTitle>
          <DialogDescription>
            Sube un archivo Excel (.xlsx, .xls) o CSV con los medicamentos del vademécum.
            Si un medicamento ya existe, se omitirá (no se duplicará).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Botón plantilla */}
          <Alert className="border-blue-300 bg-blue-50">
            <Info className="h-4 w-4 text-blue-700" />
            <AlertTitle className="text-blue-900">¿Primera vez?</AlertTitle>
            <AlertDescription className="text-blue-800">
              <p className="mb-2 text-sm">
                Descarga la plantilla Excel con los headers correctos y ejemplos. Llénala con tus
                medicamentos y vuelve a subirla aquí.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownloadPlantilla}
                className="border-blue-400 text-blue-700 hover:bg-blue-100"
              >
                <Download className="h-4 w-4 mr-1" /> Descargar plantilla
              </Button>
            </AlertDescription>
          </Alert>

          {/* Headers esperados */}
          <div className="rounded-md border p-3 bg-muted/30">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Headers que reconoce el archivo
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[
                'name (obligatorio)',
                'genericName',
                'category',
                'dose',
                'via',
                'defaultDuration',
                'indication',
                'notes',
              ].map((h) => (
                <Badge
                  key={h}
                  variant="outline"
                  className={`text-[10px] ${h.includes('obligatorio') ? 'border-red-300 text-red-700' : ''}`}
                >
                  {h}
                </Badge>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              También acepta nombres en español: <em>nombre, nombre genérico, categoría, dosis,
              vía, duración, indicación, notas</em>
            </p>
          </div>

          {/* Zona de drop */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              isDragging
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium mb-1">
              {fileName ? `Archivo: ${fileName}` : 'Arrastra tu archivo aquí'}
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              o haz click para seleccionar
            </p>
            <label className="inline-block">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleInputChange}
                className="hidden"
                disabled={importMutation.isPending}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={importMutation.isPending}
                onClick={(e) => {
                  // Trigger click en el input hermano
                  ;(e.target as HTMLElement)
                    .closest('label')
                    ?.querySelector('input')
                    ?.click()
                }}
              >
                <Upload className="h-4 w-4 mr-1" />
                {importMutation.isPending ? 'Importando...' : 'Seleccionar archivo'}
              </Button>
            </label>
          </div>

          {/* Resultado */}
          {importMutation.isPending && (
            <div className="text-center text-sm text-muted-foreground py-3">
              <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-muted border-t-foreground mr-2 align-middle" />
              Procesando archivo...
            </div>
          )}

          {result && (
            <div className="space-y-3">
              {/* Resumen */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-700 mx-auto mb-1" />
                  <div className="text-2xl font-bold text-emerald-700">{result.imported}</div>
                  <div className="text-[10px] uppercase tracking-wide text-emerald-700">Importados</div>
                </div>
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-center">
                  <AlertCircle className="h-5 w-5 text-amber-700 mx-auto mb-1" />
                  <div className="text-2xl font-bold text-amber-700">{result.skipped || 0}</div>
                  <div className="text-[10px] uppercase tracking-wide text-amber-700">Omitidos (duplicados)</div>
                </div>
                <div className="rounded-md border border-red-300 bg-red-50 p-3 text-center">
                  <AlertCircle className="h-5 w-5 text-red-700 mx-auto mb-1" />
                  <div className="text-2xl font-bold text-red-700">{result.errors.length}</div>
                  <div className="text-[10px] uppercase tracking-wide text-red-700">Con errores</div>
                </div>
              </div>

              {/* Lista de errores */}
              {result.errors.length > 0 && (
                <div className="rounded-md border max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Fila</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.errors.map((e, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{e.row}</TableCell>
                          <TableCell className="text-xs">{e.error}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {result.imported > 0 && (
                <Alert className="border-emerald-300 bg-emerald-50">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                  <AlertTitle className="text-emerald-900">Importación completada</AlertTitle>
                  <AlertDescription className="text-emerald-800 text-sm">
                    {result.imported} medicamento(s) agregado(s) al vademécum. Ya aparecen en las
                    sugerencias al hacer recetas.
                    {result.errors.length > 0 && (
                      <span className="block mt-1">
                        Revisa los errores arriba para decidir si corriges y vuelves a subir las
                        filas problemáticas.
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result && result.imported > 0 && result.errors.length === 0 ? 'Cerrar' : 'Cancelar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
