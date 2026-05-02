/**
 * Patient routes — profile, conditions, consent, export, deletion.
 *
 * Methodology v0.1 §8.1 (patient ownership): export and deletion are first-class.
 * Deletion is hard-delete with audit-event trail of the action; the audit
 * row's actor_patient_id is set to the deleted patient's id, so the deletion
 * itself is recoverable for compliance review even after the patient row is
 * gone.
 *
 * Security note (Stream C):
 *   - GET /export is now POST /export and DELETE / both require a fresh
 *     `password` in the request body. A stolen 24h JWT alone no longer lets
 *     an attacker exfiltrate or wipe the account; they need the password
 *     too. The legacy GET /export route is kept and 405s with a hint, so
 *     existing clients fail loud rather than silently.
 */

import { Hono } from 'hono';
import type { Env, ContextVars } from '../env';
import { recordAudit } from '../lib/audit';
import { badRequest, notFound, unauthorized } from '../lib/errors';
import { verifyPassword } from './auth';

const patientRoutes = new Hono<{ Bindings: Env; Variables: ContextVars }>();

interface PatchPatientBody {
  pseudonym?: string;
  age_band?: string;
  sex?: 'M' | 'F' | 'NB' | 'PNTS';
  region?: string;
}

interface AddConditionBody {
  condition_code: string;
  diagnosed_year?: number;
  self_reported?: boolean;
  note?: string;
}

interface ConsentBody {
  consent_research?: boolean;
  consent_aggregate?: boolean;
}

interface PatientRow {
  id: string;
  created_at: number;
  pseudonym: string | null;
  age_band: string | null;
  sex: string | null;
  region: string | null;
  consent_research: number;
  consent_aggregate: number;
  consent_research_at: number | null;
  consent_aggregate_at: number | null;
  methodology_version: string;
}

interface PatientPiiRow {
  email: string;
  name_given: string | null;
  name_family: string | null;
  date_of_birth: string | null;
}

// =============================================================
// GET /api/patient — profile
// =============================================================
patientRoutes.get('/', async (c) => {
  const patientId = c.get('patient_id')!;

  const patient = await c.env.DB.prepare(
    `SELECT id, created_at, pseudonym, age_band, sex, region,
            consent_research, consent_aggregate,
            consent_research_at, consent_aggregate_at,
            methodology_version
     FROM patient WHERE id = ? AND deleted_at IS NULL`
  )
    .bind(patientId)
    .first<PatientRow>();

  if (!patient) return notFound(c, 'Patient not found');

  const pii = await c.env.DB.prepare(
    'SELECT email, name_given, name_family, date_of_birth FROM patient_pii WHERE patient_id = ?'
  )
    .bind(patientId)
    .first<PatientPiiRow>();

  const conditions = await c.env.DB.prepare(
    `SELECT condition_code, diagnosed_year, self_reported, note
     FROM patient_condition WHERE patient_id = ?`
  )
    .bind(patientId)
    .all();

  return c.json({
    data: {
      ...patient,
      consent_research: !!patient.consent_research,
      consent_aggregate: !!patient.consent_aggregate,
      email: pii?.email ?? null,
      name_given: pii?.name_given ?? null,
      name_family: pii?.name_family ?? null,
      conditions: conditions.results,
    },
  });
});

