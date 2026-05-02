/**
 * Organoleptic inference — methodology v0.1 §7.2.
 *
 * Given a list of patient-reported aroma descriptors (`lemon`, `pine`,
 * `lavender`, ...), looks up the descriptor map in the DB and returns an
 * inferred terpene profile suitable for population into batch.terp_* columns
 * when no COA is available.
 *
 * Every batch inferred this way MUST have measurement_status='inferred'.
 * The Worker enforces this; the DB does not.
 *
 * The math:
 *   1. Each descriptor maps to a primary terpene with a confidence weight.
 *   2. Weights for the same terpene are summed across descriptors.
 *   3. Final values are normalised so the total approximates a typical
 *      cannabis terpene total of 1.5% w/w (configurable via `targetTotalPct`).
 *
 * This is a coarse model. It is documented as such. The flag `inferred` is
 * the contract; callers must never present these as measured.
 */

import type { TerpeneCode } from './chemotype';

interface DescriptorRow {
  descriptor_code: string;
  primary_terpene: TerpeneCode;
  weight: number;
}

export interface InferredProfile {
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
  terp_total_pct: number;
  inferred_from: string[];           // descriptor codes used
  unmapped_descriptors: string[];     // descriptors with no DB mapping
}

const DEFAULT_TOTAL_PCT = 1.5;

export async function inferTerpeneProfile(
  db: D1Database,
  descriptors: string[],
  targetTotalPct = DEFAULT_TOTAL_PCT
): Promise<InferredProfile> {
  if (descriptors.length === 0) {
    return emptyProfile();
  }

  const placeholders = descriptors.map(() => '?').join(',');
  const result = await db
    .prepare(
      `SELECT descriptor_code, primary_terpene, weight
       FROM terpene_descriptor_map
       WHERE descriptor_code IN (${placeholders})`
    )
    .bind(...descriptors)
    .all<DescriptorRow>();

  const rows = (result.results ?? []) as DescriptorRow[];

  // Bucket weights per terpene.
  const weights: Record<TerpeneCode, number> = {
    pinene: 0,
    myrcene: 0,
    limonene: 0,
    terpinolene: 0,
    linalool: 0,
    caryophyllene: 0,
    humulene: 0,
    ocimene: 0,
    bisabolol: 0,
    farnesene: 0,
  };

  const seenDescriptors = new Set<string>();
  for (const r of rows) {
    weights[r.primary_terpene] = (weights[r.primary_terpene] ?? 0) + r.weight;
    seenDescriptors.add(r.descriptor_code);
  }

  const unmapped = descriptors.filter((d) => !seenDescriptors.has(d));

  const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0);

  if (totalWeight === 0) {
    return { ...emptyProfile(), unmapped_descriptors: unmapped };
  }

  // Normalise to target total.
  const scale = targetTotalPct / totalWeight;

  // Pinene split: assume α/β-pinene roughly 70/30 in cannabis. This is an
  // approximation — the α:β ratio in cannabis chemovars varies roughly 60-80%
  // α-pinene per Booth et al. 2017 (PLoS ONE, doi:10.1371/journal.pone.0173911)
  // and Booth et al. 2020 (Plant Physiol, doi:10.1104/pp.20.00593). The ratio is
  // also genotype-dependent. 70/30 is a reasonable mid-point for v0.1 inference
  // when a COA is unavailable. Inferred values are flagged as such; never use
  // them where measured values are required.
  const pineneTotal = weights.pinene * scale;

  const profile: InferredProfile = {
    terp_pinene_a: round(pineneTotal * 0.7),
    terp_pinene_b: round(pineneTotal * 0.3),
    terp_myrcene: round(weights.myrcene * scale),
    terp_limonene: round(weights.limonene * scale),
    terp_terpinolene: round(weights.terpinolene * scale),
    terp_linalool: round(weights.linalool * scale),
    terp_caryophyllene: round(weights.caryophyllene * scale),
    terp_humulene: round(weights.humulene * scale),
    terp_ocimene: round(weights.ocimene * scale),
    terp_bisabolol: round(weights.bisabolol * scale),
    terp_farnesene: round(weights.farnesene * scale),
    terp_total_pct: round(targetTotalPct),
    inferred_from: descriptors.filter((d) => seenDescriptors.has(d)),
    unmapped_descriptors: unmapped,
  };

  // Replace zero values with null so SQL queries can distinguish
  // "not assessed" from "assessed at zero".
  return zeroToNull(profile);
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function emptyProfile(): InferredProfile {
  return {
    terp_pinene_a: null,
    terp_pinene_b: null,
    terp_myrcene: null,
    terp_limonene: null,
    terp_terpinolene: null,
    terp_linalool: null,
    terp_caryophyllene: null,
    terp_humulene: null,
    terp_ocimene: null,
    terp_bisabolol: null,
    terp_farnesene: null,
    terp_total_pct: 0,
    inferred_from: [],
    unmapped_descriptors: [],
  };
}

function zeroToNull(p: InferredProfile): InferredProfile {
  const fields: Array<keyof InferredProfile> = [
    'terp_pinene_a',
    'terp_pinene_b',
    'terp_myrcene',
    'terp_limonene',
    'terp_terpinolene',
    'terp_linalool',
    'terp_caryophyllene',
    'terp_humulene',
    'terp_ocimene',
    'terp_bisabolol',
    'terp_farnesene',
  ];
  const out: InferredProfile = { ...p };
  for (const f of fields) {
    if (out[f] === 0) (out as Record<string, unknown>)[f] = null;
  }
  return out;
}
