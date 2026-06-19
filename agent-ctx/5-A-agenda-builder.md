# Task 5-A — Agenda builder (Módulo 01 Agenda)

Agent: Agenda builder
Task ID: 5-A
Module: Módulo 01 Agenda

## Context I read before starting
- `/home/z/my-project/worklog.md` — only Task 1 (main agent) entries; main agent set up the Prisma schema, seed and dashboard.
- Prisma schema models I use: `Appointment`, `AppointmentBlock`, `Patient`, `Podologist`, `Service`, `Clinic`, `ClinicConfig`.
- `src/lib/api.ts` exposes `requireSession()`, `ok()`, `bad()`, `effectiveClinic()`.
- `src/lib/session.ts` exposes `getSession()`, `canManageAgenda()`, `isPodologist()`, `ROLES`.
- `src/lib/format.ts` exposes `fmtMoney`, `fmtTime`, `fmtDate`, `STATUS_COLORS`, `STATUS_LABELS`, `toInputDate`, `toInputTime`, `startOfWeek`, `endOfWeek`, `addDays`, `isSameDay`, `format`.
- Brand color: azul #0a3143 (use inline style or `bg-primary`).
- shadcn/ui in `@/components/ui/*`. `sonner` toast: `import { toast } from 'sonner'`.

## Files created
### API routes (I own /api/citas, /api/bloqueos, /api/podologos)
- `src/app/api/podologos/route.ts` — GET list of active podologists (PODOLOGIST sees only self; SUPER can use ?clinicId= or ?all=1)
- `src/app/api/citas/route.ts` — GET (agenda shape: ?date=&view=day|week&podologistId=&all=1 → {appointments, blocks, clinic}) + GET (Consulta shape: ?hoy=1|?fecha=|?paciente=|?actionable=1 → {rows}) + POST (create, PODOLOGIST=403, validates clinic, sets PENDIENTE+MANUAL)
- `src/app/api/citas/[id]/route.ts` — GET (full detail), PATCH (status/time/reason/notes/podologistId/date with validation; status enum checked; FINALIZADA does NOT auto-create consultation; PODOLOGIST=403), DELETE (only PENDIENTE/CANCELADA; blocks if consultation attached; PODOLOGIST=403)
- `src/app/api/bloqueos/route.ts` — GET (date + optional podologistId), POST (fullDay switch, reason enum, PODOLOGIST=403)
- `src/app/api/bloqueos/[id]/route.ts` — DELETE (cross-clinic guard, PODOLOGIST=403)

