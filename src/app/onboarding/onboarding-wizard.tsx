'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
// useSession no se usa directamente — userEmail viene como prop del server component
// signOut se usa para forzar re-login después del onboarding
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Check, ChevronRight, ChevronLeft, Building2, Palette, FileText, Users, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

const TIMEZONES = [
  { value: 'America/Mexico_City', label: 'Ciudad de México (Centro)' },
  { value: 'America/Cancun', label: 'Cancún (Quintana Roo)' },
  { value: 'America/Mazatlan', label: 'Mazatlán (Pacífico)' },
  { value: 'America/Hermosillo', label: 'Hermosillo (Sonora)' },
  { value: 'America/Tijuana', label: 'Tijuana (Noroeste)' },
  { value: 'America/Monterrey', label: 'Monterrey (Noreste)' },
]

const COLOR_PRESETS = [
  { primary: '#0d9488', secondary: '#0f766e', label: 'Teal' },
  { primary: '#2563eb', secondary: '#1d4ed8', label: 'Azul' },
  { primary: '#7c3aed', secondary: '#6d28d9', label: 'Púrpura' },
  { primary: '#dc2626', secondary: '#b91c1c', label: 'Rojo' },
  { primary: '#ea580c', secondary: '#c2410c', label: 'Naranja' },
  { primary: '#16a34a', secondary: '#15803d', label: 'Verde' },
  { primary: '#0891b2', secondary: '#0e7490', label: 'Cian' },
  { primary: '#be185d', secondary: '#9f1239', label: 'Rosa' },
]

const STEPS = [
  { id: 1, title: 'Tu Clínica', icon: Building2, desc: 'Información básica' },
  { id: 2, title: 'Branding', icon: Palette, desc: 'Logo y colores' },
  { id: 3, title: 'Fiscal', icon: FileText, desc: 'Facturación (opcional)' },
  { id: 4, title: 'Usuarios', icon: Users, desc: 'Equipo de trabajo' },
  { id: 5, title: 'Listo', icon: Sparkles, desc: 'Confirmar' },
]

type ClinicData = {
  name?: string | null; slug?: string | null; address?: string | null
  phone?: string | null; email?: string | null; openingTime?: string | null
  closingTime?: string | null; timezone?: string | null; primaryColor?: string | null
  secondaryColor?: string | null; logoUrl?: string | null; rfc?: string | null
  razonSocial?: string | null; regimenFiscal?: string | null
}

