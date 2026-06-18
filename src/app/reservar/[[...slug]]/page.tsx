import { PublicBookingFlow } from './booking-flow'

/**
 * /reservar            → muestra todas las clínicas (selector)
 * /reservar/clinica-1  → pre-selecciona la clínica con ese slug
 *
 * Página pública (sin auth). Standalone (sin AppShell).
 */
export default async function ReservarPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>
}) {
  const { slug } = await params
  const clinicSlug = slug && slug.length > 0 ? slug[0] : undefined
  return <PublicBookingFlow initialClinicSlug={clinicSlug} />
}

export const dynamic = 'force-dynamic'
