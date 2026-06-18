import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import path from 'path'
import { mkdir, writeFile } from 'fs/promises'
import { uploadToSupabase } from '@/lib/supabase-storage'

// ============================================================
// CONFIGURACIÓN / logo
// POST (multipart) → sube un logo para la clínica.
// En Vercel (producción): usa Supabase Storage.
// En local (dev): guarda en /public/uploads/clinics/{clinicId}/
// ============================================================

const ALLOWED_EXT = ['png', 'jpg', 'jpeg', 'webp', 'svg']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

const MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role !== 'SUPER' && user!.role !== 'OWNER') return bad('Sin permisos', 403)

  const clinicId = user!.clinicId
  if (!clinicId) return bad('Sin clínica', 400)

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return bad('Archivo no recibido')
  if (file.size === 0) return bad('Archivo vacío')
  if (file.size > MAX_SIZE) return bad('El archivo excede el tamaño máximo de 5MB')

  const filename = file.name || 'logo.png'
  const ext = (filename.split('.').pop() || 'png').toLowerCase()
  if (!ALLOWED_EXT.includes(ext)) {
    return bad(`Extensión .${ext} no permitida. Use: ${ALLOWED_EXT.join(', ')}`)
  }

  const storedName = `logo.${ext}`
  const mimeType = MIME_MAP[ext] || 'image/png'
  const arrayBuf = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuf)

  // Cache-buster: append timestamp para que el navegador no cachee el logo viejo
  const cacheBust = Date.now()
  let logoUrl: string

  // Intentar Supabase Storage primero (para Vercel/producción)
  const supabaseUrl = await uploadToSupabase(clinicId, storedName, buffer, mimeType)
  if (supabaseUrl) {
    logoUrl = `${supabaseUrl}?t=${cacheBust}`
  } else {
    // Fallback: guardar en /public (solo funciona en dev, no en Vercel)
    try {
      const relDir = `/uploads/clinics/${clinicId}`
      const absDir = path.join(process.cwd(), 'public', relDir)
      await mkdir(absDir, { recursive: true })
      const relPath = `${relDir}/${storedName}`
      const absPath = path.join(absDir, storedName)
      await writeFile(absPath, buffer)
      logoUrl = `${relPath}?t=${cacheBust}`
    } catch (e: any) {
      console.error('[LOGO UPLOAD] filesystem fallback failed:', e?.message)
      return bad(
        'No se pudo subir el logo. Si estás en producción, configura Supabase Storage (crea un bucket público llamado "clinics").',
        500,
      )
    }
  }

  // Actualizar clinic.logoUrl
  await db.clinic.update({
    where: { id: clinicId },
    data: { logoUrl },
  })

  return ok({ url: logoUrl })
}
