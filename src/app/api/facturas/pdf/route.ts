import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, bad } from '@/lib/api'
import { downloadInvoicePdf } from '@/lib/facturapi'

/**
 * GET /api/facturas/pdf?faId=<facturapi_id>&invoiceId=<invoice_id>
 * Descarga el PDF de la factura desde FacturAPI.
 * Verifica acceso via invoiceId (opcional) o solo faId (requiere autenticación).
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)

  const faId = req.nextUrl.searchParams.get('faId')
  if (!faId) return bad('faId requerido', 400)

  // Si hay invoiceId, verificar acceso a la factura
  const invoiceId = req.nextUrl.searchParams.get('invoiceId')
  let clinicToken = ''

  if (invoiceId) {
    const inv = await db.invoice.findUnique({
      where: { id: invoiceId },
      include: { clinic: true },
    })
    if (!inv) return bad('Factura no encontrada', 404)
    if (user!.role !== 'SUPER' && inv.clinicId !== user!.clinicId) return bad('Sin acceso', 403)
    clinicToken = inv.clinic?.facturapiToken?.trim() || ''
  } else {
    // Sin invoiceId — buscar la clínica del usuario
    if (!user!.clinicId) return bad('Sin clínica asignada', 400)
    const clinic = await db.clinic.findUnique({ where: { id: user!.clinicId } })
    clinicToken = clinic?.facturapiToken?.trim() || ''
  }

  if (!clinicToken) return bad('Sucursal sin API key de FacturAPI', 400)

  try {
    const pdfBuffer = await downloadInvoicePdf(clinicToken, faId)
    return new NextResponse(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="factura-${faId}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    })
  } catch (e: any) {
    console.error('[FACTURAS] error descargando PDF:', e)
    return bad(e?.message || 'Error al descargar PDF', 502)
  }
}