export function OnboardingWizard({ initialClinic, userEmail, clinicId }: { initialClinic: ClinicData | null; userEmail: string; clinicId: string }) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: initialClinic?.name || '', timezone: initialClinic?.timezone || '',
    address: initialClinic?.address || '', phone: initialClinic?.phone || '',
    email: initialClinic?.email || '', openingTime: initialClinic?.openingTime || '09:00',
    closingTime: initialClinic?.closingTime || '18:00',
    primaryColor: initialClinic?.primaryColor || '#0d9488',
    secondaryColor: initialClinic?.secondaryColor || '#0f766e',
    rfc: initialClinic?.rfc || '', razonSocial: initialClinic?.razonSocial || '',
    regimenFiscal: initialClinic?.regimenFiscal || '',
  })
  const [newUsers, setNewUsers] = useState<Array<{ name: string; email: string; role: string; password: string }>>([])

  useEffect(() => {
    if (!form.timezone) {
      try { const detected = Intl.DateTimeFormat().resolvedOptions().timeZone; setForm(f => ({ ...f, timezone: detected })) } catch {}
    }
  }, [])

  const update = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }))

  async function saveStep(stepName: string, data: any, goToNext: number | null = null) {
    setLoading(true)
    try {
      const res = await fetch('/api/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ step: stepName, data }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al guardar')
      if (goToNext) setStep(goToNext)
    } catch (e: any) { toast.error(e.message) }
    setLoading(false)
  }

  async function finish() {
    setLoading(true)
    try {
      const res = await fetch('/api/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ step: 'all', data: { ...form, users: newUsers }, complete: true }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al finalizar')
      toast.success('¡Configuración completada! Reiniciando sesión...')
      // El JWT no se puede actualizar en runtime — necesitamos re-login
      // para que el token se regenere con onboardingComplete = true
      setTimeout(() => {
        signOut({ redirect: false })
        router.push('/login?onboarding=done')
        router.refresh()
      }, 1500)
    } catch (e: any) { toast.error(e.message) }
    setLoading(false)
  }

  const currentStep = STEPS.find(s => s.id === step)!
  const accent = form.primaryColor || '#0d9488'

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="border-b bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/podoclinic-logo.png" alt="PodoClinic" className="h-8 w-auto object-contain" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
            <span className="text-sm text-gray-500">Configuración inicial</span>
          </div>
          <span className="text-sm text-gray-400">Paso {step} de {STEPS.length}</span>
        </div>
        <div className="h-1 bg-gray-100">
          <div className="h-full transition-all duration-300" style={{ width: `${(step / STEPS.length) * 100}%`, backgroundColor: accent }} />
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 pt-8 pb-4">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div className={`flex flex-col items-center gap-1 ${step >= s.id ? 'opacity-100' : 'opacity-30'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${step > s.id ? 'text-white' : step === s.id ? 'text-white' : 'bg-gray-200 text-gray-500'}`} style={step >= s.id ? { backgroundColor: accent } : {}}>
                  {step > s.id ? <Check className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
                </div>
                <span className="text-[10px] font-medium text-gray-600 hidden sm:block">{s.title}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`w-8 sm:w-16 h-0.5 mx-1 ${step > s.id ? '' : 'bg-gray-200'}`} style={step > s.id ? { backgroundColor: accent } : {}} />}
            </div>
          ))}
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 pb-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><currentStep.icon className="w-5 h-5" style={{ color: accent }} />{currentStep.title}</CardTitle>
            <p className="text-sm text-gray-500">{currentStep.desc}</p>
          </CardHeader>
          <CardContent className="space-y-4">

            {step === 1 && (
              <div className="space-y-4">
                <div><Label>Nombre de tu clínica *</Label><Input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Ej: Clínica del Pie Hermosillo" /></div>
                <div><Label>Zona horaria *</Label><p className="text-xs text-gray-500 mb-1">Detectamos tu zona automáticamente. Cámbiala si es incorrecta.</p>
                  <select value={form.timezone} onChange={e => update('timezone', e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                    {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Hora apertura</Label><Input type="time" value={form.openingTime} onChange={e => update('openingTime', e.target.value)} /></div>
                  <div><Label>Hora cierre</Label><Input type="time" value={form.closingTime} onChange={e => update('closingTime', e.target.value)} /></div>
                </div>
                <div><Label>Dirección</Label><Input value={form.address} onChange={e => update('address', e.target.value)} placeholder="Calle, número, ciudad" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Teléfono</Label><Input value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="6621234567" /></div>
                  <div><Label>Email</Label><Input value={form.email} onChange={e => update('email', e.target.value)} placeholder="contacto@tuclinica.com" /></div>
                </div>
                <div className="flex justify-end"><Button onClick={() => saveStep('clinic', form, 2)} disabled={loading || !form.name || !form.timezone} style={{ backgroundColor: accent }}>{loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Continuar <ChevronRight className="w-4 h-4 ml-1" /></Button></div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div><Label>Logo de tu clínica</Label><p className="text-xs text-gray-500 mb-2">Sube el logo de tu clínica. Aparecerá en el sistema, recetas y tickets.</p>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden" style={{ backgroundColor: accent + '10' }}>
                      <span className="text-2xl font-bold" style={{ color: accent }}>{form.name?.charAt(0) || 'C'}</span>
                    </div>
                    <div><input type="file" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; const formData = new FormData(); formData.append('file', file); try { const res = await fetch('/api/config/logo', { method: 'POST', body: formData }); if (res.ok) toast.success('Logo subido'); else toast.error('Error al subir logo') } catch { toast.error('Error al subir logo') } }} className="text-sm" /><p className="text-xs text-gray-400 mt-1">PNG o JPG, idealmente cuadrado</p></div>
                  </div>
                </div>
                <div><Label>Color principal</Label><p className="text-xs text-gray-500 mb-2">Elige el color que identificará a tu clínica.</p>
                  <div className="grid grid-cols-4 gap-2">
                    {COLOR_PRESETS.map(preset => (
                      <button key={preset.primary} onClick={() => { update('primaryColor', preset.primary); update('secondaryColor', preset.secondary) }} className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition ${form.primaryColor === preset.primary ? 'border-gray-800' : 'border-transparent hover:border-gray-300'}`}>
                        <div className="w-8 h-8 rounded-full" style={{ backgroundColor: preset.primary }} /><span className="text-[10px] text-gray-600">{preset.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2"><input type="color" value={form.primaryColor} onChange={e => update('primaryColor', e.target.value)} className="w-10 h-10 rounded cursor-pointer" /><span className="text-sm text-gray-600">o elige un color personalizado</span></div>
                </div>
                <div className="flex justify-between"><Button variant="outline" onClick={() => setStep(1)}><ChevronLeft className="w-4 h-4 mr-1" /> Atrás</Button><Button onClick={() => saveStep('branding', form, 3)} disabled={loading} style={{ backgroundColor: accent }}>{loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Continuar <ChevronRight className="w-4 h-4 ml-1" /></Button></div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-4"><p className="text-sm text-blue-900"><strong>¿Para qué sirve?</strong> Datos para facturación (CFDI) vía FacturAPI. Puedes configurarlo después.</p></div>
                <div><Label>RFC</Label><Input value={form.rfc} onChange={e => update('rfc', e.target.value)} placeholder="XAXX010101000" /></div>
                <div><Label>Razón social</Label><Input value={form.razonSocial} onChange={e => update('razonSocial', e.target.value)} placeholder="Mi Clínica S.A. de C.V." /></div>
                <div><Label>Régimen fiscal</Label><select value={form.regimenFiscal} onChange={e => update('regimenFiscal', e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">Selecciona...</option><option value="601">601 · General de Ley</option><option value="612">612 · Actividades Empresariales</option><option value="626">626 · RESICO</option></select></div>
                <div className="flex justify-between"><Button variant="outline" onClick={() => setStep(2)}><ChevronLeft className="w-4 h-4 mr-1" /> Atrás</Button><Button onClick={() => saveStep('fiscal', form, 4)} disabled={loading} style={{ backgroundColor: accent }}>{loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}{form.rfc ? 'Continuar' : 'Saltar'} <ChevronRight className="w-4 h-4 ml-1" /></Button></div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-4"><p className="text-sm text-amber-900"><strong>Tu cuenta:</strong> {userEmail} (Súper Dueño)<br />Crea usuarios adicionales o hazlo después.</p></div>
                {newUsers.map((u, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-3"><Label>Nombre</Label><Input value={u.name} onChange={e => setNewUsers(prev => prev.map((p, idx) => idx === i ? { ...p, name: e.target.value } : p))} placeholder="María" /></div>
                    <div className="col-span-4"><Label>Email</Label><Input value={u.email} onChange={e => setNewUsers(prev => prev.map((p, idx) => idx === i ? { ...p, email: e.target.value } : p))} placeholder="r@clinica.com" /></div>
                    <div className="col-span-3"><Label>Rol</Label><select value={u.role} onChange={e => setNewUsers(prev => prev.map((p, idx) => idx === i ? { ...p, role: e.target.value } : p))} className="w-full h-10 rounded-md border border-input bg-background px-2 text-sm"><option value="RECEPTION">Recepción</option><option value="PODOLOGIST">Podólogo</option></select></div>
                    <div className="col-span-2"><Label>Contraseña</Label><Input value={u.password} onChange={e => setNewUsers(prev => prev.map((p, idx) => idx === i ? { ...p, password: e.target.value } : p))} placeholder="••••" /></div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setNewUsers(prev => [...prev, { name: '', email: '', role: 'RECEPTION', password: '' }])}>+ Agregar</Button>
                <div className="flex justify-between"><Button variant="outline" onClick={() => setStep(3)}><ChevronLeft className="w-4 h-4 mr-1" /> Atrás</Button><Button onClick={() => saveStep('users', { users: newUsers }, 5)} disabled={loading} style={{ backgroundColor: accent }}>{loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Continuar <ChevronRight className="w-4 h-4 ml-1" /></Button></div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <div className="text-center mb-6"><div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: accent + '20' }}><Sparkles className="w-8 h-8" style={{ color: accent }} /></div><h3 className="text-xl font-bold mt-3">¡Todo listo!</h3><p className="text-sm text-gray-500">Revisa tu configuración</p></div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Clínica:</span><span className="font-medium">{form.name}</span></div>
                  <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Zona horaria:</span><span className="font-medium">{TIMEZONES.find(t => t.value === form.timezone)?.label || form.timezone}</span></div>
                  <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Horario:</span><span className="font-medium">{form.openingTime} - {form.closingTime}</span></div>
                  <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Color:</span><div className="flex items-center gap-2"><div className="w-5 h-5 rounded" style={{ backgroundColor: form.primaryColor }} /><span className="font-medium">{form.primaryColor}</span></div></div>
                  <div className="flex justify-between border-b pb-2"><span className="text-gray-500">RFC:</span><span className="font-medium">{form.rfc || <em className="text-gray-400">No configurado</em>}</span></div>
                </div>
                <div className="flex justify-between pt-4"><Button variant="outline" onClick={() => setStep(4)}><ChevronLeft className="w-4 h-4 mr-1" /> Atrás</Button><Button onClick={finish} disabled={loading} style={{ backgroundColor: accent }} className="px-8">{loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}Iniciar PodoClinic</Button></div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
