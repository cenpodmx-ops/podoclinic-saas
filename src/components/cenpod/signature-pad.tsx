'use client'

import { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react'
import { Button } from '@/components/ui/button'
import { Eraser } from 'lucide-react'

export type SignaturePadHandle = {
  clear: () => void
  getDataUrl: () => string | null
}

export const SignaturePad = forwardRef<SignaturePadHandle, { className?: string }>(
  function SignaturePad({ className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const drawing = useRef(false)
    const lastPt = useRef<{ x: number; y: number } | null>(null)
    const [hasContent, setHasContent] = useState(false)

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Ajustar tamaño del canvas al contenedor
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.scale(dpr, dpr)
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = '#0a3143'

      // No rellenar fondo (transparente) para que se vea bien sobre blanco
    }, [])

    const getPoint = (e: PointerEvent | React.PointerEvent) => {
      const canvas = canvasRef.current!
      const rect = canvas.getBoundingClientRect()
      return { x: (e as PointerEvent).clientX - rect.left, y: (e as PointerEvent).clientY - rect.top }
    }

    const start = (e: React.PointerEvent) => {
      e.preventDefault()
      drawing.current = true
      lastPt.current = getPoint(e)
      ;(e.target as Element).setPointerCapture(e.pointerId)
    }
    const move = (e: React.PointerEvent) => {
      if (!drawing.current) return
      e.preventDefault()
      const ctx = canvasRef.current!.getContext('2d')!
      const pt = getPoint(e)
      if (lastPt.current) {
        ctx.beginPath()
        ctx.moveTo(lastPt.current.x, lastPt.current.y)
        ctx.lineTo(pt.x, pt.y)
        ctx.stroke()
      }
      lastPt.current = pt
      if (!hasContent) setHasContent(true)
    }
    const end = (e: React.PointerEvent) => {
      e.preventDefault()
      drawing.current = false
      lastPt.current = null
    }

    useImperativeHandle(ref, () => ({
      clear() {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')!
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        setHasContent(false)
      },
      getDataUrl() {
        const canvas = canvasRef.current
        if (!canvas || !hasContent) return null
        // Compose on white background for export
        const exportCanvas = document.createElement('canvas')
        exportCanvas.width = canvas.width
        exportCanvas.height = canvas.height
        const ectx = exportCanvas.getContext('2d')!
        ectx.fillStyle = '#ffffff'
        ectx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
        ectx.drawImage(canvas, 0, 0)
        return exportCanvas.toDataURL('image/png')
      },
    }))

    return (
      <div className={className}>
        <div className="relative border-2 border-dashed border-muted-foreground/30 rounded-md bg-white">
          <canvas
            ref={canvasRef}
            className="w-full h-32 touch-none cursor-crosshair"
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          />
          {!hasContent && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs text-muted-foreground">
              Firma aquí con el mouse o el dedo
            </div>
          )}
        </div>
        <div className="flex justify-between mt-1">
          <p className="text-[10px] text-muted-foreground">Línea de firma</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => (ref as any)?.current?.clear()}
            disabled={!hasContent}
            className="h-6 text-xs"
          >
            <Eraser className="h-3 w-3 mr-1" /> Limpiar
          </Button>
        </div>
      </div>
    )
  },
)
