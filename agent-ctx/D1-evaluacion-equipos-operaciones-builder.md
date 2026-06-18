# Task D1 — Evaluación (16) + Equipos (17) + Operaciones (15) builder

Agent: Evaluación + Equipos + Operaciones builder
Task ID: D1
Modules: Módulo 16 Evaluación de Podólogos, Módulo 17 Control de Equipos, Módulo 15 Cierre/Apertura de Sucursal.

## Context I read before starting
- `/home/z/my-project/worklog.md` — inicialización del proyecto, schema, módulos ya construidos (Agenda, Consulta, Pacientes, Servicios, Dashboard). El Bloque D (15, 16, 17) estaba con placeholders `ComingSoon`.
- `/home/z/my-project/prisma/schema.prisma` — modelos que uso:
  * `PodologistEvaluation` (id, podologistId, clinicId, period, consultsDone, consultsCancelled, consultsNoShow, revenue, avgValue, googleReviews, goalConsults, goalRevenue). Solo índice en (podologistId, period), no unique.
  * `Equipment` + `Maintenance` (con `type: CALIBRACION | MANTENIMIENTO | REPARACION`, `onDelete: Cascade` desde Equipment).
  * `DailyOperation` (clinicId, date, type: APERTURA | CIERRE, openingFund, closingCounted, closingExpected, difference, notes, signatureData, summaryJson, performedBy).
  * `CashSession` + `CashMovement` (creados ya por el módulo Consulta).
  * `Appointment`, `Consultation`, `Podologist`, `Clinic`.
- `src/lib/api.ts` — `requireSession`, `ok`, `bad`, `effectiveClinic` (SUPER + ?all=1 ve todo).
- `src/lib/session.ts` — `getSession`, `ROLES`.
- `src/lib/format.ts` — `fmtMoney`, `fmtDate`, `fmtDateTime`, `METHOD_LABELS`.
- Brand #0a3143 (uso `style={{ backgroundColor: '#0a3143' }}` en botones e iconos).
- `sonner` para toasts. `lucide-react` para iconos. `recharts` ya instalado. `date-fns v4`.
- El módulo 7 (Caja) del agente B2 todavía está como `ComingSoon` — construí mi propia lógica de summary en `src/app/api/operaciones/_summary.ts` sin depender de /api/caja.

## APIs creadas (propietario)

### Módulo 16 — Evaluación de Podólogos
- `GET /api/evaluaciones?period=YYYY-MM&podologistId=&all=1`
  - Para cada podólogo activo de la clínica (o todas para SUPER con ?all=1):
    consultsDone (FINALIZADA), consultsCancelled (CANCELADA), consultsNoShow (NO_ASISTIO),
    revenue (suma Consultation.total pagadas en el periodo), avgValue, googleReviews (de PodologistEvaluation o 0),
    goalConsults/goalRevenue (de PodologistEvaluation o del podólogo), progressConsults/progressRevenue,
    cancellationRate.
  - 403 si RECEPTION o PODOLOGIST.
  - Bulk load de appointments, consultations y evaluations en paralelo (3 queries).
- `PATCH /api/evaluaciones/[podologistId]` — body `{ period, googleReviews?, goalConsults?, goalRevenue? }`.
  - Upsert PodologistEvaluation (busca por podologistId+period con findFirst ya que no hay unique).
  - 403 si RECEPTION/PODOLOGIST. 403 cross-clinic.
- `GET /api/evaluaciones/reporte?podologistId=&period=`
  - Devuelve el reporte mensual completo del podólogo (para PDF/print): metrics + trend últimos 6 meses + appointments del periodo + últimas 10 consultas.
  - Llama a `computePodologistMonthlyReport` exportado desde `route.ts` para reusar la lógica.
  - 403 si RECEPTION/PODOLOGIST.

### Módulo 17 — Control de Equipos
- `GET /api/equipos?all=1` — lista equipos con `daysUntilMaintenance` y `status` (OK/PROXIMO/VENCIDO/SIN_FECHA) calculados. 403 si RECEPTION/PODOLOGIST.
- `POST /api/equipos` — crea equipo con todos los campos opcionales menos `name`. SUPER puede especificar `clinicId`.
- `GET /api/equipos/[id]` — equipo + historial completo de mantenimientos + clinic. Cross-clinic guard.
- `PATCH /api/equipos/[id]` — actualiza campos parciales (acepta null para limpiar).
- `DELETE /api/equipos/[id]` — borrado físico (cascadea Maintenance por onDelete:Cascade). 403 si RECEPTION/PODOLOGIST.
- `POST /api/equipos/[id]/mantenimientos` — body `{ type, description?, technician?, cost? }`.
  - Crea Maintenance y actualiza Equipment:
    - `CALIBRACION` → lastCalibration = hoy, nextMaintenance = hoy + 12 meses
    - `MANTENIMIENTO` → nextMaintenance = hoy + 6 meses
    - `REPARACION` → no toca fechas
  - Transacción prisma para asegurar atomicidad.

