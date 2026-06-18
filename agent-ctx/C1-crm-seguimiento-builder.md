---
Task ID: C1
Agent: CRM + Seguimiento builder
Task: Build Módulos 08 CRM + 14 Seguimiento Post-Consulta

Work Log:
- Leí worklog previo (Tasks 1, 5-A, 5-B, 5-C, 10) y el schema Prisma. Verifiqué que `/api/crm` y `/api/seguimiento` existían como directorios vacíos.
- Revisé helpers disponibles: requireSession, effectiveClinic, ok, bad, fmtDate/fmtMoney, canAccessFinance. Revisé config (api/config devuele tplConfirm/tplReminder/tplBirthday/tplInactive/tplFollowUp).
- Creé lib/whatsapp.ts con: normalizePhone (asume +52 MX si 10 dígitos), waUrl (construye wa.me?text=), fillTemplate (reemplaza {{vars}}), DEFAULT_TEMPLATES (fallback si la clínica no configura las plantillas).
- Construí APIs CRM (todas con 403 si RECEPTION o PODOLOGIST, salvo seguimiento que permite RECEPTION):
  * /api/crm/segmentos (GET) ?type=INACTIVOS_30|INACTIVOS_60|INACTIVOS_90|INACTIVOS_180|CUMPLEANOS_MES|CUMPLEANOS_SEMANA|CUMPLEANOS_HOY|DIABETICOS|NUEVOS_MES|RIESGO_ABANDONO. Calcula segmento dinámicamente cargando pacientes con su última cita FINALIZADA. RIESGO_ABANDONO = sin visita > 90 días AND (diabetic OR riskLevel=ALTO). Devuelve { segment, count, patients: [{ id, firstName, lastName, phone, birthDate?, lastVisit?, daysSinceVisit?, isDiabetic, riskLevel, createdAt }] }. Ordena por días sin visita (inactivos), fecha de cumpleaños (cumpleaños) o nombre (demás).
  * /api/crm/campana (POST) { segment, templateKey: tplInactive|tplBirthday|tplFollowUp|tplReminder }. Carga plantilla de ClinicConfig (o DEFAULT_TEMPLATES), reemplaza {{nombre_paciente}}, {{clinica}}, {{link_reserva}}. Devuelve [{ patientId, name, phone, message, waUrl }]. Hace upsert de SegmentMembership para trackear la campaña (mejor esfuerzo, no bloqueante).
  * /api/crm/leads (GET ?status=, POST { name, phone, email?, interest?, notes? }). GET incluye waUrl por lead (tplFollowUp). POST crea con status=NUEVO.
  * /api/crm/leads/[id] (PATCH) { status?, convertToPatient?, notes?, interest? }. convertToPatient=true → genera expNumber (C{n}-00001), crea Patient (firstName=primera palabra del name, lastName=resto), asocia patientId y marca status=AGENDADO.
  * /api/crm/reportes (GET ?months=6). Calcula: retenciónRate (recurrentes/activos del período), byMonth (nuevos vs recurrentes por mes), efectividadCampana (agendados/total leads), riesgoAbandono count, leads pipeline (total/contactados/agendados), totalPacientes, nuevosHoy.
- Construí APIs Seguimiento (todas con 403 si PODOLOGIST):
  * /api/seguimiento (GET) ?status=PENDIENTE|CONTACTADO|AGENDADO|VENCIDO&from=&to=. VENCIDO se calcula en runtime: si dueDate < today AND status='PENDIENTE'. Devuelve { total, counts, buckets: { vencidos, hoy, proximos7, futuros, contactados, agendados }, rows }. Cada row incluye patient { id, firstName, lastName, phone, expNumber }, consultation { id, date, diagnosis, treatment, podologist { name } }, dueDate, dueDateLabel, status, effectiveStatus, daysUntilDue, isToday, isOverdue, whatsappSent.
  * /api/seguimiento/[id] (PATCH) { status?, whatsappSent?, notes? }. Verifica cross-clinic.
  * /api/seguimiento/[id]/whatsapp (GET). Carga tplFollowUp de ClinicConfig (o DEFAULT_TEMPLATES), reemplaza {{nombre_paciente}}, {{podologo}}, {{link_reserva}}, {{clinica}}, {{fecha}}. Marca whatsappSent=true (best-effort). Devuelve { waUrl, message, patientName, phone }.
- Construí página /crm con 3 tabs:
  * Segmentación: 10 botones para cada tipo de segmento (con íconos lucide). Click → TanStack Query carga /api/crm/segmentos?type=... → tabla con nombre, teléfono, última visita, días sin visita (con color rojo/ámbar según umbral), botón WhatsApp por paciente (wa.me con template según segmento), botón "Marcar contactado". Botón "Iniciar campaña" → POST /api/crm/campana → abre modal CampanaModal que va uno-por-uno mostrando el paciente actual + mensaje preview + botón "Abrir WhatsApp" + botón "Marcar contactado" + "Siguiente"/"Anterior" + barra de progreso.
  * Leads: tabla con nombre, contacto, interés, status (Select editable), fecha, acciones (WhatsApp, Convertir a paciente con AlertDialog de confirmación, Ver paciente si ya convertido). Botón "Nuevo lead" abre dialog con formulario (nombre, teléfono, email, interés, notas). Filtro por status.
  * Reportes: 6 KPI cards (retención %, activos periodo, nuevos periodo, efectividad campañas %, riesgo abandono, total pacientes), gráfica de barras (Recharts) nuevos vs recurrentes por mes, 3 cards de pipeline de leads.
