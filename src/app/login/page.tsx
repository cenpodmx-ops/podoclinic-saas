'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

const demoUsers = [
  { email: 'super@cenpod.com', label: 'Súper Dueño', role: 'Matriz · todas las clínicas' },
  { email: 'dueno@cenpod.com', label: 'Dueño', role: 'Clínica 1' },
  { email: 'recepcion@cenpod.com', label: 'Recepción', role: 'Clínica 1' },
  { email: 'ricardo@cenpod.com', label: 'Podólogo', role: 'Solo su agenda' },
]

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

  function quick(u: string) {
    setEmail(u)
    setPassword('cenpod123')
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Panel brand */}
      <div
        className="md:w-1/2 flex flex-col justify-between p-10 text-white relative overflow-hidden"
        style={{ backgroundColor: '#0a3143' }}
      >
        <div className="flex items-center gap-3 relative z-10">
          <img src="/logo-white.png" alt="CENPOD" className="h-12 w-auto" />
          <div>
            <div className="text-xl font-semibold tracking-wide">CENPOD</div>
            <div className="text-xs opacity-70">Grupo CENPOD · Hermosillo, Sonora</div>
          </div>
        </div>

        <div className="relative z-10 my-10">
          <h1 className="text-3xl md:text-4xl font-bold leading-tight">
            Sistema de gestión<br />clínica del grupo
          </h1>
          <p className="mt-4 opacity-80 max-w-md">
            Agenda, expedientes, facturación, inventario, finanzas, CRM y comunicación interna
            unificados en una sola plataforma.
          </p>
        </div>

        <div className="relative z-10 text-xs opacity-60">
          v1.0 · Confidencial · Uso interno Grupo CENPOD
        </div>

        <div className="absolute -right-32 -bottom-32 w-96 h-96 rounded-full opacity-10 bg-white" />
        <div className="absolute -right-12 top-1/3 w-48 h-48 rounded-full opacity-5 bg-white" />
      </div>

      {/* Form */}
      <div className="md:w-1/2 flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">Iniciar sesión</CardTitle>
            <p className="text-sm text-muted-foreground">
              Ingresa con tu cuenta para acceder al sistema.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@cenpod.com"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={show ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading} style={{ backgroundColor: '#0a3143' }}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Entrar
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Cuentas de demostración (clave: <code className="bg-muted px-1 rounded">cenpod123</code>):
              </p>
              <div className="grid grid-cols-2 gap-2">
                {demoUsers.map((u) => (
                  <button
                    key={u.email}
                    type="button"
                    onClick={() => quick(u.email)}
                    className="text-left text-xs p-2 rounded border hover:bg-muted transition"
                  >
                    <div className="font-medium">{u.label}</div>
                    <div className="text-muted-foreground">{u.role}</div>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
