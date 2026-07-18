import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { uploadToSupabaseRaw } from '@/lib/supabase-storage'
import { randomUUID } from 'crypto'

// ============================================================
// CONFIGURACIÓN / ticket
// GET  → devuelve { ticketConfig: {...}, clinic: {...} }
// PATCH → actualiza ticketConfig (JSON con logo, tamaño, datos empresa)
// POST (multipart, field=file) → sube logo del ticket a Supabase Storage
// ============================================================

type TicketConfig = {
  logoUrl?: string | null       // URL del logo para el ticket (independiente del de receta)
  logoSize?: number              // altura en px (ej. 60)
  clinicName?: string            // nombre a mostrar (override del de clínica)
  address?: string               // dirección a mostrar
  phone?: string                 // teléfono a mostrar
  showLogo?: boolean             // mostrar/ocultar logo
  showAddress?: boolean
  showPhone?: boolean
  showClinicName?: boolean
  footerMessage?: string         // mensaje personalizado al final
}

const DEFAULT_TICKET_CONFIG: TicketConfig = {
  logoUrl: null,
  logoSize: 60,
  clinicName: '',
  address: '',
  phone: '',
  showLogo: true,
  showAddress: true,
  showPhone: true,
  showClinicName: true,
  footerMessage: '¡Gracias por su visita!',
}

function parseConfig(s: string | null | undefined): TicketConfig {
  if (!s) return { ...DEFAULT_TICKET_CONFIG }
  try {
    const parsed = JSON.parse(s) as Partial<TicketConfig>
    return { ...DEFAULT_TICKET_CONFIG, ...parsed }
  } catch {
    return { ...DEFAULT_TICKET_CONFIG }
  }
}

export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response

  const clinicId = user!.clinicId
  const config = await db.clinicConfig.findUnique({ where: { clinicId } })
  const clinic = await db.clinic.findUnique({
    where: { id: clinicId },
    select: { name: true, address: true, phone: true },
  })

  const ticketConfig = parseConfig(config?.ticketConfig)

  return ok({
    ticketConfig,
    clinic: {
      name: clinic?.name || '',
      address: clinic?.address || '',
      phone: clinic?.phone || '',
    },
  })
}

export async function PATCH(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role !== 'SUPER' && user!.role !== 'OWNER') return bad('Sin permisos', 403)

  const clinicId = user!.clinicId
  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')

  const current = await db.clinicConfig.findUnique({ where: { clinicId } })
  const currentConfig = parseConfig(current?.ticketConfig)

  // Merge con los campos enviados
  const newConfig: TicketConfig = {
    ...currentConfig,
    ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl } : {}),
    ...(body.logoSize !== undefined ? { logoSize: Number(body.logoSize) } : {}),
    ...(body.clinicName !== undefined ? { clinicName: body.clinicName } : {}),
    ...(body.address !== undefined ? { address: body.address } : {}),
    ...(body.phone !== undefined ? { phone: body.phone } : {}),
    ...(body.showLogo !== undefined ? { showLogo: body.showLogo } : {}),
    ...(body.showAddress !== undefined ? { showAddress: body.showAddress } : {}),
    ...(body.showPhone !== undefined ? { showPhone: body.showPhone } : {}),
    ...(body.showClinicName !== undefined ? { showClinicName: body.showClinicName } : {}),
    ...(body.footerMessage !== undefined ? { footerMessage: body.footerMessage } : {}),
  }

  await db.clinicConfig.upsert({
    where: { clinicId },
    create: { clinicId, ticketConfig: JSON.stringify(newConfig) },
    update: { ticketConfig: JSON.stringify(newConfig) },
  })

  return ok({ ticketConfig: newConfig })
}

// POST multipart: subir logo del ticket
export async function POST(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role !== 'SUPER' && user!.role !== 'OWNER') return bad('Sin permisos', 403)

  const clinicId = user!.clinicId
  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return bad('Archivo no recibido')
  if (file.size === 0) return bad('Archivo vacío')
  if (file.size > 5 * 1024 * 1024) return bad('Máximo 5MB')

  const filename = file.name || 'ticket-logo.png'
  const ext = (filename.split('.').pop() || 'png').toLowerCase()
  const allowed = ['png', 'jpg', 'jpeg', 'webp', 'svg']
  if (!allowed.includes(ext)) return bad(`Extensión .${ext} no permitida`)

  const storedName = `ticket-logo-${randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const mimeType = file.type || 'image/png'

  const { url, error } = await uploadToSupabaseRaw(`tickets/${clinicId}/${storedName}`, buffer, mimeType)
  if (!url) return bad(error || 'Error al subir logo')

  return ok({ url })
}
