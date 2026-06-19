---
Task ID: C3
Agent: Reserva Pública builder
Task: Build Módulo 11 Link de Reserva Pública

Work Log:
- Leí worklog previo (Tareas 1, 5-A, 5-B, 5-C, 10) y verifiqué el stack: Next.js 16, Prisma+SQLite, NextAuth, Tailwind 4, shadcn/ui.
- Leí schema.prisma (modelos Appointment, Patient, Podologist, Service, Clinic, AppointmentBlock). NO modifiqué el schema.
- Leí middleware.ts → confirmé que /reservar y /api/public/* ya están excluidos de auth.
- Leí APIs existentes: /api/clinicas, /api/podologos, /api/citas (GET/POST), /api/citas/[id], /api/pacientes (POST con generateExpNumber), /api/config.
- Leí app-shell.tsx, dashboard, config, modules.ts → entendí el layout interno y los roles.

- Construí APIs PÚBLICAS (sin requireSession):
  * GET /api/public/clinicas — lista clinics no distribuidoras con id, name, slug, address, phone, email, openingTime, closingTime.
  * GET /api/public/podologos?clinicId=|?clinicSlug= — podólogos activos de la clínica.
  * GET /api/public/disponibilidad?clinicId=&podologistId=&date=YYYY-MM-DD — genera slots de clinic.slotMinutes (default 30) entre openingTime y closingTime, filtra los que se solapan con citas no CANCELADA y bloqueos (fullDay bloquea todo), filtra los pasados si es hoy, devuelve máx 3: primero de la mañana, primero de la tarde, uno más (segundo de la mañana o tarde). Si no se pasa podologistId, itera los activos de la clínica y devuelve el primero con disponibilidad.
  * POST /api/public/reservar — body {clinicId, podologistId?, date, startTime, firstName, lastName, phone, email?, reason?, esNuevo}. Validaciones: fecha YYYY-MM-DD, hora HH:mm, phone 10 dígitos MX (normaliza +52 / 521), email si viene. Resuelve podólogo (valida que sea de la clínica y activo, o elige cualquiera con slot libre). Valida que el slot siga libre (sin solapamiento con citas/bloques). Busca paciente por phone en la clínica → si existe lo enlaza, si no crea con expNumber auto (C{n}-00001, replica lógica de /api/pacientes). Crea Appointment con status='PENDIENTE', source='WEB'. Retorna {success, appointmentId, patientId, isNewPatient, patientName, expNumber, podologistName, clinicName, whatsappUrl}. whatsappUrl = wa.me/52{clinicPhone}?text=... con mensaje "Hola, agendé una cita para {firstName} el {fecha} a las {hora} con {podologo}. Confirmo mi asistencia." (fecha y hora formateadas en es-MX).

- Bug encontrado y arreglado: overlaps() esperaba {start, end} pero recibía {startTime, endTime, status} → TypeError. Lo arreglé normalizando los appts/blocks a {start, end} antes de comparar.

- Construí página pública /reservar/[[...slug]]/page.tsx:
  * page.tsx es server component que lee params.slug (catch-all opcional) y pasa initialClinicSlug al client.
  * booking-flow.tsx es 'use client' con todo el estado y los 6 pasos.
  * Header azul #0a3143 con logo blanco, footer azul con teléfono de la clínica, card central blanco con sombra.
  * Stepper de 6 pasos (Clínica, Podólogo, Día, Hora, Datos, Confirmar) con dots numerados, check en los completados, ring en el activo.
  * Step 1 (solo si no hay slug): tarjetas de clínicas con nombre, dirección, teléfono. Si la URL es /reservar/clinica-1, salta al step 2.
  * Step 2: opción "Cualquier podólogo" + tarjetas de podólogos con inicial/foto y especialidad.
  * Step 3: Calendar shadcn con locale es, desactiva domingos, fechas pasadas y +60 días. Al seleccionar avanza al step 4.
  * Step 4: fetch /api/public/disponibilidad, muestra 2-3 slots como botones grandes con hora 12h (08:00 AM, 12:00 PM, etc.). Mensaje "Solo mostramos algunos horarios disponibles para facilitar tu elección." Si no hay slots, mensaje amber con botón reintentar.
  * Step 5: form nombre, apellido, teléfono (10 dígitos), email opcional, motivo opcional, toggle "Soy paciente nuevo" / "Ya he visitado la clínica". Validación inline al tocar Continuar.
  * Step 6: resumen con iconos (clínica, podólogo, fecha, hora, paciente, teléfono) + nota informativa + botón "Confirmar cita". On POST: si 409 (slot tomado) → vuelve a step 4 con mensaje "Ese horario ya fue reservado, elige otro" y refetch; si éxito → pantalla de éxito.
  * Pantalla de éxito: check animado, resumen (clínica, paciente, expediente, podólogo, fecha, hora, estado), badge "Paciente nuevo registrado" si aplica, botón verde WhatsApp (abre wa.me), botón "Agendar otra cita" (reset). Link tel: al pie.

- Construí página interna /reserva (OWNER+SUPER) dentro del AppShell:
  * KPIs: reservas web este mes, confirmadas, pendientes, total histórico (con colores CENPOD).
  * Card "Link general" con URL /reservar, botón copiar, botón abrir, QR 180x180 (api.qrserver.com), instrucciones de uso.
  * Card "Links por sucursal" con cada clínica: nombre, badge "X este mes", URL /reservar/{slug}, botón copiar, botón abrir, QR 120x120.
  * Nota informativa con el flujo completo de reservas web.
  * Usa TanStack Query para /api/clinicas y /api/reserva/stats.
  * Usa useSyncExternalStore para leer window.location.origin (patrón React 19 lint-friendly, evita set-state-in-effect).
  * Botones copiar con feedback "¡Copiado!" + toast sonner.

- Creé API interna /api/reserva/stats (requireSession, OWNER+SUPER): thisMonth, thisMonthConfirmed, thisMonthPending, total, byClinic (solo SUPER, con groupBy clinicId).

- Lint: 0 errores en TODOS mis archivos (verificado con bunx eslint archivo-por-archivo). Los errores residuales son en inventario (otro agente) — no míos.
- Dev log: sin errores de compile o runtime en mis rutas. Todas devuelven 200/201 excepto las validaciones que devuelven 400/404/409 según corresponde.

- Probé end-to-end con curl:
  * GET /api/public/clinicas → 4 clínicas (CENPOD 1/2/3 + Matriz).
  * GET /api/public/podologos?clinicSlug=clinica-1 → Dr. Ricardo Méndez, Dra. Laura Quijano.
  * GET /api/public/disponibilidad?clinicId=...&date=2026-06-19 → 3 slots (08:00, 08:30, 12:00) para pod-001.
  * GET /api/public/disponibilidad?date=2024-01-01 → mensaje "Fecha pasada", slots:[].
  * POST /api/public/reservar (paciente nuevo, con podólogo) → 201, appointmentId, patientId, expNumber C1-00008, whatsappUrl bien formado.
  * POST /api/public/reservar (mismo slot) → 409 "Ese horario acaba de ser reservado."
  * POST /api/public/reservar (mismo teléfono, slot distinto) → 201, isNewPatient=false, mismo patientId.
  * POST sin podologistId → 201, elige automáticamente pod-001.
  * POST con teléfono inválido (123) → 400 "Teléfono inválido (10 dígitos MX)".
  * POST con campos faltantes → 400 "Nombre requerido".
  * GET /reservar → 200, renderiza "¿A qué clínica deseas asistir?".
  * GET /reservar/clinica-1 → 200, renderiza "Selecciona tu podólogo" (saltó step 1).
  * GET /reservar/slug-no-existente → 200, renderiza step 1 (no encontró la clínica).
  * GET /reservar/clinica-1/extra (catch-all) → 200, renderiza step 2.
  * Login SUPER → GET /api/reserva/stats → thisMonth=2 (tras pruebas), byClinic con CENPOD 1:2. Tras cleanup → thisMonth=0.
  * GET /reserva (interno, con SUPER auth) → 200, renderiza "Link de Reserva Pública", "Link general", "Links por sucursal", "Reservas web este mes".

- Limpié todos los datos de prueba (pacientes María Test, Paciente Auto y sus appointments) para entregar el sistema limpio.

Stage Summary:
- APIs PÚBLICAS: /api/public/clinicas (GET), /api/public/podologos (GET), /api/public/disponibilidad (GET), /api/public/reservar (POST) — todas sin requireSession, reachable sin login.
- API INTERNA: /api/reserva/stats (GET, OWNER+SUPER) — KPIs de reservas web.
- Pages:
  * /reservar/[[...slug]]/page.tsx (pública, standalone, sin AppShell) + booking-flow.tsx (client, 6 pasos, mobile-first, brand #0a3143).
  * /reserva/page.tsx (interna, dentro de AppShell, OWNER+SUPER) con links + QR + stats.
- Features clave:
  * Solo 2-3 horarios por día (spec).
  * Validación de slot en POST (sin solapamiento).
  * Auto-asignación de podólogo si no se especifica.
  * Auto-creación de paciente con expNumber si no existe por teléfono.
  * Cita creada con status='PENDIENTE', source='WEB'.
  * WhatsApp URL con +52 y mensaje pre-llenado.
  * Pantalla de éxito con resumen + botón WhatsApp + agendar otra.
  * Manejo de error 409 (slot tomado) → vuelve a step 4 con mensaje.
  * Calendar desactiva domingos y fechas pasadas.
  * Mobile-first, responsive, accesible (labels, aria, keyboard nav).
- Lint: 0 errores en mis 8 archivos. Dev log: sin errores.
- No rompí rutas existentes (verificado: dashboard, agenda, etc. siguen cargando).
