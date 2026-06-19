# Task E3 — Expediente backend builder

## Built APIs (NOM-004 medical record)

All routes require `requireSession()` and protect against cross-clinic access
(unless SUPER). PODOLOGIST role is forbidden on every write op.

### Helper
- `src/lib/audit.ts` — `logAudit(patientId, clinicId, userId, userName, action, section?, details?)`.
  Best-effort (never throws). Actions: VIEW, EDIT, CREATE_PROCEDURE,
  CREATE_CONSENT, CREATE_REFERRAL, CREATE_EVOLUTION, DELETE, EXPORT.

### Extended
- `GET /api/pacientes/[id]` — now returns `fichaIdentificacion` (parsed),
  `historiaClinicaInicial` (parsed), `procedures`, `consents`, `referrals`,
  `auditLogs` (last 50). Logs VIEW audit on every call.
- `PATCH /api/pacientes/[id]` — accepts `fichaIdentificacion` and
  `historiaClinicaInicial` (JSON objects, stored as stringified). Sets
  `historiaClinicaCompleta=true` + `historiaClinicaFecha=now` on first save.
  Logs EDIT audit. All existing fields still work.
- `PATCH /api/consultas/[id]` — accepts `soapJson` ({S, O, A, P}). Merges with
  existing SOAP. Logs CREATE_EVOLUTION audit. All other PATCH fields still
  work (items, paid, etc.).
- `POST /api/pacientes/[id]/archivos` — accepts photo metadata for type
  FOTO_CLINICA: `zonaAnatomica` (PIE_DERECHO | PIE_IZQUIERDO | AMBOS),
  `vista` (DORSAL | PLANTAR | LATERAL | MEDIAL | POSTERIOR | ACERCAMIENTO),
  `motivoFoto`, `relacionadoDiagnostico`, `autorizaUsoClinico`,
  `autorizaDocencia`, `permiteIdentificar` (booleans). Stored on PatientFile.
  Existing upload still works.

### New routes
- `PATCH /api/pacientes/[id]/ficha` — body is the ficha object. EDIT/FICHA audit.
- `GET|PATCH /api/pacientes/[id]/historia-clinica` — returns parsed JSON +
  metadata (completa, fecha). PATCH merges with existing.
- `GET|POST /api/procedimientos` — `?patientId=` filter; creates Procedure,
  logs CREATE_PROCEDURE.
- `GET|PATCH|DELETE /api/procedimientos/[id]` — standard CRUD + audit.
- `GET|POST /api/consentimientos` — `?patientId=` filter; creates Consent,
  logs CREATE_CONSENT. `riesgosJson` stored as JSON string, returned as array.
- `GET|DELETE /api/consentimientos/[id]`.
- `GET|POST /api/referencias` — `?patientId=` filter; creates Referral,
  logs CREATE_REFERRAL. `motivoClinicoJson` stored as JSON string.
- `GET|DELETE /api/referencias/[id]`.
- `GET /api/auditoria?patientId=` — last 100 audit logs.
- `GET /api/pacientes/[id]/alertas` — clinical alerts engine (spec §25).

### Alertas engine (spec §25)
Returns `{ data: Alert[], summary: {red, orange, yellow, total} }`. Reads from:
- `patient.fichaIdentificacion` (tutor/contacto emergencia for minors)
- `patient.historiaClinicaInicial` (signosVitales, exploracionVascular.pulsos,
  diagnosticos, antecedentesPatologicos.alergias, anticoagulantes)
- `patient.isDiabetic`, `patient.allergies`, `patient.currentMeds`,
  `patient.chronicConditions`
- latest consultation `soapJson.O.signosVitales` (overrides)
- recent procedures / consents / fotos clínicas

RED alerts:
- Diabetes + herida activa
- Diabetes + pulsos pedios/tibiales ausentes
- Fiebre (≥38°C) + lesión infectada
- Secreción purulenta
- Necrosis / tejido desvitalizado
- Sospecha celulitis / linfangitis
- Glucosa capilar > 250
- Hipertensión severa (TA > 180/110)

ORANGE alerts:
- Dolor severo (EVA ≥ 8)
- Eritema progresivo
- Anticoagulantes + procedimiento reciente
- Alergia a anestésico / látex / yodo / clorhexidina
- Menor de edad sin tutor registrado
- Consentimiento faltante antes de procedimiento reciente (90 días)
- Foto identificable sin autorización
- Neuropatía diabética (parestesias)

YELLOW alerts (informativas):
- Diabetes sin alertas críticas
- Glucosa capilar 140–250
- Hipertensión grado 1–2 (140–180 / 90–110)
- Paciente adulto mayor (≥60)

## Schema changes (minor, additive)
- Added `Procedure.podologist Podologist? @relation(...)` + back-reference
  `Podologist.procedures Procedure[]` so we can include podologist info on
  procedure GETs. Pushed to DB.

## Validation done (end-to-end via curl, reception@cenpod.com session)
- GET /api/pacientes/[id] → 200 with procedures/consents/referrals/auditLogs,
  VIEW audit entry created.
- PATCH /api/pacientes/[id]/ficha → 200, FICHA audit entry created.
- PATCH /api/pacientes/[id]/historia-clinica → 200, `completa=true`,
  `fecha` set on first save, HISTORIA audit entry created.
- GET /api/pacientes/[id]/historia-clinica → 200, returns parsed JSON +
  metadata.
- POST /api/procedimientos → 201, CREATE_PROCEDURE audit entry created,
  anestesiaJson returned as parsed object.
- GET /api/procedimientos?patientId= → 200.
- GET /api/procedimientos/[id] → 200 with patient + podologist included.
- PATCH /api/procedimientos/[id] → 200, EDIT audit.
- DELETE /api/procedimientos/[id] → 200, DELETE audit.
- POST /api/consentimientos → 201, CREATE_CONSENT audit, riesgosJson returned
  as array.
- GET /api/consentimientos?patientId= → 200.
- DELETE /api/consentimientos/[id] → 200, DELETE audit.
- POST /api/referencias → 201, CREATE_REFERRAL audit.
- GET /api/referencias?patientId= → 200.
- DELETE /api/referencias/[id] → 200, DELETE audit.
- GET /api/auditoria?patientId= → 200, list of audit logs newest-first.
- GET /api/pacientes/[id]/alertas → 200 with proper RED/YELLOW classification
  for a test patient (diabetic + glucosa 280 + TA 170/100).

## Notes
- **Prisma client cache**: had to kill & restart `bun run dev` after
  `prisma generate` because `globalForPrisma.prisma` keeps the old client
  instance. Standard behaviour with the existing `src/lib/db.ts` pattern.
- JSON fields stored as `JSON.stringify(obj)`, returned as parsed objects.
- Audit logging is best-effort (wrapped in try/catch) so it never blocks the
  primary operation.
- The `Procedure` model originally had `podologistId` but no relation — added
  the relation so we can `include: { podologist }`. Same for
  `consultationId` (kept as scalar because no back-reference exists on
  Consultation; frontend can fetch the consultation separately if needed).
- All existing PATCH fields on /api/pacientes/[id] and /api/consultas/[id]
  continue to work — extended, not replaced.

## Lint
`bun run lint` → 0 errors, 0 warnings in backend files.
(Any remaining warnings are in frontend files from other agents.)
