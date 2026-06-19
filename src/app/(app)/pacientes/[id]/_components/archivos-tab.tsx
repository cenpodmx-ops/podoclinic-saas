'use client'

import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Upload,
  FileText,
  Image as ImageIcon,
  File,
  Trash2,
  Download,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { fmtDateTime } from '@/lib/format'
import type { Patient, PatientFileRow } from './types'

const TYPE_LABELS: Record<string, string> = {
  BIOQUIMICO: 'Bioquímico',
  RADIOGRAFIA: 'Radiografía',
  ESTUDIO: 'Estudio',
  FOTO: 'Fotografía',
  FOTO_CLINICA: 'Fotografía',
  DOCUMENTO: 'Documento',
  IDENTIFICACION: 'Identificación',
  CONSENTIMIENTO: 'Consentimiento',
  OTRO: 'Otro',
}
const TYPE_COLORS: Record<string, string> = {
  BIOQUIMICO: 'bg-purple-100 text-purple-800 border-purple-300',
  RADIOGRAFIA: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  ESTUDIO: 'bg-blue-100 text-blue-800 border-blue-300',
  FOTO: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  FOTO_CLINICA: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  DOCUMENTO: 'bg-slate-100 text-slate-800 border-slate-300',
  IDENTIFICACION: 'bg-amber-100 text-amber-800 border-amber-300',
  CONSENTIMIENTO: 'bg-orange-100 text-orange-800 border-orange-300',
  OTRO: 'bg-slate-100 text-slate-800 border-slate-300',
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(file: PatientFileRow) {
  const ext = file.fileUrl.split('.').pop()?.toLowerCase()
  if (file.mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png'].includes(ext || '')) {
    return ImageIcon
  }
  if (ext === 'pdf' || ext === 'docx') return FileText
  return File
}

function isImage(file: PatientFileRow) {
  return file.mimeType.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(file.fileUrl)
}

export function ArchivosTab({ patient }: { patient: Patient }) {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedType, setSelectedType] = useState<string>('DOCUMENTO')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data, isLoading } = useQuery<PatientFileRow[]>({
    queryKey: ['paciente-archivos', patient.id],
    queryFn: () =>
      fetch(`/api/pacientes/${patient.id}/archivos`)
        .then((r) => r.json())
        .then((d) => d?.data || d || []),
    enabled: !!patient.id,
  })

  const files = (data || patient.files || []).filter(
    (f) => f.type !== 'FOTO_CLINICA' && f.type !== 'FOTO',
  )

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const file = files[0]
    setUploading(true)
    setProgress(0)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('type', selectedType)

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', `/api/pacientes/${patient.id}/archivos`)
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText)
              if (data.error) reject(new Error(data.error))
              else resolve()
            } catch {
              resolve()
            }
          } else {
            try {
              const e = JSON.parse(xhr.responseText)
              reject(new Error(e.error || 'Error'))
            } catch {
              reject(new Error('Error'))
            }
          }
        }
        xhr.onerror = () => reject(new Error('Error de red'))
        xhr.send(form)
      })
      toast.success('Archivo subido')
      setProgress(100)
      qc.invalidateQueries({ queryKey: ['paciente-archivos', patient.id] })
      if (inputRef.current) inputRef.current.value = ''
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setUploading(false)
      setTimeout(() => setProgress(0), 800)
    }
  }

  async function deleteFile(file: PatientFileRow) {
    if (!confirm(`¿Eliminar el archivo "${file.name}"?`)) return
    setDeletingId(file.id)
    try {
      const res = await fetch(`/api/pacientes/${patient.id}/archivos/${file.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Error')
      toast.success('Archivo eliminado')
      qc.invalidateQueries({ queryKey: ['paciente-archivos', patient.id] })
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs">Tipo de archivo</Label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-full sm:w-64 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div
            className="border-2 border-dashed rounded-md p-6 text-center cursor-pointer hover:bg-muted/40 transition-colors"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onDrop={(e) => {
              e.preventDefault()
              handleFiles(e.dataTransfer.files)
            }}
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium">
              {uploading ? 'Subiendo...' : 'Haz clic o arrastra un archivo aquí'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG o DOCX · Máximo 20MB</p>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.docx,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => handleFiles(e.target.files)}
              disabled={uploading}
            />
          </div>

          {uploading && (
            <div className="space-y-1">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground text-center">{progress}%</p>
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      ) : files.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground text-sm">
            <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-50" />
            Sin archivos en el expediente.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {files.map((f) => {
            const Icon = fileIcon(f)
            return (
              <Card key={f.id} className="overflow-hidden">
                <div className="aspect-video bg-muted/40 flex items-center justify-center">
                  {isImage(f) ? (
                    <img src={f.fileUrl} alt={f.name} className="w-full h-full object-cover" />
                  ) : (
                    <Icon className="h-10 w-10 text-muted-foreground" />
                  )}
                </div>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium truncate" title={f.name}>
                      {f.name}
                    </p>
                    <Badge variant="outline" className={TYPE_COLORS[f.type] || TYPE_COLORS.OTRO}>
                      {TYPE_LABELS[f.type] || f.type}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {fmtDateTime(f.createdAt)} · {formatBytes(f.sizeBytes)}
                  </p>
                  <div className="flex gap-1">
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <a href={f.fileUrl} target="_blank" rel="noreferrer" download>
                        <Download className="h-3 w-3" /> Ver
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => deleteFile(f)}
                      disabled={deletingId === f.id}
                    >
                      {deletingId === f.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
