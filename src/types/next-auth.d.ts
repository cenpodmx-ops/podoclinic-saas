import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string
      clinicId: string
      clinicName: string
      clinicSlug: string
      clinicTimezone: string
      clinicPrimaryColor: string
      clinicSecondaryColor: string
      onboardingComplete: boolean
      podologistId?: string
    } & DefaultSession['user']
  }
  interface User {
    role: string
    clinicId: string
    clinicName: string
    clinicSlug: string
      clinicTimezone: string
      clinicPrimaryColor: string
      clinicSecondaryColor: string
      onboardingComplete: boolean
    podologistId?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: string
    clinicId: string
    clinicName: string
    clinicSlug: string
      clinicTimezone: string
      clinicPrimaryColor: string
      clinicSecondaryColor: string
      onboardingComplete: boolean
    podologistId?: string
  }
}
