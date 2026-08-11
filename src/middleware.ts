import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  // Rutas públicas (sin auth ni onboarding)
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/public') ||
    pathname.startsWith('/api/onboarding') ||
    pathname.startsWith('/reservar') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/logo-') ||
    pathname.startsWith('/podoclinic-logo') ||
    pathname.startsWith('/login-logo') ||
    pathname.startsWith('/robots.txt') ||
    pathname.startsWith('/uploads')
  ) {
    return NextResponse.next()
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET || 'cenpod-dev-secret-change-in-prod' })
  
  // No hay sesión → login
  if (!token) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(url)
  }

  // Onboarding no completado → forzar al wizard
  if (token.onboardingComplete === false && !pathname.startsWith('/onboarding')) {
    const url = req.nextUrl.clone()
    url.pathname = '/onboarding'
    return NextResponse.redirect(url)
  }

  // Ya completó onboarding y está en /onboarding → ir al dashboard
  if (token.onboardingComplete === true && pathname.startsWith('/onboarding')) {
    const url = req.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
