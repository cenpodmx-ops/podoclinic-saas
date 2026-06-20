'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Search,
  UserPlus,
  Loader2,
  Phone,
  MessageCircle,
  Filter,
  LayoutGrid,
  List as ListIcon,
  ChevronLeft,
  ChevronRight,
  Droplet,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { PatientFormDialog } from '@/components/cenpod/patient-form-dialog'
import { fmtMoney, fmtDate } from '@/lib/format'

type PatientRow = {
  id: string
  expNumber: string
  firstName: string
  lastName: string
  phone: string | null
  email: string | null
  isDiabetic: boolean
  allergies: string | null
  riskLevel: string | null
  totalSpent: number
  lastVisit: string | null
  createdAt: string
  clinic: { name: string }
}

const RISK_BADGE: Record<string, string> = {
  BAJO: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  MEDIO: 'bg-amber-100 text-amber-800 border-amber-300',
  ALTO: 'bg-red-100 text-red-800 border-red-300',
}

function whatsappHref(phone: string | null, name: string) {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10) return null
  // MX default country code 52
  const num = digits.startsWith('52') ? digits : `52${digits}`
  const text = encodeURIComponent(`Hola ${name}, te contactamos de CENPOD.`)
  return `https://wa.me/${num}?text=${text}`
}