// =============================================================
// PATCH /api/patient — update profile
// =============================================================
patientRoutes.patch('/', async (c) => {
  const patientId = c.get('patient_id')!;
  const body = (await c.req.json()) as PatchPatientBody;

  const updates: string[] = [];
  const values: (string | null)[] = [];

  if (body.pseudonym !== undefined) {
    updates.push('pseudonym = ?');
    values.push(body.pseudonym || null);
  }
  if (body.age_band !== undefined) {
    if (body.age_band && !/^\d{2}-\d{2}$|^65\+$/.test(body.age_band)) {
      return badRequest(c, 'age_band must look like 25-29 or 65+', 'age_band');
    }
    updates.push('age_band = ?');
    values.push(body.age_band || null);
  }
  if (body.sex !== undefined) {
    if (body.sex && !['M', 'F', 'NB', 'PNTS'].includes(body.sex)) {
      return badRequest(c, 'sex must be M, F, NB, or PNTS', 'sex');
    }
    updates.push('sex = ?');
    values.push(body.sex || null);
  }
  if (body.region !== undefined) {
    updates.push('region = ?');
    values.push(body.region || null);
  }

  if (updates.length === 0) return c.json({ data: { ok: true, changed: 0 } });

  values.push(patientId);
  await c.env.DB.prepare(`UPDATE patient SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  await recordAudit(c.env.DB, {
    actorPatientId: patientId,
    action: 'patient.update',
    targetType: 'patient',
    targetId: patientId,
    metadata: { fields: updates.map((u) => u.split(' ')[0]) },
    ip: c.req.header('cf-connecting-ip'),
    userAgent: c.req.header('user-agent'),
  });

  return c.json({ data: { ok: true, changed: updates.length } });
});

// =============================================================
// POST /api/patient/conditions — add a condition
// =============================================================
patientRoutes.post('/conditions', async (c) => {
  const patientId = c.get('patient_id')!;
  const body = (await c.req.json()) as AddConditionBody;

  if (!body.condition_code) return badRequest(c, 'condition_code required');

  await c.env.DB.prepare(
    `INSERT INTO patient_condition (patient_id, condition_code, diagnosed_year, self_reported, note)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (patient_id, condition_code) DO UPDATE SET
       diagnosed_year = excluded.diagnosed_year,
       self_reported = excluded.self_reported,
       note = excluded.note`
  )
    .bind(
      patientId,
      body.condition_code,
      body.diagnosed_year ?? null,
      body.self_reported === false ? 0 : 1,
      body.note ?? null
    )
    .run();

  return c.json({ data: { ok: true } }, 201);
});

// =============================================================
// DELETE /api/patient/conditions/:code
// =============================================================
patientRoutes.delete('/conditions/:code', async (c) => {
  const patientId = c.get('patient_id')!;
  const code = c.req.param('code');

  await c.env.DB.prepare(
    'DELETE FROM patient_condition WHERE patient_id = ? AND condition_code = ?'
  )
    .bind(patientId, code)
    .run();

  return c.json({ data: { ok: true } });
});

// =============================================================
// POST /api/patient/consent — update consent flags
// =============================================================
patientRoutes.post('/consent', async (c) => {
  const patientId = c.get('patient_id')!;
  const body = (await c.req.json()) as ConsentBody;
  const now = Date.now();

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (body.consent_research !== undefined) {
    updates.push('consent_research = ?', 'consent_research_at = ?');
    values.push(body.consent_research ? 1 : 0, body.consent_research ? now : null);
  }
  if (body.consent_aggregate !== undefined) {
    updates.push('consent_aggregate = ?', 'consent_aggregate_at = ?');
    values.push(body.consent_aggregate ? 1 : 0, body.consent_aggregate ? now : null);
  }

  if (updates.length === 0) return badRequest(c, 'No consent fields provided');

  await c.env.DB.prepare(`UPDATE patient SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values, patientId)
    .run();

  await recordAudit(c.env.DB, {
    actorPatientId: patientId,
    action: 'patient.consent',
    targetType: 'patient',
    targetId: patientId,
    metadata: body as Record<string, unknown>,
    ip: c.req.header('cf-connecting-ip'),
    userAgent: c.req.header('user-agent'),
  });

  return c.json({ data: { ok: true } });
});

