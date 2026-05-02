/**
 * seed-founder-data.ts
 *
 * Populates a freshly-migrated D1 with the founder's reference cultivars
 * (L.A. S.A.G.E. T26 and Karamel Kandy KSV-9), a couple of seed sessions per
 * cultivar, plus a default founder patient account so login works without
 * stepping through the registration flow.
 *
 * Usage:
 *   pnpm db:seed:local
 *   tsx scripts/seed-founder-data.ts --remote --env dev   # dev/prod via wrangler exec
 *
 * The script shells out to `wrangler d1 execute` so it works against any of
 * the three configured D1 instances. Intentionally idempotent — safe to run
 * multiple times.
 */

import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

interface RunOpts {
  local: boolean;
  env?: 'dev' | 'prod';
  remote?: boolean;
  dbName?: string;
}

const SEED_PATIENT_ID = 'seed_founder_patient';
const SEED_PATIENT_EMAIL = 'founder@phenologue.local';

const DEFAULT_PATIENT_PASSWORD_HASH =
  // argon2id of 'phenologue-dev-password' computed once and committed so the
  // local seed completes without launching a Worker. Real users hash via the
  // /api/auth/register endpoint with their own salt.
  '0000000000000000000000000000000000000000000000000000000000000000:0000000000000000000000000000000000000000000000000000000000000000';

const LAS_CULTIVAR_ID = 'seed_las_cultivar';
const LAS_BATCH_ID = 'seed_las_batch';
const KK_CULTIVAR_ID = 'seed_kk_cultivar';
const KK_BATCH_ID = 'seed_kk_batch';

