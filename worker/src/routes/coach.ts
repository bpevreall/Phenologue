/**
 * Coach routes — conversational intake stub (Stream D).
 *
 * v0.1 contains a stub only. The endpoint shape is fixed so that frontend
 * code (Stream A) can wire against it now; the LLM call lands in v0.2.
 *
 * v0.2 implementation plan (DO NOT BUILD YET):
 *   1. Receive { draft_id, user_message }.
 *   2. Authenticate via requireAuth() (already wired in index.ts).
 *   3. Load the session_draft row, verify ownership and that it is open
 *      (not committed, not voided).
 *   4. Format a prompt for the model:
 *        - System prompt: methodology v0.1 rules + DraftState schema +
 *          purpose-tag/route vocabularies (importable from
 *          ../lib/intake-validate).
 *        - Conversation history (parked alongside the draft, or in a
 *          separate session_draft_message table — TBD in v0.2 design).
 *        - Current DraftState + IntakeValidationResult so the model knows
 *          what is still missing.
 *        - The new user_message.
 *   5. Call the LLM. Provider TBD — most likely Anthropic API via fetch
 *      (using c.env.ANTHROPIC_API_KEY) or Cloudflare Workers AI binding
 *      (c.env.AI). Either way, add the binding to env.ts and wrangler.toml
 *      as part of v0.2.
 *   6. Parse the model's structured output. The model returns JSON of the
 *      form { assistant_message: string, draft_patches: Partial<DraftState>[] }.
 *      Reject outputs that don't validate against that schema.
 *   7. Apply draft_patches by calling mergeDraft() and writing the new
 *      draft_json. This must be the SAME merge semantics as PATCH
 *      /api/sessions/intake/:id so behavior is consistent.
 *   8. Return { assistant_message, draft_patches, draft } to the client.
 *
 * Until then this stub returns a hard-coded message and an empty patch list,
 * keeping the API surface stable.
 */

import { Hono } from 'hono';
import type { Env, ContextVars } from '../env';
import { badRequest } from '../lib/errors';

const coachRoutes = new Hono<{ Bindings: Env; Variables: ContextVars }>();

interface CoachIntakeBody {
  draft_id: string;
  user_message: string;
}

// =============================================================
// POST /api/coach/intake — stub (v0.2 will wire the LLM)
// =============================================================
coachRoutes.post('/intake', async (c) => {
  let body: Partial<CoachIntakeBody> = {};
  try {
    const parsed = await c.req.json();
    if (parsed && typeof parsed === 'object') body = parsed as Partial<CoachIntakeBody>;
  } catch {
    return badRequest(c, 'Request body must be valid JSON');
  }

  if (!body.draft_id || typeof body.draft_id !== 'string') {
    return badRequest(c, 'draft_id is required', 'draft_id');
  }
  if (typeof body.user_message !== 'string') {
    return badRequest(c, 'user_message is required', 'user_message');
  }

  return c.json({
    data: {
      assistant_message:
        'Coach mode is not yet enabled in v0.1. Please use the form-based session create at /dashboard/sessions/new.',
      draft_patches: [],
    },
  });
});

export { coachRoutes };
