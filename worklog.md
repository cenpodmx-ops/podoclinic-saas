# Sistema CENPOD - Worklog

Proyecto: Sistema de gestión clínica para Grupo CENPOD (Hermosillo, Sonora).
Stack: Next.js 16 + Prisma + SQLite (dev) / Supabase/PostgreSQL (prod) + NextAuth + Tailwind + shadcn/ui + Socket.io.

Decisiones clave acordadas con el cliente:
- Los 18 módulos completos.
- Subida de archivos al expediente del paciente: SÍ.
- Módulo 12 Consentimientos Informados: ELIMINADO (se maneja físico).
- FacturAPI: integración lista con placeholder para el token del cliente.
- WhatsApp vía wa.me (sin API de pago).
- Multi-sucursal con clinic_id desde el schema.
- Branding: blanco + azul #0a3143.

---
Task ID: 1
Agent: main
Task: Inicializar el worklog y escribir el schema Prisma completo de los 18 módulos con seed inicial.

Work Log:
- Leí el PDF de especificaciones completo.
- Copié logos a /public (logo-white.png para modo claro con fondo azul, logo-dark.png para modo oscuro).
- Confirmé stack disponible: Next.js 16, Prisma+SQLite, NextAuth, Socket.io para mini-servicios.
- Voy a escribir el schema Prisma cubriendo: clinicas, usuarios, podologos, pacientes, citas, bloqueos, consultas, recetas, inventario, servicios, facturas, pagos, caja, movimientos caja, pedidos red, mensajes red, avisos red, equipos, mantenimiento equipos, leads CRM, segmentos CRM, plantillas whatsapp, configuracion clinica, archivos paciente, seguimientos post-consulta, evaluacion podologos, sucursal apertura/cierre.

Stage Summary:
- Schema en prisma/schema.prisma con ~30 modelos.
- Seed con 3 clínicas, 4 usuarios (uno por rol), 3 podólogos, servicios base, pacientes demo, citas demo para hoy.

---
Task ID: 5-C
Agent: Consulta builder
Task: Build Módulo 02 Consulta (API + page with cobro and ticket)

Work Log:
- Leí el worklog y el schema Prisma. Revisé la librería existente (api.ts, format.ts, session.ts, app-shell, dashboard).
- Construí /api/consultas (GET/POST) en src/app/api/consultas/route.ts:
  * GET soporta ?cita=<id> (cualquier rol excepto PODÓLOGO) y ?page=&limit= (solo SUPER/OWNER).
  * POST valida que la cita exista, pertenezca a la clínica del usuario (o SUPER), y no tenga ya una consulta asociada (409 si sí).
  * POST crea Consultation con clinicId/patientId/podologistId heredados de la cita, itemsJson, totales calculados (consultPrice + productsTotal - discount).
  * Si paid=true: valida stock ANTES de tocar nada (400 si alguno no alcanza), descuenta stock por item PRODUCTO/MEDICAMENTO + crea StockMovement SALIDA, marca appointment.status='FINALIZADA', obtiene o crea CashSession de hoy (openingFund=0 si no existe), crea CashMovement INGRESO (source='CONSULTA', method, refId=consultation.id), incrementa patient.totalSpent, y si followUpDays>0 crea FollowUp con dueDate=today+followUpDays y status='PENDIENTE'.
  * Si paid=false: marca appointment.status='EN_CONSULTA'.
  * 403 si rol='PODOLOGIST'.
- Construí /api/consultas/[id] (GET/PATCH):
  * GET devuelve la consulta con patient, podologist, appointment.clinic, followUps y items parseados.
  * PATCH actualiza campos. Recalcula productsTotal/total si cambian items/precio/descuento. Si paid cambia false→true, ejecuta exactamente la misma lógica de cobro que el POST (valida stock, descuenta, finaliza cita, CashSession, CashMovement, totalSpent, FollowUp). Soporta ticketPrinted.
- Construí APIs de soporte que el flujo de consulta necesita (no eran del módulo pero la página depende de ellos):
  * /api/citas (GET ?hoy=1 | ?actionable=1 | ?paciente= | ?fecha=)
  * /api/citas/[id] (GET/PATCH) — usado por "Iniciar consulta" (PATCH status='EN_CONSULTA')
  * /api/inventario (GET ?q=) — buscador de productos con stock visible, sin paginación (take 30)
  * /api/servicios (GET) — lista de servicios activos
  * /api/config (GET) — clinic + diagnosesList parseado a array
