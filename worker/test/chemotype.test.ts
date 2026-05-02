import { describe, expect, it } from 'vitest';
import { computeChemotype, type BatchTerpeneRow } from '../src/lib/chemotype';

const empty: BatchTerpeneRow = {
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
};

describe('computeChemotype', () => {
  it('returns unclassified for an empty profile', () => {
    expect(computeChemotype(empty)).toMatchObject({
      classification: 'unclassified',
      dominant_terpene: null,
    });
  });

  it('classifies as <terpene>-dominant when one terpene is over 25% share', () => {
    const result = computeChemotype({
      ...empty,
      terp_limonene: 1.0,
      terp_pinene_a: 0.3,
      terp_pinene_b: 0.1,
      terp_myrcene: 0.2,
    });
    expect(result.dominant_terpene).toBe('limonene');
    expect(result.classification).toBe('limonene-dominant');
    expect(result.secondary_terpene).toBe('pinene');
  });

  it('sums α + β pinene into a single pinene bucket', () => {
    const result = computeChemotype({
      ...empty,
      terp_pinene_a: 0.6,
      terp_pinene_b: 0.4,
      terp_myrcene: 0.2,
    });
    expect(result.dominant_terpene).toBe('pinene');
    expect(result.dominant_pct).toBe(1);
  });

  it('classifies as mixed when no terpene reaches 25% share', () => {
    const result = computeChemotype({
      ...empty,
      terp_limonene: 0.2,
      terp_myrcene: 0.2,
      terp_caryophyllene: 0.2,
      terp_linalool: 0.2,
      terp_humulene: 0.2,
    });
    expect(result.classification).toBe('mixed');
  });

  it('matches the founder L.A. S.A.G.E. inferred profile', () => {
    // Limonene-dominant / pinene-secondary, per docs §12.
    const result = computeChemotype({
      ...empty,
      terp_limonene: 0.55,
      terp_pinene_a: 0.18,
      terp_pinene_b: 0.06,
      terp_myrcene: 0.08,
      terp_linalool: 0.03,
    });
    expect(result.dominant_terpene).toBe('limonene');
    expect(result.secondary_terpene).toBe('pinene');
    expect(result.classification).toBe('limonene-dominant');
  });

  it('matches the founder Karamel Kandy inferred profile', () => {
    // Caryophyllene-dominant / myrcene-secondary, per docs §12.
    const result = computeChemotype({
      ...empty,
      terp_caryophyllene: 0.45,
      terp_myrcene: 0.22,
      terp_limonene: 0.08,
      terp_humulene: 0.05,
    });
    expect(result.dominant_terpene).toBe('caryophyllene');
    expect(result.secondary_terpene).toBe('myrcene');
    expect(result.classification).toBe('caryophyllene-dominant');
  });
});
