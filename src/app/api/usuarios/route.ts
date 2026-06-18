import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import bcrypt from 'bcryptjs'

/**
 * GET /api/usuarios
 * Lista usuarios. SUPER ve todos; OWNER ve los de su clínica; resto 403.
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role !== 'SUPER' && user!.role !== 'OWNER') return bad('Sin permisos', 403)

  const where: any = {}
  if (user!.role !== 'SUPER') {
    where.clinicId = user!.clinicId
  }

  const usuarios = await db.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      lastLogin: true,
      createdAt: true,
      clinicId: true,
      clinic: { select: { id: true, name: true } },
      podologistId: true,
      podologist: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return ok({ data: usuarios })
}

/**
 * POST /api/usuarios
 * Crea un usuario nuevo. Solo SUPER y OWNER.
 * Body: { name, email, password, role, clinicId?, podologistId?, active? }
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role !== 'SUPER' && user!.role !== 'OWNER') return bad('Sin permisos', 403)

  const body = await req.json()
  const { name, email, password, role, clinicId, podologistId, active } = body

  // Validaciones
  if (!name || !email || !password) return bad('Nombre, email y contraseña son obligatorios')
  if (!['SUPER', 'OWNER', 'RECEPTION', 'PODOLOGIST'].includes(role)) {
    return bad('Rol inválido. Debe ser: SUPER, OWNER, RECEPTION o PODOLOGIST')
  }
  if (password.length < 6) return bad('La contraseña debe tener al menos 6 caracteres')

  // Email único
  const existe = await db.user.findUnique({ where: { email } })
  if (existe) return bad('Ya existe un usuario con ese correo', 409)

  // Reglas de permisos:
  // - Solo SUPER puede crear SUPER u OWNER
  // - OWNER no puede crear SUPER
  if (role === 'SUPER' && user!.role !== 'SUPER') return bad('Solo el Súper Dueño puede crear usuarios Súper Dueño', 403)
  if (role === 'OWNER' && user!.role !== 'SUPER') return bad('Solo el Súper Dueño puede crear Dueños de Clínica', 403)

  // Determinar clinicId:
  // - SUPER puede especificar clinicId
  // - OWNER siempre asigna a su propia clínica
  const finalClinicId = user!.role === 'SUPER' && clinicId ? clinicId : user!.clinicId
  if (!finalClinicId) return bad('Se requiere una clínica')

  // Generar hash bcrypt
  const passwordHash = bcrypt.hashSync(password, 10)

  // Validar podologistId si viene (solo para rol PODOLOGIST)
  let finalPodologistId: string | null = null
  if (role === 'PODOLOGIST') {
    if (!podologistId) return bad('Los usuarios Podólogo deben estar vinculados a un podólogo. Crea primero el podólogo en la pestaña Equipo.')
    const podo = await db.podologist.findUnique({ where: { id: podologistId } })
    if (!podo) return bad('Podólogo no encontrado', 404)
    // Verificar que el podólogo no tenga ya un usuario
    const podoUserExistente = await db.user.findUnique({ where: { podologistId } })
    if (podoUserExistente) return bad('Ese podólogo ya tiene un usuario vinculado', 409)
    finalPodologistId = podologistId
  }

  const creado = await db.user.create({
    data: {
      name,
      email,
      passwordHash,
      role,
      clinicId: finalClinicId,
      podologistId: finalPodologistId,
      active: active !== false,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      clinicId: true,
      podologistId: true,
      createdAt: true,
    },
  })

  return ok(creado, 201)
}
