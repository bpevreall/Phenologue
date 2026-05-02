# Phenologue: Technical Specification

**Version:** 0.1
**Author:** Brendon Pevreall, Bloom
**Date:** 26 April 2026
**Status:** Pre-implementation reference

---

## 1. Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Cloudflare Edge                        │
│                                                             │
│   ┌──────────────┐     ┌──────────────┐    ┌────────────┐   │
│   │  Pages (UI)  │────▶│   Worker     │───▶│   D1 DB    │   │
│   │  Vue/Svelte  │     │  (API + BFF) │    │   (SQLite) │   │
│   └──────────────┘     └──────────────┘    └────────────┘   │
│                              │                              │
│                              ├───────▶  R2 (image storage)  │
│                              │                              │
│                              ├───────▶  KV  (session cache) │
│                              │                              │
│                              └───────▶  Queues (async jobs) │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ (analytics export, opt-in)
                              ▼
                    ┌──────────────────────┐
                    │  Bloom Research DW   │
                    │  (anonymised, future)│
                    └──────────────────────┘
```

### Stack rationale

| Component | Choice | Why |
|-----------|--------|-----|
| Compute | Cloudflare Workers | Founder fluency, free tier covers MVP, edge latency, no cold starts |
| Database | Cloudflare D1 (SQLite) | Zero ops, free tier 5GB, sufficient for n=10k patients × ~365 sessions/yr |
| UI framework | SvelteKit (or Vue 3) | Smaller bundles than React, simpler reactivity, runs natively on Pages |
| Image storage | Cloudflare R2 | Free egress, S3-compatible, microscope shots only, ~50KB-2MB each |
| Cache | Cloudflare KV | Session tokens, computed dashboards, invalidations |
| Async jobs | Cloudflare Queues | Aggregation rebuilds, scheduled exports, webhook delivery |
| Auth | Custom JWT + WebAuthn | No external dependency, supports passkeys, no PII at IdP |
| Analytics | Cloudflare Web Analytics | Free, GDPR-friendly, no cookies |
| CDN/DNS | Cloudflare (native) | Already in stack |

### Why not Postgres / Next.js / Supabase / Vercel

- Postgres on managed services has minimum monthly cost; D1 is free at this scale
- Next.js is heavier than needed; SvelteKit ships less JS
- Supabase is excellent but introduces another vendor and dependency
- Vercel egress and function pricing exceeds Cloudflare for this workload

The Cloudflare-native stack is also defensible for UK data residency claims because Cloudflare offers EU-only data routing controls, which matters for medical-adjacent data even when not regulated as a medical device.

---

## 2. Data model

### 2.1 Entity overview

```
patient ─┬─ session ─── rating
         │      │
         │      ├─ task_log
         │      └─ adverse_event
         │
         ├─ patient_condition
         ├─ patient_consent
         └─ patient_export

cultivar ─── batch ──── coa
                  │
                  └─ session (FK)

terpene_descriptor_map (lookup)
chemotype_classification (computed view)
```

### 2.2 Core schema (D1 / SQLite)

See `/scaffold/schema/001_initial.sql` for full DDL. Highlights:

```sql
CREATE TABLE patient (
    id TEXT PRIMARY KEY,                -- uuid
    created_at INTEGER NOT NULL,         -- unix epoch
    pseudonym TEXT,                      -- chosen handle, not real name
    age_band TEXT,                       -- '25-29', '30-34', etc
    sex TEXT,                            -- 'M', 'F', 'NB', 'PNTS'
    region TEXT,                         -- NUTS-2 (e.g. 'UKH3')
    consent_research INTEGER DEFAULT 0,  -- boolean
    consent_aggregate INTEGER DEFAULT 0,
    deleted_at INTEGER                   -- soft delete
);

CREATE TABLE patient_condition (
    patient_id TEXT NOT NULL,
    condition_code TEXT NOT NULL,        -- 'adhd', 'chronic_pain', 'gad', etc.
    diagnosed_year INTEGER,
    PRIMARY KEY (patient_id, condition_code),
    FOREIGN KEY (patient_id) REFERENCES patient(id)
);

