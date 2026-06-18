import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/public/podologos?clinicId= | ?clinicSlug=
 * PÚBLICO (sin auth). Lista podólogos activos de la clínica indicada.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const clinicId = sp.get('clinicId')
  const clinicSlug = sp.get('clinicSlug')

  if (!clinicId && !clinicSlug) {
    return NextResponse.json({ error: 'Se requiere clinicId o clinicSlug' }, { status: 400 })
  }

  // Resuelve clinicId a partir del slug si es necesario
  let resolvedClinicId = clinicId || undefined
  if (!resolvedClinicId && clinicSlug) {
    const c = await db.clinic.findUnique({
      where: { slug: clinicSlug },
      select: { id: true },
    })
    if (!c) {
      return NextResponse.json({ error: 'Clínica no encontrada' }, { status: 404 })
    }
    resolvedClinicId = c.id
  }

  const podologos = await db.podologist.findMany({
    where: { clinicId: resolvedClinicId, active: true },
    select: {
      id: true,
      name: true,
      specialty: true,
      photoUrl: true,
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ data: podologos })
}
