import {
  LayoutDashboard,
  CalendarDays,
  Stethoscope,
  Users,
  FileText,
  Package,
  Wallet,
  Megaphone,
  ListChecks,
  Network,
  Link2,
  BarChart3,
  HeartPulse,
  DoorOpen,
  Gauge,
  Wrench,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export type ModuleDef = {
  id: string
  label: string
  shortLabel?: string
  icon: LucideIcon
  href: string
  roles: string[] // quiénes lo ven
  group: 'operacion' | 'pacientes' | 'finanzas' | 'crecimiento' | 'grupo' | 'config'
}

export const MODULES: ModuleDef[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    shortLabel: 'Inicio',
    icon: LayoutDashboard,
    href: '/dashboard',
    roles: ['SUPER', 'OWNER', 'RECEPTION'],
    group: 'operacion',
  },
  {
    id: 'agenda',
    label: 'Agenda',
    icon: CalendarDays,
    href: '/agenda',
    roles: ['SUPER', 'OWNER', 'RECEPTION'],
    group: 'operacion',
  },
  {
    id: 'consulta',
    label: 'Consulta',
    icon: Stethoscope,
    href: '/consulta',
    roles: ['SUPER', 'OWNER', 'RECEPTION'],
    group: 'operacion',
  },
  {
    id: 'pacientes',
    label: 'Pacientes',
    icon: Users,
    href: '/pacientes',
    roles: ['SUPER', 'OWNER', 'RECEPTION'],
    group: 'pacientes',
  },
  {
    id: 'recetas',
    label: 'Recetas',
    icon: FileText,
    href: '/recetas',
    roles: ['SUPER', 'OWNER', 'RECEPTION'],
    group: 'pacientes',
  },
  {
    id: 'inventario',
    label: 'Inventario',
    icon: Package,
    href: '/inventario',
    roles: ['SUPER', 'OWNER', 'RECEPTION'],
    group: 'finanzas',
  },
  {
    id: 'caja',
    label: 'Caja',
    icon: Wallet,
    href: '/caja',
    roles: ['SUPER', 'OWNER', 'RECEPTION'],
    group: 'finanzas',
  },
  {
    id: 'finanzas',
    label: 'Finanzas',
    icon: BarChart3,
    href: '/finanzas',
    roles: ['SUPER', 'OWNER'],
    group: 'finanzas',
  },
  {
    id: 'facturas',
    label: 'Facturación',
    icon: FileText,
    href: '/facturas',
    roles: ['SUPER', 'OWNER', 'RECEPTION'],
    group: 'finanzas',
  },
  {
    id: 'crm',
    label: 'CRM',
    icon: Megaphone,
    href: '/crm',
    roles: ['SUPER', 'OWNER'],
    group: 'crecimiento',
  },
  {
    id: 'seguimiento',
    label: 'Seguimiento',
    icon: HeartPulse,
    href: '/seguimiento',
    roles: ['SUPER', 'OWNER', 'RECEPTION'],
    group: 'crecimiento',
  },
  {
    id: 'servicios',
    label: 'Servicios',
    icon: ListChecks,
    href: '/servicios',
    roles: ['SUPER', 'OWNER'],
    group: 'config',
  },
  {
    id: 'reserva',
    label: 'Link de Reserva',
    icon: Link2,
    href: '/reserva',
    roles: ['SUPER', 'OWNER'],
    group: 'crecimiento',
  },
  {
    id: 'red',
    label: 'Red PodoClinic',
    icon: Network,
    href: '/red',
    roles: ['SUPER', 'OWNER', 'RECEPTION'],
    group: 'grupo',
  },
  {
    id: 'evaluacion',
    label: 'Evaluación Podólogos',
    shortLabel: 'Evaluación',
    icon: Gauge,
    href: '/evaluacion',
    roles: ['SUPER', 'OWNER'],
    group: 'grupo',
  },
  {
    id: 'operaciones',
    label: 'Cierre / Apertura',
    shortLabel: 'Operación',
    icon: DoorOpen,
    href: '/operaciones',
    roles: ['SUPER', 'OWNER', 'RECEPTION'],
    group: 'grupo',
  },
  {
    id: 'equipos',
    label: 'Equipos',
    icon: Wrench,
    href: '/equipos',
    roles: ['SUPER', 'OWNER'],
    group: 'config',
  },
  {
    id: 'config',
    label: 'Configuración',
    icon: Settings,
    href: '/config',
    roles: ['SUPER', 'OWNER'],
    group: 'config',
  },
]

export const GROUP_LABELS: Record<ModuleDef['group'], string> = {
  operacion: 'Operación',
  pacientes: 'Pacientes',
  finanzas: 'Finanzas',
  crecimiento: 'Crecimiento',
  grupo: 'Grupo',
  config: 'Configuración',
}

/** Módulos visibles para el bottom-nav en móvil (5 más usados). */
export const MOBILE_NAV_IDS = ['dashboard', 'agenda', 'pacientes', 'consulta', 'caja']