export default function PacientesPage() {
  const router = useRouter()
  const sp = useSearchParams()
  const qc = useQueryClient()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role as string | undefined
  const isSuper = role === 'SUPER'

  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20
  const [view, setView] = useState<'cards' | 'list'>('cards')

  // Filters
  const [clinicId, setClinicId] = useState<string>('') // '' = all (SUPER) or own
  const [globalMode, setGlobalMode] = useState(true) // Global siempre activo por defecto
  const [diabetic, setDiabetic] = useState<'' | 'true' | 'false'>('')
  const [risk, setRisk] = useState<string>('')
  const [sinCitaReciente, setSinCitaReciente] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Nuevo paciente dialog
  const [formOpen, setFormOpen] = useState(() => sp.get('nuevo') === '1')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebounced(q)
      setPage(1)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [q])

  // Limpia el query param ?nuevo=1 después de montar
  useEffect(() => {
    if (sp.get('nuevo') === '1') {
      router.replace('/pacientes')
    }
  }, [sp, router])

  // Clínicas para SUPER
  const { data: clinicsData } = useQuery({
    queryKey: ['clinicas'],
    queryFn: () => fetch('/api/clinicas').then((r) => r.json()),
    enabled: isSuper,
  })
  const clinics: { id: string; name: string }[] = clinicsData?.data || []

  // Query de pacientes
  const params = new URLSearchParams()
  if (debounced) params.set('q', debounced)
  params.set('page', String(page))
  params.set('limit', String(limit))
  if (diabetic) params.set('diabetic', diabetic)
  if (risk) params.set('riskLevel', risk)
  if (sinCitaReciente) params.set('sinCitaReciente', '1')
  if (isSuper && clinicId) {
    params.set('clinicId', clinicId)
  }
  if (globalMode && !isSuper) {
    params.set('global', '1')
  }
  if (isSuper && !clinicId) {
    params.set('global', '1')
  }

  const { data, isPending: isLoading, isFetching } = useQuery({
    queryKey: ['pacientes', debounced, page, limit, diabetic, risk, sinCitaReciente, clinicId, isSuper, globalMode],
    queryFn: () => fetch(`/api/pacientes?${params.toString()}`).then((r) => r.json()),
  })

  const rows: PatientRow[] = data?.data || []
  const total: number = data?.total || 0
  const totalPages = Math.max(1, Math.ceil(total / limit))

  const activeFiltersCount =
    (diabetic ? 1 : 0) + (risk ? 1 : 0) + (sinCitaReciente ? 1 : 0) + (isSuper && clinicId ? 1 : 0)

  function clearFilters() {
    setDiabetic('')
    setRisk('')
    setSinCitaReciente(false)
    setClinicId('')
    setPage(1)
  }

  function onSaved(p: { id: string }) {
    qc.invalidateQueries({ queryKey: ['pacientes'] })
    router.push(`/pacientes/${p.id}`)
  }

  const FilterPanel = (
    <div className="space-y-4">
      {isSuper && (
        <div>
          <Label className="text-xs">Sucursal</Label>
          <Select value={clinicId} onValueChange={(v) => { setClinicId(v === '__all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-full mt-1">
              <SelectValue placeholder="Todas las sucursales" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todas las sucursales</SelectItem>
              {clinics.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div>
        <Label className="text-xs">Diabético</Label>
        <Select value={diabetic} onValueChange={(v) => { setDiabetic(v === '__all' ? '' : v as any); setPage(1) }}>
          <SelectTrigger className="w-full mt-1">
            <SelectValue placeholder="Indiferente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Indiferente</SelectItem>
            <SelectItem value="true">Sí diabético</SelectItem>
            <SelectItem value="false">No diabético</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Riesgo podológico</Label>
        <Select value={risk} onValueChange={(v) => { setRisk(v === '__all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-full mt-1">
            <SelectValue placeholder="Cualquiera" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Cualquiera</SelectItem>
            <SelectItem value="BAJO">Bajo</SelectItem>
            <SelectItem value="MEDIO">Medio</SelectItem>
            <SelectItem value="ALTO">Alto</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <label className="flex items-center gap-2 cursor-pointer text-sm">
        <input
          type="checkbox"
          checked={sinCitaReciente}
          onChange={(e) => { setSinCitaReciente(e.target.checked); setPage(1) }}
          className="h-4 w-4 rounded border-input accent-[#0a3143]"
        />
        Sin cita en 90 días
      </label>
      {activeFiltersCount > 0 && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full">
          Limpiar filtros ({activeFiltersCount})
        </Button>
      )}
    </div>
  )

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pacientes</h1>
          <p className="text-sm text-muted-foreground">
            {total} paciente{total === 1 ? '' : 's'} en total
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setFormOpen(true)} style={{ backgroundColor: '#0a3143' }} size="sm">
            <UserPlus className="h-4 w-4" /> Nuevo paciente
          </Button>
        </div>
      </div>

      {/* Search + view toggle */}
      <div className="flex flex-col md:flex-row gap-2 md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, teléfono o expediente..."
            className="pl-9"
          />
          {isFetching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Switch Global / Esta sucursal */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border bg-muted/30">
          <span className={`text-xs font-medium ${!globalMode ? 'text-primary' : 'text-muted-foreground'}`}>Esta sucursal</span>
          <button
            type="button"
            onClick={() => { setGlobalMode(!globalMode); setPage(1) }}
            className={`relative w-10 h-5 rounded-full transition-colors ${globalMode ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${globalMode ? 'translate-x-5' : ''}`} />
          </button>
          <span className={`text-xs font-medium ${globalMode ? 'text-emerald-600' : 'text-muted-foreground'}`}>Global</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Filtros móvil */}
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="md:hidden relative">
                <Filter className="h-4 w-4" />
                Filtros
                {activeFiltersCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full text-[10px] flex items-center justify-center text-white" style={{ backgroundColor: '#0a3143' }}>
                    {activeFiltersCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <SheetHeader>
                <SheetTitle>Filtros</SheetTitle>
              </SheetHeader>
              <div className="mt-4">{FilterPanel}</div>
            </SheetContent>
          </Sheet>

          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <TabsList className="grid grid-cols-2 w-[160px]">
              <TabsTrigger value="cards" className="gap-1">
                <LayoutGrid className="h-4 w-4" /> Tarjetas
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-1">
                <ListIcon className="h-4 w-4" /> Lista
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Filtros escritorio */}
      <div className="hidden md:block">
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-4 gap-4 items-end">
              {isSuper && (
                <div>
                  <Label className="text-xs">Sucursal</Label>
                  <Select value={clinicId} onValueChange={(v) => { setClinicId(v === '__all' ? '' : v); setPage(1) }}>
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">Todas</SelectItem>
                      {clinics.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="text-xs">Diabético</Label>
                <Select value={diabetic} onValueChange={(v) => { setDiabetic(v === '__all' ? '' : v as any); setPage(1) }}>
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="Indiferente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">Indiferente</SelectItem>
                    <SelectItem value="true">Sí</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Riesgo</Label>
                <Select value={risk} onValueChange={(v) => { setRisk(v === '__all' ? '' : v); setPage(1) }}>
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="Cualquiera" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">Cualquiera</SelectItem>
                    <SelectItem value="BAJO">Bajo</SelectItem>
                    <SelectItem value="MEDIO">Medio</SelectItem>
                    <SelectItem value="ALTO">Alto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={sinCitaReciente}
                    onChange={(e) => { setSinCitaReciente(e.target.checked); setPage(1) }}
                    className="h-4 w-4 rounded border-input accent-[#0a3143]"
                  />
                  Sin cita 90 días
                </label>
                {activeFiltersCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Limpiar
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contenido */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <p className="text-muted-foreground">No se encontraron pacientes.</p>
            {q && <p className="text-xs mt-1">Prueba con otro término de búsqueda.</p>}
          </CardContent>
        </Card>
      ) : view === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((p) => {
            const name = `${p.firstName} ${p.lastName}`
            const wa = whatsappHref(p.phone, name)
            return (
              <Card
                key={p.id}
                className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
                onClick={() => router.push(`/pacientes/${p.id}`)}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{name}</p>
                      <p className="text-xs text-muted-foreground">Exp. {p.expNumber}</p>
                      <Badge variant="secondary" className="text-[9px] mt-0.5" style={{ backgroundColor: '#0a3143', color: 'white' }}>
                        {p.clinic?.name || 'Sin clínica'}
                      </Badge>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {p.riskLevel && (
                        <Badge variant="outline" className={RISK_BADGE[p.riskLevel]}>
                          Riesgo {p.riskLevel.toLowerCase()}
                        </Badge>
                      )}
                      {p.isDiabetic && (
                        <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 gap-1">
                          <Droplet className="h-3 w-3" /> Diabético
                        </Badge>
                      )}
                    </div>
                  </div>

                  {p.allergies && (
                    <div className="flex items-start gap-1 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                      <span className="truncate">Alergias: {p.allergies}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {p.phone || '—'}
                    </span>
                    {p.lastVisit && <span>Última: {fmtDate(p.lastVisit)}</span>}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Total gastado</p>
                      <p className="font-semibold text-sm" style={{ color: '#0a3143' }}>
                        {fmtMoney(p.totalSpent)}
                      </p>
                    </div>
                    {wa && (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border bg-green-50 text-green-700 border-green-300 hover:bg-green-100"
                      >
                        <MessageCircle className="h-3 w-3" /> WhatsApp
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Expediente</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Teléfono</TableHead>
                  {isSuper && <TableHead>Sucursal</TableHead>}
                  <TableHead>Alertas</TableHead>
                  <TableHead>Riesgo</TableHead>
                  <TableHead className="text-right">Total gastado</TableHead>
                  <TableHead>Última visita</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => {
                  const name = `${p.firstName} ${p.lastName}`
                  const wa = whatsappHref(p.phone, name)
                  return (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/pacientes/${p.id}`)}
                    >
                      <TableCell className="font-mono text-xs">{p.expNumber}</TableCell>
                      <TableCell className="font-medium">{name}</TableCell>
                      <TableCell className="text-xs">{p.phone || '—'}</TableCell>
                      <TableCell className="text-xs"><Badge variant="secondary" className="text-[9px]" style={{ backgroundColor: '#0a3143', color: 'white' }}>{p.clinic?.name || '—'}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {p.isDiabetic && (
                            <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 gap-1">
                              <Droplet className="h-3 w-3" /> Diab
                            </Badge>
                          )}
                          {p.allergies && (
                            <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300 gap-1">
                              <AlertTriangle className="h-3 w-3" /> Alergia
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {p.riskLevel && (
                          <Badge variant="outline" className={RISK_BADGE[p.riskLevel]}>
                            {p.riskLevel}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium" style={{ color: '#0a3143' }}>
                        {fmtMoney(p.totalSpent)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {p.lastVisit ? fmtDate(p.lastVisit) : '—'}
                      </TableCell>
                      <TableCell>
                        {wa && (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center justify-center h-7 w-7 rounded-md border bg-green-50 text-green-700 border-green-300 hover:bg-green-100"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Siguiente <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <PatientFormDialog open={formOpen} onOpenChange={setFormOpen} onSaved={onSaved} />
    </div>
  )
}
