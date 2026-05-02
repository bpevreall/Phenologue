/**
 * Unit tests for intake-validate.ts — pure validation/merge functions used by
 * both the form-based and coach-mode session intake paths.
 *
 * No D1, no Env. Pure-function coverage of methodology v0.1 rules.
 */

import { describe, expect, it } from 'vitest';
import {
  type DraftState,
  mergeDraft,
  PURPOSE_TAG_VOCABULARY,
  ROUTE_VOCABULARY,
  validateDraftForCommit,
} from '../src/lib/intake-validate';

describe('validateDraftForCommit', () => {
  it('reports batch_id and pre_ratings as missing on an empty draft', () => {
    const result = validateDraftForCommit({});
    expect(result.valid).toBe(false);
    expect(result.required_missing).toEqual(
      expect.arrayContaining(['batch_id', 'pre_ratings'])
    );
    expect(result.required_missing).toHaveLength(2);
    expect(result.errors).toEqual([]);
  });

  it('returns valid for a minimal complete draft (batch + one pre_rating)', () => {
    const result = validateDraftForCommit({
      batch_id: 'batch_x',
      pre_ratings: [{ scale_code: 'mood', value: 5 }],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.required_missing).toEqual([]);
  });

  it('rejects a pre_rating value above the 0-10 range', () => {
    const result = validateDraftForCommit({
      batch_id: 'batch_x',
      pre_ratings: [{ scale_code: 'mood', value: 11 }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'pre_ratings[0].value',
          code: 'rating_out_of_range',
        }),
      ])
    );
  });

  it('rejects a pre_rating value below 0', () => {
    const result = validateDraftForCommit({
      batch_id: 'batch_x',
      pre_ratings: [{ scale_code: 'mood', value: -1 }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('rating_out_of_range');
  });

  it('rejects a non-integer pre_rating value', () => {
    const result = validateDraftForCommit({
      batch_id: 'batch_x',
      pre_ratings: [{ scale_code: 'mood', value: 5.5 }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('rating_out_of_range');
  });

  it('rejects a purpose_tag not in the controlled vocabulary', () => {
    const result = validateDraftForCommit({
      batch_id: 'batch_x',
      pre_ratings: [{ scale_code: 'mood', value: 5 }],
      purpose_tags: ['focus', 'NOT_A_REAL_TAG'],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'purpose_tags',
          code: 'unknown_purpose_tag',
        }),
      ])
    );
  });

  it('accepts every tag in the documented vocabulary', () => {
    const result = validateDraftForCommit({
      batch_id: 'batch_x',
      pre_ratings: [{ scale_code: 'mood', value: 5 }],
      purpose_tags: [...PURPOSE_TAG_VOCABULARY],
    });
    expect(result.valid).toBe(true);
  });

  it('rejects an invalid route value', () => {
    const result = validateDraftForCommit({
      batch_id: 'batch_x',
      pre_ratings: [{ scale_code: 'mood', value: 5 }],
      route: 'smoke' as unknown as DraftState['route'],
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('invalid_route');
  });

  it('rejects vape_temp_c when route is not vape', () => {
    const result = validateDraftForCommit({
      batch_id: 'batch_x',
      pre_ratings: [{ scale_code: 'mood', value: 5 }],
      route: 'oil',
      vape_temp_c: 180,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'route_mismatch' }),
      ])
    );
  });

  it('accepts vape_temp_c in the 100-250 range when route is vape', () => {
    const result = validateDraftForCommit({
      batch_id: 'batch_x',
      pre_ratings: [{ scale_code: 'mood', value: 5 }],
      route: 'vape',
      vape_temp_c: 180,
    });
    expect(result.valid).toBe(true);
  });

  it('rejects vape_temp_c outside the 100-250 range', () => {
    const result = validateDraftForCommit({
      batch_id: 'batch_x',
      pre_ratings: [{ scale_code: 'mood', value: 5 }],
      route: 'vape',
      vape_temp_c: 99,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'temp_out_of_range' }),
      ])
    );
  });

  it('exposes the route vocabulary in error messages for invalid routes', () => {
    const result = validateDraftForCommit({
      batch_id: 'batch_x',
      pre_ratings: [{ scale_code: 'mood', value: 5 }],
      route: 'bong' as unknown as DraftState['route'],
    });
    const routeErr = result.errors.find((e) => e.code === 'invalid_route')!;
    for (const r of ROUTE_VOCABULARY) {
      expect(routeErr.message).toContain(r);
    }
  });
});

describe('mergeDraft', () => {
  it('merges patches without dropping unrelated fields', () => {
    const current: DraftState = {
      batch_id: 'batch_x',
      pre_ratings: [{ scale_code: 'mood', value: 5 }],
      purpose_tags: ['focus'],
    };
    const merged = mergeDraft(current, { route: 'vape', vape_temp_c: 180 });
    expect(merged.batch_id).toBe('batch_x');
    expect(merged.pre_ratings).toEqual([{ scale_code: 'mood', value: 5 }]);
    expect(merged.purpose_tags).toEqual(['focus']);
    expect(merged.route).toBe('vape');
    expect(merged.vape_temp_c).toBe(180);
  });

  it('overwrites existing fields when the patch defines them', () => {
    const current: DraftState = {
      batch_id: 'batch_x',
      route: 'oil',
    };
    const merged = mergeDraft(current, { route: 'vape' });
    expect(merged.route).toBe('vape');
    expect(merged.batch_id).toBe('batch_x');
  });

  it('replaces arrays wholesale rather than concatenating', () => {
    const current: DraftState = {
      purpose_tags: ['focus', 'creativity'],
      pre_ratings: [{ scale_code: 'mood', value: 4 }],
    };
    const merged = mergeDraft(current, {
      purpose_tags: ['sleep_prep'],
    });
    expect(merged.purpose_tags).toEqual(['sleep_prep']);
    // Untouched array unchanged
    expect(merged.pre_ratings).toEqual([{ scale_code: 'mood', value: 4 }]);
  });

  it('ignores undefined keys in the patch', () => {
    const current: DraftState = { batch_id: 'batch_x' };
    const merged = mergeDraft(current, { batch_id: undefined });
    expect(merged.batch_id).toBe('batch_x');
  });

  it('does not mutate the input objects', () => {
    const current: DraftState = { batch_id: 'batch_x' };
    const patch: Partial<DraftState> = { route: 'vape' };
    const merged = mergeDraft(current, patch);
    expect(current).toEqual({ batch_id: 'batch_x' });
    expect(patch).toEqual({ route: 'vape' });
    expect(merged).not.toBe(current);
  });

  it('starts from an empty state when current is empty', () => {
    const merged = mergeDraft(
      {},
      { batch_id: 'batch_x', pre_ratings: [{ scale_code: 'mood', value: 5 }] }
    );
    expect(merged).toEqual({
      batch_id: 'batch_x',
      pre_ratings: [{ scale_code: 'mood', value: 5 }],
    });
  });
});