- Construí la página /consulta en src/app/(app)/consulta/page.tsx con arquitectura modular:
  * _lib/types.ts con tipos compartidos (ConsultaItem, PatientSummary, etc.)
  * _components/PatientCard.tsx (tarjeta de paciente + alerts diabético/alergias + TicketPreview para impresión)
  * _components/ProductAdder.tsx (buscador con debounce, dropdown, lista de items con qty/price/subtotal)
  * page.tsx (controlador de fases: list → confirm-start → form (3 pasos) → success/finalized/saved-unpaid + modal de ticket)
- Fases implementadas:
  * list: citas de hoy (CONFIRMADA/PENDIENTE) con buscador, cada una con botón.
  * confirm-start: aviso + "Iniciar consulta" que PATCHea la cita a EN_CONSULTA. Maneja también CANCELADA/NO_ASISTIO/BLOQUEADA con aviso de precaución.
  * form: 3 pasos (Datos → Cobro → Confirmar). Stepper visual. Validación por paso. Patient card siempre visible arriba.
  * saved-unpaid: cuando ya existe consulta no pagada, ofrece "Continuar y cobrar", "Ver ticket", "Volver a agenda".
  * finalized: cuando ya está pagada, muestra resumen + "Ver ticket" + "Generar receta".
  * success: tras POST paid=true, muestra confirmación + botones Imprimir ticket / Generar receta / Volver a agenda + link a reagendar seguimiento si followUpDays>0.
- Cobro: usa TanStack useMutation; usa POST si no existe consulta, PATCH si ya existe. Toasts informativos. Invalidate de 'dashboard' y 'citas-hoy-actionable' tras éxito.
- Ticket: implementado como Dialog shadcn que envuelve TicketPreview (monoespaciado, formato 80mm). Print CSS añadido a globals.css con @media print que oculta todo excepto .ticket-print. Botón "Imprimir" llama window.print() y marca ticketPrinted=true vía PATCH (best-effort, sin bloquear).
- Refactor: tuve que eliminar un useEffect+setState (anti-patrón React 19) y reemplazarlo por derivation con useMemo (autoPhase) + override manual (manualPhase). Esto evita cascading renders y pasó el lint.
- Validé end-to-end con curl + cookies de sesión (recepcion@cenpod.com):
  * POST sin cobro → consulta creada, cita EN_CONSULTA ✓
  * PATCH paid=true → stock decrementado (25→24), cita FINALIZADA, patient.totalSpent 0→780, CashMovement INGRESO amount=780 method=EFECTIVO, StockMovement SALIDA qty=1, FollowUp dueDate=+7d status=PENDIENTE ✓
  * POST duplicado → 409 "Esta cita ya tiene una consulta registrada" ✓
  * POST con qty>stock → 400 "Stock insuficiente para Talco antifúngico (disponible: 3, solicitado: 10)" ✓
  * Limpié los datos de prueba (consultation + side effects + restauré stock/patient/appointment a su estado original) para que el usuario reciba el sistema limpio.
- Lint: 0 errores en mis archivos (el warning residual en pacientes/page.tsx y el error previo en app-shell.tsx no son míos; el app-shell se arregló solo entre runs — probablemente por otro agente que añadió CalendarDays al import).
- Dev log: GET /consulta?cita=... → 200 en 66ms, sin errores de compilación.

Stage Summary:
- APIs: /api/consultas (GET/POST), /api/consultas/[id] (GET/PATCH) — propietario del módulo.
- APIs de soporte: /api/citas (GET), /api/citas/[id] (GET/PATCH), /api/inventario (GET ?q), /api/servicios (GET), /api/config (GET).
- Page: /consulta (3-step flow: datos → cobro → confirmar/ticket) con PatientCard, ProductAdder, Stepper, modal de ticket imprimible y vistas para saved-unpaid / finalized / success.
- Stock decrement + cash movement + appointment finalization + patient.totalSpent + follow-up todo atómico por consulta, validando stock antes de tocar nada.
- Print CSS en globals.css para formato 80mm con @media print.
- Mobile responsive (stepper colapsa labels en sm, footers stack vertical en mobile, max-w-[1100px] en desktop).
- Sin errors de lint en mis archivos; sin errores de compile en dev.log.

---
Task ID: 5-A
Agent: Agenda builder
Task: Build Módulo 01 Agenda (API + page + mi-agenda podólogo view)

