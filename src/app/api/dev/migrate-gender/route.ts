import { NextRequest } from 'next/server'
import { requireSession, ok, bad } from '@/lib/api'

/**
 * POST /api/dev/migrate-gender
 * Añade la columna 'gender' a la tabla Podologist si no existe.
 * Solo SUPER puede ejecutarlo.
 *
 * Esto es necesario porque Vercel no ejecuta prisma db push automáticamente.
 * Hay que llamar este endpoint una vez después de deployar el cambio del schema.
 */
export async function POST() {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role !== 'SUPER') return bad('Solo SUPER', 403)

  // Usar $executeRaw para agregar la columna si no existe
  // PostgreSQL no tiene "ADD COLUMN IF NOT EXISTS" antes de versión 9.6,
  // pero Supabase usa PostgreSQL 15+ que sí lo soporta.
  try {
    // Intentar agregar la columna. Si ya existe, no hace nada (IF NOT EXISTS).
    // Nota: Prisma's $executeRaw no acepta parámetros para DDL, pero esto es seguro
    // porque es SQL estático sin input del usuario.
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()

    // Verificar si la columna existe primero
    const columns: any[] = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'Podologist'
      AND column_name = 'gender'
    `

    if (columns.length === 0) {
      // La columna no existe, agregarla
      await prisma.$executeRaw`ALTER TABLE "Podologist" ADD COLUMN "gender" TEXT`
      await prisma.$disconnect()
      return ok({
        migrated: true,
        message: 'Columna gender agregada a la tabla Podologist',
      })
    } else {
      await prisma.$disconnect()
      return ok({
        migrated: false,
        message: 'La columna gender ya existe en la tabla Podologist',
      })
    }
  } catch (e: any) {
    return bad(`Error al migrar: ${e.message}`, 500)
  }
}

export async function GET() {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role !== 'SUPER') return bad('Solo SUPER', 403)

  try {
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()

    const columns: any[] = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'Podologist'
      ORDER BY ordinal_position
    `
    await prisma.$disconnect()

    return ok({
      table: 'Podologist',
      columns: columns.map((c: any) => ({ name: c.column_name, type: c.data_type, nullable: c.is_nullable })),
      hasGender: columns.some((c: any) => c.column_name === 'gender'),
    })
  } catch (e: any) {
    return bad(`Error: ${e.message}`, 500)
  }
}
