/**
 * Public aggregate routes — no auth required.
 *
 * Methodology v0.1 §6 / spec §6: aggregate views require BOTH at least
 * MIN_SESSIONS sessions AND at least MIN_PATIENTS distinct patients for
 * public visibility. The patient floor is the actual k-anonymity guarantee —
 * the session floor alone allows a single prolific user (e.g. daily use on a
 * niche cultivar) to populate a bucket whose delta vector then describes one
 * person's response. Both thresholds must clear before scale-by-scale stats
 * are exposed; otherwise the endpoint returns the suppression flag with the
 * raw n_sessions / n_patients so consumers can render "insufficient data" UI.
 *
 * v0.1 reads from the live session/rating tables. Materialised agg_* tables
 * will replace this once the aggregation Queue worker is implemented; the
 * response shape is stable.
 */

import { Hono } from 'hono';
import type { Env, ContextVars } from '../env';
import { notFound } from '../lib/errors';

const MIN_SESSIONS = 30;
const MIN_PATIENTS = 5;

const publicRoutes = new Hono<{ Bindings: Env; Variables: ContextVars }>();

interface RatingRow {
  session_id: string;
  phase: string;
  scale_code: string;
  value: number;
}

interface SessionAggRow {
  id: string;
  patient_id: string;
  voided: number;
  classification: string | null;
}

// =============================================================
// GET /api/public/cultivars/:id/aggregate
// =============================================================
publicRoutes.get('/cultivars/:id/aggregate', async (c) => {
  const id = c.req.param('id');

  const cultivar = await c.env.DB.prepare(
    'SELECT id, name, producer, country_origin FROM cultivar WHERE id = ?'
  )
    .bind(id)
    .first();

  if (!cultivar) return notFound(c, 'Cultivar not found');

  const sessions = await c.env.DB.prepare(
    `SELECT s.id, s.patient_id, s.voided, bc.classification
     FROM session s
     JOIN batch b ON s.batch_id = b.id
     LEFT JOIN batch_chemotype bc ON bc.batch_id = b.id
     JOIN patient p ON s.patient_id = p.id
     WHERE b.cultivar_id = ? AND s.voided = 0 AND p.consent_aggregate = 1`
  )
    .bind(id)
    .all<SessionAggRow>();

  const sessionRows = (sessions.results ?? []) as SessionAggRow[];
  const n = sessionRows.length;
  const nPatients = new Set(sessionRows.map((s) => s.patient_id)).size;

  if (n < MIN_SESSIONS || nPatients < MIN_PATIENTS) {
    return c.json({
      data: {
        cultivar,
        suppressed: true,
        threshold: { min_sessions: MIN_SESSIONS, min_patients: MIN_PATIENTS },
        n_sessions: n,
        n_patients: nPatients,
      },
    });
  }

  const sessionIds = sessionRows.map((s) => s.id);
  const ratings = await fetchRatings(c.env.DB, sessionIds);

  return c.json({
    data: {
      cultivar,
      suppressed: false,
      n_sessions: n,
      n_patients: nPatients,
      scale_deltas: aggregateDeltas(ratings),
    },
  });
});

// =============================================================
// GET /api/public/chemotype/:dominant_terpene/aggregate
// =============================================================
publicRoutes.get('/chemotype/:dominant_terpene/aggregate', async (c) => {
  const terpene = c.req.param('dominant_terpene');

  const sessions = await c.env.DB.prepare(
    `SELECT s.id, s.patient_id, s.voided, bc.classification
     FROM session s
     JOIN batch b ON s.batch_id = b.id
     JOIN batch_chemotype bc ON bc.batch_id = b.id
     JOIN patient p ON s.patient_id = p.id
     WHERE bc.dominant_terpene = ? AND s.voided = 0 AND p.consent_aggregate = 1`
  )
    .bind(terpene)
    .all<SessionAggRow>();

  const sessionRows = (sessions.results ?? []) as SessionAggRow[];
  const n = sessionRows.length;
  const nPatients = new Set(sessionRows.map((s) => s.patient_id)).size;

  if (n < MIN_SESSIONS || nPatients < MIN_PATIENTS) {
    return c.json({
      data: {
        dominant_terpene: terpene,
        suppressed: true,
        threshold: { min_sessions: MIN_SESSIONS, min_patients: MIN_PATIENTS },
        n_sessions: n,
        n_patients: nPatients,
      },
    });
  }

  const ratings = await fetchRatings(c.env.DB, sessionRows.map((s) => s.id));

  return c.json({
    data: {
      dominant_terpene: terpene,
      suppressed: false,
      n_sessions: n,
      n_patients: nPatients,
      scale_deltas: aggregateDeltas(ratings),
    },
  });
});

// =============================================================
// GET /api/public/methodology — return methodology version + summary
// =============================================================
publicRoutes.get('/methodology', (c) =>
  c.json({
    data: {
      version: c.env.METHODOLOGY_VERSION,
      api_version: c.env.API_VERSION,
      licence: 'CC BY-SA 4.0',
      url: 'https://phenologue.uk/methodology',
    },
  })
);

async function fetchRatings(db: D1Database, sessionIds: string[]): Promise<RatingRow[]> {
  if (sessionIds.length === 0) return [];

  // Chunk to keep statement size bounded (D1 limits parameter count).
  const CHUNK = 100;
  const all: RatingRow[] = [];
  for (let i = 0; i < sessionIds.length; i += CHUNK) {
    const chunk = sessionIds.slice(i, i + CHUNK);
    const placeholders = chunk.map(() => '?').join(',');
    const result = await db
      .prepare(
        `SELECT session_id, phase, scale_code, value
         FROM rating WHERE session_id IN (${placeholders})`
      )
      .bind(...chunk)
      .all<RatingRow>();
    all.push(...((result.results ?? []) as RatingRow[]));
  }
  return all;
}

function aggregateDeltas(
  ratings: RatingRow[]
): Record<string, { mean_delta: number | null; median_delta: number | null; n: number }> {
  const bySession = new Map<string, { pre: Map<string, number>; post: Map<string, number> }>();
  for (const r of ratings) {
    if (r.phase !== 'pre' && r.phase !== 'post') continue;
    let entry = bySession.get(r.session_id);
    if (!entry) {
      entry = { pre: new Map(), post: new Map() };
      bySession.set(r.session_id, entry);
    }
    entry[r.phase].set(r.scale_code, r.value);
  }

  const deltas: Record<string, number[]> = {};
  for (const { pre, post } of bySession.values()) {
    for (const [scale, postVal] of post) {
      const preVal = pre.get(scale);
      if (preVal === undefined) continue;
      (deltas[scale] ??= []).push(postVal - preVal);
    }
  }

  const result: Record<string, { mean_delta: number | null; median_delta: number | null; n: number }> = {};
  for (const [scale, values] of Object.entries(deltas)) {
    if (values.length === 0) {
      result[scale] = { mean_delta: null, median_delta: null, n: 0 };
      continue;
    }
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]!
      : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2;
    result[scale] = {
      mean_delta: round(mean),
      median_delta: round(median),
      n: values.length,
    };
  }
  return result;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export { publicRoutes };