Work Log:
- Leí worklog previo (solo Task 1 del main agent: schema + seed + dashboard).
- Leí schema Prisma, lib/api.ts, lib/session.ts, lib/format.ts, lib/auth.ts, app-shell.tsx, modules.ts, dashboard.
- Creé directorios para rutas API (citas, citas/[id], bloqueos, bloqueos/[id], podologos, config, pacientes, servicios) y páginas (agenda + sub-componentes, mi-agenda).
- Construí /api/podologos (GET) — PODOLOGIST solo se ve a sí mismo; SUPER puede usar ?clinicId= o ?all=1.
- Construí /api/citas (GET soporta dos shapes: agenda con ?date=&view=day|week&podologistId=&all=1 → {appointments, blocks, clinic}, y consulta con ?hoy=1|?fecha=|?paciente=|?actionable=1 → {rows}; POST valida clinic y patient, setea PENDIENTE+MANUAL, PODOLOGIST=403).
- Construí /api/citas/[id] (GET detalle completo, PATCH con validación de status enum y cross-clinic, DELETE solo si PENDIENTE/CANCELADA y sin consulta asociada, PODOLOGIST=403).
- Construí /api/bloqueos (GET + POST con switch fullDay y reason enum VACACIONES/CAPACITACION/INCAPACIDAD/OTRO, PODOLOGIST=403) y /api/bloqueos/[id] (DELETE).
- Construí /agenda page con top bar (date selector prev/next/today + Día|Semana toggle + Select de podólogo + Bloquear/Imprimir/Nueva cita), KPIs por status, leyenda, vista día multi-columna con scroll horizontal en móvil, vista semana Lun-Dom (convención mexicana), side panel Sheet con acciones de status + botones WhatsApp (Confirmar y Reseña Google) + Editar/Reagendar/Eliminar, dialog de nueva cita con patient searcher debounced + inline crear paciente + auto-ajuste de endTime por service.durationMin, dialog de bloqueo, dialog de edición, auto-open con ?nueva=1, optimistic updates para cambios de status.
- Construí /mi-agenda page (podólogo read-only): lista de citas de hoy con tarjetas, KPI cards, empty state, sin acciones.
- Sub-componentes en _components/: types.ts, patient-searcher.tsx, new-appointment-dialog.tsx, edit-appointment-dialog.tsx, appointment-panel.tsx, block-dialog.tsx, agenda-grid.tsx.
- Corregí lint error en src/components/cenpod/app-shell.tsx (faltaba import `CalendarDays`).
- Corregí icono `Today` inexistente en lucide-react → usé `CalendarCheck`.
- Mis rutas /api/pacientes, /api/servicios, /api/config fueron sobreescritas por otros agentes (Pacientes, Servicios, Config). Coordiné:
  - /api/pacientes: arreglé `mode: 'insensitive'` incompatible con SQLite (default `contains` ya es case-insensitive).
  - /api/servicios: mi frontend maneja ambos shapes (array o { rows: [...] }).
  - /api/config: extendí la versión del Config agent para también devolver plantillas WhatsApp (tplConfirm, tplGoogleReview, etc.) y horas de la clínica (openingTime, closingTime, slotMinutes) — aditivo, no rompe nada.
- Probé end-to-end como recepción (crea cita, patchea status, valida status enum, delete con 400 cuando no es PENDIENTE/CANCELADA, crea bloqueo, lo ve en /api/citas, lo elimina), como podólogo (POST=403, GET propio=200, /mi-agenda renderiza), y como SUPER (ve 7 citas y 3 podólogos con ?all=1).
- `bun run lint` → 0 errores, 0 warnings.

Stage Summary:
- APIs creadas/propietarias: /api/citas (GET/POST), /api/citas/[id] (GET/PATCH/DELETE), /api/bloqueos (GET/POST), /api/bloqueos/[id] (DELETE), /api/podologos (GET).
- APIs coordinadas con otros agentes: /api/pacientes (arreglé bug SQLite), /api/servicios (handle ambos shapes), /api/config (extendí con plantillas WhatsApp).
- Pages: /agenda (top bar, vista día multi-columna con scroll horizontal, vista semana Lun-Dom, side panel con acciones de status + WhatsApp + Editar/Reagendar/Eliminar, dialog nueva cita con patient searcher + crear inline, dialog bloqueo, auto-open ?nueva=1, optimistic updates, KPIs, leyenda, print).
- Pages: /mi-agenda (podólogo read-only: lista de citas de hoy con KPI cards y empty state, sin acciones).
- Todos los endpoints respetan requireSession, effectiveClinic, role guards (PODOLOGIST=403 en POST/PATCH/DELETE), cross-clinic guards, status enum validation, soft-delete rules.
- Lint limpio (0 errores), todas las rutas devuelven 200 con datos correctos, ambas páginas renderizan sin errores de compilación.