- Construí página /seguimiento:
  * KPIs rápidos (Vencidos, Hoy, Próximos 7 días, Futuros, Contactados, Agendados) con colores por severidad.
  * 4 buckets agrupados: Vencidos (rojo), Hoy (ámbar), Próximos 7 días (azul), Futuros (slate) + Contactados + Agendados al final.
  * Cada card: link al paciente, badge expNumber, badge status, fecha de vencimiento (con días restantes o "vencido hace X días" en rojo), fecha de consulta + podólogo + diagnóstico (truncado), nota si existe. Acciones: "Enviar WhatsApp" (abre wa.me con template), "Marcar contactado", "Marcar agendado".
  * Filtros por URL (?status=vencidos|hoy|proximos7) con chips en el header.
- Validé end-to-end con curl + cookies:
  * /api/crm/segmentos?type=DIABETICOS → 200, 4 pacientes ✓
  * /api/crm/segmentos?type=INACTIVOS_30 → 200, 6 pacientes ✓
  * POST /api/crm/leads → 201, lead creado con status=NUEVO ✓
  * PATCH /api/crm/leads/{id} { status: CONTACTADO } → 200 ✓
  * PATCH /api/crm/leads/{id} { convertToPatient: true } → 200, patient creado con expNumber C1-00008 ✓
  * POST /api/crm/campana { segment: DIABETICOS, templateKey: tplFollowUp } → 200, 4 recipients con waUrl ✓
  * /api/crm/reportes?months=6 → 200, byMonth con 6 meses, retencionRate=0 (sólo hay 1 paciente activo), totalPacientes=7 ✓
  * /api/seguimiento (OWNER) → 200, total=0 (no hay followUps en seed) ✓
  * RECEPTION: /api/crm/segmentos → 403 ✓, /api/seguimiento → 200 ✓ (spec dice RECEPTION puede acceder a seguimiento)
  * PODOLOGIST: /api/crm/segmentos → 403 ✓, /api/seguimiento → 403 ✓
  * /crm page → 200 ✓, /seguimiento page → 200 (después de fix de path de import './types' → './_components/types') ✓
- Limpieza: borré el lead de prueba "Lead Test" y el paciente convertido ("C1-00008") que generé durante testing, para que el usuario reciba el sistema limpio. Verificó con bun script directo a Prisma.
- Fix menor: en src/app/(app)/seguimiento/page.tsx el import inicial apuntaba a './types' pero el archivo estaba en './_components/types'. Corregido y verificado 200.

Stage Summary:
- APIs: /api/crm/segmentos (GET), /api/crm/campana (POST), /api/crm/leads (GET, POST), /api/crm/leads/[id] (PATCH), /api/crm/reportes (GET), /api/seguimiento (GET), /api/seguimiento/[id] (PATCH), /api/seguimiento/[id]/whatsapp (GET).
- Lib: src/lib/whatsapp.ts (normalizePhone MX+52, waUrl, fillTemplate, DEFAULT_TEMPLATES).
- Pages: /crm (3 tabs: Segmentación con tabla + modal uno-por-uno de campaña, Leads con tabla CRUD + convertir a paciente, Reportes con KPIs + bar chart Recharts), /seguimiento (buckets Vencidos/Hoy/Próximos7/Futuros/Contactados/Agendados + acciones WhatsApp/Contactado/Agendado + filtros URL).
- Components: tab-segmentacion.tsx, tab-leads.tsx, tab-reportes.tsx en src/app/(app)/crm/_components/ + types.ts. types.ts en src/app/(app)/seguimiento/_components/.
- WhatsApp: siempre vía wa.me (https://wa.me/<phone>?text=<encoded>). Phone normalizado: si 10 dígitos → antepone 52 (MX). Si ya empieza con 52 y ≥12 dígitos → respeta.
- Plantillas: leídas de ClinicConfig (tplInactive/tplBirthday/tplFollowUp/tplReminder) con fallback a DEFAULT_TEMPLATES en lib/whatsapp.ts si la clínica no las configuró. Variables reemplazadas: {{nombre_paciente}}, {{clinica}}, {{link_reserva}}, {{podologo}}, {{fecha}}, {{hora}}.
- Role guards: CRM exclusivo OWNER+SUPER (403 para RECEPTION y PODOLOGIST). Seguimiento accesible para OWNER+SUPER+RECEPTION (403 sólo PODOLOGIST).
- Lint: 0 errores en mis archivos. Los 5 errores/warnings residuales son de otros agentes (inventario, reserva, reservar/booking-flow).
- Dev log: /crm → 200, /seguimiento → 200, todas las APIs retornan códigos esperados (200/201/403/404/400). Sin errores de compilación en mis archivos.
- Mobile responsive: tabs colapsan labels en sm, KPIs en grid responsive (2 cols móvil → 6 cols desktop), tablas con overflow-x-auto + max-h-96 overflow-y-auto + scrollbar sticky header, acciones stack vertical en móvil.
- Brand #0a3143: aplicado en botones primarios, íconos de headers, badges activos y barra de progreso del modal de campaña.
