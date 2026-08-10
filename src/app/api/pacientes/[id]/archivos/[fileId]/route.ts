import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { deleteFromSupabaseByUrl } from '@/lib/supabase-storage'

async function loadForUser(patientId: string, fileId: string, user: { role: string; clinicId: string }) {
  const file = await db.patientFile.findUnique({
    where: { id: fileId },
    include: { patient: { select: { id: true, clinicId: true } } },
  })
  if (!file) return null
  if (file.patientId !== patientId) return 'mismatch' as const
  if (user.role !== 'SUPER' && file.patient.clinicId !== user.clinicId) return 'forbidden' as const
  return file
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; fileId: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('No tienes permiso para eliminar archivos', 403)
  const { id, fileId } = await ctx.params

  const access = await loadForUser(id, fileId, user!)
  if (access === null) return bad('Archivo no encontrado', 404)
  if (access === 'mismatch') return bad('Archivo no pertenece al paciente', 400)
  if (access === 'forbidden') return bad('Sin acceso a este paciente', 403)

  // Borrar de Supabase Storage (si la URL corresponde a Supabase)
  // Si no es de Supabase, intentar borrado local como fallback.
  const fileUrl = access.fileUrl || ''
  const isSupabaseUrl = fileUrl.includes('supabase.co/storage/v1/object/public/clinics/')
  if (isSupabaseUrl) {
    const result = await deleteFromSupabaseByUrl(fileUrl)
    if (!result.ok) {
      // Log pero no bloquear: igual borramos el registro para que no quede huérfano visible
      console.error('[PATIENT FILE DELETE] Supabase error:', result.error)
    }
  } else if (fileUrl.startsWith('/uploads/')) {
    // Fallback: archivo local en /public/uploads/
    try {
      const path = await import('path')
      const fs = await import('fs/promises')
      const abs = path.join(process.cwd(), 'public', fileUrl)
      await fs.rm(abs, { force: true })
    } catch (e) {
      console.error('[PATIENT FILE DELETE] local file rm error:', e)
    }
  }

  await db.patientFile.delete({ where: { id: fileId } })
  return ok({ ok: true })
}
