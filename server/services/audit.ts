import { AuditLog } from '../models/AuditLog.js'

export function writeAudit(input: {
  actorType: 'system' | 'admin' | 'stripe'; actorId?: string | null; action: string
  entityType: string; entityId: string; before?: unknown; after?: unknown; correlationId?: string | null
}) {
  // Audit failure must never reverse a payment result; log it, then alert through production monitoring.
  return AuditLog.create({ ...input, actorId: input.actorId ?? null, before: input.before ?? null, after: input.after ?? null, correlationId: input.correlationId ?? null })
    .catch((error) => console.error('Audit write failed:', error))
}
