import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, ok, bad } from '@/lib/api'
import { logAudit } from '@/lib/audit'

// ============================================================
// MÓDULO EXPEDIENTE NOM-004 — Procedimientos / [id]
// GET    → procedimiento completo
// PATCH  → actualiza campos. Log audit. 403 si PODOLOGIST o cross-clinic.
// DELETE → elimina. Log audit. 403 si PODOLOGIST o cross-clinic.
// ============================================================

function safeParse<T = any>(s: string | null | undefined, fallback: T = {} as T): T {
  if (!s) return fallback
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}

async function loadProcedureForUser(id: string, user: { role: string; clinicId: string }) {
  const p = await db.procedure.findUnique({
    where: { id },
    select: { id: true, clinicId: true, patientId: true, procedimiento: true },
  })
  if (!p) return null
  if (user.role !== 'SUPER' && p.clinicId !== user.clinicId) return 'forbidden' as const
  return p
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('Acceso denegado', 403)
  const { id } = await ctx.params

  const access = await loadProcedureForUser(id, user!)
  if (access === null) return bad('Procedimiento no encontrado', 404)
  if (access === 'forbidden') return bad('Sin acceso a este procedimiento', 403)

  const proc = await db.procedure.findUnique({
    where: { id },
    include: {
      podologist: { select: { id: true, name: true } },
      patient: { select: { id: true, firstName: true, lastName: true, expNumber: true } },
    },
  })
  if (!proc) return bad('Procedimiento no encontrado', 404)

  return ok({
    ...proc,
    anestesiaJson: proc.anestesiaJson ? safeParse(proc.anestesiaJson) : null,
  })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('No tienes permiso para editar procedimientos', 403)
  const { id } = await ctx.params

  const access = await loadProcedureForUser(id, user!)
  if (access === null) return bad('Procedimiento no encontrado', 404)
  if (access === 'forbidden') return bad('Sin acceso a este procedimiento', 403)

  const body = await req.json().catch(() => null)
  if (!body) return bad('Cuerpo inválido')

  const data: any = {}
  if (body.procedimiento !== undefined) data.procedimiento = String(body.procedimiento).trim()
  if (body.indicacion !== undefined) data.indicacion = body.indicacion || null
  if (body.diagnosticoRelacionado !== undefined) data.diagnosticoRelacionado = body.diagnosticoRelacionado || null
  if (body.regionAnatomica !== undefined) data.regionAnatomica = body.regionAnatomica || null
  if (body.pieDedoLado !== undefined) data.pieDedoLado = body.pieDedoLado || null
  if (body.tecnica !== undefined) data.tecnica = body.tecnica || null
  if (body.antisepctico !== undefined) data.antisepctico = body.antisepctico || null
  if (body.instrumental !== undefined) data.instrumental = body.instrumental || null
  if (body.anestesiaJson !== undefined) {
    data.anestesiaJson = body.anestesiaJson ? JSON.stringify(body.anestesiaJson) : null
  }
  if (body.hemostasia !== undefined) data.hemostasia = body.hemostasia || null
  if (body.hallazgos !== undefined) data.hallazgos = body.hallazgos || null
  if (body.complicaciones !== undefined) data.complicaciones = body.complicaciones || null
  if (body.materialCuracion !== undefined) data.materialCuracion = body.materialCuracion || null
  if (body.indicacionesPost !== undefined) data.indicacionesPost = body.indicacionesPost || null
  if (body.tolerancia !== undefined) data.tolerancia = body.tolerancia || null
  if (body.profesionalResponsable !== undefined) data.profesionalResponsable = body.profesionalResponsable || null
  if (body.firmaData !== undefined) data.firmaData = body.firmaData || null
  if (body.fecha !== undefined) {
    const d = new Date(body.fecha)
    if (!isNaN(d.getTime())) data.fecha = d
  }

  const updated = await db.procedure.update({ where: { id }, data })

  await logAudit(
    access.patientId,
    access.clinicId,
    user!.id,
    user!.name,
    'EDIT',
    'PROCEDIMIENTO',
    `Edición del procedimiento: ${access.procedimiento} (${id})`,
  )

  return ok({
    ...updated,
    anestesiaJson: updated.anestesiaJson ? safeParse(updated.anestesiaJson) : null,
  })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireSession()
  if (response) return response
  if (user!.role === 'PODOLOGIST') return bad('No tienes permiso para eliminar procedimientos', 403)
  const { id } = await ctx.params

  const access = await loadProcedureForUser(id, user!)
  if (access === null) return bad('Procedimiento no encontrado', 404)
  if (access === 'forbidden') return bad('Sin acceso a este procedimiento', 403)

  await db.procedure.delete({ where: { id } })

  await logAudit(
    access.patientId,
    access.clinicId,
    user!.id,
    user!.name,
    'DELETE',
    'PROCEDIMIENTO',
    `Eliminación del procedimiento: ${access.procedimiento} (${id})`,
  )

  return ok({ ok: true })
}
