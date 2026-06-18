import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import bcrypt from 'bcryptjs'

/**
 * PATCH /api/usuarios/[id]
 * Actualiza un usuario. Solo SUPER y OWNER.
 * Body puede incluir: { name, email, role, clinicId, podologistId, active, password? }
 * Si viene password, se regenera el hash.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role !== 'SUPER' && user!.role !== 'OWNER') return bad('Sin permisos', 403)

  const { id } = await params
  const existing = await db.user.findUnique({ where: { id } })
  if (!existing) return bad('Usuario no encontrado', 404)

  // OWNER solo puede editar usuarios de su clínica
  if (user!.role !== 'SUPER' && existing.clinicId !== user!.clinicId) {
    return bad('Sin permisos sobre este usuario', 403)
  }

  const body = await req.json()
  const { name, email, role, clinicId, podologistId, active, password } = body

  // Validar rol si viene
  if (role && !['SUPER', 'OWNER', 'RECEPTION', 'PODOLOGIST'].includes(role)) {
    return bad('Rol inválido')
  }

  // Permisos de rol
  if (role === 'SUPER' && user!.role !== 'SUPER') return bad('Solo el Súper Dueño puede asignar rol Súper Dueño', 403)
  if (role === 'OWNER' && user!.role !== 'SUPER') return bad('Solo el Súper Dueño puede asignar rol Dueño', 403)

  // Email único (si cambia)
  if (email && email !== existing.email) {
    const emailTaken = await db.user.findUnique({ where: { email } })
    if (emailTaken) return bad('Ese correo ya está en uso', 409)
  }

  // Si rol es PODOLOGIST y no tiene podologistId, exigir
  let finalPodologistId: string | null = existing.podologistId
  if (role === 'PODOLOGIST') {
    if (podologistId) {
      // Verificar que el podólogo exista y no esté ya vinculado a OTRO usuario
      const podoUser = await db.user.findFirst({
        where: { podologistId, NOT: { id } },
      })
      if (podoUser) return bad('Ese podólogo ya tiene otro usuario vinculado', 409)
      finalPodologistId = podologistId
    } else if (!existing.podologistId) {
      return bad('Los usuarios Podólogo deben estar vinculados a un podólogo')
    }
  } else {
    // Si el rol no es PODOLOGIST, quitar el vinculo
    finalPodologistId = null
  }

  // Determinar clinicId
  const finalClinicId =
    user!.role === 'SUPER' && clinicId ? clinicId : existing.clinicId || user!.clinicId

  // Construir data
  const data: any = {
    ...(name !== undefined && { name }),
    ...(email !== undefined && { email }),
    ...(role !== undefined && { role }),
    ...(clinicId !== undefined && user!.role === 'SUPER' && { clinicId }),
    podologistId: finalPodologistId,
    ...(active !== undefined && { active }),
  }

  // Si viene password, regenerar hash
  if (password) {
    if (password.length < 6) return bad('La contraseña debe tener al menos 6 caracteres')
    data.passwordHash = bcrypt.hashSync(password, 10)
  }

  const actualizado = await db.user.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      clinicId: true,
      podologistId: true,
    },
  })

  return ok(actualizado)
}

/**
 * DELETE /api/usuarios/[id]
 * Desactiva un usuario (no borra, solo active=false para preservar auditoría).
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role !== 'SUPER' && user!.role !== 'OWNER') return bad('Sin permisos', 403)

  const { id } = await params
  const existing = await db.user.findUnique({ where: { id } })
  if (!existing) return bad('Usuario no encontrado', 404)

  // No puedes desactivarte a ti mismo
  if (id === user!.id) return bad('No puedes desactivar tu propia cuenta', 400)

  // OWNER solo puede desactivar usuarios de su clínica
  if (user!.role !== 'SUPER' && existing.clinicId !== user!.clinicId) {
    return bad('Sin permisos sobre este usuario', 403)
  }

  // Soft delete: desactivar
  await db.user.update({ where: { id }, data: { active: false } })
  return ok({ ok: true })
}