CREATE TABLE cultivar (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    producer TEXT NOT NULL,
    country_origin TEXT,
    genetic_lineage TEXT,                -- free text e.g. 'Lemonnade x Cookies'
    canonical_name TEXT                  -- normalised for joining
);

CREATE TABLE batch (
    id TEXT PRIMARY KEY,
    cultivar_id TEXT NOT NULL,
    batch_number TEXT NOT NULL,
    harvest_date TEXT,
    test_date TEXT,
    expiry_date TEXT,
    irradiation TEXT,                    -- 'gamma', 'ebeam', 'none', 'unknown'
    coa_url TEXT,
    thc_pct REAL,
    cbd_pct REAL,
    thcv_pct REAL,
    cbg_pct REAL,
    cbn_pct REAL,
    -- terpenes (% w/w if measured)
    terp_pinene_a REAL,
    terp_pinene_b REAL,
    terp_myrcene REAL,
    terp_limonene REAL,
    terp_terpinolene REAL,
    terp_linalool REAL,
    terp_caryophyllene REAL,
    terp_humulene REAL,
    terp_ocimene REAL,
    terp_bisabolol REAL,
    terp_farnesene REAL,
    terp_other_json TEXT,                -- JSON for less common terpenes
    measurement_status TEXT NOT NULL,    -- 'measured', 'partial', 'inferred'
    FOREIGN KEY (cultivar_id) REFERENCES cultivar(id),
    UNIQUE (cultivar_id, batch_number)
);

CREATE TABLE session (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    batch_id TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    purpose_tags_json TEXT NOT NULL,     -- ["focus", "exploratory"]
    route TEXT NOT NULL,                 -- 'vape', 'oil', 'edible'
    device TEXT,                         -- 'mighty_plus', 'tinymight_2', etc.
    vape_temp_c INTEGER,
    dose_grams REAL,
    onset_minutes INTEGER,
    peak_minutes INTEGER,
    note TEXT,
    voided INTEGER DEFAULT 0,
    void_reason TEXT,
    methodology_version TEXT NOT NULL,   -- '0.1'
    FOREIGN KEY (patient_id) REFERENCES patient(id),
    FOREIGN KEY (batch_id) REFERENCES batch(id)
);

CREATE TABLE rating (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    phase TEXT NOT NULL,                 -- 'pre', 'post', 'next_day'
    captured_at INTEGER NOT NULL,
    scale_code TEXT NOT NULL,            -- 'focus', 'anxiety', 'pain_intensity', etc.
    value INTEGER NOT NULL,              -- 0-10
    FOREIGN KEY (session_id) REFERENCES session(id)
);

CREATE TABLE task_log (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    description TEXT,
    complexity INTEGER,                  -- 1-5
    estimated_minutes INTEGER,
    actual_minutes INTEGER,
    completion_status TEXT,              -- 'completed', 'partial', 'abandoned'
    quality_rating INTEGER,              -- 0-10
    FOREIGN KEY (session_id) REFERENCES session(id)
);

CREATE TABLE adverse_event (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    code TEXT NOT NULL,                  -- 'dry_mouth', 'paranoia', 'tachycardia', etc.
    severity INTEGER,                    -- 1-5
    note TEXT,
    FOREIGN KEY (session_id) REFERENCES session(id)
);

CREATE TABLE organoleptic_assessment (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    assessed_at INTEGER NOT NULL,
    descriptors_json TEXT NOT NULL,      -- ["lemon", "pine", "floral"]
    intensity INTEGER,                   -- 0-10
    note TEXT,
    FOREIGN KEY (batch_id) REFERENCES batch(id),
    FOREIGN KEY (patient_id) REFERENCES patient(id)
);

