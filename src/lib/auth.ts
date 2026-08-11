import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'PodoClinic',
      credentials: {
        email: { label: 'Correo', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        try {
          const user = await db.user.findUnique({
            where: { email: credentials.email },
            include: { clinic: true, podologist: true },
          })
          if (!user || !user.active) return null
          const ok = bcrypt.compareSync(credentials.password, user.passwordHash)
          if (!ok) return null
          await db.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } })
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            clinicId: user.clinicId ?? '',
            clinicName: user.clinic?.name ?? '',
            clinicSlug: user.clinic?.slug ?? '',
            clinicTimezone: user.clinic?.timezone || 'America/Hermosillo',
            clinicPrimaryColor: user.clinic?.primaryColor || '#0a3143',
            clinicSecondaryColor: user.clinic?.secondaryColor || '',
            onboardingComplete: user.clinic?.onboardingComplete ?? false,
            podologistId: user.podologistId ?? '',
          } as any
        } catch {
          return null
        }
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 7 },
  secret: process.env.NEXTAUTH_SECRET || 'cenpod-dev-secret-change-in-prod',
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.clinicId = (user as any).clinicId
        token.clinicName = (user as any).clinicName
        token.clinicSlug = (user as any).clinicSlug
        token.podologistId = (user as any).podologistId
        token.clinicTimezone = (user as any).clinicTimezone
        token.clinicPrimaryColor = (user as any).clinicPrimaryColor
        token.clinicSecondaryColor = (user as any).clinicSecondaryColor
        token.onboardingComplete = (user as any).onboardingComplete
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = token.sub
        ;(session.user as any).role = token.role
        ;(session.user as any).clinicId = token.clinicId
        ;(session.user as any).clinicName = token.clinicName
        ;(session.user as any).clinicSlug = token.clinicSlug
        ;(session.user as any).podologistId = token.podologistId
        ;(session.user as any).clinicTimezone = token.clinicTimezone
        ;(session.user as any).clinicPrimaryColor = token.clinicPrimaryColor
        ;(session.user as any).clinicSecondaryColor = token.clinicSecondaryColor
        ;(session.user as any).onboardingComplete = token.onboardingComplete
      }
      return session
    },
  },
}

export type Role = 'SUPER' | 'OWNER' | 'RECEPTION' | 'PODOLOGIST'
