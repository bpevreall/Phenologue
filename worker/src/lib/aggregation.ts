/**
 * Aggregation pipeline — methodology v0.1 §6.
 *
 * Recomputes the materialised tables `agg_chemotype_outcome` and
 * `agg_cultivar_outcome` from the live session/rating data. Triggered by:
 *
 *   - Queue jobs (`session_completed`, `batch_chemotype_changed`)
 *     for incremental refresh after a write
 *   - Cron (`scheduled_recompute`) for a daily full sweep that catches any
 *     drift the incremental path missed
 *
 * Aggregations exclude:
 *   - voided sessions
 *   - patients without consent_aggregate = 1
 *   - patients with fewer than 5 sessions (per spec — insufficient personal
 *     baseline)
 */

import { nanoid } from 'nanoid';
import type { Env, AggregationJob } from '../env';

export interface RowDelta {
  patient_id: string;
  chemotype: string | null;
  cultivar_id: string;
  condition_code: string | null;
  scale_code: string;
  pre: number;
  post: number;
}

const MIN_SESSIONS_PER_PATIENT = 5;

export async function handleAggregationJob(env: Env, job: AggregationJob): Promise<void> {
  switch (job.kind) {
    case 'session_completed':
    case 'batch_chemotype_changed':
      // Incremental: just recompute everything (D1 is small enough that a
      // full pass is faster than diffing). Replace with diff-based logic
      // when the dataset grows past ~50k sessions.
      await fullRecompute(env);
      break;
    case 'scheduled_recompute':
      await fullRecompute(env);
      break;
  }
}

export async function scheduledRecompute(env: Env): Promise<void> {
  await fullRecompute(env);
}

async function fullRecompute(env: Env): Promise<void> {
  const rows = await fetchDeltas(env.DB);
  const { byChemotype, byCultivar } = buildBuckets(rows);
  await persist(env.DB, byChemotype, byCultivar);
}

async function fetchDeltas(db: D1Database): Promise<RowDelta[]> {
  // Pull pre + post pairs joined with chemotype, cultivar, and the SCALE'S
  // condition_code (from rating_scale, not from patient_condition).
  //
  // The bucket condition is determined by the scale itself: condition-specific
  // scales (e.g. task_initiation → 'adhd') populate that condition's bucket;
  // core scales (e.g. focus, mood) populate a single 'core' bucket. This means
  // each (session, scale) pair contributes exactly ONE delta to one bucket.
  //
  // Earlier versions of this query joined `patient_condition` instead of
  // `rating_scale`, which fanned every session out across every condition the
  // patient had registered — multi-counting deltas in patients with multiple
  // conditions and dropping patients with no conditions. That bug corrupted
  // n_sessions and delta_mean on the public aggregate endpoint.
  const result = await db
    .prepare(
      `WITH sess AS (
         SELECT s.id, s.patient_id, b.cultivar_id, bc.classification AS chemotype
         FROM session s
         JOIN batch b ON s.batch_id = b.id
         LEFT JOIN batch_chemotype bc ON bc.batch_id = b.id
         JOIN patient p ON s.patient_id = p.id
         WHERE s.voided = 0 AND p.consent_aggregate = 1
       ),
       counts AS (
         SELECT patient_id, COUNT(*) AS n FROM sess GROUP BY patient_id
       ),
       qualifying AS (
         SELECT s.* FROM sess s
         JOIN counts c ON c.patient_id = s.patient_id
         WHERE c.n >= ?1
       ),
       pre_post AS (
         SELECT q.id AS session_id, q.patient_id, q.chemotype, q.cultivar_id,
                pre.scale_code, pre.value AS pre, post.value AS post
         FROM qualifying q
         JOIN rating pre  ON pre.session_id  = q.id AND pre.phase  = 'pre'
         JOIN rating post ON post.session_id = q.id AND post.phase = 'post'
                          AND post.scale_code = pre.scale_code
       )
       SELECT pp.patient_id, pp.chemotype, pp.cultivar_id,
              COALESCE(rs.condition_code, 'core') AS condition_code,
              pp.scale_code, pp.pre, pp.post
       FROM pre_post pp
       LEFT JOIN rating_scale rs ON rs.code = pp.scale_code`
    )
    .bind(MIN_SESSIONS_PER_PATIENT)
    .all<RowDelta>();

  return (result.results ?? []) as RowDelta[];
}

