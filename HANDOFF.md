# Bloom / Phenologue — Claude Code Handoff

**Date:** 26 April 2026
**Owner:** Brendon Pevreall
**Methodology version:** 0.1

---

## What this is

Bloom is being repositioned from "digital cannabis clinic" to "patient outcomes intelligence platform for UK medical cannabis." The wedge product is **Phenologue**, an open patient self-assessment tool.

This handoff package contains the foundational documents and a partial code scaffold. Your job (Claude Code) is to take it from foundation to working MVP.

---

## What's in this package

```
bloom/
├── docs/
│   ├── 01-bloom-strategic-repositioning.md   # Business frame
│   ├── 02-phenologue-methodology.md          # The protocol IP (read first)
│   └── 03-technical-specification.md         # Architecture + data model + API
└── scaffold/
    ├── schema/
    │   ├── 001_initial.sql                   # Full D1 schema
    │   └── 002_reference_data.sql            # Rating scales + descriptor map
    └── worker/
        ├── package.json
        ├── wrangler.toml                     # Three envs: local/dev/prod
        ├── tsconfig.json
        └── src/
            ├── index.ts                      # Hono entry, route mounting
            ├── env.ts                        # Bindings type
            ├── lib/jwt.ts                    # HS256 via WebCrypto
            ├── middleware/
            │   ├── envelope.ts               # Response wrapper + meta
            │   ├── rate-limit.ts             # KV-backed
            │   └── auth.ts                   # JWT verification
            └── routes/
                ├── auth.ts                   # Register, login, /me
                └── session.ts                # Core protocol (most complete)
```

---

## What's not yet built

### Worker — missing route modules (referenced in `index.ts`)

- `routes/patient.ts` — profile, conditions, consent, export, deletion
- `routes/cultivar.ts` — catalogue, batch creation, COA upload
- `routes/report.ts` — personal dashboard data, batch reports (HTML generation matching the founder's reference report)
- `routes/public.ts` — anonymised aggregate endpoints

### Worker — supporting modules

- `lib/audit.ts` — audit event helper
- `lib/chemotype.ts` — dominant/secondary terpene computation, classification
- `lib/inference.ts` — organoleptic descriptor → terpene profile inference
- `lib/aggregation.ts` — Queue handlers for materialised view recomputation
- `lib/r2.ts` — image upload, signed URL generation

### Frontend (not yet started)

- SvelteKit project under `pages/` (referenced in spec, not scaffolded)
- Component primitives: `<RatingScale>`, `<TerpenePill>`, `<ChemotypeBadge>`, `<SessionCard>`
- Route structure per spec §5.1
- Visual style: Fraunces + JetBrains Mono editorial aesthetic — see founder's strain report HTML for reference, do not redesign

### Seed data

- `scripts/seed-founder-data.ts` — populate L.A. S.A.G.E. and Karamel Kandy reference cultivars/batches plus the founder's first sessions

### Operational

- GitHub Actions CI (lint, typecheck, test, deploy)
- Sentry integration
- Wrangler secrets setup script

---

## Build order recommendation

1. **Wire up local dev first.** Create D1 instance, run migrations, verify schema. Stand up the Worker in `wrangler dev` and confirm `/health` returns the methodology version.
2. **Finish core route modules** in this order: patient → cultivar → session (already mostly done) → report → public.
3. **Seed founder data** so there's something to query against.
4. **Scaffold SvelteKit app.** Build authentication flow + session creation + session list as the v1 surface. That's enough to dogfood.
5. **Iterate on protocol fidelity** — every session created in the wild generates feedback that may need methodology v0.2 adjustments. Treat methodology as living doc.

---

## Hard constraints

- **Methodology version stamping is mandatory.** Every session row, every report, every export must include the methodology version it was created against. Schema enforces this; routes must not bypass it.
- **Pre-ratings are required.** A session without pre-ratings is a methodology violation and must be rejected with `422 methodology_violation`.
- **24-hour edit window is enforced.** Post-ratings, voids, and edits all respect this. After 24 hours the session is immutable.
- **Inferred ≠ measured.** Anywhere a terpene profile is shown, the `measurement_status` flag must be visible. Never present an inferred value as if it were measured.
- **No PII in main tables.** Real names live only in `patient_pii`. All other tables reference patient by pseudonymous UUID.
- **Anonymisation is one-way.** Aggregate exports must strip identifiers before leaving the worker boundary.

---

## Soft preferences

- Prefer Hono idioms; don't reach for Express patterns.
- Prefer raw SQL over ORM. D1's API is fine, the schema is small enough to reason about directly.
- Prefer SvelteKit over Next/React. Smaller bundles matter for a patient-facing tool that may be used on poor mobile connections.
- Prefer custom CSS over Tailwind. The aesthetic is editorial/scientific; utility-first CSS pulls toward generic look.
- Prefer CC BY-SA on docs, MIT on code. Methodology is a public good; implementation is exemplary.

---

## What done looks like for v0.1

- A patient can register, log in, create a session, capture pre-ratings, capture post-ratings within 24 hours, log a task, and view their session history.
- The founder (Brendon) has logged 30+ real sessions across L.A. S.A.G.E. and Karamel Kandy.
- The methodology document is live at `phenologue.uk/methodology` and has been read by a handful of beta users.
- The codebase is deployable to Cloudflare with `pnpm deploy:dev` and `pnpm deploy:prod`.
- A volunteer application has been submitted to MedBud referencing Phenologue as a relevant artefact.

That is enough. Bloom Patient (Layer 2) and beyond are explicitly out of scope for v0.1.

---

## Founder context (for tone calibration)

- Brendon is a Field Technical Support Engineer at Hanover Displays
- Stack fluency: Cloudflare Workers, TypeScript, Raspberry Pi, embedded
- UK medical cannabis patient with ADHD — primary-source domain knowledge
- Has microscope + photography setup for trichome assessment
- Prefers depth and transparency over hand-holding
- Time-boxed: this is a side project, not a sabbatical

When in doubt, optimise for: shipping something honest and useful over shipping something polished and over-scoped.

---

*This handoff package is the seed. Treat the methodology document as the source of truth for protocol questions. Treat the technical specification as the source of truth for architecture questions. Where they conflict, the methodology wins — adjust the architecture.*