const SEED_SQL = String.raw`
-- Founder patient (no PII for the seed account)
INSERT OR REPLACE INTO patient
  (id, created_at, pseudonym, age_band, sex, region,
   consent_research, consent_aggregate, methodology_version)
VALUES
  ('${SEED_PATIENT_ID}', strftime('%s','now')*1000, 'founder', '30-34', 'M', 'UKH3',
   1, 1, '0.1');

INSERT OR REPLACE INTO patient_pii (patient_id, email)
VALUES ('${SEED_PATIENT_ID}', '${SEED_PATIENT_EMAIL}');

INSERT OR REPLACE INTO patient_auth (patient_id, password_hash)
VALUES ('${SEED_PATIENT_ID}', '${DEFAULT_PATIENT_PASSWORD_HASH}');

INSERT OR REPLACE INTO patient_condition (patient_id, condition_code, diagnosed_year, self_reported)
VALUES ('${SEED_PATIENT_ID}', 'adhd', 2024, 1);

INSERT OR REPLACE INTO patient_terpene_preference (patient_id, terpene_code, affinity)
VALUES ('${SEED_PATIENT_ID}', 'limonene', 'liked'),
       ('${SEED_PATIENT_ID}', 'pinene', 'liked');

-- L.A. S.A.G.E. T26 (IPS Pharma) — limonene-dominant / pinene-secondary, inferred
INSERT OR REPLACE INTO cultivar
  (id, name, canonical_name, producer, country_origin, genetic_lineage,
   created_at, submitted_by_patient_id)
VALUES
  ('${LAS_CULTIVAR_ID}', 'L.A. S.A.G.E. T26', 'la-sage-t26', 'IPS Pharma',
   'Macedonia', 'Lemon Sage Lineage', strftime('%s','now')*1000, '${SEED_PATIENT_ID}');

INSERT OR REPLACE INTO batch
  (id, cultivar_id, batch_number, harvest_date, test_date, irradiation,
   thc_pct, cbd_pct, total_cannabinoids_pct,
   terp_pinene_a, terp_pinene_b, terp_myrcene, terp_limonene,
   terp_linalool, terp_caryophyllene, terp_humulene, terp_total_pct,
   measurement_status, created_at, submitted_by_patient_id)
VALUES
  ('${LAS_BATCH_ID}', '${LAS_CULTIVAR_ID}', 'IPS-PHC-LAS T26',
   '2025-09-15', '2025-12-01', 'gamma',
   26.4, 0.1, 27.8,
   0.18, 0.06, 0.08, 0.55, 0.03, 0.04, 0.02, 0.96,
   'inferred', strftime('%s','now')*1000, '${SEED_PATIENT_ID}');

INSERT OR REPLACE INTO organoleptic_assessment
  (id, batch_id, patient_id, assessed_at, descriptors_json, intensity, note, is_public)
VALUES
  ('seed_las_org', '${LAS_BATCH_ID}', '${SEED_PATIENT_ID}', strftime('%s','now')*1000,
   '["lemon","sour_citrus","pine","fresh_herb","sage"]',
   8, 'Bright lemon-pine — classic L.A. nose, with a herbal sage lift.', 1);

-- Karamel Kandy KSV-9 (Kasa Verde) — caryophyllene-dominant / myrcene-secondary, inferred
INSERT OR REPLACE INTO cultivar
  (id, name, canonical_name, producer, country_origin, genetic_lineage,
   created_at, submitted_by_patient_id)
VALUES
  ('${KK_CULTIVAR_ID}', 'Karamel Kandy KSV-9', 'karamel-kandy-ksv-9', 'Kasa Verde',
   'Canada', 'Caramel cookies x candy lineage', strftime('%s','now')*1000, '${SEED_PATIENT_ID}');

INSERT OR REPLACE INTO batch
  (id, cultivar_id, batch_number, harvest_date, test_date, irradiation,
   thc_pct, cbd_pct, total_cannabinoids_pct,
   terp_myrcene, terp_limonene, terp_caryophyllene, terp_humulene,
   terp_linalool, terp_total_pct,
   measurement_status, created_at, submitted_by_patient_id)
VALUES
  ('${KK_BATCH_ID}', '${KK_CULTIVAR_ID}', 'A363041',
   '2025-08-20', '2025-11-10', 'none',
   24.8, 0.2, 25.6,
   0.22, 0.08, 0.45, 0.05, 0.04, 0.84,
   'inferred', strftime('%s','now')*1000, '${SEED_PATIENT_ID}');

INSERT OR REPLACE INTO organoleptic_assessment
  (id, batch_id, patient_id, assessed_at, descriptors_json, intensity, note, is_public)
VALUES
  ('seed_kk_org', '${KK_BATCH_ID}', '${SEED_PATIENT_ID}', strftime('%s','now')*1000,
   '["caramel","cookie_dough","pepper","clove","stone_fruit"]',
   7, 'Heavy gas-pepper backbone over a caramel/cookie sweetness.', 1);

-- A couple of seed sessions per cultivar so the dashboard isn't empty
INSERT OR REPLACE INTO session
  (id, patient_id, batch_id, started_at, ended_at,
   purpose_tags_json, route, device, vape_temp_c, dose_grams,
   onset_minutes, peak_minutes, methodology_version)
VALUES
  ('seed_session_las_1', '${SEED_PATIENT_ID}', '${LAS_BATCH_ID}',
   strftime('%s','now')*1000 - 3600000*72, strftime('%s','now')*1000 - 3600000*71,
   '["focus","exploratory"]', 'vape', 'mighty_plus', 195, 0.10,
   3, 12, '0.1'),
  ('seed_session_las_2', '${SEED_PATIENT_ID}', '${LAS_BATCH_ID}',
   strftime('%s','now')*1000 - 3600000*48, strftime('%s','now')*1000 - 3600000*47,
   '["focus"]', 'vape', 'mighty_plus', 195, 0.10,
   2, 10, '0.1'),
  ('seed_session_kk_1', '${SEED_PATIENT_ID}', '${KK_BATCH_ID}',
   strftime('%s','now')*1000 - 3600000*24, strftime('%s','now')*1000 - 3600000*23,
   '["sleep_prep","relaxation"]', 'vape', 'mighty_plus', 200, 0.12,
   4, 18, '0.1');

-- Pre-ratings + post-ratings on the seed sessions
INSERT OR REPLACE INTO rating (id, session_id, phase, captured_at, scale_code, value)
VALUES
  -- LAS session 1 pre
  ('seed_r1_pre_focus',   'seed_session_las_1', 'pre',  strftime('%s','now')*1000 - 3600000*72, 'focus',           3),
  ('seed_r1_pre_anxiety', 'seed_session_las_1', 'pre',  strftime('%s','now')*1000 - 3600000*72, 'anxiety',         5),
  ('seed_r1_pre_mood',    'seed_session_las_1', 'pre',  strftime('%s','now')*1000 - 3600000*72, 'mood',            5),
  ('seed_r1_pre_energy',  'seed_session_las_1', 'pre',  strftime('%s','now')*1000 - 3600000*72, 'energy',          4),
  ('seed_r1_pre_ti',      'seed_session_las_1', 'pre',  strftime('%s','now')*1000 - 3600000*72, 'task_initiation', 2),
  -- LAS session 1 post
  ('seed_r1_post_focus',   'seed_session_las_1', 'post', strftime('%s','now')*1000 - 3600000*71, 'focus',           7),
  ('seed_r1_post_anxiety', 'seed_session_las_1', 'post', strftime('%s','now')*1000 - 3600000*71, 'anxiety',         3),
  ('seed_r1_post_mood',    'seed_session_las_1', 'post', strftime('%s','now')*1000 - 3600000*71, 'mood',            7),
  ('seed_r1_post_energy',  'seed_session_las_1', 'post', strftime('%s','now')*1000 - 3600000*71, 'energy',          6),
  ('seed_r1_post_ti',      'seed_session_las_1', 'post', strftime('%s','now')*1000 - 3600000*71, 'task_initiation', 7),

  -- LAS session 2 pre
  ('seed_r2_pre_focus',   'seed_session_las_2', 'pre',  strftime('%s','now')*1000 - 3600000*48, 'focus',           4),
  ('seed_r2_pre_anxiety', 'seed_session_las_2', 'pre',  strftime('%s','now')*1000 - 3600000*48, 'anxiety',         4),
  ('seed_r2_pre_mood',    'seed_session_las_2', 'pre',  strftime('%s','now')*1000 - 3600000*48, 'mood',            6),
  ('seed_r2_pre_ti',      'seed_session_las_2', 'pre',  strftime('%s','now')*1000 - 3600000*48, 'task_initiation', 3),
  -- LAS session 2 post
  ('seed_r2_post_focus',   'seed_session_las_2', 'post', strftime('%s','now')*1000 - 3600000*47, 'focus',           8),
  ('seed_r2_post_anxiety', 'seed_session_las_2', 'post', strftime('%s','now')*1000 - 3600000*47, 'anxiety',         3),
  ('seed_r2_post_mood',    'seed_session_las_2', 'post', strftime('%s','now')*1000 - 3600000*47, 'mood',            7),
  ('seed_r2_post_ti',      'seed_session_las_2', 'post', strftime('%s','now')*1000 - 3600000*47, 'task_initiation', 8),

  -- Karamel Kandy session pre
  ('seed_r3_pre_anxiety', 'seed_session_kk_1', 'pre',  strftime('%s','now')*1000 - 3600000*24, 'anxiety',          6),
  ('seed_r3_pre_mood',    'seed_session_kk_1', 'pre',  strftime('%s','now')*1000 - 3600000*24, 'mood',             4),
  ('seed_r3_pre_pain',    'seed_session_kk_1', 'pre',  strftime('%s','now')*1000 - 3600000*24, 'pain',             3),
  ('seed_r3_pre_sleep',   'seed_session_kk_1', 'pre',  strftime('%s','now')*1000 - 3600000*24, 'sleep_readiness',  4),
  -- Karamel Kandy session post
  ('seed_r3_post_anxiety', 'seed_session_kk_1', 'post', strftime('%s','now')*1000 - 3600000*23, 'anxiety',          2),
  ('seed_r3_post_mood',    'seed_session_kk_1', 'post', strftime('%s','now')*1000 - 3600000*23, 'mood',             7),
  ('seed_r3_post_pain',    'seed_session_kk_1', 'post', strftime('%s','now')*1000 - 3600000*23, 'pain',             2),
  ('seed_r3_post_sleep',   'seed_session_kk_1', 'post', strftime('%s','now')*1000 - 3600000*23, 'sleep_readiness',  9);

-- Task log on LAS session 1 (focus / coding work)
INSERT OR REPLACE INTO task_log
  (id, session_id, description, complexity, estimated_minutes, actual_minutes,
   completion_status, quality_rating)
VALUES
  ('seed_task_las_1', 'seed_session_las_1',
   'Refactor migration runner — split D1 ops into per-env modules.',
   3, 90, 75, 'completed', 8);
`;

