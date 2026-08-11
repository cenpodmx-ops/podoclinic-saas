import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { OnboardingWizard } from './onboarding-wizard'

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const user = session.user as any

  // Si ya completó el onboarding, ir al dashboard
  if (user.clinicId) {
    const clinic = await db.clinic.findUnique({
      where: { id: user.clinicId },
      select: { onboardingComplete: true, name: true, slug: true, timezone: true, primaryColor: true, secondaryColor: true, address: true, phone: true, email: true, openingTime: true, closingTime: true, rfc: true, razonSocial: true, regimenFiscal: true, logoUrl: true },
    })
    if (clinic?.onboardingComplete) redirect('/dashboard')

    // Pasar datos iniciales al wizard
    return (
      <div className="min-h-screen bg-gray-50">
        <OnboardingWizard initialClinic={clinic} userEmail={user.email || ''} clinicId={user.clinicId} />
      </div>
    )
  }

  redirect('/login')
}
