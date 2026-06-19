import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string
      clinicId: string
      clinicName: string
      clinicSlug: string
      podologistId?: string
    } & DefaultSession['user']
  }
  interface User {
    role: string
    clinicId: string
    clinicName: string
    clinicSlug: string
    podologistId?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: string
    clinicId: string
    clinicName: string
    clinicSlug: string
    podologistId?: string
  }
}
