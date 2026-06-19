# Task B3 — Facturación builder

Task: Build Módulo 04 Facturación with FacturAPI integration (API + page with 3 tabs).

## Files owned
- `src/lib/facturapi.ts` — FacturAPI server-side helper (create, cancel, get pdf/xml urls, catálogos SAT).
- `src/lib/invoice-types.ts` — tipos compartidos cliente/servidor.
- `src/app/api/facturas/route.ts` — GET list + POST create (timbrado or simulación).
- `src/app/api/facturas/[id]/route.ts` — GET detalle + PATCH cancel.
- `src/app/api/facturas/[id]/pdf/route.ts` — GET PDF (302 a FacturAPI o HTML imprimible).
- `src/app/api/facturas/citables/route.ts` — GET consultas finalizadas sin factura.
- `src/app/api/facturas/resumen/route.ts` — GET resumen mensual (OWNER/SUPER).
- `src/app/(app)/facturas/page.tsx` — página con 3 tabs.
- `src/app/(app)/facturas/_lib/types.ts` — tipos de UI.
- `src/app/(app)/facturas/_components/facturar-dialog.tsx` — dialog de facturación.
- `src/app/(app)/facturas/_components/tabs.tsx` — TabPorFacturar / TabHistorial / TabResumen.

## Files extended
- `src/app/api/config/route.ts` — añadido `facturapiConfigured: boolean` (sin exponer el token).
- `src/app/globals.css` — añadido print CSS para `.factura-resumen-print`.

## Behavior summary
- POST `/api/facturas` con `{ consultationId }` o `{ patientId, items, paymentMethod, useCfdi }`.
- Valida RFC del paciente (400 si falta).
- Si `Clinic.facturapiToken` existe → POST a `https://www.facturapi.io/api/v1/invoices` con customer + items + payment_form + use_cfdi + series. Almacena folio (SERIE-000001), uuid (formato "sat_uuid|facturapi_id"), pdfUrl y xmlUrl (URLs firmadas obtenidas vía los endpoints /pdf y /xml que devuelven 302). status='TIMBRADA'.
- Si no hay token → status='PENDIENTE', sin folio.
- Si falla FacturAPI → 502, no crea el Invoice.
- PATCH cancel: solo OWNER/SUPER. Si PENDIENTE → marca CANCELADA en BD. Si TIMBRADA → DELETE a FacturAPI `/invoices/{id}/cancel` con motivo.
- GET PDF: si TIMBRADA con pdfUrl → 302 redirect. Sino → HTML imprimible (CFDI 4.0 visual: header emisor, datos receptor, tabla items con clave SAT, desglose IVA, totales, UUID, watermark si cancelada, banner simulación).

## Notes for other agents
- No modifiqué el schema Prisma.
- El campo `Invoice.uuid` se guarda con formato "sat_uuid|facturapi_id" para poder cancelar en FacturAPI sin necesidad de un campo extra.
- El `facturapiToken` NUNCA se expone al cliente — solo `facturapiConfigured: boolean`.
- POST permite SUPER/OWNER/RECEPTION. PATCH cancel solo SUPER/OWNER. GET resumen solo SUPER/OWNER.