### Módulo 15 — Cierre y Apertura de Sucursal
- `GET /api/operaciones?date=YYYY-MM-DD` (default hoy) o `?from=&to=` (modo historial).
  - Devuelve `{ date, status, apertura, cierre, cashSession, summary }` con resumen en vivo:
    citas (total/atendidas/canceladas/noAsistio/pendientes), ingresos byMethod, egresos, openingFund, expectedCash.
  - Helper compartido en `_summary.ts`: `computeDailySummary(clinicId, date)`.
  - 403 si PODOLOGIST (RECEPTION puede ver/operar la caja).
- `POST /api/operaciones/apertura` — body `{ openingFund, notes? }`.
  - 409 si ya hay APERTURA hoy. Crea DailyOperation APERTURA + crea o reabre CashSession.
- `POST /api/operaciones/cierre` — body `{ countedCash, notes?, signatureData? }`.
  - 400 si no se abrió hoy. 409 si ya se cerró hoy.
  - Computa summary, crea DailyOperation CIERRE con closingCounted/Expected/difference/summaryJson/signatureData/performedBy.
  - Cierra CashSession (closed=true, closedAt, closedBy, countedCash, expectedCash, difference, notes, signatureData).
- `GET /api/operaciones/historial?from=&to=` (default últimos 30 días). OWNER/SUPER only. Agrupado por fecha.
- `GET /api/operaciones/[id]/pdf` — devuelve HTML imprimible A4 con header de clínica, fecha, responsable,
  KPIs, tabla de citas, ingresos por método, totales (contado vs esperado vs diferencia con color),
  incidencias, línea de firma, y la firma capturada (si existe) como `<img src="data:image/png...">`.
  Botón "Imprimir / Guardar PDF" visible solo en pantalla (no en print).

## Pages construidas

### `/evaluacion` — `src/app/(app)/evaluacion/page.tsx` (OWNER + SUPER)
- Period selector (month input + ChevronLeft/Right + Hoy).
- 4 KPI cards: podólogos activos, consultas del periodo, ingresos del periodo, reseñas Google.
- Tabla con scroll horizontal: avatar + nombre, hechas, canceladas (badge rojo), no-asistió (badge naranja),
  ingresos, ticket promedio, reseñas (badge con estrella), meta consultas (GoalBar con %), meta ingresos (GoalBar con $),
  acciones (Editar metas / Descargar reporte).
- Click en fila → Dialog detalle: 8 mini-stats, line chart tendencia 6 meses (consultas + ingresos),
  tabla de citas del periodo (scroll), botones Editar metas / Descargar reporte PDF.
- EditGoalsDialog: inputs para googleReviews, goalConsults, goalRevenue (vacío = usar meta del podólogo).
- ReportPrintDialog: vista previa del reporte con stats + chart + botón "Imprimir / Guardar PDF" (window.print()).
- Charts comparativos (bar): ingresos por podólogo, consultas por podólogo.

### `/equipos` — `src/app/(app)/equipos/page.tsx` (OWNER + SUPER)
- Alert banners: vencidos (rojo) y próximos 30 días (naranja) — listando los nombres.
- 4 SummaryCards: total, al día, próximos, vencidos (con colores CENPOD).
- Grid de tarjetas (1/2/3 columnas responsive): cada tarjeta con icono, nombre, brand·model, badge de estado
  (OK verde / PROXIMO naranja / VENCIDO rojo / SIN_FECHA slate), serie, proveedor, última calibración,
  próximo mantenimiento (con color), días restantes, badge de N° mantenimientos, botones "+" (mantenimiento) y "✏" (editar).
- Click en tarjeta → Dialog detalle: 8 databoxes, notas, tabla historial mantenimientos (con badges por tipo y costo),
  botones Eliminar (con confirmación), Editar, Registrar mantenimiento.
- EquipoFormDialog (nuevo/editar): name*, brand, model, serialNumber, acquisitionDate, serviceProvider,
  lastCalibration, nextMaintenance, notes. useEffect para sincronizar form cuando cambia el `equipo` prop.
- MantenimientoDialog: tipo (Select), técnico, descripción, costo. Indica qué fechas se actualizarán.
- Hard delete (no soft) con confirmación.

### `/operaciones` — `src/app/(app)/operaciones/page.tsx` (all except PODOLOGIST)
- Tabs: "Hoy" y "Historial".
- Hoy:
  - StatusCard dinámico según estado:
    * CERRADA_SIN_ABRIR → tarjeta con inputs fondo apertura + notas + botón "Abrir sucursal".
    * ABIERTA → tarjeta verde con responsable, fondo, hora + botón rojo "Cerrar sucursal".
    * CERRADA → tarjeta slate con responsable + diferencia (con color) + botón "Ver reporte".
  - LiveSummary (cada 30s refetch): 4 KPI cards, ingresos por método, caja efectivo (apertura + ingresos efectivo - egresos efectivo = esperado).
  - CierreDialog: efectivo esperado (read-only), efectivo contado (input), diferencia (con color), incidencias (textarea),
    SignaturePad (canvas HTML5 con pointer events, mouse + touch, botón limpiar, exporta PNG dataURL con fondo blanco),
    botón "Confirmar cierre". Al confirmar: POST /cierre, toast, abre el PDF en nueva pestaña.
  - CierreReportCard (después de cerrar): 8 stats, incidencias, firma capturada, botones Imprimir/PDF y
    "Enviar al dueño por WhatsApp" (wa.me con mensaje formateado multiline).
