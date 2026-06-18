import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/public/clinicas
 * PÚBLICO (sin auth). Lista clínicas operativas (no distribuidora) para el
 * selector de la página /reservar.
 */
export async function GET() {
  const clinics = await db.clinic.findMany({
    where: { isDistributor: false },
    select: {
      id: true,
      name: true,
      slug: true,
      address: true,
      phone: true,
      email: true,
      openingTime: true,
      closingTime: true,
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ data: clinics })
}
