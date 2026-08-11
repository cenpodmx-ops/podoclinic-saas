import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import bcrypt from 'bcryptjs'

// ============================================================
// ONBOARDING API — Wizard de configuración inicial de clínica
// POST /api/onboarding — guarda los datos del paso actual
// GET  /api/onboarding — devuelve el estado del onboarding
// ============================================================

export async function GET() {
  const { user, response } = await requireSession()
  if (response) return response

  if (!user!.clinicId) return ok({ needsOnboarding: false })

  const clinic = await db.clinic.findUnique({
    where: { id: user!.clinicId },
    select: {
      id: true, name: true, slug: true, address: true, phone: true, email: true,
      openingTime: true, closingTime: true, slotMinutes: true,
      timezone: true, primaryColor: true, secondaryColor: true, logoUrl: true,
      rfc: true, razonSocial: true, regimenFiscal: true,
      onboardingComplete: true,
    },
  })

  return ok({ clinic, needsOnboarding: !clinic?.onboardingComplete })
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (!user!.clinicId) return bad('Sin clínica asignada', 400)

  const body = await req.json().catch(() => ({}))
  const { step, data, complete } = body

  // Acumular datos según el paso
  const updateData: Record<string, any> = {}

  if (step === 'clinic' || step === 'all') {
    // Paso 1: datos de la clínica
    if (data.name) updateData.name = String(data.name).trim()
    if (data.timezone) updateData.timezone = String(data.timezone).trim()
    if (data.address !== undefined) updateData.address = String(data.address).trim() || null
    if (data.phone !== undefined) updateData.phone = String(data.phone).trim() || null
    if (data.email !== undefined) updateData.email = String(data.email).trim() || null
    if (data.openingTime) updateData.openingTime = String(data.openingTime)
    if (data.closingTime) updateData.closingTime = String(data.closingTime)
  }

  if (step === 'branding' || step === 'all') {
    // Paso 2: branding
    if (data.primaryColor) updateData.primaryColor = String(data.primaryColor)
    if (data.secondaryColor !== undefined) updateData.secondaryColor = String(data.secondaryColor) || null
    if (data.logoUrl !== undefined) updateData.logoUrl = String(data.logoUrl) || null
  }

  if (step === 'fiscal' || step === 'all') {
    // Paso 3: datos fiscales (opcional)
    if (data.rfc !== undefined) updateData.rfc = String(data.rfc).trim() || null
    if (data.razonSocial !== undefined) updateData.razonSocial = String(data.razonSocial).trim() || null
    if (data.regimenFiscal !== undefined) updateData.regimenFiscal = String(data.regimenFiscal).trim() || null
  }

  if (step === 'users') {
    // Paso 4: crear usuarios adicionales (recepción, podólogo)
    const users = data.users as Array<{ name: string; email: string; role: string; password: string; podologistId?: string }>
    if (Array.isArray(users)) {
      for (const u of users) {
        if (!u.email || !u.password || !u.name) continue
        // Solo crear si no existe ya
        const existing = await db.user.findUnique({ where: { email: u.email } })
        if (existing) continue
        await db.user.create({
          data: {
            email: u.email,
            name: u.name,
            passwordHash: bcrypt.hashSync(u.password, 10),
            role: u.role,
            clinicId: user!.clinicId,
            podologistId: u.podologistId || null,
          },
        })
      }
    }
  }

  // Marcar onboarding como completo
  if (complete) {
    updateData.onboardingComplete = true
  }

  // Actualizar la clínica
  if (Object.keys(updateData).length > 0) {
    await db.clinic.update({
      where: { id: user!.clinicId },
      data: updateData,
    })
  }

  // Devolver la clínica actualizada
  const clinic = await db.clinic.findUnique({
    where: { id: user!.clinicId },
    select: {
      id: true, name: true, slug: true, timezone: true,
      primaryColor: true, secondaryColor: true, logoUrl: true,
      onboardingComplete: true,
    },
  })

  return ok({ clinic })
}
