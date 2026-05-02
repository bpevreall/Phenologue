# Parallel Feature Development Plan

**Status**: planning · 2026-05-02
**Owner**: Brendon Pevreall
**Coordination**: agent-teams parallel-feature-development pattern

---

## Branch + environment topology

```
main  ────────────────────────────────────►  Pages prod (phenologue.pages.dev)
                                              Worker prod (phenologue-worker-prod)
                                              D1 prod (phenologue-prod)
                                              KV prod (phenologue-cache-prod)
                                              MAINTENANCE_MODE=true (Pages env)

dev   ────────────────────────────────────►  Pages dev (phenologue-dev.pages.dev)
                                              Worker dev (phenologue-worker-dev)
                                              D1 dev (phenologue-dev)
                                              KV dev (phenologue-dev-cache)
                                              MAINTENANCE_MODE unset
```

**Flow rule**: features land in `dev` first, get exercised on `phenologue-dev.pages.dev`, then merge to `main` for prod release. Prod stays in maintenance mode until the founder explicitly toggles `MAINTENANCE_MODE=false` on the prod Pages project.

**Migrations**: append-only. `wrangler d1 migrations apply phenologue-dev --env dev --remote` runs first; once verified, the same migration is applied to prod with `--env prod`.

---

## Workstreams (parallel-safe)

The remaining pre-launch work decomposes into 4 streams with **non-overlapping file ownership**, allowing parallel implementation by separate agents (or focused human sessions). Stream owners are assignable but the file boundaries are fixed.

### Stream A — UI uplift ("doesn't look like nothing")

**Goal**: address the UX review findings so the home page reads as a product, not a manuscript.

**Owner files (exclusive)**:
- `pages/src/routes/+page.svelte` — landing page (live counter strip, screenshot, hero)
- `pages/src/routes/dashboard/sessions/new/+page.svelte` — pre-ratings cut from 7 sliders to "core 3 + show more"
- `pages/src/routes/dashboard/quick-log/+page.svelte` — same pre-ratings cut
- `pages/src/routes/dashboard/sessions/[id]/+page.svelte` — kill `prompt('Reason for voiding…')`, build modal
- `pages/src/lib/components/StepBar.svelte` — NEW: numbered circles + line fill, replaces text-spans
- `pages/src/lib/components/VoidSessionModal.svelte` — NEW
- `pages/src/lib/styles/editorial.css` — `:focus-visible` fix, label contrast bump

**Reads but does not modify**: any `lib/` shared utility, `routes/about/`, layout files.

**Integration point**: `StepBar` and `VoidSessionModal` are new components owned by Stream A; other streams import but don't modify them.

### Stream B — Trust + identity

**Goal**: make the founder owning a non-clinician medical platform a credibility asset.

**Owner files (exclusive)**:
- `pages/src/routes/about/+page.svelte` — full rebuild: founder bio + photo + GitHub + GDPR contact + data lifecycle
- `pages/src/routes/methodology/+page.svelte` — citation list, PubMed links (mirror `docs/02-phenologue-methodology.md` §11)
- `pages/static/founder.jpg` — NEW asset
- `pages/src/routes/+layout.svelte` — footer enhancement: GitHub link, methodology link, contact email

**Reads but does not modify**: `docs/02-phenologue-methodology.md` (canonical source).

