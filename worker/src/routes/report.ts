/**
 * Report routes — personal dashboard, batch report, condition analysis.
 *
 * Personal reports are computed on demand from the patient's own session
 * history. They do NOT require the aggregation tables — those are for cohort
 * stats only. Personal-only reports are available immediately after a session.
 *
 * Methodology v0.1 §6 + §3 — pre/post deltas tied to chemotype + purpose.
 */

import { Hono } from 'hono';
import type { Env, ContextVars } from '../env';
import { notFound } from '../lib/errors';

const reportRoutes = new Hono<{ Bindings: Env; Variables: ContextVars }>();

interface SessionRow {
  id: string;
  started_at: number;
  ended_at: number | null;
  batch_id: string;
  cultivar_name: string;
  producer: string;
  classification: string | null;
  dominant_terpene: string | null;
  secondary_terpene: string | null;
  purpose_tags_json: string;
  voided: number;
}

interface RatingRow {
  session_id: string;
  phase: 'pre' | 'post' | 'next_day';
  scale_code: string;
  value: number;
}

// =============================================================
// GET /api/reports/personal — dashboard summary
// =============================================================
reportRoutes.get('/personal', async (c) => {
  const patientId = c.get('patient_id')!;

  const sessions = await c.env.DB.prepare(
    `SELECT s.id, s.started_at, s.ended_at, s.batch_id, s.purpose_tags_json,
            s.voided,
            c.name AS cultivar_name, c.producer,
            bc.classification, bc.dominant_terpene, bc.secondary_terpene
     FROM session s
     JOIN batch b ON s.batch_id = b.id
     JOIN cultivar c ON b.cultivar_id = c.id
     LEFT JOIN batch_chemotype bc ON bc.batch_id = b.id
     WHERE s.patient_id = ?
     ORDER BY s.started_at DESC`
  )
    .bind(patientId)
    .all<SessionRow>();

  const ratings = await c.env.DB.prepare(
    `SELECT r.session_id, r.phase, r.scale_code, r.value
     FROM rating r JOIN session s ON r.session_id = s.id
     WHERE s.patient_id = ?`
  )
    .bind(patientId)
    .all<RatingRow>();

  const sessionRows = (sessions.results ?? []) as SessionRow[];
  const ratingRows = (ratings.results ?? []) as RatingRow[];

  const totalSessions = sessionRows.filter((s) => !s.voided).length;
  const validSessions = sessionRows.filter((s) => !s.voided);

  const purposeCounts: Record<string, number> = {};
  for (const s of validSessions) {
    try {
      const tags = JSON.parse(s.purpose_tags_json) as string[];
      for (const t of tags) purposeCounts[t] = (purposeCounts[t] ?? 0) + 1;
    } catch {
      // ignore parse errors on malformed legacy rows
    }
  }

  const chemotypeCounts: Record<string, number> = {};
  for (const s of validSessions) {
    if (s.classification) {
      chemotypeCounts[s.classification] = (chemotypeCounts[s.classification] ?? 0) + 1;
    }
  }

  // Per-scale pre/post mean delta over all sessions
  const ratingMap = buildRatingMap(ratingRows);
  const scaleDeltas = computeScaleDeltas(validSessions, ratingMap);

  // Most-used cultivars
  const cultivarCounts: Record<string, { name: string; producer: string; count: number }> = {};
  for (const s of validSessions) {
    const key = s.batch_id;
    if (!cultivarCounts[key]) {
      cultivarCounts[key] = { name: s.cultivar_name, producer: s.producer, count: 0 };
    }
    cultivarCounts[key].count++;
  }

  const recentSessions = sessionRows.slice(0, 10).map((s) => ({
    id: s.id,
    started_at: s.started_at,
    cultivar_name: s.cultivar_name,
    classification: s.classification,
    purpose_tags: safeJsonArray(s.purpose_tags_json),
    voided: !!s.voided,
  }));

  return c.json({
    data: {
      patient_id: patientId,
      total_sessions: totalSessions,
      purpose_counts: purposeCounts,
      chemotype_counts: chemotypeCounts,
      scale_deltas: scaleDeltas,
      cultivar_counts: Object.values(cultivarCounts).sort((a, b) => b.count - a.count).slice(0, 10),
      recent_sessions: recentSessions,
    },
  });
});

