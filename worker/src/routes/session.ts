/**
 * Session routes — the core of the Phenologue protocol.
 *
 * A session is a single discrete consumption event with pre-state ratings,
 * dose / route / temperature data, post-state ratings, and optional task logs.
 *
 * The 24-hour edit window is enforced here. Voiding is supported but
 * permanent deletion is not (audit trail integrity).
 */

import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import type { Env, ContextVars } from '../env';
import { recordAudit } from '../lib/audit';
import { badRequest, conflict, methodologyViolation, notFound } from '../lib/errors';

const sessionRoutes = new Hono<{ Bindings: Env; Variables: ContextVars }>();

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

interface CreateSessionBody {
  batch_id: string;
  purpose_tags: string[];
  route: 'vape' | 'oil' | 'edible' | 'other';
  device?: string;
  vape_temp_c?: number;
  dose_grams?: number;
  pre_ratings: Array<{ scale_code: string; value: number }>;
  note?: string;
}

interface AddPostRatingsBody {
  ratings: Array<{ scale_code: string; value: number }>;
  onset_minutes?: number;
  peak_minutes?: number;
  note?: string;
}

interface AddTaskLogBody {
  description: string;
  complexity?: number;
  estimated_minutes?: number;
  actual_minutes?: number;
  completion_status?: 'completed' | 'partial' | 'abandoned';
  quality_rating?: number;
}

interface AddAdverseEventBody {
  code: string;
  severity?: number;
  note?: string;
}

interface VoidBody {
  reason: string;
}

interface PatchSessionBody {
  device?: string;
  vape_temp_c?: number;
  dose_grams?: number;
  onset_minutes?: number;
  peak_minutes?: number;
  note?: string;
  purpose_tags?: string[];
}

