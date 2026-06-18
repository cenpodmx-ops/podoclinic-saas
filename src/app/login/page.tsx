'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  const callback = params.get('callbackUrl') || '/'

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })
    setLoading(false)
    if (res?.error) {
      toast.error('Credenciales incorrectas. Revisa tu correo y contraseña.')
      return
    }
    toast.success('Bienvenido a CENPOD')
    router.push(callback)
    router.refresh()
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      {/* Fondo azul CENPOD */}
      <div className="absolute inset-0" style={{ backgroundColor: '#0a3143' }} />

      {/* Capa de huellas/patrones de pies discretos animados */}
      <div className="absolute inset-0 opacity-[0.08] pointer-events-none">
        <FootprintsLayer />
      </div>

      {/* Manchas decorativas sutiles */}
      <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-20 blur-3xl"
           style={{ background: 'radial-gradient(circle, #1a5a7a 0%, transparent 70%)' }} />
      <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full opacity-20 blur-3xl"
           style={{ background: 'radial-gradient(circle, #1a5a7a 0%, transparent 70%)' }} />

      {/* Formulario centrado */}
      <div className="relative z-10 w-full max-w-md">
        <Card className="shadow-2xl border-white/10 bg-white/95 backdrop-blur-xl">
          <CardContent className="pt-8 pb-8 px-8">
            {/* Logo arriba del form */}
            <div className="flex justify-center mb-6">
              <img src="/logo-dark.png" alt="CENPOD" className="h-20 w-auto" />
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Correo electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@cenpod.com"
                    autoComplete="email"
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={show ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="pl-9 pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-base font-medium"
                disabled={loading}
                style={{ backgroundColor: '#0a3143' }}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Ingresando...
                  </>
                ) : (
                  'Iniciar sesión'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-white/50 mt-6">
          © 2026 Grupo CENPOD · Sistema de gestión clínica
        </p>
      </div>
    </div>
  )
}

/**
 * Capa decorativa con huellas de pies SVG discretas y animadas.
 * Las huellas flotan suavemente hacia arriba para dar movimiento sutil al fondo.
 */
function FootprintsLayer() {
  // Generamos posiciones pseudo-aleatorias pero estables
  const footprints = [
    { left: '5%', top: '15%', size: 60, delay: 0, duration: 8, rotate: -15 },
    { left: '85%', top: '10%', size: 80, delay: 1.5, duration: 10, rotate: 20 },
    { left: '15%', top: '70%', size: 70, delay: 0.8, duration: 9, rotate: 25 },
    { left: '75%', top: '65%', size: 55, delay: 2.2, duration: 11, rotate: -10 },
    { left: '45%', top: '85%', size: 65, delay: 1.2, duration: 9.5, rotate: 5 },
    { left: '90%', top: '40%', size: 50, delay: 3, duration: 12, rotate: 30 },
    { left: '8%', top: '45%', size: 75, delay: 0.5, duration: 10.5, rotate: -25 },
    { left: '50%', top: '5%', size: 45, delay: 2.5, duration: 8.5, rotate: 15 },
    { left: '30%', top: '35%', size: 55, delay: 1.8, duration: 9.8, rotate: -5 },
    { left: '65%', top: '85%', size: 60, delay: 3.5, duration: 11.5, rotate: 10 },
    { left: '20%', top: '90%', size: 50, delay: 0.3, duration: 10, rotate: 18 },
    { left: '88%', top: '75%', size: 70, delay: 2.8, duration: 9.2, rotate: -18 },
  ]

  return (
    <>
      <style>{`
        @keyframes footprintFloat {
          0%, 100% { transform: translateY(0) rotate(var(--rot)); opacity: 0.6; }
          50% { transform: translateY(-18px) rotate(calc(var(--rot) + 5deg)); opacity: 1; }
        }
      `}</style>
      {footprints.map((fp, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: fp.left,
            top: fp.top,
            // @ts-expect-error custom prop
            '--rot': `${fp.rotate}deg`,
            animation: `footprintFloat ${fp.duration}s ease-in-out ${fp.delay}s infinite`,
          }}
        >
          <FootprintIcon size={fp.size} />
        </div>
      ))}
    </>
  )
}

/** Huella de pie estilizada en SVG (blanco para contrastar sobre el azul) */
function FootprintIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="white"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Palma del pie */}
      <ellipse cx="32" cy="40" rx="14" ry="18" />
      {/* Dedos */}
      <ellipse cx="18" cy="18" rx="4" ry="6" />
      <ellipse cx="26" cy="13" rx="4" ry="7" />
      <ellipse cx="34" cy="11" rx="4" ry="7.5" />
      <ellipse cx="42" cy="13" rx="4" ry="7" />
      <ellipse cx="49" cy="18" rx="3.5" ry="5.5" />
    </svg>
  )
}