// =============================================================
// GET /api/reports/personal/condition/:code — condition-specific analysis
// =============================================================
reportRoutes.get('/personal/condition/:code', async (c) => {
  const patientId = c.get('patient_id')!;
  const code = c.req.param('code');

  const conditionScales = await c.env.DB.prepare(
    `SELECT code FROM rating_scale WHERE condition_code = ? OR category = 'core'`
  )
    .bind(code)
    .all<{ code: string }>();
  const scaleCodes = (conditionScales.results ?? []).map((r) => r.code);

  const sessions = await c.env.DB.prepare(
    `SELECT s.id, s.started_at, s.batch_id, s.purpose_tags_json, s.voided,
            c.name AS cultivar_name, c.producer,
            bc.classification, bc.dominant_terpene, bc.secondary_terpene
     FROM session s
     JOIN batch b ON s.batch_id = b.id
     JOIN cultivar c ON b.cultivar_id = c.id
     LEFT JOIN batch_chemotype bc ON bc.batch_id = b.id
     WHERE s.patient_id = ? AND s.voided = 0
     ORDER BY s.started_at DESC`
  )
    .bind(patientId)
    .all<SessionRow>();

  const ratings = await c.env.DB.prepare(
    `SELECT r.session_id, r.phase, r.scale_code, r.value
     FROM rating r JOIN session s ON r.session_id = s.id
     WHERE s.patient_id = ?`
  )
    .bind(patientId)
    .all<RatingRow>();

  const ratingMap = buildRatingMap((ratings.results ?? []) as RatingRow[]);

  // Group by chemotype classification, compute per-scale deltas restricted
  // to scales relevant for this condition.
  const byChemotype = new Map<string, { n: number; sum: Map<string, { delta: number; count: number }> }>();
  for (const s of (sessions.results ?? []) as SessionRow[]) {
    const cls = s.classification ?? 'unclassified';
    let entry = byChemotype.get(cls);
    if (!entry) {
      entry = { n: 0, sum: new Map() };
      byChemotype.set(cls, entry);
    }
    entry.n++;

    const pre = ratingMap.get(`${s.id}|pre`) ?? new Map<string, number>();
    const post = ratingMap.get(`${s.id}|post`) ?? new Map<string, number>();

    for (const scale of scaleCodes) {
      const p = pre.get(scale);
      const q = post.get(scale);
      if (p === undefined || q === undefined) continue;
      const bucket = entry.sum.get(scale) ?? { delta: 0, count: 0 };
      bucket.delta += q - p;
      bucket.count++;
      entry.sum.set(scale, bucket);
    }
  }

  const result = [...byChemotype.entries()].map(([classification, { n, sum }]) => ({
    classification,
    n_sessions: n,
    scale_deltas: Object.fromEntries(
      [...sum.entries()].map(([scale, { delta, count }]) => [
        scale,
        { mean_delta: count ? round(delta / count) : null, n: count },
      ])
    ),
  }));

  return c.json({
    data: {
      condition_code: code,
      scales: scaleCodes,
      by_chemotype: result,
    },
  });
});

// =============================================================
// GET /api/reports/batch/:id — batch report (sessions across all patients
// who consented; falls back to personal-only when not enough data)
// =============================================================
reportRoutes.get('/batch/:id', async (c) => {
  const batchId = c.req.param('id');
  const patientId = c.get('patient_id')!;

  const batch = await c.env.DB.prepare(
    `SELECT b.*, c.name AS cultivar_name, c.producer, c.country_origin,
            bc.dominant_terpene, bc.dominant_pct, bc.secondary_terpene,
            bc.secondary_pct, bc.classification
     FROM batch b
     JOIN cultivar c ON b.cultivar_id = c.id
     LEFT JOIN batch_chemotype bc ON bc.batch_id = b.id
     WHERE b.id = ?`
  )
    .bind(batchId)
    .first();

  if (!batch) return notFound(c, 'Batch not found');

  // Personal session history against this batch
  const personalSessions = await c.env.DB.prepare(
    `SELECT s.id, s.started_at, s.purpose_tags_json, s.dose_grams, s.vape_temp_c,
            s.onset_minutes, s.peak_minutes, s.note, s.voided
     FROM session s
     WHERE s.batch_id = ? AND s.patient_id = ?
     ORDER BY s.started_at DESC`
  )
    .bind(batchId, patientId)
    .all();

  const personalRatings = await c.env.DB.prepare(
    `SELECT r.session_id, r.phase, r.scale_code, r.value
     FROM rating r JOIN session s ON r.session_id = s.id
     WHERE s.batch_id = ? AND s.patient_id = ?`
  )
    .bind(batchId, patientId)
    .all<RatingRow>();

  const ratingMap = buildRatingMap((personalRatings.results ?? []) as RatingRow[]);
  const personalDeltas = computeScaleDeltas(
    (personalSessions.results ?? []) as unknown as SessionRow[],
    ratingMap
  );

  return c.json({
    data: {
      batch,
      personal: {
        n_sessions: (personalSessions.results ?? []).filter(
          (s: unknown) => !(s as { voided: number }).voided
        ).length,
        sessions: personalSessions.results,
        scale_deltas: personalDeltas,
      },
    },
  });
});

// =============================================================
// helpers
// =============================================================
function buildRatingMap(rows: RatingRow[]): Map<string, Map<string, number>> {
  const map = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const key = `${r.session_id}|${r.phase}`;
    let inner = map.get(key);
    if (!inner) {
      inner = new Map();
      map.set(key, inner);
    }
    inner.set(r.scale_code, r.value);
  }
  return map;
}

function computeScaleDeltas(
  sessions: SessionRow[],
  ratingMap: Map<string, Map<string, number>>
): Record<string, { mean_delta: number | null; n: number }> {
  const acc: Record<string, { delta: number; count: number }> = {};

  for (const s of sessions) {
    if (s.voided) continue;
    const pre = ratingMap.get(`${s.id}|pre`);
    const post = ratingMap.get(`${s.id}|post`);
    if (!pre || !post) continue;

    for (const [scale, postVal] of post) {
      const preVal = pre.get(scale);
      if (preVal === undefined) continue;
      const bucket = acc[scale] ?? { delta: 0, count: 0 };
      bucket.delta += postVal - preVal;
      bucket.count++;
      acc[scale] = bucket;
    }
  }

  return Object.fromEntries(
    Object.entries(acc).map(([scale, { delta, count }]) => [
      scale,
      { mean_delta: count ? round(delta / count) : null, n: count },
    ])
  );
}

function safeJsonArray(s: string | null): string[] {
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export { reportRoutes };
