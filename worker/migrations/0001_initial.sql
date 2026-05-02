-- Phenologue: Initial Schema
-- Methodology version: 0.1
-- D1 / SQLite

PRAGMA foreign_keys = ON;

-- =============================================================
-- Patient core
-- =============================================================

CREATE TABLE patient (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    pseudonym TEXT,
    age_band TEXT,                       -- '25-29', '30-34', '35-39', etc.
    sex TEXT,                            -- 'M', 'F', 'NB', 'PNTS'
    region TEXT,                         -- NUTS-2 code, e.g. 'UKH3' (East Anglia)
    consent_research INTEGER NOT NULL DEFAULT 0,
    consent_aggregate INTEGER NOT NULL DEFAULT 0,
    consent_research_at INTEGER,
    consent_aggregate_at INTEGER,
    deleted_at INTEGER,
    methodology_version TEXT NOT NULL DEFAULT '0.1'
);

CREATE TABLE patient_pii (
    patient_id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name_given TEXT,
    name_family TEXT,
    date_of_birth TEXT,                  -- YYYY-MM-DD, only if user opts in
    FOREIGN KEY (patient_id) REFERENCES patient(id) ON DELETE CASCADE
);

CREATE TABLE patient_auth (
    patient_id TEXT PRIMARY KEY,
    password_hash TEXT,                  -- argon2id, nullable if passkey-only
    last_login_at INTEGER,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until INTEGER,
    FOREIGN KEY (patient_id) REFERENCES patient(id) ON DELETE CASCADE
);

CREATE TABLE patient_passkey (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    credential_id TEXT NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    transports TEXT,
    nickname TEXT,
    created_at INTEGER NOT NULL,
    last_used_at INTEGER,
    FOREIGN KEY (patient_id) REFERENCES patient(id) ON DELETE CASCADE
);

CREATE TABLE patient_condition (
    patient_id TEXT NOT NULL,
    condition_code TEXT NOT NULL,        -- 'adhd', 'chronic_pain', 'gad', 'sleep', etc.
    diagnosed_year INTEGER,
    self_reported INTEGER NOT NULL DEFAULT 1,
    note TEXT,
    PRIMARY KEY (patient_id, condition_code),
    FOREIGN KEY (patient_id) REFERENCES patient(id) ON DELETE CASCADE
);

CREATE TABLE patient_terpene_preference (
    patient_id TEXT NOT NULL,
    terpene_code TEXT NOT NULL,          -- 'limonene', 'pinene', 'linalool', etc.
    affinity TEXT NOT NULL,              -- 'liked', 'disliked', 'neutral'
    PRIMARY KEY (patient_id, terpene_code),
    FOREIGN KEY (patient_id) REFERENCES patient(id) ON DELETE CASCADE
);

-- =============================================================
-- Cultivar / batch / COA
-- =============================================================

CREATE TABLE cultivar (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    canonical_name TEXT NOT NULL,        -- normalised lowercase, no punctuation
    producer TEXT NOT NULL,
    country_origin TEXT,
    genetic_lineage TEXT,
    created_at INTEGER NOT NULL,
    submitted_by_patient_id TEXT,
    UNIQUE (canonical_name, producer)
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

    -- Cannabinoids (% w/w)
    thc_pct REAL,
    cbd_pct REAL,
    thcv_pct REAL,
    cbg_pct REAL,
    cbn_pct REAL,
    cbc_pct REAL,
    total_cannabinoids_pct REAL,

    -- Terpenes (% w/w)
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
    terp_other_json TEXT,                -- JSON object for less common terpenes
    terp_total_pct REAL,

    measurement_status TEXT NOT NULL,    -- 'measured', 'partial', 'inferred'
    created_at INTEGER NOT NULL,
    submitted_by_patient_id TEXT,

    FOREIGN KEY (cultivar_id) REFERENCES cultivar(id),
    UNIQUE (cultivar_id, batch_number)
);

-- Computed: dominant + secondary terpenes per batch (refreshed on insert/update)
CREATE TABLE batch_chemotype (
    batch_id TEXT PRIMARY KEY,
    dominant_terpene TEXT,
    dominant_pct REAL,
    secondary_terpene TEXT,
    secondary_pct REAL,
    classification TEXT,                 -- 'limonene-dominant', etc.
    computed_at INTEGER NOT NULL,
    FOREIGN KEY (batch_id) REFERENCES batch(id) ON DELETE CASCADE
);

-- =============================================================
-- Session core
-- =============================================================

CREATE TABLE session (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    batch_id TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    purpose_tags_json TEXT NOT NULL,     -- JSON array of purpose codes
    route TEXT NOT NULL,                 -- 'vape', 'oil', 'edible', 'other'
    device TEXT,
    vape_temp_c INTEGER,
    dose_grams REAL,
    onset_minutes INTEGER,
    peak_minutes INTEGER,
    note TEXT,
    voided INTEGER NOT NULL DEFAULT 0,
    void_reason TEXT,
    voided_at INTEGER,
    methodology_version TEXT NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patient(id) ON DELETE CASCADE,
    FOREIGN KEY (batch_id) REFERENCES batch(id)
);

CREATE TABLE rating (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    phase TEXT NOT NULL,                 -- 'pre', 'post', 'next_day'
    captured_at INTEGER NOT NULL,
    scale_code TEXT NOT NULL,            -- 'focus', 'anxiety', 'pain_intensity', etc.
    value INTEGER NOT NULL CHECK (value BETWEEN 0 AND 10),
    FOREIGN KEY (session_id) REFERENCES session(id) ON DELETE CASCADE,
    UNIQUE (session_id, phase, scale_code)
);