// =============================================================
// POST /api/sessions — start a session
// =============================================================
sessionRoutes.post('/', async (c) => {
  const patientId = c.get('patient_id')!;
  const body = (await c.req.json()) as CreateSessionBody;

  if (!body.batch_id || !body.purpose_tags?.length || !body.route) {
    return badRequest(c, 'batch_id, purpose_tags, and route are required');
  }
  if (!['vape', 'oil', 'edible', 'other'].includes(body.route)) {
    return badRequest(c, 'route must be vape, oil, edible, or other');
  }
  if (!Array.isArray(body.pre_ratings) || body.pre_ratings.length === 0) {
    return methodologyViolation(c, 'Pre-ratings are required by methodology v0.1');
  }

  const sessionId = nanoid(16);
  const now = Date.now();

  const batch = await c.env.DB.prepare('SELECT id FROM batch WHERE id = ?')
    .bind(body.batch_id)
    .first();
  if (!batch) return notFound(c, 'Batch not found');

  const stmts: D1PreparedStatement[] = [];

  stmts.push(
    c.env.DB.prepare(
      `INSERT INTO session
       (id, patient_id, batch_id, started_at, purpose_tags_json, route, device,
        vape_temp_c, dose_grams, note, methodology_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      sessionId,
      patientId,
      body.batch_id,
      now,
      JSON.stringify(body.purpose_tags),
      body.route,
      body.device ?? null,
      body.vape_temp_c ?? null,
      body.dose_grams ?? null,
      body.note ?? null,
      c.env.METHODOLOGY_VERSION
    )
  );

  for (const r of body.pre_ratings) {
    if (r.value < 0 || r.value > 10) continue;
    stmts.push(
      c.env.DB.prepare(
        `INSERT INTO rating (id, session_id, phase, captured_at, scale_code, value)
         VALUES (?, ?, 'pre', ?, ?, ?)`
      ).bind(nanoid(16), sessionId, now, r.scale_code, r.value)
    );
  }

  await c.env.DB.batch(stmts);

  await recordAudit(c.env.DB, {
    actorPatientId: patientId,
    action: 'session.create',
    targetType: 'session',
    targetId: sessionId,
    metadata: {
      batch_id: body.batch_id,
      route: body.route,
      methodology_version: c.env.METHODOLOGY_VERSION,
    },
    ip: c.req.header('cf-connecting-ip'),
    userAgent: c.req.header('user-agent'),
  });

  return c.json({ data: { id: sessionId, started_at: now } }, 201);
});

// =============================================================
// GET /api/sessions
// =============================================================
sessionRoutes.get('/', async (c) => {
  const patientId = c.get('patient_id')!;
  const from = c.req.query('from');
  const to = c.req.query('to');
  const purpose = c.req.query('purpose');
  const includeVoided = c.req.query('voided') === '1';

  let sql =
    `SELECT s.id, s.started_at, s.ended_at, s.batch_id, s.route, s.device,
            s.dose_grams, s.vape_temp_c, s.purpose_tags_json, s.note,
            s.voided, s.methodology_version,
            c.name AS cultivar_name, c.producer,
            bc.classification, bc.dominant_terpene, bc.secondary_terpene
     FROM session s
     JOIN batch b ON s.batch_id = b.id
     JOIN cultivar c ON b.cultivar_id = c.id
     LEFT JOIN batch_chemotype bc ON bc.batch_id = b.id
     WHERE s.patient_id = ?`;
  const params: (string | number)[] = [patientId];

  if (!includeVoided) sql += ' AND s.voided = 0';
  if (from) {
    sql += ' AND s.started_at >= ?';
    params.push(parseInt(from, 10));
  }
  if (to) {
    sql += ' AND s.started_at <= ?';
    params.push(parseInt(to, 10));
  }

  sql += ' ORDER BY s.started_at DESC LIMIT 200';

  const result = await c.env.DB.prepare(sql).bind(...params).all();
  let rows = result.results as Array<Record<string, unknown>>;

  if (purpose) {
    rows = rows.filter((r) => {
      try {
        const tags = JSON.parse((r.purpose_tags_json as string) ?? '[]') as string[];
        return tags.includes(purpose);
      } catch {
        return false;
      }
    });
  }

  return c.json({ data: rows });
});

// =============================================================
// GET /api/sessions/:id
// =============================================================
sessionRoutes.get('/:id', async (c) => {
  const patientId = c.get('patient_id')!;
  const id = c.req.param('id');

  const session = await c.env.DB.prepare(
    `SELECT s.*, c.name AS cultivar_name, c.producer, b.batch_number,
            bc.dominant_terpene, bc.secondary_terpene, bc.classification
     FROM session s
     JOIN batch b ON s.batch_id = b.id
     JOIN cultivar c ON b.cultivar_id = c.id
     LEFT JOIN batch_chemotype bc ON bc.batch_id = b.id
     WHERE s.id = ? AND s.patient_id = ?`
  )
    .bind(id, patientId)
    .first();

  if (!session) return notFound(c, 'Session not found');

  const ratings = await c.env.DB.prepare(
    'SELECT phase, scale_code, value, captured_at FROM rating WHERE session_id = ? ORDER BY captured_at'
  )
    .bind(id)
    .all();

  const tasks = await c.env.DB.prepare('SELECT * FROM task_log WHERE session_id = ?')
    .bind(id)
    .all();

  const adverse = await c.env.DB.prepare('SELECT * FROM adverse_event WHERE session_id = ?')
    .bind(id)
    .all();

  return c.json({
    data: {
      ...session,
      ratings: ratings.results,
      tasks: tasks.results,
      adverse_events: adverse.results,
    },
  });
});

// =============================================================
// PATCH /api/sessions/:id — within 24h window
// =============================================================
sessionRoutes.patch('/:id', async (c) => {
  const patientId = c.get('patient_id')!;
  const id = c.req.param('id');
  const body = (await c.req.json()) as PatchSessionBody;

  const session = await c.env.DB.prepare(
    'SELECT id, started_at, voided FROM session WHERE id = ? AND patient_id = ?'
  )
    .bind(id, patientId)
    .first<{ id: string; started_at: number; voided: number }>();

  if (!session) return notFound(c, 'Session not found');
  if (session.voided) return conflict(c, 'voided', 'Session is voided');

  if (Date.now() - session.started_at > EDIT_WINDOW_MS) {
    return conflict(c, 'edit_window_closed', 'Edit window has closed (24h)');
  }

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (body.device !== undefined) {
    updates.push('device = ?');
    values.push(body.device || null);
  }
  if (body.vape_temp_c !== undefined) {
    updates.push('vape_temp_c = ?');
    values.push(body.vape_temp_c);
  }
  if (body.dose_grams !== undefined) {
    updates.push('dose_grams = ?');
    values.push(body.dose_grams);
  }
  if (body.onset_minutes !== undefined) {
    updates.push('onset_minutes = ?');
    values.push(body.onset_minutes);
  }
  if (body.peak_minutes !== undefined) {
    updates.push('peak_minutes = ?');
    values.push(body.peak_minutes);
  }
  if (body.note !== undefined) {
    updates.push('note = ?');
    values.push(body.note || null);
  }
  if (body.purpose_tags !== undefined) {
    if (!Array.isArray(body.purpose_tags) || body.purpose_tags.length === 0) {
      return badRequest(c, 'purpose_tags must be a non-empty array');
    }
    updates.push('purpose_tags_json = ?');
    values.push(JSON.stringify(body.purpose_tags));
  }

  if (updates.length === 0) return c.json({ data: { ok: true, changed: 0 } });

  values.push(id);
  await c.env.DB.prepare(`UPDATE session SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  return c.json({ data: { ok: true, changed: updates.length } });
});

// =============================================================
// POST /api/sessions/:id/ratings
// =============================================================
sessionRoutes.post('/:id/ratings', async (c) => {
  const patientId = c.get('patient_id')!;
  const id = c.req.param('id');
  const phase = c.req.query('phase') ?? 'post';

  if (phase !== 'post' && phase !== 'next_day') {
    return badRequest(c, 'phase must be post or next_day');
  }

  const body = (await c.req.json()) as AddPostRatingsBody;

  const session = await c.env.DB.prepare(
    'SELECT id, started_at, voided FROM session WHERE id = ? AND patient_id = ?'
  )
    .bind(id, patientId)
    .first<{ id: string; started_at: number; voided: number }>();

  if (!session) return notFound(c, 'Session not found');
  if (session.voided) return conflict(c, 'voided', 'Session is voided');

  if (Date.now() - session.started_at > EDIT_WINDOW_MS && phase === 'post') {
    return conflict(
      c,
      'edit_window_closed',
      'Post-ratings can only be added within 24 hours of session start'
    );
  }

  const now = Date.now();
  const stmts: D1PreparedStatement[] = [];

  for (const r of body.ratings) {
    if (r.value < 0 || r.value > 10) continue;
    stmts.push(
      c.env.DB.prepare(
        `INSERT INTO rating (id, session_id, phase, captured_at, scale_code, value)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (session_id, phase, scale_code)
         DO UPDATE SET value = excluded.value, captured_at = excluded.captured_at`
      ).bind(nanoid(16), id, phase, now, r.scale_code, r.value)
    );
  }

  if (
    phase === 'post' &&
    (body.onset_minutes != null || body.peak_minutes != null || body.note != null)
  ) {
    stmts.push(
      c.env.DB.prepare(
        `UPDATE session SET
           onset_minutes = COALESCE(?, onset_minutes),
           peak_minutes = COALESCE(?, peak_minutes),
           note = COALESCE(?, note),
           ended_at = COALESCE(ended_at, ?)
         WHERE id = ?`
      ).bind(
        body.onset_minutes ?? null,
        body.peak_minutes ?? null,
        body.note ?? null,
        now,
        id
      )
    );
  }

  await c.env.DB.batch(stmts);

  // Trigger aggregation refresh asynchronously when post-ratings land.
  if (phase === 'post') {
    try {
      await c.env.AGG_QUEUE.send({ kind: 'session_completed', session_id: id });
    } catch (err) {
      console.warn('Failed to enqueue aggregation job:', err);
    }
  }

  return c.json({ data: { ok: true, count: body.ratings.length } });
});

// =============================================================
// POST /api/sessions/:id/tasks
// =============================================================
sessionRoutes.post('/:id/tasks', async (c) => {
  const patientId = c.get('patient_id')!;
  const id = c.req.param('id');
  const body = (await c.req.json()) as AddTaskLogBody;

  const session = await c.env.DB.prepare(
    'SELECT id FROM session WHERE id = ? AND patient_id = ? AND voided = 0'
  )
    .bind(id, patientId)
    .first();

  if (!session) return notFound(c, 'Session not found');

  const taskId = nanoid(16);
  await c.env.DB.prepare(
    `INSERT INTO task_log
       (id, session_id, description, complexity, estimated_minutes,
        actual_minutes, completion_status, quality_rating)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      taskId,
      id,
      body.description ?? null,
      body.complexity ?? null,
      body.estimated_minutes ?? null,
      body.actual_minutes ?? null,
      body.completion_status ?? null,
      body.quality_rating ?? null
    )
    .run();

  return c.json({ data: { id: taskId } }, 201);
});

// =============================================================
// POST /api/sessions/:id/adverse_events
// =============================================================
sessionRoutes.post('/:id/adverse_events', async (c) => {
  const patientId = c.get('patient_id')!;
  const id = c.req.param('id');
  const body = (await c.req.json()) as AddAdverseEventBody;

  if (!body.code) return badRequest(c, 'code required');

  const session = await c.env.DB.prepare(
    'SELECT id FROM session WHERE id = ? AND patient_id = ? AND voided = 0'
  )
    .bind(id, patientId)
    .first();

  if (!session) return notFound(c, 'Session not found');

  const aeId = nanoid(16);
  await c.env.DB.prepare(
    `INSERT INTO adverse_event (id, session_id, code, severity, note)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(aeId, id, body.code, body.severity ?? null, body.note ?? null)
    .run();

  return c.json({ data: { id: aeId } }, 201);
});

// =============================================================
// POST /api/sessions/:id/void
// =============================================================
sessionRoutes.post('/:id/void', async (c) => {
  const patientId = c.get('patient_id')!;
  const id = c.req.param('id');
  const body = (await c.req.json()) as VoidBody;

  if (!body.reason || body.reason.length < 3) {
    return badRequest(c, 'Reason required (≥3 chars)');
  }

  const session = await c.env.DB.prepare(
    'SELECT id, started_at FROM session WHERE id = ? AND patient_id = ? AND voided = 0'
  )
    .bind(id, patientId)
    .first<{ id: string; started_at: number }>();

  if (!session) return notFound(c, 'Session not found');

  if (Date.now() - session.started_at > EDIT_WINDOW_MS) {
    return conflict(
      c,
      'edit_window_closed',
      'Sessions can only be voided within 24 hours'
    );
  }

  await c.env.DB.prepare(
    'UPDATE session SET voided = 1, void_reason = ?, voided_at = ? WHERE id = ?'
  )
    .bind(body.reason, Date.now(), id)
    .run();

  await recordAudit(c.env.DB, {
    actorPatientId: patientId,
    action: 'session.void',
    targetType: 'session',
    targetId: id,
    metadata: { reason: body.reason },
    ip: c.req.header('cf-connecting-ip'),
    userAgent: c.req.header('user-agent'),
  });

  return c.json({ data: { ok: true } });
});

export { sessionRoutes };
