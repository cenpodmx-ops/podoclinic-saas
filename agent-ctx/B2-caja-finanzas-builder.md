# Task B2 — Caja + Finanzas builder

Owner: Módulo 07 — Caja y Finanzas (Sistema CENPOD).

Scope:
- APIs: /api/caja (GET/POST), /api/caja/[id] (PATCH), /api/caja/egreso (POST), /api/caja/enviar (POST), /api/finanzas (GET), /api/finanzas/comisiones (GET), /api/finanzas/reportes (GET).
- Pages: /caja (open/close cash, egresos, corte printable, WhatsApp), /finanzas (KPIs, recharts, commissions, reports).

Access control (CRITICAL):
- Caja: RECEPTION + OWNER + SUPER. Podólogo = 403.
- Finanzas: OWNER + SUPER. Reception/Podólogo = 403.
- Use canAccessFinance() from @/lib/session.

Models used (do NOT modify schema):
- CashSession, CashMovement, Consultation, Appointment, Podologist, Product, Clinic.

Helper imports:
- DB: `import { db } from '@/lib/db'`
- API: `import { requireSession, effectiveClinic, ok, bad } from '@/lib/api'`
- Session: `import { canAccessFinance, type SessionUser } from '@/lib/session'`
- Format: `import { fmtMoney, fmtDate, fmtDateTime, METHOD_LABELS } from '@/lib/format'`

Status: In progress.
