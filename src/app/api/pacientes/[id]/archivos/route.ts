import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { randomUUID } from 'crypto'
import path from 'path'
import { mkdir, writeFile } from 'fs/promises'

const ALLOWED_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'docx']
const MAX_SIZE = 20 * 1024 * 1024 // 20MB

const TYPE_LABELS: Record<string, string> = {
  BIOQUIMICO: 'BIOQUIMICO',
  RADIOGRAFIA: 'RADIOGRAFIA',
  ESTUDIO: 'ESTUDIO',
  FOTO: 'FOTO',
  OTRO: 'OTRO',
}

async function loadPatientForUser(id: string, user: { role: string; clinicId: string }) {
  const p = await db.patient.findUnique({ where: { id }, select: { id: true, clinicId: true } })
  if (!p) return null
  if (user.role !== 'SUPER' && p.clinicId !== user.clinicId) return 'forbidden' as const
  return p
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  const { id } = await ctx.params

  const access = await loadPatientForUser(id, user!)
  if (access === null) return bad('Paciente no encontrado', 404)
  if (access === 'forbidden') return bad('Sin acceso a este paciente', 403)

  const files = await db.patientFile.findMany({
    where: { patientId: id },
    orderBy: { createdAt: 'desc' },
  })
  return ok({ data: files })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('No tienes permiso para subir archivos', 403)
  const { id } = await ctx.params

  const access = await loadPatientForUser(id, user!)
  if (access === null) return bad('Paciente no encontrado', 404)
  if (access === 'forbidden') return bad('Sin acceso a este paciente', 403)

  const form = await req.formData()
  const file = form.get('file')
  const typeRaw = String(form.get('type') || 'OTRO').toUpperCase()
  const type = TYPE_LABELS[typeRaw] || 'OTRO'
  const customName = form.get('name') ? String(form.get('name')) : null

  if (!(file instanceof File)) return bad('Archivo no recibido')
  if (file.size === 0) return bad('Archivo vacío')
  if (file.size > MAX_SIZE) return bad('El archivo excede el tamaño máximo de 20MB')

  const filename = file.name || 'archivo'
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  if (!ALLOWED_EXT.includes(ext)) {
    return bad(`Extensión .${ext} no permitida. Use: ${ALLOWED_EXT.join(', ')}`)
  }

  const uuid = randomUUID()
  const relDir = `/uploads/${id}`
  const absDir = path.join(process.cwd(), 'public', relDir)
  await mkdir(absDir, { recursive: true })

  const storedName = `${uuid}.${ext}`
  const relPath = `${relDir}/${storedName}`
  const absPath = path.join(absDir, storedName)

  const arrayBuf = await file.arrayBuffer()
  await writeFile(absPath, Buffer.from(arrayBuf))

  const mimeType = file.type || 'application/octet-stream'
  const name = customName || filename.replace(/\.[^.]+$/, '')

  const created = await db.patientFile.create({
    data: {
      patientId: id,
      name,
      type,
      fileUrl: relPath,
      mimeType,
      sizeBytes: file.size,
    },
  })

  return ok(created, 201)
}
