'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import {
  ChevronLeft,
  LogOut,
  Menu,
  Moon,
  Sun,
  X,
  Building2,
  Bell,
  UserCircle,
  CalendarDays,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MODULES, GROUP_LABELS, MOBILE_NAV_IDS, type ModuleDef } from '@/lib/modules'
import { ROLES } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { RedProvider, useRed } from '@/components/cenpod/red-provider'
import { ClinicSwitcher } from '@/components/cenpod/clinic-switcher'

function SidebarLink({ m, active, collapsed }: { m: ModuleDef; active: boolean; collapsed: boolean }) {
  const Icon = m.icon
  return (
    <Link
      href={m.href}
      prefetch
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
      )}
      title={collapsed ? m.label : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{m.label}</span>}
    </Link>
  )
}

function SidebarContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role as string
  const filtered = MODULES.filter((m) => m.roles.includes(role))

  // Agrupar
  const groups = filtered.reduce<Record<string, ModuleDef[]>>((acc, m) => {
    ;(acc[m.group] ||= []).push(m)
    return acc
  }, {})

  const order: ModuleDef['group'][] = ['operacion', 'pacientes', 'finanzas', 'crecimiento', 'grupo', 'config']

  return (
    <nav className="flex flex-col gap-4 px-3 py-4">
      {order.map((g) => {
        const items = groups[g]
        if (!items?.length) return null
        return (
          <div key={g}>
            {!collapsed && (
              <div className="px-3 mb-1 text-[10px] uppercase tracking-wider text-sidebar-foreground/50 font-semibold">
                {GROUP_LABELS[g]}
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              {items.map((m) => {
                const active = m.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(m.href)
                return <SidebarLink key={m.id} m={m} active={active} collapsed={collapsed} />
              })}
            </div>
          </div>
        )
      })}
    </nav>
  )
}

function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()
  const u = session?.user as any
  const roleLabel = u ? (ROLES as any)[u.role] : ''
  const red = useRed()
  const totalUnread = red?.totalUnread ?? 0

  return (
    <header className="h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 flex items-center gap-3 px-4">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onOpenMenu}>
        <Menu className="h-5 w-5" />
      </Button>

      <ClinicSwitcher />

      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          <Sun className="h-4 w-4 dark:hidden" />
          <Moon className="h-4 w-4 hidden dark:block" />
        </Button>
        <Link href="/red" className="relative inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-accent transition-colors">
          <Bell className="h-4 w-4" />
          {totalUnread > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <UserCircle className="h-5 w-5" />
              <span className="hidden sm:inline text-sm">{u?.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="font-medium">{u?.name}</div>
              <div className="text-xs text-muted-foreground">{u?.email}</div>
              <div className="text-xs text-muted-foreground mt-1">{roleLabel}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/login' })} className="text-red-600 focus:text-red-600">
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

function MobileBottomNav() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role as string
  if (!role) return null

  // Podólogo: solo agenda
  if (role === 'PODOLOGIST') {
    return (
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t bg-background flex items-center justify-around h-14 safe-area-pb">
        <Link
          href="/mi-agenda"
          className={cn(
            'flex flex-col items-center justify-center text-[10px] gap-0.5 flex-1 h-full',
            pathname === '/mi-agenda' ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          <CalendarDays className="h-5 w-5" />
          Mi Agenda
        </Link>
      </nav>
    )
  }

  const items = MODULES.filter((m) => MOBILE_NAV_IDS.includes(m.id) && m.roles.includes(role))
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t bg-background flex items-center justify-around h-14 safe-area-pb">
      {items.map((m) => {
        const Icon = m.icon
        const active = m.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(m.href)
        return (
          <Link
            key={m.id}
            href={m.href}
            prefetch
            className={cn(
              'flex flex-col items-center justify-center text-[10px] gap-0.5 flex-1 h-full',
              active ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <Icon className="h-5 w-5" />
            {m.shortLabel || m.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { data: session } = useSession()
  const role = (session?.user as any)?.role as string

  // Podólogo: layout fijo de solo lectura
  if (role === 'PODOLOGIST') {
    return (
      <div className="min-h-screen flex flex-col">
        <TopBar onOpenMenu={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-auto pb-20 md:pb-0">{children}</main>
        <MobileBottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex flex-1">
        {/* Sidebar escritorio */}
        <aside
          className={cn(
            'hidden md:flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-200 sticky top-0 h-screen',
            collapsed ? 'w-20' : 'w-64'
          )}
        >
          <div
            className="flex flex-col items-center justify-center gap-0 px-4 py-5 border-b border-sidebar-border text-white shrink-0"
            style={{ backgroundColor: '#0a3143' }}
          >
            {!collapsed ? (
              <>
                <span className="text-2xl font-extrabold tracking-[0.15em] leading-none">CENPOD</span>
                <span className="text-[9px] font-medium tracking-[0.2em] mt-1 text-white/70 text-center">
                  CENTRO PODOLÓGICO
                </span>
              </>
            ) : (
              <span className="text-lg font-extrabold tracking-wider leading-none">CP</span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto cenpod-sidebar-scroll">
            <SidebarContent collapsed={collapsed} />
          </div>
          <div className="border-t border-sidebar-border p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed((c) => !c)}
              className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
            >
              <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
              {!collapsed && <span className="ml-2">Contraer</span>}
            </Button>
          </div>
        </aside>

        {/* Sidebar móvil */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 p-0 bg-sidebar text-sidebar-foreground">
            <div
              className="flex items-center justify-between gap-2 px-4 py-5 border-b border-sidebar-border text-white"
              style={{ backgroundColor: '#0a3143' }}
            >
              <div className="flex flex-col">
                <span className="text-xl font-extrabold tracking-[0.15em] leading-none">CENPOD</span>
                <span className="text-[8px] font-medium tracking-[0.2em] mt-1 text-white/70">
                  CENTRO PODOLÓGICO
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                className="text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div onClick={() => setMobileOpen(false)}>
              <SidebarContent collapsed={false} />
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex-1 flex flex-col min-w-0">
          <TopBar onOpenMenu={() => setMobileOpen(true)} />
          <main className="flex-1 overflow-auto pb-20 md:pb-0">{children}</main>
        </div>
      </div>
      <MobileBottomNav />
    </div>
  )
}

// Wrapper público que inyecta el RedProvider antes de renderizar el shell.
// RedProvider sólo debe activarse cuando hay sesión y no es podólogo puro read-only.
export function AppShellWithRed({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  if (session?.user) {
    return <RedProvider><AppShell>{children}</AppShell></RedProvider>
  }
  return <AppShell>{children}</AppShell>
}