**Integration point**: footer changes in `+layout.svelte` overlap with Stream A (which doesn't touch the footer); split clearly.

### Stream C — Security hardening (pre-public-launch)

**Goal**: close the security findings before MAINTENANCE_MODE is flipped off.

**Owner files (exclusive)**:
- `worker/src/lib/jwt.ts` — `alg` header validation, `kid` support, fail-fast on unset key
- `worker/src/middleware/auth.ts` — apply boot-time secret assertion
- `worker/src/routes/auth.ts` — generic `/register` response (account-enumeration mitigation), constant-time password compare
- `worker/src/routes/patient.ts` — re-auth gate on `/export` and `DELETE /api/patient`
- `worker/src/routes/image.ts` — `requireAuth` middleware applied (image bypass fix)
- `worker/test/auth.test.ts` — NEW: regression tests for the above
- `worker/test/jwt.test.ts` — NEW: alg-confusion + tampered-token tests

**Reads but does not modify**: `env.ts`, `index.ts` (Stream D's territory).

**Integration point**: this stream may need to add a new context var; coordinate with Stream D via `env.ts` change request.

### Stream D — Coach-mode foundation

**Goal**: lay the rails for LLM-driven session intake without rewriting form-based pages.

**Owner files (exclusive)**:
- `worker/migrations/0004_session_draft.sql` — NEW: `session_draft` table
- `worker/src/routes/intake.ts` — NEW: `POST /api/sessions/intake`, `PATCH /:id`, `POST /:id/commit`
- `worker/src/routes/coach.ts` — NEW: stub coach route (LLM call deferred to v0.2-coach)
- `worker/src/index.ts` — wire new route mounts ← coordinate with Stream C
- `worker/src/lib/intake-validate.ts` — NEW: validation helpers shared between form and coach
- `worker/test/intake.test.ts` — NEW

**Reads but does not modify**: `worker/src/routes/session.ts` (existing form path stays untouched until coach-mode lands).

**Integration point**: new mounts in `index.ts` must merge cleanly with Stream C's middleware additions.

---

## Conflict-avoidance rules

1. **One owner per file.** If two streams need the same file, the one with deeper work owns it; the other requests changes via PR comment.

2. **Shared interfaces live in `worker/src/types/api.ts`** (NEW, owned by Stream C → Stream D). Both streams import; neither modifies after initial draft.

3. **`pages/src/lib/api.ts`** is owned by Stream A for response shape changes; Streams B/C/D do not modify.

4. **Migrations are sequential**, not parallel. Stream D's `0004_session_draft.sql` lands first; if Stream C needs schema changes (e.g. for image authz), they go in `0005`.

5. **All streams branch from `dev`**, not `main`. Work merges into `dev`, gets verified on `phenologue-dev.pages.dev`, then PRs to `main` together.

---

## Definition of done (per stream)

| Stream | Done when |
|---|---|
| A | Home page shows live counter strip + 1 screenshot · pre-ratings step cut to core 3 with "+ More scales" disclosure · `:focus-visible` visible on every interactive element · `prompt()` calls eliminated |
| B | About page has founder paragraph + photo + GitHub link + GDPR contact + data-lifecycle paragraph · methodology page renders citation list with DOI links · footer has 3 trust links |
| C | JWT verifier asserts `alg === 'HS256'` · `JWT_SIGNING_KEY` boot assertion in place · `/register` returns generic 200 · `/export` and `DELETE /api/patient` require password re-entry · `/api/images/:id` requires auth · 8+ test cases passing |
| D | `session_draft` table migrated · intake endpoints accept partial state · commit endpoint validates and creates real session/rating rows · existing form path unchanged · 4+ test cases passing |

---

## Order of operations

1. **Stream B** can ship anytime; pure docs/copy/links, no DB or code dependencies. Lowest risk, highest perceived impact.
2. **Stream A** ships next; UI work, no API changes.
3. **Streams C and D** can run in parallel from `dev` branch; they touch different files.
4. **All streams merge to `main`** together. Then flip `MAINTENANCE_MODE=false` on Pages prod.
5. **Soft launch** to Reddit/Discord follows.

---

## Pre-launch checklist (do not flip MAINTENANCE_MODE off until)

- [ ] Stream A: focus-visible, pre-rating UX, prompt() killed
- [ ] Stream B: About page rebuild, methodology citations live
- [ ] Stream C: all security findings landed + tests green
- [ ] Stream D: session_draft + intake endpoints (coach UI deferred but rails ready)
- [ ] `wrangler secret list --env prod` shows real `JWT_SIGNING_KEY` (not the placeholder)
- [ ] Public aggregate endpoint visibly suppresses below `n_patients < 5`
- [ ] All worker tests pass; SvelteKit build clean
- [ ] Founder has logged 5+ real sessions on dev to exercise the path end-to-end
- [ ] One trusted reviewer (not Brendon) has done a 30-min walkthrough on dev