### API routes (shared with other agents — coordinated edits)
- `src/app/api/pacientes/route.ts` — was overwritten by the Pacientes module agent with a paginated version. I fixed their SQLite-incompatible `mode: 'insensitive'` (SQLite doesn't support it; default `contains` is already case-insensitive). Returned shape is `{ data, total, page, limit }`.
- `src/app/api/servicios/route.ts` — was overwritten by another agent. Returns `{ rows: [...] }`. My components handle both shapes (bare array OR { rows: [...] }).
- `src/app/api/config/route.ts` — was overwritten by the Config module agent. I extended their version to ALSO return the WhatsApp templates (tplConfirm, tplGoogleReview, etc.) needed by the Agenda's WhatsApp buttons. Backward-compatible: existing fields (clinic, diagnosesList) are still returned.

### Frontend pages + components (I own these)
- `src/app/(app)/agenda/page.tsx` — Main agenda page: top bar (date selector with prev/next/today + Día|Semana toggle + podólogo Select + Bloquear/Imprimir/Nueva cita), KPI badges, legend, day/week grid, side panel, dialogs orchestration. Auto-opens "Nueva cita" dialog if `?nueva=1` in URL.
- `src/app/(app)/agenda/_components/types.ts` — Shared TS types
- `src/app/(app)/agenda/_components/patient-searcher.tsx` — Debounced patient search + inline "Crear nuevo paciente" form. Handles both response shapes.
- `src/app/(app)/agenda/_components/new-appointment-dialog.tsx` — Create + Reschedule dialog. Auto-adjusts end time from service.durationMin or +30min.
- `src/app/(app)/agenda/_components/edit-appointment-dialog.tsx` — Edit time/reason/notes/podólogo.
- `src/app/(app)/agenda/_components/appointment-panel.tsx` — Side Sheet with patient info, status buttons (Confirmar/Iniciar Consulta/Finalizar/Cancelar/No asistió), WhatsApp buttons (Confirmar + Pedir Reseña Google), Edit/Reagendar/Eliminar (with AlertDialog). Optimistic updates for status changes.
- `src/app/(app)/agenda/_components/block-dialog.tsx` — Create AppointmentBlock (VACACIONES/CAPACITACION/INCAPACIDAD/OTRO + Día completo switch).
- `src/app/(app)/agenda/_components/agenda-grid.tsx` — Day view (multi-column when "Todos los podólogos" selected, single-column when one is selected, horizontal scroll on mobile) + Week view (Mon-Sun per Mexican convention). Uses CSS classes `.appt-pendiente`, `.appt-confirmada`, etc. from globals.css. Click empty slot → opens "Nueva cita" prefilled; click appointment → opens side panel; click block → confirms deletion.
- `src/app/(app)/mi-agenda/page.tsx` — Podólogo read-only view: today's own appointments as a list (time, patient, status badge, reason, service). KPI cards. Empty state. NO actions.

### Minor fix to another agent's file
- `src/components/cenpod/app-shell.tsx` — added missing `CalendarDays` import (was breaking lint and the PODOLOGIST mobile bottom nav).

## Verification performed
- `bun run lint` → 0 errors, 0 warnings (after fix).
- Authenticated as recepcion@cenpod.com → POST /api/citas created appointment with status=PENDIENTE, source=MANUAL, serviceName="Consulta general", price=600. ✓
- PATCH /api/citas/[id] with valid status → 200. PATCH with invalid status "FOO" → 400. ✓
- DELETE /api/citas/[id] on CONFIRMADA appointment → 400 (only PENDIENTE/CANCELADA allowed). ✓
- POST /api/bloqueos created a CAPACITACION block. GET /api/citas returned blocks:[1] with reason="CAPACITACION". DELETE /api/bloqueos/[id] → 200. ✓
- POST /api/citas as ricardo@cenpod.com (PODOLOGIST) → 403. GET /api/citas?podologistId=pod-001 as PODOLOGIST → 200 (own appointments). ✓
- GET /api/citas?date=today&view=week → returned 8 appointments (7 today + 1 tomorrow from seed). ✓
- SUPER (super@cenpod.com) with ?all=1 → 7 appointments across all clinics, 3 podólogos, clinic.name="Todas las clínicas". ✓
- /agenda renders as 200 (SSR) for recepción and super. /mi-agenda renders as 200 for podólogo. ✓
- /agenda?nueva=1 → 200 (auto-opens dialog client-side via useEffect). ✓
- /api/config now returns tplConfirm, tplGoogleReview, etc. for the WhatsApp buttons. ✓

## Notes for other agents
1. **Pacientes agent**: my `/api/pacientes/route.ts` was overwritten by your version. I had to fix your `mode: 'insensitive'` (SQLite doesn't support it). Your response shape is `{ data, total, page, limit }` — my patient-searcher expects this shape; please don't change it.
2. **Servicios agent**: my `/api/servicios/route.ts` was overwritten by your version returning `{ rows: [...] }`. My components handle both shapes (bare array OR `{ rows }`).
3. **Config agent**: my `/api/config/route.ts` was overwritten by your version. I extended it to also return the WhatsApp templates (`tplConfirm`, `tplGoogleReview`, etc.) and clinic hours (`openingTime`, `closingTime`, `slotMinutes`) needed by the Agenda's WhatsApp buttons. The change is additive — your existing fields (`clinic`, `diagnosesList`) are still returned. I added a `config` field with the templates. Please don't remove it.
4. **App-shell (main agent)**: I added the missing `CalendarDays` import to fix the lint error and the PODOLOGIST mobile bottom nav. Please don't remove it.

## Work Log
- Read worklog + schema + lib helpers.
- Created directory structure.
- Created /api/podologos route.
- Created /api/citas/route.ts (merged Consulta-module shape + Agenda-module shape).
- Created /api/citas/[id]/route.ts with PATCH/DELETE (status enum validation, soft-delete rules, cross-clinic guard, PODOLOGIST=403).
- Created /api/bloqueos/route.ts and /api/bloqueos/[id]/route.ts.
- Created /api/config, /api/pacientes, /api/servicios (initial versions, later merged/overwritten).
- Created agenda page + 6 sub-components (types, patient-searcher, new/edit/block dialogs, appointment panel, agenda grid).
- Created /mi-agenda page for podólogos.
- Fixed missing `CalendarDays` import in app-shell.tsx (lint error from another agent's code).
- Fixed `Today` icon import in agenda/page.tsx (lucide-react doesn't export `Today` → use `CalendarCheck`).
- Fixed `mode: 'insensitive'` SQLite incompatibility in pacientes/route.ts (was breaking patient search).
- Extended /api/config to also return WhatsApp templates.
- Ran end-to-end tests as recepcion + podólogo + super — all pass.
- Ran `bun run lint` → 0 errors, 0 warnings.

## Stage Summary
- APIs created/owned: /api/citas (GET/POST), /api/citas/[id] (GET/PATCH/DELETE), /api/bloqueos (GET/POST), /api/bloqueos/[id] (DELETE), /api/podologos (GET)
- APIs coordinated with other agents: /api/pacientes (fixed SQLite bug), /api/servicios (handle both shapes), /api/config (extended with WhatsApp templates)
- Pages: /agenda (top bar, day/week views, multi-column podólogo layout, side panel with status actions + WhatsApp buttons + Edit/Reagendar/Eliminar, new-appointment dialog with patient searcher + inline create, block dialog with full-day switch, auto-open ?nueva=1, optimistic status updates, KPI badges, legend, print support)
- Pages: /mi-agenda (podólogo read-only: today's appointments list with KPI cards + empty state, NO actions)
- All API routes respect: requireSession, effectiveClinic, role guards (PODOLOGIST=403 for POST/PATCH/DELETE), cross-clinic guards, status enum validation, soft-delete rules
- Verified lint clean (0 errors), all routes return 200 with correct data, both pages render without compile errors
