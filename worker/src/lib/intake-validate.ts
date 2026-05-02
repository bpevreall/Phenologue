/**
 * Intake validation helpers — pure functions, shared between the form-based
 * session-create flow and the coach-mode draft/commit flow.
 *
 * No D1, no Env, no I/O. These are easy to unit-test and deliberately have
 * zero coupling to the request lifecycle. The route handlers compose these
 * helpers; the coach (eventually) uses them to decide what to ask next.
 *
 * Methodology source of truth: docs/02-phenologue-methodology.md §3 (session
 * core), §5 (purpose tagging), §4 (route + dose).
 */

// =============================================================
// Types
// =============================================================

export type Route = 'vape' | 'oil' | 'edible' | 'other';

export interface PreRating {
  scale_code: string;
  value: number;
}

export interface DraftState {
  cultivar_id?: string;
  batch_id?: string;
  pre_ratings?: PreRating[];
  purpose_tags?: string[];
  route?: Route;
  vape_temp_c?: number;
  dose_grams?: number;
  pre_note?: string;
}

export interface IntakeValidationError {
  field: string;
  code: string;
  message: string;
}

export interface IntakeValidationResult {
  valid: boolean;
  errors: IntakeValidationError[];
  /** Required fields that have not yet been provided. */
  required_missing: string[];
}

// =============================================================
// Controlled vocabularies (methodology v0.1)
// =============================================================

/** §5: purpose tag controlled vocabulary. */
export const PURPOSE_TAG_VOCABULARY: ReadonlyArray<string> = [
  'focus',
  'creativity',
  'physical_activity',
  'social',
  'relaxation',
  'sleep_prep',
  'pain_management',
  'anxiety_management',
  'appetite_stimulation',
  'recreational',
  'exploratory',
];

/** §4: route enum. */
export const ROUTE_VOCABULARY: ReadonlyArray<Route> = ['vape', 'oil', 'edible', 'other'];

// =============================================================
// Validation
// =============================================================

/**
 * Validate a DraftState as if it were about to be committed to a `session`
 * row. Returns the full set of validation errors plus a list of fields that
 * are still missing — the coach uses `required_missing` to decide which
 * field to ask the user about next.
 */
export function validateDraftForCommit(draft: DraftState): IntakeValidationResult {
  const errors: IntakeValidationError[] = [];
  const requiredMissing: string[] = [];

  // batch_id — required
  if (!draft.batch_id) {
    requiredMissing.push('batch_id');
  }

  // pre_ratings — required, at least one
  if (!draft.pre_ratings || draft.pre_ratings.length === 0) {
    requiredMissing.push('pre_ratings');
  } else {
    draft.pre_ratings.forEach((r, i) => {
      if (!r || typeof r !== 'object') {
        errors.push({
          field: `pre_ratings[${i}]`,
          code: 'invalid_pre_rating',
          message: 'pre_rating must be an object with scale_code and value',
        });
        return;
      }
      if (!r.scale_code || typeof r.scale_code !== 'string') {
        errors.push({
          field: `pre_ratings[${i}].scale_code`,
          code: 'invalid_scale_code',
          message: 'scale_code must be a non-empty string',
        });
      }
      if (!Number.isInteger(r.value) || r.value < 0 || r.value > 10) {
        errors.push({
          field: `pre_ratings[${i}].value`,
          code: 'rating_out_of_range',
          message: 'pre_rating value must be an integer between 0 and 10',
        });
      }
    });
  }

  // purpose_tags — optional; if present, every tag must be in the vocabulary
  if (draft.purpose_tags !== undefined) {
    if (!Array.isArray(draft.purpose_tags)) {
      errors.push({
        field: 'purpose_tags',
        code: 'invalid_type',
        message: 'purpose_tags must be an array',
      });
    } else {
      for (const tag of draft.purpose_tags) {
        if (!PURPOSE_TAG_VOCABULARY.includes(tag)) {
          errors.push({
            field: 'purpose_tags',
            code: 'unknown_purpose_tag',
            message: `'${tag}' is not in the purpose tag vocabulary`,
          });
        }
      }
    }
  }

  // route — optional; if present, must be enum
  if (draft.route !== undefined && !ROUTE_VOCABULARY.includes(draft.route)) {
    errors.push({
      field: 'route',
      code: 'invalid_route',
      message: `route must be one of: ${ROUTE_VOCABULARY.join(', ')}`,
    });
  }

  // vape_temp_c — only valid if route === 'vape'; range 100–250
  if (draft.vape_temp_c !== undefined) {
    if (draft.route !== 'vape') {
      errors.push({
        field: 'vape_temp_c',
        code: 'route_mismatch',
        message: 'vape_temp_c is only valid when route = vape',
      });
    }
    if (
      typeof draft.vape_temp_c !== 'number' ||
      draft.vape_temp_c < 100 ||
      draft.vape_temp_c > 250
    ) {
      errors.push({
        field: 'vape_temp_c',
        code: 'temp_out_of_range',
        message: 'vape_temp_c must be a number between 100 and 250',
      });
    }
  }

  // dose_grams — optional; if present, must be a positive number
  if (draft.dose_grams !== undefined) {
    if (typeof draft.dose_grams !== 'number' || draft.dose_grams < 0) {
      errors.push({
        field: 'dose_grams',
        code: 'invalid_dose',
        message: 'dose_grams must be a non-negative number',
      });
    }
  }

  return {
    valid: errors.length === 0 && requiredMissing.length === 0,
    errors,
    required_missing: requiredMissing,
  };
}

/**
 * Merge a Partial<DraftState> patch into the current state. Undefined keys
 * in the patch are dropped (i.e. they do NOT clobber existing values).
 * Defined keys — including `null`-ish — overwrite.
 *
 * Arrays are replaced wholesale, not concatenated. The coach is expected
 * to send the full intended array on each patch.
 */
export function mergeDraft(
  current: DraftState,
  patch: Partial<DraftState>
): DraftState {
  const out: DraftState = { ...current };
  for (const key of Object.keys(patch) as Array<keyof DraftState>) {
    const value = patch[key];
    if (value !== undefined) {
      // Type-system gymnastics: assign the value through the union without
      // narrowing each branch individually.
      (out as Record<string, unknown>)[key as string] = value;
    }
  }
  return out;
}
