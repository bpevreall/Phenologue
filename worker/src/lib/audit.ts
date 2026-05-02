/**
 * Audit log helper.
 *
 * Every state-changing operation should record an audit_event. IPs are hashed,
 * never stored raw. Patient deletions cascade-delete their own audit rows
 * because retaining mutation records about a deleted account is a compliance
 * problem; for cohort/system events the actor_patient_id is null and they
 * persist.
 */

import { nanoid } from 'nanoid';

export interface AuditEvent {
  actorPatientId: string | null;
  action: string;                // 'patient.register', 'session.create', ...
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

export async function recordAudit(db: D1Database, ev: AuditEvent): Promise<void> {
  const ipHash = ev.ip ? await sha256Hex(ev.ip) : null;

  await db
    .prepare(
      `INSERT INTO audit_event
         (id, actor_patient_id, action, target_type, target_id,
          metadata_json, ip_hash, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      nanoid(16),
      ev.actorPatientId,
      ev.action,
      ev.targetType ?? null,
      ev.targetId ?? null,
      ev.metadata ? JSON.stringify(ev.metadata) : null,
      ipHash,
      ev.userAgent ?? null,
      Date.now()
    )
    .run();
}

async function sha256Hex(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
