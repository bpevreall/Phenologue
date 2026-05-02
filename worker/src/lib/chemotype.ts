/**
 * Chemotype computation — methodology v0.1.
 *
 * Given a batch's terpene profile (% w/w), determines:
 *   - dominant terpene + dominant share of total terpene mass
 *   - secondary terpene + share
 *   - classification: '<dominant>-dominant' or 'mixed' if no terpene
 *     accounts for at least 25% of total terpene mass.
 *
 * batch_chemotype is populated and refreshed entirely from app code via
 * refreshBatchChemotype(). An earlier version of the schema did this in a SQL
 * trigger, but the necessary CASE/UNION expression exceeded D1's compound-
 * select limit, so the Worker is the single source of truth. Every code path
 * that writes to the `batch` table MUST call refreshBatchChemotype after the
 * write.
 */

export type TerpeneCode =
  | 'pinene'
  | 'myrcene'
  | 'limonene'
  | 'terpinolene'
  | 'linalool'
  | 'caryophyllene'
  | 'humulene'
  | 'ocimene'
  | 'bisabolol'
  | 'farnesene';

export interface BatchTerpeneRow {
  terp_pinene_a: number | null;
  terp_pinene_b: number | null;
  terp_myrcene: number | null;
  terp_limonene: number | null;
  terp_terpinolene: number | null;
  terp_linalool: number | null;
  terp_caryophyllene: number | null;
  terp_humulene: number | null;
  terp_ocimene: number | null;
  terp_bisabolol: number | null;
  terp_farnesene: number | null;
}

export interface Chemotype {
  dominant_terpene: TerpeneCode | null;
  dominant_pct: number | null;
  secondary_terpene: TerpeneCode | null;
  secondary_pct: number | null;
  classification: string;
  total_pct: number;
}

// Methodology v0.1 §2.3: a terpene is "dominant" if it accounts for at least 25%
// of total terpene mass. The threshold is a chosen parameter, not a discovered
// truth — Hazekamp & Fischedick 2012 (Drug Test Anal, doi:10.1002/dta.407) used
// PCA-based clustering rather than a fixed threshold; Herwig et al. 2024 (Cannabis
// Cannabinoid Res, doi:10.1089/can.2024.0127) used hierarchical clustering across
// 140 medicinal flowers. 0.25 is permissive (more cultivars classified vs. mixed)
// and appropriate for v0.1's small dataset. Methodology v0.2 will publish a
// sensitivity analysis once the dataset supports it.
const DOMINANCE_THRESHOLD = 0.25;

export function computeChemotype(b: BatchTerpeneRow): Chemotype {
  const buckets: Array<[TerpeneCode, number]> = [
    ['pinene', (b.terp_pinene_a ?? 0) + (b.terp_pinene_b ?? 0)],
    ['myrcene', b.terp_myrcene ?? 0],
    ['limonene', b.terp_limonene ?? 0],
    ['terpinolene', b.terp_terpinolene ?? 0],
    ['linalool', b.terp_linalool ?? 0],
    ['caryophyllene', b.terp_caryophyllene ?? 0],
    ['humulene', b.terp_humulene ?? 0],
    ['ocimene', b.terp_ocimene ?? 0],
    ['bisabolol', b.terp_bisabolol ?? 0],
    ['farnesene', b.terp_farnesene ?? 0],
  ];

  const present = buckets.filter(([, v]) => v > 0).sort((a, z) => z[1] - a[1]);
  const total = present.reduce((s, [, v]) => s + v, 0);

  if (present.length === 0 || total === 0) {
    return {
      dominant_terpene: null,
      dominant_pct: null,
      secondary_terpene: null,
      secondary_pct: null,
      classification: 'unclassified',
      total_pct: 0,
    };
  }

  const [domName, domPct] = present[0]!;
  const second = present[1];

  const domShare = domPct / total;
  const classification =
    domShare >= DOMINANCE_THRESHOLD ? `${domName}-dominant` : 'mixed';

  return {
    dominant_terpene: domName,
    dominant_pct: round(domPct),
    secondary_terpene: second?.[0] ?? null,
    secondary_pct: second ? round(second[1]) : null,
    classification,
    total_pct: round(total),
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Refresh batch_chemotype for a given batch from the canonical batch row.
 * The SQL trigger writes top-two terpenes on every batch UPDATE, so calling
 * this only stamps the classification (which the trigger cannot compute
 * without the % threshold logic).
 */
export async function refreshBatchChemotype(
  db: D1Database,
  batchId: string
): Promise<Chemotype | null> {
  const row = await db
    .prepare(
      `SELECT terp_pinene_a, terp_pinene_b, terp_myrcene, terp_limonene,
              terp_terpinolene, terp_linalool, terp_caryophyllene,
              terp_humulene, terp_ocimene, terp_bisabolol, terp_farnesene
       FROM batch WHERE id = ?`
    )
    .bind(batchId)
    .first<BatchTerpeneRow>();

  if (!row) return null;

  const chemo = computeChemotype(row);
  const now = Date.now();

  // The trigger only stamps top-two terpene names + their %, leaving
  // classification NULL. We patch it here so app reads see a complete row.
  await db
    .prepare(
      `INSERT INTO batch_chemotype (batch_id, dominant_terpene, dominant_pct,
                                    secondary_terpene, secondary_pct,
                                    classification, computed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (batch_id) DO UPDATE SET
         dominant_terpene  = excluded.dominant_terpene,
         dominant_pct      = excluded.dominant_pct,
         secondary_terpene = excluded.secondary_terpene,
         secondary_pct     = excluded.secondary_pct,
         classification    = excluded.classification,
         computed_at       = excluded.computed_at`
    )
    .bind(
      batchId,
      chemo.dominant_terpene,
      chemo.dominant_pct,
      chemo.secondary_terpene,
      chemo.secondary_pct,
      chemo.classification,
      now
    )
    .run();

  return chemo;
}
