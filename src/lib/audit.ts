// Helper para registro de auditoría del expediente clínico NOM-004.
// Toda lectura o modificación al expediente de un paciente debe
// generar una entrada de auditoría para cumplimiento legal.
import { db } from '@/lib/db'

export type AuditAction =
  | 'VIEW'
  | 'EDIT'
  | 'CREATE'
  | 'DELETE'
  | 'EXPORT'
  | 'CREATE_PROCEDURE'
  | 'CREATE_CONSENT'
  | 'CREATE_REFERRAL'
  | 'CREATE_EVOLUTION'

export type AuditSection =
  | 'FICHA'
  | 'HISTORIA'
  | 'PROCEDIMIENTO'
  | 'CONSENT'
  | 'REFERRAL'
  | 'EVOLUCION'
  | 'ARCHIVO'
  | 'EXPEDIENTE'
  | string

/**
 * Registra un evento de auditoría en el expediente del paciente.
 *
 * @param patientId  ID del paciente cuyo expediente fue accedido/modificado
 * @param clinicId   ID de la clínica a la que pertenece el paciente
 * @param userId     ID del usuario que ejecutó la acción (opcional)
 * @param userName   Nombre del usuario que ejecutó la acción (opcional)
 * @param action     Una de las acciones definidas en AuditAction
 * @param section    Sección del expediente afectada (FICHA, HISTORIA, ...)
 * @param details    Descripción legible del evento
 */
export async function logAudit(
  patientId: string,
  clinicId: string,
  userId: string | undefined,
  userName: string | undefined,
  action: AuditAction | string,
  section?: AuditSection,
  details?: string,
) {
  try {
    await db.auditLog.create({
      data: {
        patientId,
        clinicId,
        userId: userId || null,
        userName: userName || null,
        action,
        section: section || null,
        details: details || null,
      },
    })
  } catch (err) {
    // La auditoría es best-effort: nunca debe romper el flujo principal.
    console.error('[audit] No se pudo registrar auditoría:', err)
  }
}