---
Task ID: 5-B
Agent: Pacientes builder
Task: Build Módulo 03 Pacientes + Expediente (API + list + detail with files)

Work Log:
- Leí worklog previo y el schema Prisma (modelos Patient, PatientFile, Appointment, Consultation, Prescription, FollowUp, Clinic).
- Verifiqué helpers disponibles: requireSession, effectiveClinic, ok, bad, fmtMoney, fmtDate, fmtDateTime, STATUS_LABELS, METHOD_LABELS. Verifiqué SessionUser con clinicSlug (necesario para generar expNumber `C{n}-00001`).
- Agregué relación `podologist` al modelo `Prescription` (faltante en schema) + back-reference en `Podologist`. Corrido `bun run db:push` para sincronizar.
- Construí APIs:
  - GET /api/pacientes con búsqueda case-insensitive (sin `mode: 'insensitive'` porque SQLite no lo soporta, pero LIKE ya es case-insensitive por defecto), filtros (diabetic, riskLevel, sinCitaReciente=90 días, clinicId override para SUPER, all=1), paginación, include de última cita FINALIZADA y clinic.
  - POST /api/pacientes con auto-generación de expNumber, validación de campos, 403 para PODOLOGIST.
  - GET/PATCH/DELETE /api/pacientes/[id] con verificación cross-clinic y bloqueo de DELETE si tiene consultas o recetas.
  - GET/POST /api/pacientes/[id]/archivos con multipart upload, validación de extensión (PDF/JPG/PNG/DOCX), límite 20MB, escritura a /public/uploads/<patientId>/<uuid>.<ext>.
  - DELETE /api/pacientes/[id]/archivos/[fileId] con borrado físico + DB.
  - GET /api/clinicas (mini endpoint para filtro de sucursal del SUPER).
- Ajusté `agenda/_components/patient-searcher.tsx` (otro agente) para consumir el nuevo shape `{ data, total, page, limit }` en vez de array directo.
- Construí PatientFormDialog reusable en `src/components/cenpod/patient-form-dialog.tsx` con secciones: datos personales, datos fiscales (colapsable), alertas de salud (con switch diabético + risk select), notas generales.
- Construí `/pacientes` (lista) con:
  - Búsqueda debounced 300ms
  - Filtros: sucursal (solo SUPER), diabético (sí/no), riesgo, sin cita 90 días
  - Vista tarjetas | lista (Tabs)
  - Botón "Nuevo paciente" + auto-open si `?nuevo=1`
  - Paginación
  - Click navega a /pacientes/[id]
  - Botón WhatsApp por paciente (wa.me con código MX 52)
- Construí `/pacientes/[id]` (expediente) con:
  - Header con avatar, nombre, expNumber, badges, botones WhatsApp / Agendar cita / Editar
  - **HealthAlerts** (imposibles de pasar por alto): DIABÉTICO (rojo sólido), ALERGIAS (naranja), MEDICAMENTOS (amarillo), CONDICIONES CRÓNICAS (rosa) — todos con icono y descripción
  - 7 tabs: Resumen, Historia clínica, Consultas, Citas, Recetas, Archivos, Seguimiento (cada tab con badge de contador)
  - Resumen: datos personales, datos fiscales (si existen), riesgo podológico editable inline, resumen clínico editable inline, notas editables inline, dialog de edición completa
  - Historia: 4 campos editables (hereditarios, patológicos, no patológicos, exploración física) + botón imprimir
  - Consultas: cards expandibles con diagnóstico/tratamiento/items cobrados/notes, stats (total gastado, pagado, pendiente, podólogo más frecuente)
  - Citas: lista cronológica con status badge colorido, podólogo, servicio
  - Recetas: cards con medicamentos parseados de JSON + botón Reimprimir (abre ventana con receta formateada y window.print)
  - Archivos: drag & drop + input, selector de tipo, progreso de subida vía XHR, thumbnails para imágenes, íconos para PDF/DOCX, download + delete
  - Seguimiento: lista de follow-ups con estado y fecha de vencimiento, badge rojo si vencido