CREATE TABLE microscope_image (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    captured_at INTEGER NOT NULL,
    r2_key TEXT NOT NULL,
    magnification INTEGER,
    trichome_clear_pct INTEGER,
    trichome_cloudy_pct INTEGER,
    trichome_amber_pct INTEGER,
    density TEXT,                        -- 'low', 'medium', 'high', 'very_high'
    is_public INTEGER DEFAULT 0,
    FOREIGN KEY (batch_id) REFERENCES batch(id),
    FOREIGN KEY (patient_id) REFERENCES patient(id)
);
```

### 2.3 Indices

```sql
CREATE INDEX idx_session_patient ON session(patient_id, started_at DESC);
CREATE INDEX idx_session_batch ON session(batch_id);
CREATE INDEX idx_rating_session ON rating(session_id, phase);
CREATE INDEX idx_batch_cultivar ON batch(cultivar_id);
CREATE INDEX idx_organoleptic_batch ON organoleptic_assessment(batch_id);
```

### 2.4 Computed views

A `chemotype_summary` view computes dominant + secondary terpene per batch and is materialised on batch insert/update via a trigger.

---

## 3. API surface

REST-ish, JSON, JWT auth via `Authorization: Bearer <token>`.

### 3.1 Endpoints

```
# Auth
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/passkey/register
POST   /api/auth/passkey/login
POST   /api/auth/logout
GET    /api/auth/me

# Patient profile
GET    /api/patient
PATCH  /api/patient
POST   /api/patient/conditions
DELETE /api/patient/conditions/:code
POST   /api/patient/consent
GET    /api/patient/export                    # full data export (JSON or CSV)
DELETE /api/patient                           # full deletion

# Cultivars and batches
GET    /api/cultivars?q=&producer=
GET    /api/cultivars/:id
POST   /api/cultivars                          # create from patient submission
GET    /api/cultivars/:id/batches
POST   /api/cultivars/:id/batches
GET    /api/batches/:id
PATCH  /api/batches/:id                        # add COA after the fact

# Sessions
POST   /api/sessions                           # start a session
GET    /api/sessions?from=&to=&purpose=
GET    /api/sessions/:id
PATCH  /api/sessions/:id                       # within 24h window
POST   /api/sessions/:id/ratings
POST   /api/sessions/:id/tasks
POST   /api/sessions/:id/adverse_events
POST   /api/sessions/:id/void

# Organoleptic + microscope
POST   /api/batches/:id/organoleptic
POST   /api/batches/:id/images                 # multipart, → R2
GET    /api/batches/:id/images
PATCH  /api/images/:id                         # toggle public

# Reports
GET    /api/reports/batch/:id                  # the strain assessment report
GET    /api/reports/personal                   # personal dashboard data
GET    /api/reports/personal/condition/:code   # condition-specific analysis

