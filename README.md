# Phenologue

> Open patient-reported outcomes methodology and platform for medical cannabis.
> A Bloom project. Methodology CC BY-SA 4.0. Code MIT.

```
phenologue/
├── docs/                       # Strategic, methodology, and technical documents
├── worker/                     # Cloudflare Worker — API + queue + cron
│   ├── migrations/             # D1 migrations (incl. chemotype trigger + reference data)
│   ├── scripts/                # Seed scripts (founder data, etc.)
│   ├── src/
│   │   ├── index.ts            # Hono router + queue + scheduled handlers
│   │   ├── env.ts              # Bindings type
│   │   ├── lib/                # chemotype, inference, audit, r2, aggregation, errors, jwt
│   │   ├── middleware/         # envelope, rate-limit, auth
│   │   └── routes/             # auth, patient, cultivar, batch, image, session, report, public
│   ├── test/                   # Vitest unit tests
│   ├── package.json
│   ├── wrangler.toml
│   └── tsconfig.json
└── pages/                      # SvelteKit (Cloudflare Pages) — patient UI
    ├── src/
    │   ├── lib/
    │   │   ├── components/     # RatingScale, TerpenePill, ChemotypeBadge, SessionCard, DropCap
    │   │   ├── styles/         # editorial.css (Fraunces + JetBrains Mono)
    │   │   ├── api.ts          # Bearer-token API client
    │   │   └── auth.ts         # localStorage token store
    │   └── routes/
    │       ├── +layout.svelte
    │       ├── +page.svelte    # Landing
    │       ├── login, register, methodology, about
    │       └── dashboard/
    │           ├── +layout.svelte
    │           ├── +page.svelte               # Personal dashboard
    │           ├── sessions/{+page,new,[id]}  # List, create, detail
    │           └── cultivars/+page.svelte
    ├── package.json
    ├── svelte.config.js
    ├── vite.config.ts
    └── tsconfig.json
```

---

## Quickstart

```bash
# Install
cd worker && pnpm install
cd ../pages && pnpm install

# Local D1 + reference data + founder seed
cd ../worker
pnpm db:migrate:local
pnpm db:seed:local

# Set the JWT signing key for local dev
echo 'JWT_SIGNING_KEY=dev-only-please-change' > .dev.vars

# Run the API on :8787
pnpm dev

# In another terminal, run the SvelteKit app on :5173
cd ../pages
pnpm dev
```

Open <http://localhost:5173>. Vite proxies `/api/*` to the Worker at :8787.

---

## Hard methodology constraints (enforced in code)

- **Methodology version stamping is mandatory.** Every session row, every report, every export carries the version it was created against. Schema enforces it; routes must not bypass it.
- **Pre-ratings are required.** A session without pre-ratings is rejected with `422 methodology_violation`.
- **24-hour edit window is enforced.** Post-ratings, voids, and edits all respect this. Sessions are immutable after 24 hours.
- **Inferred ≠ measured.** Anywhere a terpene profile is shown, the `measurement_status` flag must be visible. The `<ChemotypeBadge>` component handles this.
- **No PII in main tables.** Real names live only in `patient_pii`. Everything else references the patient by pseudonymous UUID.
- **Anonymisation is one-way.** Aggregate exports strip identifiers before leaving the Worker boundary.

---

## Worker scripts

```bash
pnpm dev                  # wrangler dev — local API on :8787
pnpm typecheck            # tsc --noEmit
pnpm test                 # vitest
pnpm db:migrate:local     # apply migrations to local D1
pnpm db:seed:local        # populate founder data + reference cultivars
pnpm db:reset:local       # nuke local state and reseed from scratch
pnpm deploy:dev           # wrangler deploy --env dev
pnpm deploy:prod          # wrangler deploy --env prod
```

## Pages scripts

```bash
pnpm dev                  # vite dev — UI on :5173
pnpm build                # vite build
pnpm typecheck            # svelte-check
pnpm deploy:dev           # cloudflare pages deploy (dev project)
pnpm deploy:prod          # cloudflare pages deploy (prod project)
```

---

## Deployment

The wrangler config has placeholder D1/KV/R2/Queue IDs. Before first deploy:

```bash
# In worker/
wrangler d1 create phenologue-dev      # → copy id into wrangler.toml [env.dev]
wrangler kv namespace create CACHE --env dev
wrangler r2 bucket create phenologue-images-dev
wrangler queues create phenologue-aggregation-dev
wrangler secret put JWT_SIGNING_KEY --env dev
```

Repeat for prod. Then `pnpm deploy:dev` and `pnpm deploy:prod`.

The prod Worker is routed at `api.phenologue.uk/*`. The Pages app deploys
to `phenologue.uk` (prod) and `dev.phenologue.uk` (dev).

---

## What's done in v0.1

- Full schema (patient + PII separation, cultivar/batch/COA, session/rating/task/AE, organoleptic + microscope, audit log, aggregation tables)
- All API endpoints from spec §3.1 except passkey (deferred to v0.2)
- Chemotype computation + organoleptic terpene inference
- Aggregation pipeline (Queue + cron)
- Personal dashboard, session create flow, session detail with post-rating capture
- Editorial typography system (no Tailwind, no UI lib)

## What's deferred to v0.2

- Passkey / WebAuthn registration and login
- Image-based terpene profile inference (ML on bud photos)
- Multi-language support (English first)
- WCAG 2.2 AA accessibility audit (must complete before public launch)
- Image upload via multipart (currently base64 JSON envelope)
- Batch detail page + condition reports in the SvelteKit UI

---

## Licensing

- **Methodology** — `docs/02-phenologue-methodology.md` is licensed CC BY-SA 4.0.
- **Code** — MIT, `LICENSE-CODE`.
- **Aggregate dataset** — Open access for descriptive statistics, licensed access for raw anonymised dataset.

---

*Built with intent: ship something honest and useful before something polished and over-scoped. Methodology is the source of truth — adjust the architecture if they conflict.*
