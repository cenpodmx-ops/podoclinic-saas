# Task B4 — Recetas builder

## What was built

### APIs (owner of `/api/recetas/*`)

- `GET /api/recetas?page=&limit=&patientId=&all=&q=&from=&to=` → `{ data, total, page, limit }`
  - Each item: patient (id, name, expNumber, birthDate, sex, phone), podologist (id, name, specialty, cedula), medications parsed from JSON.
  - Search OR by firstName / lastName / expNumber / diagnosis.
  - Date range filter via `startOfDay` / `endOfDay`.
- `POST /api/recetas` → create. Body `{ patientId, podologistId?, diagnosis?, medications: [{name, dose, via, duration, productId?}], indications?, clinicId? }`.
  - clinicId taken from patient (or body if SUPER).
  - Validates podologist belongs to clinic.
  - Normalizes meds (filters empty, trims).
  - 400 if no meds with name.
  - 403 if PODOLOGIST.
- `GET /api/recetas/[id]` → full prescription with patient, podologist, clinic (fetched separately), medications parsed.
- `DELETE /api/recetas/[id]` → 403 unless OWNER/SUPER.
- `GET /api/recetas/[id]/print` → standalone HTML (Content-Type: text/html). Professional layout driven by `ClinicConfig.prescriptionDesign` JSON. Auto-print with `?print=1`.

### Component

- `<PrescriptionPrintPreview data={...} />` at `src/components/cenpod/prescription-print.tsx`.
  - Visual mirror of the print HTML.
  - Used in new-prescription dialog preview tab and in view-prescription dialog.

### Page `/recetas`

Located at `src/app/(app)/recetas/`:

- `_lib/types.ts` — shared types.
- `_components/patient-searcher.tsx` — debounced patient searcher with health-alert badges.
- `_components/medication-editor.tsx` — dynamic meds list with inventory suggestions (stock badge).
- `_components/prescription-form-dialog.tsx` — new prescription dialog with tabs Datos / Vista previa + Success dialog.
- `_components/prescription-view-dialog.tsx` — view existing prescription with delete + print.
- `page.tsx` — list with search + date filter + pagination + table (desktop) / cards (mobile) + empty state.

### CSS

Added `.rx-preview-*` block to `src/app/globals.css` (header, logo, clinic info, title row, meta grid, sections, rx-symbol, meds table with zebra, indications, signature, footer) + responsive + `@media print` for direct page printing.

## End-to-end test results (curl + cookies)

| Action                                         | Result      |
| ---------------------------------------------- | ----------- |
| Login recepcion                                | 200         |
| GET /api/recetas (empty)                       | 200, total:0|
| POST /api/recetas (2 meds)                     | 201         |
| GET /api/recetas list                          | 200, total:1|
| GET /api/recetas/[id]                          | 200, parsed |
| GET /api/recetas/[id]/print                    | 200, 8312B  |
| - HTML contains title, clinic, patient, doctor | ✓           |
| - HTML contains diagnosis, both meds, vía      | ✓           |
| - HTML contains indications, signature label   | ✓           |
| - @page, @media print, window.print            | ✓           |
| Login podólogo                                 | 200         |
| GET /api/recetas as podólogo                   | 403 ✓       |
| POST /api/recetas as podólogo                  | 403 ✓       |
| POST without meds                              | 400         |
| DELETE as recepción                            | 403 ✓       |
| DELETE as dueño                                | 200 ✓       |
| Filter from=2026-06-18&to=2026-06-18           | total:1 ✓   |
| Filter from=2026-06-01&to=2026-06-30           | total:1 ✓   |
| GET /recetas page                              | 200, 61KB   |

## Key notes

- `Prescription` model has `clinicId` but NO `clinic` relation in schema. Fetched separately in `[id]` GET and `print` GET.
- Did NOT modify the existing `tab-recetas.tsx` in `pacientes/[id]` — it consumes `/api/pacientes/[id]` shape, not my new endpoints.
- "Descargar PDF" and "Imprimir" both open the popup `/api/recetas/[id]/print?print=1` (browser print dialog has Save as PDF option).
- Lint: 0 errors on my files. Pre-existing errors in `inventario/_components/product-form-dialog.tsx` and `reservar/[[...slug]]/booking-flow.tsx` are not mine.
- TypeScript: 0 errors on my files. Pre-existing errors in other modules are not mine.
- Dev log: clean, no errors related to recetas.