- Verifiqué:
  - `bun run lint` → 0 errores
  - `bunx tsc --noEmit` → 0 errores en archivos del módulo
  - Pruebas API con curl: GET lista, POST crear (expNumber C1-00007 generado correctamente), GET detalle, PATCH actualizar, POST archivo, GET archivos, DELETE archivo — todos 200/201
  - Sin errores 500 en dev.log para mis archivos
- Reinicié el dev server tras `db:push` (para recargar Prisma Client con la nueva relación `Prescription.podologist`).

Stage Summary:
- APIs: /api/pacientes (GET/POST), /api/pacientes/[id] (GET/PATCH/DELETE), /api/pacientes/[id]/archivos (GET/POST), /api/pacientes/[id]/archivos/[fileId] (DELETE), /api/clinicas (GET, auxiliar para filtro SUPER)
- Schema: añadida relación `Prescription.podologist` ↔ `Podologist.prescriptions` (onDelete: SetNull)
- Pages: /pacientes (lista con tarjetas/tabla + filtros + nuevo dialog), /pacientes/[id] (expediente con 7 tabs: resumen, historia, consultas, citas, recetas, archivos, seguimiento)
- Component: PatientFormDialog (`src/components/cenpod/patient-form-dialog.tsx`) reusable para alta/edición, con secciones colapsables y validación
- Sub-componentes del expediente en `src/app/(app)/pacientes/[id]/_components/`: types, health-alerts, tab-resumen, tab-historia, tab-consultas, tab-citas, tab-recetas, tab-archivos, tab-seguimiento
- Notas:
  - SQLite no soporta `mode: 'insensitive'` en `contains`; SQLite LIKE ya es case-insensitive para ASCII (no para acentos). En PostgreSQL prod se deberá agregar `mode: 'insensitive'` o usar `search` con accent-insensitive.
  - Los archivos se guardan en `/public/uploads/<patientId>/<uuid>.<ext>` y se sirven como estáticos a través del middleware que permite `/uploads/*` sin auth.
  - La subida de archivos usa XHR para mostrar progreso real en el cliente.
  - Las alertas de salud (diabético/alergias/medicamentos/crónicas) se muestran como banners de color sólido al inicio del expediente, imposibles de pasar por alto.
  - Botón "Agendar cita" enlaza a `/agenda?nueva=1&paciente=<id>` para integración futura con el módulo Agenda.

---
Task ID: 10
Agent: main (verificación final)
Task: Verificación end-to-end con Agent Browser + fixes de Radix Select y hydration.

Work Log:
- Verificado con Agent Browser: login (4 roles), dashboard (KPIs + gráficas), agenda (vista día/semana, panel lateral, acciones, WhatsApp), pacientes (lista + tarjetas + filtros), expediente (tabs + alertas de salud DIABÉTICO en rojo), servicios (tabla CRUD), configuración (5 tabs), mi-agenda (podólogo read-only), consulta (flujo de 3 pasos con diagnósticos predefinidos).
- Fix 1: SessionProvider no recibía sesión del servidor → hydration mismatch. Solución: root layout pasa `session` a Providers → SessionProvider.
- Fix 2: Radix Select crashea con `<SelectItem value="">`. Cambiado a sentinel `"all"` / `"__all"` / `"__none"` en agenda, pacientes y consulta.
- Fix 3: Agenda usaba `new Date()` en useState inicial → hydration mismatch. Solución: `mounted` guard + useEffect.
- Fix 4: AgendaGrid trataba `selectedPodologistId='all'` como podólogo único. Solución: `!== 'all'` check.
- Lint: 0 errores. Dev log: 200s sin errores de runtime.

Stage Summary:
- Bloque A COMPLETO y verificado en navegador:
  - Dashboard (Módulo 13) ✓
  - Agenda (Módulo 01) ✓
  - Consulta (Módulo 02) ✓
  - Pacientes + Expediente con archivos (Módulo 03) ✓
  - Servicios (Módulo 09) ✓
  - Configuración básica (Módulo 18) ✓
  - Mi-agenda (podólogo) ✓
  - Auth con 4 roles ✓
  - Layout responsive con sidebar + bottom-nav ✓
  - Tema CENPOD (azul #0a3143 + blanco) ✓
- Módulos del Bloque B/C/D tienen páginas "en construcción" placeholder.
- Listo para que el cliente pruebe y demos luz verde al Bloque B (Inventario, Caja, Finanzas, Facturación, Recetas).
