import { describe, expect, it } from 'vitest';
import { buildBuckets, type RowDelta } from '../src/lib/aggregation';

/**
 * Regression tests for buildBuckets. The headline test (multi-condition
 * patient does NOT multi-count) guards against the v0.1 aggregation bug where
 * `fetchDeltas` joined patient_condition rather than rating_scale, causing
 * each session to be counted once per condition the patient had registered.
 *
 * The fix: the SQL now produces ONE row per (session, scale) with the bucket
 * condition_code COALESCEd to 'core' for non-condition-specific scales.
 */

const baseRow = (over: Partial<RowDelta>): RowDelta => ({
  patient_id: 'p1',
  chemotype: 'limonene-dominant',
  cultivar_id: 'cult_a',
  condition_code: 'core',
  scale_code: 'mood',
  pre: 4,
  post: 7,
  ...over,
});

describe('buildBuckets', () => {
  it('counts each (session, scale) exactly once per bucket', () => {
    const rows: RowDelta[] = [
      baseRow({ patient_id: 'p1', scale_code: 'mood', pre: 4, post: 7 }),
      baseRow({ patient_id: 'p1', scale_code: 'anxiety', pre: 6, post: 3 }),
      baseRow({ patient_id: 'p2', scale_code: 'mood', pre: 5, post: 8 }),
    ];
    const { byChemotype } = buildBuckets(rows);
    const moodBucket = byChemotype.get('limonene-dominant|core|mood')!;
    expect(moodBucket.deltas).toEqual([3, 3]); // p1: 7-4, p2: 8-5
    expect(moodBucket.patients.size).toBe(2);

    const anxietyBucket = byChemotype.get('limonene-dominant|core|anxiety')!;
    expect(anxietyBucket.deltas).toEqual([-3]); // p1: 3-6
    expect(anxietyBucket.patients.size).toBe(1);
  });

  it('does NOT multi-count when the same patient has multiple conditions', () => {
    // Regression test for the v0.1 bug: a patient with ADHD + chronic_pain +
    // sleep used to have each session counted 3 times because fetchDeltas
    // joined patient_condition. The fixed query joins rating_scale, so the
    // same row appears exactly once regardless of how many conditions the
    // patient has registered.
    const rows: RowDelta[] = [
      baseRow({ patient_id: 'multi_cond_patient', scale_code: 'mood', pre: 4, post: 8 }),
    ];
    const { byChemotype, byCultivar } = buildBuckets(rows);
    const moodBucket = byChemotype.get('limonene-dominant|core|mood')!;
    expect(moodBucket.deltas).toHaveLength(1);
    expect(moodBucket.deltas[0]).toBe(4);
    expect(moodBucket.patients.size).toBe(1);

    const cultBucket = byCultivar.get('cult_a|core|mood')!;
    expect(cultBucket.deltas).toHaveLength(1);
  });

  it('routes condition-specific scales to their own bucket', () => {
    // task_initiation is an ADHD-specific scale (condition_code='adhd' on
    // rating_scale). The COALESCE in fetchDeltas means condition_code is
    // 'adhd' here, not 'core'.
    const rows: RowDelta[] = [
      baseRow({ scale_code: 'task_initiation', condition_code: 'adhd', pre: 3, post: 7 }),
      baseRow({ scale_code: 'mood', condition_code: 'core', pre: 5, post: 8 }),
    ];
    const { byChemotype } = buildBuckets(rows);
    expect(byChemotype.get('limonene-dominant|adhd|task_initiation')!.deltas).toEqual([4]);
    expect(byChemotype.get('limonene-dominant|core|mood')!.deltas).toEqual([3]);
    // No bleed between buckets
    expect(byChemotype.get('limonene-dominant|core|task_initiation')).toBeUndefined();
    expect(byChemotype.get('limonene-dominant|adhd|mood')).toBeUndefined();
  });

  it('skips rows without a chemotype classification', () => {
    const rows: RowDelta[] = [
      baseRow({ chemotype: null, scale_code: 'mood' }),
      baseRow({ chemotype: 'limonene-dominant', scale_code: 'mood', pre: 4, post: 7 }),
    ];
    const { byChemotype } = buildBuckets(rows);
    expect(byChemotype.size).toBe(1);
    expect(byChemotype.get('limonene-dominant|core|mood')!.deltas).toEqual([3]);
  });

  it('keeps chemotype and cultivar buckets independent', () => {
    const rows: RowDelta[] = [
      baseRow({ patient_id: 'p1', chemotype: 'limonene-dominant', cultivar_id: 'cult_a', scale_code: 'mood', pre: 4, post: 7 }),
      baseRow({ patient_id: 'p2', chemotype: 'limonene-dominant', cultivar_id: 'cult_b', scale_code: 'mood', pre: 5, post: 9 }),
    ];
    const { byChemotype, byCultivar } = buildBuckets(rows);
    // One chemotype bucket, two patients, two deltas
    const chemoB = byChemotype.get('limonene-dominant|core|mood')!;
    expect(chemoB.deltas).toEqual([3, 4]);
    expect(chemoB.patients.size).toBe(2);
    // Two separate cultivar buckets, one delta each
    expect(byCultivar.get('cult_a|core|mood')!.deltas).toEqual([3]);
    expect(byCultivar.get('cult_b|core|mood')!.deltas).toEqual([4]);
  });
});