// =============================================================
// POST /api/patient/export — full data export (JSON / CSV) with re-auth
// =============================================================
// Re-auth gate: a fresh `password` in the JSON body is required in addition
// to the bearer JWT. A stolen 24h token by itself is no longer sufficient
// to exfil the patient's full record. format=csv|json may be specified
// alongside the password in the body, or via ?format= query for convenience.
patientRoutes.post('/export', async (c) => {
  const patientId = c.get('patient_id')!;

  const body = (await c.req.json().catch(() => ({}))) as {
    password?: string;
    format?: string;
  };
  const format = body.format ?? c.req.query('format') ?? 'json';

  if (format !== 'json' && format !== 'csv') {
    return badRequest(c, 'format must be json or csv');
  }

  if (!body.password || typeof body.password !== 'string') {
    return badRequest(c, 'password required for re-auth', 'password');
  }

  const auth = await c.env.DB.prepare(
    'SELECT password_hash FROM patient_auth WHERE patient_id = ?'
  )
    .bind(patientId)
    .first<{ password_hash: string | null }>();

  if (!auth?.password_hash || !(await verifyPassword(body.password, auth.password_hash))) {
    return unauthorized(c, 'Re-authentication failed');
  }

  const [patient, pii, conditions, sessions, ratings, tasks, adverse, organoleptic] =
    await Promise.all([
      c.env.DB.prepare('SELECT * FROM patient WHERE id = ?').bind(patientId).first(),
      c.env.DB.prepare('SELECT * FROM patient_pii WHERE patient_id = ?').bind(patientId).first(),
      c.env.DB.prepare('SELECT * FROM patient_condition WHERE patient_id = ?').bind(patientId).all(),
      c.env.DB.prepare('SELECT * FROM session WHERE patient_id = ?').bind(patientId).all(),
      c.env.DB.prepare(
        `SELECT r.* FROM rating r
         JOIN session s ON r.session_id = s.id
         WHERE s.patient_id = ?`
      )
        .bind(patientId)
        .all(),
      c.env.DB.prepare(
        `SELECT t.* FROM task_log t
         JOIN session s ON t.session_id = s.id
         WHERE s.patient_id = ?`
      )
        .bind(patientId)
        .all(),
      c.env.DB.prepare(
        `SELECT a.* FROM adverse_event a
         JOIN session s ON a.session_id = s.id
         WHERE s.patient_id = ?`
      )
        .bind(patientId)
        .all(),
      c.env.DB.prepare('SELECT * FROM organoleptic_assessment WHERE patient_id = ?')
        .bind(patientId)
        .all(),
    ]);

  const exportRow = await c.env.DB.prepare(
    `INSERT INTO audit_event (id, actor_patient_id, action, target_type, target_id, created_at)
     VALUES (?, ?, 'patient.export', 'patient', ?, ?)`
  )
    .bind(crypto.randomUUID(), patientId, patientId, Date.now())
    .run()
    .catch(() => null);

  const payload = {
    exported_at: new Date().toISOString(),
    methodology_version: c.env.METHODOLOGY_VERSION,
    patient,
    patient_pii: pii,
    conditions: conditions.results,
    sessions: sessions.results,
    ratings: ratings.results,
    tasks: tasks.results,
    adverse_events: adverse.results,
    organoleptic_assessments: organoleptic.results,
    audit_export_id: exportRow ? 'recorded' : 'failed',
  };

  if (format === 'csv') {
    // Export sessions + ratings as flat CSV; everything else stays JSON-only
    // because flat representation loses too much fidelity.
    return new Response(sessionsToCsv(sessions.results, ratings.results), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="phenologue-export-${patientId}.csv"`,
      },
    });
  }

  return c.json({ data: payload });
});

// =============================================================
// Legacy GET /api/patient/export — superseded by POST + re-auth
// =============================================================
// Kept so old clients fail loud rather than appearing to work with stale
// auth semantics. Returns 405 Method Not Allowed with a hint.
patientRoutes.get('/export', (c) =>
  c.json(
    {
      data: null,
      errors: [
        {
          code: 'method_not_allowed',
          message:
            'GET /api/patient/export was replaced by POST with a password body for re-auth.',
        },
      ],
    },
    405
  )
);

// =============================================================
// DELETE /api/patient — full deletion (re-auth required)
// =============================================================
// Re-auth gate: a fresh `password` in the JSON body is required in addition
// to ?confirm=yes and the bearer JWT.
patientRoutes.delete('/', async (c) => {
  const patientId = c.get('patient_id')!;
  const confirm = c.req.query('confirm');

  if (confirm !== 'yes') {
    return badRequest(c, 'Append ?confirm=yes to permanently delete this account');
  }

  const body = (await c.req.json().catch(() => ({}))) as { password?: string };
  if (!body.password || typeof body.password !== 'string') {
    return badRequest(c, 'password required for re-auth', 'password');
  }

  const auth = await c.env.DB.prepare(
    'SELECT password_hash FROM patient_auth WHERE patient_id = ?'
  )
    .bind(patientId)
    .first<{ password_hash: string | null }>();

  if (!auth?.password_hash || !(await verifyPassword(body.password, auth.password_hash))) {
    return unauthorized(c, 'Re-authentication failed');
  }

  // Audit FIRST so we have a record after the cascade-delete strips
  // patient-scoped audit rows.
  await recordAudit(c.env.DB, {
    actorPatientId: null, // system-level event, not patient-attributable post-delete
    action: 'patient.delete',
    targetType: 'patient',
    targetId: patientId,
    metadata: { trigger: 'self_request' },
    ip: c.req.header('cf-connecting-ip'),
    userAgent: c.req.header('user-agent'),
  });

  // Cascade-deletes via FK: patient_pii, patient_auth, patient_passkey,
  // patient_condition, patient_terpene_preference, session (and via session
  // -> rating, task_log, adverse_event), organoleptic_assessment, microscope_image
  await c.env.DB.prepare('DELETE FROM patient WHERE id = ?').bind(patientId).run();

  return c.json({ data: { ok: true, deleted_at: Date.now() } });
});

function sessionsToCsv(
  sessions: unknown[],
  ratings: unknown[]
): string {
  const ratingMap = new Map<string, Map<string, number>>();
  for (const r of ratings as Array<{ session_id: string; phase: string; scale_code: string; value: number }>) {
    const key = `${r.session_id}|${r.phase}`;
    if (!ratingMap.has(key)) ratingMap.set(key, new Map());
    ratingMap.get(key)!.set(r.scale_code, r.value);
  }

  const allScales = new Set<string>();
  for (const m of ratingMap.values()) for (const k of m.keys()) allScales.add(k);
  const scales = [...allScales].sort();

  const header = [
    'session_id',
    'started_at',
    'batch_id',
    'route',
    'dose_grams',
    'voided',
    ...scales.flatMap((s) => [`pre_${s}`, `post_${s}`]),
  ];
  const rows = [header.join(',')];

  for (const s of sessions as Array<Record<string, unknown>>) {
    const pre = ratingMap.get(`${s.id}|pre`) ?? new Map();
    const post = ratingMap.get(`${s.id}|post`) ?? new Map();
    rows.push(
      [
        s.id,
        s.started_at,
        s.batch_id,
        s.route,
        s.dose_grams ?? '',
        s.voided,
        ...scales.flatMap((sc) => [pre.get(sc) ?? '', post.get(sc) ?? '']),
      ]
        .map(csvEscape)
        .join(',')
    );
  }

  return rows.join('\n');
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export { patientRoutes };