- Historial: date range (desde/hasta), presets última semana / últimos 30 días, tabla con fecha, sucursal, responsable,
  fondo apertura, contado, esperado, diferencia (color), estado, botón ver reporte. Click en fila abre el PDF.

## Componente reutilizable
- `src/components/cenpod/signature-pad.tsx` — `SignaturePad` (forwardRef + useImperativeHandle con `clear()` y `getDataUrl()`).
  Canvas HTML5 con Pointer Events (mouse + touch), dpr-aware para retina, fondo transparente en pantalla
  y blanco al exportar (composición en canvas secundario). Placeholder "Firma aquí…" hasta que hay contenido.

## Validaciones end-to-end probadas (con cookies de dueno@cenpod.com)
- `/api/evaluaciones?period=2026-06` → 200, lista de 3 podólogos con métricas correctas.
- `/api/evaluaciones/reporte?podologistId=pod-001&period=2026-06` → 200, reporte completo con trend.
- `PATCH /api/evaluaciones/pod-001` con googleReviews=5, goalConsults=100, goalRevenue=80000 → 200, upsert correcto.
- `GET /api/equipos` → 200, lista con daysUntilMaintenance y status calculados (Autoclave VENCIDO -17d).
- `POST /api/equipos` con name="Equipo de prueba D1" → 201, creado.
- `POST /api/equipos/{id}/mantenimientos` type=CALIBRACION → 201, equipo.lastCalibration = hoy, nextMaintenance = +12 meses.
- `GET /api/equipos/{id}` → 200, incluye historial.
- `DELETE /api/equipos/{id}` → 200, borrado físico.
- `GET /api/operaciones` → 200, status CERRADA_SIN_ABRIR, summary con citas/ingresos/expectedCash.
- `POST /api/operaciones/apertura` openingFund=500 → 201, crea DailyOperation APERTURA + actualiza CashSession.
- `POST /api/operaciones/apertura` (de nuevo) → 409 "La sucursal ya está abierta hoy".
- `POST /api/operaciones/cierre` countedCash=318.40 → 201, closingExpected=818.40, difference=-500, summaryJson poblado.
- `POST /api/operaciones/cierre` (de nuevo) → 409 "La sucursal ya está cerrada hoy".
- `GET /api/operaciones/{id}/pdf` → 200 text/html, render correcto.
- `GET /api/operaciones/historial?from=2026-06-01&to=2026-06-30` → 200, agrupado por fecha.
- Páginas /evaluacion, /equipos, /operaciones → HTTP 200, sin runtime errors ni hydration mismatches.

## Limpieza
- Borré los DailyOperation y PodologistEvaluation de prueba creados durante testing (notes LIKE 'Test%' y googleReviews=5 period=2026-06).

## Final checks
- `bunx eslint` (solo mis archivos) → 0 errores, 0 warnings (--max-warnings=0).
- `bunx tsc --noEmit` → 0 errores en mis archivos.
- `dev.log` → sin errores de compile ni runtime en mis páginas/APIs.
- 1 error residual en `src/app/(app)/facturas/_components/facturar-dialog.tsx:133` (Parsing error: Property assignment expected) — es de otro agente (B2), no mío.
- Módulos 15, 16 y 17 ya NO son `ComingSoon`. Reemplazados por páginas funcionales completas.

## Notas
- El schema `PodologistEvaluation` no tiene `@@unique([podologistId, period])`, así que uso `findFirst` + upsert manual (no `findUnique` con clave compuesta).
- `computeDailySummary` filtra CashMovement por `createdAt` en el rango del día (no por fecha de operación). Si la prod usa otro campo, ajustar.
- El PDF route usa HTML inline + CSS `@page A4` y un botón `window.print()`. CSS `.no-print` oculta el botón al imprimir.
- SignaturePad usa Pointer Events (unificado mouse/touch/lápiz) y DPR para retina. Exporta PNG con fondo blanco compuesto.
- WhatsApp usa `https://wa.me/?text=...` (sin número) — abre el cliente de WhatsApp y el usuario elige destinatario (dueño).
- El cierre abre automáticamente el PDF en nueva pestaña (`window.open`) para que se pueda imprimir/guardar.
- Refetch de /api/operaciones cada 30s cuando el tab "Hoy" está activo y la sucursal está abierta (resumen en vivo).