function parseArgs(argv: string[]): RunOpts {
  const out: RunOpts = { local: true };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--local') out.local = true;
    else if (arg === '--remote') {
      out.local = false;
      out.remote = true;
    } else if (arg === '--env') {
      const v = argv[++i];
      if (v === 'dev' || v === 'prod') out.env = v;
    } else if (arg === '--db') {
      out.dbName = argv[++i];
    }
  }
  return out;
}

function run(opts: RunOpts): void {
  const dbName = opts.dbName ?? defaultDbName(opts);
  const dir = mkdtempSync(join(tmpdir(), 'phenologue-seed-'));
  const file = join(dir, 'seed.sql');
  writeFileSync(file, SEED_SQL);

  const flags: string[] = [];
  if (opts.local) flags.push('--local');
  if (opts.remote) flags.push('--remote');
  if (opts.env) flags.push('--env', opts.env);

  // Use npx so it resolves the locally-installed wrangler regardless of PATH.
  const cmd = `npx --no-install wrangler d1 execute ${dbName} ${flags.join(' ')} --file="${file}"`;
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', shell: true });
}

function defaultDbName(opts: RunOpts): string {
  if (opts.env === 'dev') return 'phenologue-dev';
  if (opts.env === 'prod') return 'phenologue-prod';
  return 'phenologue';
}

run(parseArgs(process.argv.slice(2)));