export interface Bucket {
  deltas: number[];
  patients: Set<string>;
}

interface BucketKey {
  primary: string;
  condition: string;
  scale: string;
}

/**
 * Group RowDelta entries into chemotype- and cultivar-keyed buckets. Each
 * (session, scale) pair contributes exactly ONE delta to ONE bucket, keyed by
 * (chemotype-or-cultivar, condition_code, scale_code). The condition_code is
 * the SCALE's condition (or 'core' for non-condition-specific scales) — never
 * the patient's, which would multi-count for multi-condition patients.
 *
 * Exported for unit testing.
 */
export function buildBuckets(rows: RowDelta[]) {
  const byChemotype = new Map<string, Bucket>();
  const byCultivar = new Map<string, Bucket>();

  const keyOf = (k: BucketKey) => `${k.primary}|${k.condition}|${k.scale}`;

  for (const r of rows) {
    if (!r.chemotype) continue; // chemotype is required; condition_code is now never null (COALESCE'd)
    const delta = r.post - r.pre;
    const condition = r.condition_code ?? 'core';

    const ck: BucketKey = { primary: r.chemotype, condition, scale: r.scale_code };
    const cb = byChemotype.get(keyOf(ck)) ?? { deltas: [], patients: new Set() };
    cb.deltas.push(delta);
    cb.patients.add(r.patient_id);
    byChemotype.set(keyOf(ck), cb);

    const uk: BucketKey = { primary: r.cultivar_id, condition, scale: r.scale_code };
    const ub = byCultivar.get(keyOf(uk)) ?? { deltas: [], patients: new Set() };
    ub.deltas.push(delta);
    ub.patients.add(r.patient_id);
    byCultivar.set(keyOf(uk), ub);
  }

  return { byChemotype, byCultivar };
}

async function persist(
  db: D1Database,
  byChemotype: Map<string, Bucket>,
  byCultivar: Map<string, Bucket>
): Promise<void> {
  const now = Date.now();
  const stmts: D1PreparedStatement[] = [];

  // Wipe + reinsert. D1 has no SAVEPOINT/transaction at the SDK level, so
  // do this in a batch which is atomic at the wire level.
  stmts.push(db.prepare('DELETE FROM agg_chemotype_outcome'));
  stmts.push(db.prepare('DELETE FROM agg_cultivar_outcome'));

  for (const [k, b] of byChemotype) {
    const parts = k.split('|');
    const chemotype = parts[0]!;
    const condition_code = parts[1]!;
    const scale_code = parts[2]!;
    const stats = stats1d(b.deltas);
    stmts.push(
      db
        .prepare(
          `INSERT INTO agg_chemotype_outcome
             (id, chemotype, condition_code, scale_code, n_sessions, n_patients,
              delta_mean, delta_median, delta_sd, computed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          nanoid(16),
          chemotype,
          condition_code,
          scale_code,
          b.deltas.length,
          b.patients.size,
          stats.mean,
          stats.median,
          stats.sd,
          now
        )
    );
  }

  for (const [k, b] of byCultivar) {
    const parts = k.split('|');
    const cultivar_id = parts[0]!;
    const condition_code = parts[1]!;
    const scale_code = parts[2]!;
    const stats = stats1d(b.deltas);
    stmts.push(
      db
        .prepare(
          `INSERT INTO agg_cultivar_outcome
             (id, cultivar_id, condition_code, scale_code, n_sessions, n_patients,
              delta_mean, delta_median, delta_sd, computed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          nanoid(16),
          cultivar_id,
          condition_code,
          scale_code,
          b.deltas.length,
          b.patients.size,
          stats.mean,
          stats.median,
          stats.sd,
          now
        )
    );
  }

  if (stmts.length > 0) await db.batch(stmts);
}

function stats1d(values: number[]): { mean: number | null; median: number | null; sd: number | null } {
  if (values.length === 0) return { mean: null, median: null, sd: null };
  const sum = values.reduce((s, v) => s + v, 0);
  const mean = sum / values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return {
    mean: round(mean),
    median: round(median),
    sd: round(Math.sqrt(variance)),
  };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
