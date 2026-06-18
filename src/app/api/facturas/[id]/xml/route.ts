import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, bad } from '@/lib/api'
import { downloadInvoiceXml } from '@/lib/facturapi'

/**
 * GET /api/facturas/[id]/xml?faId=<facturapi_id>
 * Descarga el XML de la factura desde FacturAPI.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const { id } = await params
  const faId = req.nextUrl.searchParams.get('faId')
  if (!faId) return bad('faId requerido', 400)

  const inv = await db.invoice.findUnique({
    where: { id },
    include: { clinic: true },
  })
  if (!inv) return bad('Factura no encontrada', 404)
  if (user!.role !== 'SUPER' && inv.clinicId !== user!.clinicId) return bad('Sin acceso', 403)

  const token = inv.clinic?.facturapiToken?.trim()
  if (!token) return bad('Sucursal sin API key de FacturAPI', 400)

  try {
    const xmlBuffer = await downloadInvoiceXml(token, faId)
    return new NextResponse(xmlBuffer as any, {
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `attachment; filename="factura-${inv.folio || id}.xml"`,
        'Content-Length': String(xmlBuffer.length),
      },
    })
  } catch (e: any) {
    console.error('[FACTURAS] error descargando XML:', e)
    return bad(e?.message || 'Error al descargar XML', 502)
  }
}