# Aggregate (public, no auth)
GET    /api/public/cultivars/:id/aggregate     # anonymised cohort data
GET    /api/public/chemotype/:dominant_terpene/aggregate
```

### 3.2 Response envelope

```json
{
  "data": { ... },
  "meta": {
    "request_id": "...",
    "methodology_version": "0.1",
    "api_version": "0.1"
  },
  "errors": []
}
```

---

## 4. Authentication and security

- **JWT** signed with HS256, 24-hour expiry, refresh tokens stored in KV
- **Passkey (WebAuthn)** as primary auth, password as fallback only
- **Argon2id** for password hashing (via `@noble/hashes`)
- **Rate limiting** at Worker level: 60 req/min per IP, 600 req/min per authenticated user
- **CSRF** via SameSite cookies + origin checking on state-changing endpoints
- **PII separation**: `patient` table holds pseudonyms; real names only in `patient_pii` table accessible only by self
- **Audit log** (`audit_event` table) records all data access and mutation events

### 4.1 Threat model summary

| Threat | Mitigation |
|--------|-----------|
| Account takeover | Passkey-first auth, optional 2FA, audit log alerts |
| Database leak | No real names in main tables, age-banded not exact age, region not address |
| Subpoena / regulatory request | Patient-controlled deletion, no central decryption key |
| Insider misuse | Audit log, principle of least privilege, no shared admin accounts |
| Cross-patient data leak | Row-level filtering on every query by `patient_id` from JWT |
| Image leakage | R2 keys are random UUIDs, signed URLs with 5-minute expiry, public flag enforced server-side |

---

## 5. Frontend structure

### 5.1 Pages (SvelteKit routes)

```
/                            -- landing, methodology summary
/login                       -- auth
/register                    -- onboarding
/onboarding/conditions       -- condition selection
/onboarding/consent          -- granular consent
/dashboard                   -- personal home
/dashboard/sessions          -- session list
/dashboard/sessions/new      -- start a session (multi-step)
/dashboard/sessions/:id      -- session detail
/dashboard/cultivars         -- personal cultivar history
/dashboard/cultivars/:id     -- cultivar detail + sessions
/dashboard/insights          -- personal patterns / charts
/cultivars                   -- public catalogue
/cultivars/:id               -- public cultivar page (aggregate)
/methodology                 -- live methodology document
/about                       -- Bloom + Phenologue context
/research                    -- data access for researchers
```

### 5.2 Component library

Custom-built, no UI framework. The aesthetic is the editorial/laboratory style established in the founder's strain report — Fraunces + JetBrains Mono, paper-tone palette, sharp typography. This is intentional: it signals scientific seriousness and differentiates from the typical wellness/cannabis aesthetic.

Key reusable components:
- `<RatingScale>` — 0–10 anchored slider with descriptor tooltips
- `<TerpenePill>` — terpene badge with tier styling
- `<ChemotypeBadge>` — dominant/secondary terpene display
- `<SessionCard>` — list item for sessions
- `<DropCap>` — typographic flourish for long-form content
- `<DataTable>` — bare, unstyled-table-grade utility for raw data display

---

## 6. Aggregation pipeline

Aggregations run on Cloudflare Queues, triggered by:
- New session completion
- Batch chemotype update
- Daily scheduled (cron trigger 03:00 UTC)

Materialised tables (`agg_*`):
- `agg_chemotype_outcome` — chemotype × condition × scale × pre/post delta (mean, median, n, sd)
- `agg_cultivar_outcome` — cultivar-level rollup
- `agg_chemotype_purpose` — chemotype × purpose × functional/pleasantness ratings

Aggregations exclude:
- Voided sessions
- Sessions with `n < 5` for the patient (insufficient personal baseline)
- Patients without `consent_aggregate = 1`

Aggregations exposed:
- Personal: `n=1` patient view, all sessions
- Cohort: requires `n >= 10` to display, otherwise "insufficient data"
- Public: requires `n >= 30` to display

---

## 7. Deployment

### 7.1 Environments

- `local` — wrangler dev, in-memory D1
- `dev` — Cloudflare Workers (dev.phenologue.uk), D1 dev instance
- `prod` — Cloudflare Workers (phenologue.uk), D1 prod instance

### 7.2 CI/CD

GitHub Actions:
- On PR: lint, typecheck, unit tests, integration tests against in-memory D1
- On merge to `main`: deploy to dev
- On tag `v*`: deploy to prod with manual approval

### 7.3 Observability

- Cloudflare Analytics for traffic
- Worker logs with structured JSON output
- Sentry (free tier) for error reporting
- Custom dashboard for protocol-level metrics: sessions/day, active patients, methodology version distribution

---

## 8. Open questions deferred to v0.2

- Federated identity (OIDC / SAML) for clinic accounts — Layer 3 concern
- Mobile app vs PWA — currently PWA-only, native app deferred
- Image-based terpene profile inference (ML on bud photos) — research project, not MVP
- Integration with prescriber EMR — Layer 3 concern
- Multi-language support — English first, internationalisation deferred
- Accessibility audit (WCAG 2.2 AA) — must complete before public launch

---

## 9. Build sequence

The scaffold (in `/scaffold/`) provides:

1. Project structure (worker, pages, schema, scripts)
2. Initial D1 migration with full schema
3. Worker entrypoint with route stubs and JWT middleware
4. SvelteKit app shell with routing
5. Component primitives (RatingScale, TerpenePill, etc.)
6. Seed script populating L.A. S.A.G.E. and Karamel Kandy reference data
7. README with build / dev / deploy instructions
8. Wrangler config for dev and prod environments

The scaffold is intentionally not a finished application. It is a structured starting point for handoff to Claude Code or for direct extension by Brendon.

---

*Specification version 0.1. Aligned with Methodology v0.1.*
