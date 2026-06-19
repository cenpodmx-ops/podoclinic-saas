'use client'

import { useQuery } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Printer, Trash2, FileText } from 'lucide-react'
import { PrescriptionPrintPreview } from '@/components/cenpod/prescription-print'
import { fmtDate } from '@/lib/format'
import { openPrintWindow } from './prescription-form-dialog'
import { toast } from 'sonner'

type Props = {
  rxId: string | null
  open: boolean
  onOpenChange: (v: boolean) => void
  canDelete?: boolean
  onDeleted?: () => void
}

type FullRx = {
  id: string
  date: string
  diagnosis: string | null
  medications: { name: string; dose?: string; via?: string; duration?: string; productId?: string }[]
  indications: string | null
  patient: {
    id: string
    firstName: string
    lastName: string
    name: string
    expNumber: string
    birthDate: string | null
    sex: string | null
    phone: string | null
    address: string | null
  } | null
  podologist: {
    id: string
    name: string
    specialty: string | null
    cedula: string | null
    certNumber: string | null
  } | null
  clinic: any
  createdAt: string
}

export function PrescriptionViewDialog({ rxId, open, onOpenChange, canDelete, onDeleted }: Props) {
  const { data: rx, isLoading } = useQuery<FullRx>({
    queryKey: ['receta', rxId],
    queryFn: () => fetch(`/api/recetas/${rxId}`).then((r) => r.json()),
    enabled: !!rxId && open,
  })

  async function handleDelete() {
    if (!rxId) return
    if (!confirm('¿Eliminar esta receta? Esta acción no se puede deshacer.')) return
    const r = await fetch(`/api/recetas/${rxId}`, { method: 'DELETE' })
    if (!r.ok) {
      const j = await r.json().catch(() => null)
      toast.error(j?.error || 'Error al eliminar')
      return
    }
    toast.success('Receta eliminada')
    onOpenChange(false)
    onDeleted?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Receta
          </DialogTitle>
          <DialogDescription>
            {rx ? `Folio ${rx.id.slice(-8).toUpperCase()} · ${fmtDate(rx.date)}` : 'Cargando…'}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !rx ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge variant="outline" className="text-xs">
                {rx.medications.length} medicamento{rx.medications.length === 1 ? '' : 's'}
              </Badge>
              {rx.podologist && (
                <Badge variant="outline" className="text-xs">
                  {rx.podologist.name}
                  {rx.podologist.cedula ? ` · Céd. ${rx.podologist.cedula}` : ''}
                </Badge>
              )}
              {rx.diagnosis && (
                <Badge variant="outline" className="text-xs text-muted-foreground max-w-[280px] truncate">
                  {rx.diagnosis}
                </Badge>
              )}
            </div>

            <div className="rounded-md bg-muted/30 p-4 max-h-[60vh] overflow-y-auto">
              <PrescriptionPrintPreview
                data={{
                  id: rx.id,
                  date: rx.date,
                  diagnosis: rx.diagnosis,
                  medications: rx.medications,
                  indications: rx.indications,
                  patient: rx.patient,
                  podologist: rx.podologist,
                  clinic: rx.clinic,
                }}
              />
            </div>
          </>
        )}

        <DialogFooter className="gap-2 flex-col-reverse sm:flex-row sm:justify-end">
          {canDelete && rx && (
            <Button variant="destructive" onClick={handleDelete} className="sm:mr-auto">
              <Trash2 className="h-4 w-4" /> Eliminar
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          {rx && (
            <Button onClick={() => openPrintWindow(rx.id)}>
              <Printer className="h-4 w-4" /> Imprimir / PDF
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
