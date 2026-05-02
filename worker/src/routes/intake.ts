/**
 * Intake routes — coach-mode foundation (Stream D).
 *
 * Sits ALONGSIDE the existing form-based POST /api/sessions flow in
 * routes/session.ts. The form path remains the canonical "collect everything,
 * post once" contract; these intake endpoints add a parallel surface where
 * partial state can be parked across multiple turns of a coach-driven
 * conversation, then committed once enough fields are present.
 *
 * Lifecycle:
 *   POST   /api/sessions/intake           → start a draft (returns id)
 *   PATCH  /api/sessions/intake/:id       → merge a Partial<DraftState> patch
 *   GET    /api/sessions/intake/:id       → read current draft + validation
 *   POST   /api/sessions/intake/:id/commit → finalize to session + rating rows
 *   DELETE /api/sessions/intake/:id       → soft-delete (void) the draft
 *
 * The commit step mirrors routes/session.ts:POST / exactly, so methodology
 * constraints (batch_id required, ≥1 pre_rating required, etc.) are enforced
 * uniformly across both flows.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { nanoid } from 'nanoid';
import type { Env, ContextVars } from '../env';
import { recordAudit } from '../lib/audit';
import { badRequest, conflict, methodologyViolation, notFound } from '../lib/errors';
import {
  type DraftState,
  type IntakeValidationResult,
  mergeDraft,
  validateDraftForCommit,
} from '../lib/intake-validate';

const intakeRoutes = new Hono<{ Bindings: Env; Variables: ContextVars }>();

interface DraftRow {
  id: string;
  patient_id: string;
  started_at: number;
  updated_at: number;
  draft_json: string;
  committed_at: number | null;
  committed_session_id: string | null;
  voided_at: number | null;
  void_reason: string | null;
}

interface VoidBody {
  reason?: string;
}

function parseDraft(row: DraftRow): DraftState {
  try {
    const parsed = JSON.parse(row.draft_json);
    return (parsed && typeof parsed === 'object' ? parsed : {}) as DraftState;
  } catch {
    return {};
  }
}

function snapshot(row: DraftRow): {
  id: string;
  started_at: number;
  updated_at: number;
  committed_at: number | null;
  committed_session_id: string | null;
  voided_at: number | null;
  draft: DraftState;
  validation: IntakeValidationResult;
} {
  const draft = parseDraft(row);
  return {
    id: row.id,
    started_at: row.started_at,
    updated_at: row.updated_at,
    committed_at: row.committed_at,
    committed_session_id: row.committed_session_id,
    voided_at: row.voided_at,
    draft,
    validation: validateDraftForCommit(draft),
  };
}

type IntakeContext = Context<{ Bindings: Env; Variables: ContextVars }>;

async function loadOwnedDraft(
  c: IntakeContext,
  draftId: string,
  patientId: string
): Promise<DraftRow | null> {
  return await c.env.DB.prepare(
    `SELECT id, patient_id, started_at, updated_at, draft_json,
            committed_at, committed_session_id, voided_at, void_reason
       FROM session_draft
      WHERE id = ? AND patient_id = ?`
  )
    .bind(draftId, patientId)
    .first<DraftRow>();
}

// =============================================================
// POST /api/sessions/intake — start a new draft
// =============================================================
intakeRoutes.post('/', async (c) => {
  const patientId = c.get('patient_id')!;

  let initial: Partial<DraftState> = {};
  try {
    const body = await c.req.json();
    if (body && typeof body === 'object') initial = body as Partial<DraftState>;
  } catch {
    // empty body is fine — caller may want a totally blank draft
  }

  const id = nanoid(16);
  const now = Date.now();
  // Strip undefined values so JSON encoding stays clean.
  const draftJson = JSON.stringify(mergeDraft({}, initial));

  await c.env.DB.prepare(
    `INSERT INTO session_draft
       (id, patient_id, started_at, updated_at, draft_json)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(id, patientId, now, now, draftJson)
    .run();

  const row = await loadOwnedDraft(c, id, patientId);
  if (!row) return notFound(c, 'Draft not found after insert');

  return c.json({ data: snapshot(row) }, 201);
});

// =============================================================
// GET /api/sessions/intake/:id — read a draft
// =============================================================
intakeRoutes.get('/:id', async (c) => {
  const patientId = c.get('patient_id')!;
  const id = c.req.param('id');

  const row = await loadOwnedDraft(c, id, patientId);
  if (!row) return notFound(c, 'Draft not found');

  return c.json({ data: snapshot(row) });
});

// =============================================================
// PATCH /api/sessions/intake/:id — merge a Partial<DraftState>
// =============================================================
intakeRoutes.patch('/:id', async (c) => {
  const patientId = c.get('patient_id')!;
  const id = c.req.param('id');

  let patch: Partial<DraftState> = {};
  try {
    const body = await c.req.json();
    if (body && typeof body === 'object') patch = body as Partial<DraftState>;
  } catch {
    return badRequest(c, 'Request body must be valid JSON');
  }

  const row = await loadOwnedDraft(c, id, patientId);
  if (!row) return notFound(c, 'Draft not found');
  if (row.committed_at) {
    return conflict(c, 'already_committed', 'Draft has already been committed');
  }
  if (row.voided_at) {
    return conflict(c, 'voided', 'Draft has been voided');
  }

  const merged = mergeDraft(parseDraft(row), patch);
  const now = Date.now();

  await c.env.DB.prepare(
    `UPDATE session_draft
        SET draft_json = ?, updated_at = ?
      WHERE id = ?`
  )
    .bind(JSON.stringify(merged), now, id)
    .run();

  const updated = await loadOwnedDraft(c, id, patientId);
  if (!updated) return notFound(c, 'Draft not found after update');

  return c.json({ data: snapshot(updated) });
});

// =============================================================
// POST /api/sessions/intake/:id/commit — finalize to session + rating rows
// =============================================================
intakeRoutes.post('/:id/commit', async (c) => {
  const patientId = c.get('patient_id')!;
  const id = c.req.param('id');

  const row = await loadOwnedDraft(c, id, patientId);
  if (!row) return notFound(c, 'Draft not found');
  if (row.committed_at) {
    return conflict(c, 'already_committed', 'Draft has already been committed');
  }
  if (row.voided_at) {
    return conflict(c, 'voided', 'Draft has been voided');
  }

  const draft = parseDraft(row);
  const validation = validateDraftForCommit(draft);
  if (!validation.valid) {
    // 422 if there are real methodology violations (missing pre_ratings,
    // missing batch_id), 400 otherwise. We pick 400 as the simpler default
    // and surface the full validation payload to the caller.
    return c.json(
      {
        data: null,
        errors: [
          {
            code: 'draft_invalid',
            message: 'Draft is not yet valid for commit',
          },
        ],
        validation,
      },
      400
    );
  }

  // At this point validation guarantees batch_id and ≥1 pre_rating.
  const batchId = draft.batch_id!;
  const preRatings = draft.pre_ratings!;

  // Verify the batch exists, mirroring routes/session.ts:POST /.
  const batch = await c.env.DB.prepare('SELECT id FROM batch WHERE id = ?')
    .bind(batchId)
    .first();
  if (!batch) return notFound(c, 'Batch not found');

  // Methodology v0.1: pre-ratings required (defensive double-check).
  if (preRatings.length === 0) {
    return methodologyViolation(c, 'Pre-ratings are required by methodology v0.1');
  }

  const sessionId = nanoid(16);
  const now = Date.now();

  // Coach-mode currently lacks first-class fields for purpose_tags and
  // route — they are optional in DraftState. The form-based flow in
  // routes/session.ts treats them as required. To keep the `session` row
  // valid (NOT NULL columns + non-empty purpose_tags_json), we default
  // missing values to safe equivalents: route = 'other', purpose_tags =
  // ['exploratory']. The coach is expected to fill these in before commit
  // in v0.2; this default is the minimal fallback for v0.1.
  const route = draft.route ?? 'other';
  const purposeTags =
    draft.purpose_tags && draft.purpose_tags.length > 0
      ? draft.purpose_tags
      : ['exploratory'];

  const stmts: D1PreparedStatement[] = [];

  stmts.push(
    c.env.DB.prepare(
      `INSERT INTO session
         (id, patient_id, batch_id, started_at, purpose_tags_json, route,
          device, vape_temp_c, dose_grams, note, methodology_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      sessionId,
      patientId,
      batchId,
      now,
      JSON.stringify(purposeTags),
      route,
      null, // device — not tracked in DraftState v0.1
      draft.vape_temp_c ?? null,
      draft.dose_grams ?? null,
      draft.pre_note ?? null,
      c.env.METHODOLOGY_VERSION
    )
  );

  for (const r of preRatings) {
    if (!Number.isInteger(r.value) || r.value < 0 || r.value > 10) continue;
    stmts.push(
      c.env.DB.prepare(
        `INSERT INTO rating (id, session_id, phase, captured_at, scale_code, value)
         VALUES (?, ?, 'pre', ?, ?, ?)`
      ).bind(nanoid(16), sessionId, now, r.scale_code, r.value)
    );
  }

  stmts.push(
    c.env.DB.prepare(
      `UPDATE session_draft
          SET committed_at = ?, committed_session_id = ?, updated_at = ?
        WHERE id = ?`
    ).bind(now, sessionId, now, id)
  );

  await c.env.DB.batch(stmts);

  await recordAudit(c.env.DB, {
    actorPatientId: patientId,
    action: 'session.create',
    targetType: 'session',
    targetId: sessionId,
    metadata: {
      batch_id: batchId,
      route,
      methodology_version: c.env.METHODOLOGY_VERSION,
      via: 'intake_draft',
      draft_id: id,
    },
    ip: c.req.header('cf-connecting-ip'),
    userAgent: c.req.header('user-agent'),
  });

  return c.json(
    {
      data: {
        session_id: sessionId,
        committed_at: now,
        draft_id: id,
      },
    },
    201
  );
});

// =============================================================
// DELETE /api/sessions/intake/:id — soft-delete (void) the draft
// =============================================================
intakeRoutes.delete('/:id', async (c) => {
  const patientId = c.get('patient_id')!;
  const id = c.req.param('id');

  let body: VoidBody = {};
  try {
    const parsed = await c.req.json();
    if (parsed && typeof parsed === 'object') body = parsed as VoidBody;
  } catch {
    // empty body is fine — reason is optional
  }

  const row = await loadOwnedDraft(c, id, patientId);
  if (!row) return notFound(c, 'Draft not found');
  if (row.committed_at) {
    return conflict(c, 'already_committed', 'Cannot void a committed draft');
  }
  if (row.voided_at) {
    // idempotent: already voided
    return c.json({ data: { ok: true } });
  }

  const now = Date.now();
  await c.env.DB.prepare(
    `UPDATE session_draft
        SET voided_at = ?, void_reason = ?, updated_at = ?
      WHERE id = ?`
  )
    .bind(now, body.reason ?? null, now, id)
    .run();

  return c.json({ data: { ok: true } });
});

export { intakeRoutes };
