import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import path from 'path'
import { mkdir, writeFile } from 'fs/promises'

// ============================================================
// MÓDULO 18 — CONFIGURACIÓN / logo
// POST (multipart) → sube un logo para la clínica y lo guarda en
//                   /public/uploads/clinics/{clinicId}/logo.png.
//                   Actualiza clinic.logoUrl y devuelve la URL.
// ============================================================

const ALLOWED_EXT = ['png', 'jpg', 'jpeg', 'webp', 'svg']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  // Solo OWNER y SUPER pueden cambiar el logo
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

  // Usamos siempre .png como nombre final para cache-busting simple en el frontend,
  // pero respetamos la extensión original si es webp/svg/jpg.
  const storedName = `logo.${ext}`
  const relDir = `/uploads/clinics/${clinicId}`
  const absDir = path.join(process.cwd(), 'public', relDir)
  await mkdir(absDir, { recursive: true })

  const relPath = `${relDir}/${storedName}`
  const absPath = path.join(absDir, storedName)

  const arrayBuf = await file.arrayBuffer()
  await writeFile(absPath, Buffer.from(arrayBuf))

  // Actualizar clinic.logoUrl
  await db.clinic.update({
    where: { id: clinicId },
    data: { logoUrl: relPath },
  })

  return ok({ url: relPath })
}
