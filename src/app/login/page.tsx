'use client'

import { useState, useEffect } from 'react'
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

  useEffect(() => {
    if (params.get('onboarding') === 'done') {
      toast.success('¡Configuración completada! Inicia sesión para entrar a tu panel.')
    }
  }, [params])

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
    toast.success('Bienvenido a PodoClinic')
    router.push(callback)
    router.refresh()
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      {/* Fondo con color de marca PodoClinic */}
      <div className="absolute inset-0" style={{ backgroundColor: 'var(--clinic-primary, #0d9488)' }} />

      {/* Textura: patrón de puntos sutiles + rejilla diagonal */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(circle at 1px 1px, white 1px, transparent 0)
          `,
          backgroundSize: '24px 24px',
        }}
      />
      {/* Líneas diagonales muy sutiles */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 80px, rgba(255,255,255,0.5) 80px, rgba(255,255,255,0.5) 81px)`,
        }}
      />

      {/* Manchas decorativas sutiles para profundidad */}
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-20 blur-3xl"
           style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)' }} />
      <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full opacity-20 blur-3xl"
           style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)' }} />

      {/* Formulario centrado */}
      <div className="relative z-10 w-full max-w-md">
        <Card className="shadow-2xl border-white/10 bg-white/95 backdrop-blur-xl">
          <CardContent className="pt-10 pb-8 px-8">
            {/* Logo de PodoClinic en el recuadro blanco */}
            <div className="flex flex-col items-center mb-8">
              <img
                src="/login-logo.png"
                alt="PodoClinic"
                className="h-24 w-auto object-contain rounded-lg"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <span
                className="font-medium tracking-[0.2em] mt-3 text-center"
                style={{ color: 'var(--clinic-primary, #0d9488)', opacity: 0.6, fontSize: '0.7rem' }}
              >
                Gestión Clínica Podológica
              </span>
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
                    placeholder="tu@podoclinic.com"
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
                style={{ backgroundColor: 'var(--clinic-primary, #0d9488)' }}
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
          © 2026 PodoClinic · Sistema de gestión clínica
        </p>
      </div>
    </div>
  )
}