CREATE TABLE task_log (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    description TEXT,
    complexity INTEGER CHECK (complexity BETWEEN 1 AND 5),
    estimated_minutes INTEGER,
    actual_minutes INTEGER,
    completion_status TEXT,              -- 'completed', 'partial', 'abandoned'
    quality_rating INTEGER CHECK (quality_rating BETWEEN 0 AND 10),
    FOREIGN KEY (session_id) REFERENCES session(id) ON DELETE CASCADE
);

CREATE TABLE adverse_event (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    code TEXT NOT NULL,
    severity INTEGER CHECK (severity BETWEEN 1 AND 5),
    note TEXT,
    FOREIGN KEY (session_id) REFERENCES session(id) ON DELETE CASCADE
);

-- =============================================================
-- Organoleptic + microscope
-- =============================================================

CREATE TABLE organoleptic_assessment (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    assessed_at INTEGER NOT NULL,
    descriptors_json TEXT NOT NULL,      -- JSON array of descriptor codes
    intensity INTEGER CHECK (intensity BETWEEN 0 AND 10),
    note TEXT,
    is_public INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (batch_id) REFERENCES batch(id),
    FOREIGN KEY (patient_id) REFERENCES patient(id) ON DELETE CASCADE
);

CREATE TABLE microscope_image (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    captured_at INTEGER NOT NULL,
    r2_key TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    bytes INTEGER,
    magnification INTEGER,
    trichome_clear_pct INTEGER CHECK (trichome_clear_pct BETWEEN 0 AND 100),
    trichome_cloudy_pct INTEGER CHECK (trichome_cloudy_pct BETWEEN 0 AND 100),
    trichome_amber_pct INTEGER CHECK (trichome_amber_pct BETWEEN 0 AND 100),
    density TEXT,                        -- 'low', 'medium', 'high', 'very_high'
    note TEXT,
    is_public INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (batch_id) REFERENCES batch(id),
    FOREIGN KEY (patient_id) REFERENCES patient(id) ON DELETE CASCADE
);

-- =============================================================
-- Aggregations (materialised, recomputed via Queue jobs)
-- =============================================================

CREATE TABLE agg_chemotype_outcome (
    id TEXT PRIMARY KEY,
    chemotype TEXT NOT NULL,             -- 'limonene-dominant'
    condition_code TEXT NOT NULL,
    scale_code TEXT NOT NULL,
    n_sessions INTEGER NOT NULL,
    n_patients INTEGER NOT NULL,
    delta_mean REAL,
    delta_median REAL,
    delta_sd REAL,
    computed_at INTEGER NOT NULL,
    UNIQUE (chemotype, condition_code, scale_code)
);

CREATE TABLE agg_cultivar_outcome (
    id TEXT PRIMARY KEY,
    cultivar_id TEXT NOT NULL,
    condition_code TEXT NOT NULL,
    scale_code TEXT NOT NULL,
    n_sessions INTEGER NOT NULL,
    n_patients INTEGER NOT NULL,
    delta_mean REAL,
    delta_median REAL,
    delta_sd REAL,
    computed_at INTEGER NOT NULL,
    FOREIGN KEY (cultivar_id) REFERENCES cultivar(id),
    UNIQUE (cultivar_id, condition_code, scale_code)
);

-- =============================================================
-- Audit log
-- =============================================================

CREATE TABLE audit_event (
    id TEXT PRIMARY KEY,
    actor_patient_id TEXT,
    action TEXT NOT NULL,                -- 'login', 'session.create', 'patient.delete', etc.
    target_type TEXT,
    target_id TEXT,
    metadata_json TEXT,
    ip_hash TEXT,                        -- hashed, not raw
    user_agent TEXT,
    created_at INTEGER NOT NULL
);

-- =============================================================
-- Lookup / reference data
-- =============================================================

CREATE TABLE terpene_descriptor_map (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    descriptor_code TEXT NOT NULL,       -- 'lemon', 'pine', 'lavender'
    family TEXT NOT NULL,                -- 'citrus', 'pine', 'floral'
    primary_terpene TEXT NOT NULL,       -- 'limonene', 'pinene', 'linalool'
    weight REAL NOT NULL DEFAULT 1.0,    -- inference weight
    UNIQUE (descriptor_code, primary_terpene)
);

CREATE TABLE rating_scale (
    code TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    anchor_0 TEXT NOT NULL,
    anchor_5 TEXT NOT NULL,
    anchor_10 TEXT NOT NULL,
    category TEXT NOT NULL,              -- 'core', 'condition', 'effect_quality'
    condition_code TEXT,                 -- nullable, for condition-specific scales
    display_order INTEGER NOT NULL DEFAULT 100
);

-- =============================================================
-- Indices
-- =============================================================

CREATE INDEX idx_session_patient ON session(patient_id, started_at DESC);
CREATE INDEX idx_session_batch ON session(batch_id);
CREATE INDEX idx_session_voided ON session(voided);
CREATE INDEX idx_rating_session ON rating(session_id, phase);
CREATE INDEX idx_batch_cultivar ON batch(cultivar_id);
CREATE INDEX idx_batch_measurement_status ON batch(measurement_status);
CREATE INDEX idx_organoleptic_batch ON organoleptic_assessment(batch_id);
CREATE INDEX idx_microscope_batch ON microscope_image(batch_id);
CREATE INDEX idx_audit_actor ON audit_event(actor_patient_id, created_at DESC);
CREATE INDEX idx_cultivar_canonical ON cultivar(canonical_name);
CREATE INDEX idx_patient_pii_email ON patient_pii(email);
