/**
 * import-medbud.ts
 *
 * Scrapes https://medbud.wiki/strains/ for the public strain catalogue and
 * imports cultivars + inferred-THC batches into the local D1 instance.
 *
 * Why a separate script from import-cultivars.ts?
 *   - import-cultivars expects a curated CSV with explicit columns.
 *   - This script is the one-shot bootstrap for the MedBud public listing,
 *     which only exposes producer / strain / THC tier through URL slugs.
 *
 * Idempotency:
 *   - cultivar inserts use INSERT OR IGNORE on (canonical_name, producer)
 *   - batch inserts use INSERT OR IGNORE on (cultivar_id, batch_number)
 *     where batch_number is `medbud-{thc_pct}` so the same tier won't dupe.
 *   - Re-running the script is safe; new strains/tiers get inserted, existing
 *     rows are left untouched.
 *
 * Usage:
 *   pnpm exec tsx scripts/import-medbud.ts
 *
 * Suggested package.json entry:
 *   "db:import:medbud": "tsx scripts/import-medbud.ts"
 *
 * Notes:
 *   - measurement_status is set to 'inferred' because the MedBud listing only
 *     publishes the THC tier (T## bucket), not a real COA.
 *   - tier (value/core/craft/premium/select) is not reliably inferable from
 *     the URL alone, so it is recorded as NULL on the cultivar (we don't have
 *     a column for it anyway — left for a future enrichment pass).
 */

import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nanoid } from 'nanoid';

const SOURCE_URL = 'https://medbud.wiki/strains/';
const USER_AGENT =
  'PhenologueImporter/0.1 (+https://phenologue.app; brenpevreall@gmail.com) polite catalogue ingest';

// Acronyms we want preserved in upper-case when title-casing producer slugs.
const ACRONYM_MAP: Record<string, string> = {
  '4c': '4C',
  ips: 'IPS',
  thc: 'THC',
  cbd: 'CBD',
  gw: 'GW',
  bc: 'BC',
  bnm: 'BNM',
  ukp: 'UKP',
};

interface ParsedHit {
  producerSlug: string;
  strainSlug: string;
  thcPct: number;
  cultivarName: string;
  producer: string;
  cleanedStrainSlug: string;
  canonicalName: string;
}

interface CultivarKey {
  producer: string;
  cultivarName: string;
}

interface CultivarRecord {
  id: string;
  name: string;
  canonicalName: string;
  producer: string;
}

function titleCaseProducer(slug: string): string {
  return slug
    .split('-')
    .map((word) => {
      const lower = word.toLowerCase();
      if (ACRONYM_MAP[lower]) return ACRONYM_MAP[lower];
      if (!lower) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function titleCaseStrainWord(word: string): string {
  const lower = word.toLowerCase();
  if (ACRONYM_MAP[lower]) return ACRONYM_MAP[lower];
  if (!lower) return lower;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Parse a strain slug like "ips-las-t26-lemon-sage" or "kvc-kk-t24-karamel-kandy"
 * into:
 *   - cleanedStrainSlug: slug minus the leading product code prefix and the T## token
 *   - cultivarName: title-cased remaining words
 *   - thcPct: numeric THC tier
 *
 * Returns null if no T## token is found (we can't infer THC and the row is
 * skipped — listing entries without a tier aren't useful here).
 */
function parseStrainSlug(strainSlug: string): {
  cleanedStrainSlug: string;
  cultivarName: string;
  thcPct: number;
} | null {
  const parts = strainSlug.split('-').filter((p) => p.length > 0);
  if (parts.length === 0) return null;

  // Find the T## token (case-insensitive). Everything before it that matches
  // an "uppercase letter abbreviation" of length 2-5 is treated as a product
  // code prefix and dropped along with the tier token itself.
  let tierIdx = -1;
  let thcPct = NaN;
  for (let i = 0; i < parts.length; i++) {
    const m = /^t(\d{1,2})$/i.exec(parts[i]!);
    if (m) {
      tierIdx = i;
      thcPct = parseFloat(m[1]!);
      break;
    }
  }
  if (tierIdx < 0 || !Number.isFinite(thcPct)) return null;

  // Drop product-code prefix segments before the tier — these are typically
  // 2-5 character all-letter codes like "ips", "las", "kvc", "phc".
  const prefixCodeRe = /^[a-z]{2,5}$/i;
  const remaining: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i < tierIdx && prefixCodeRe.test(parts[i]!)) continue; // drop prefix code
    if (i === tierIdx) continue; // drop the T## itself
    remaining.push(parts[i]!);
  }

  if (remaining.length === 0) return null;

  const cleanedStrainSlug = remaining.join('-');
  const cultivarName = remaining.map(titleCaseStrainWord).join(' ');
  return { cleanedStrainSlug, cultivarName, thcPct };
}

function escapeSql(s: string): string {
  return s.replace(/'/g, "''");
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!res.ok) {
    throw new Error(`fetch ${url} -> ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

function extractHits(html: string): ParsedHit[] {
  // The MedBud listing renders strain links as
  //   <a href="/strains/{producer-slug}/{strain-slug}/">...</a>
  // We accept both leading-slash and absolute-URL variants for safety.
  const re =
    /href=["'](?:https?:\/\/medbud\.wiki)?\/strains\/([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9-]*)\/?["']/gi;

  const seen = new Set<string>();
  const hits: ParsedHit[] = [];

  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const producerSlug = m[1]!.toLowerCase();
    const strainSlug = m[2]!.toLowerCase();
    const dedupeKey = `${producerSlug}/${strainSlug}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const parsed = parseStrainSlug(strainSlug);
    if (!parsed) continue;

    const producer = titleCaseProducer(producerSlug);
    const canonicalName = `${producerSlug}-${parsed.cleanedStrainSlug}`;

    hits.push({
      producerSlug,
      strainSlug,
      thcPct: parsed.thcPct,
      cultivarName: parsed.cultivarName,
      producer,
      cleanedStrainSlug: parsed.cleanedStrainSlug,
      canonicalName,
    });
  }

  return hits;
}

function buildCultivarInsert(c: CultivarRecord, nowMs: number): string {
  return `INSERT OR IGNORE INTO cultivar
  (id, name, canonical_name, producer, country_origin, genetic_lineage, created_at, submitted_by_patient_id)
VALUES (
  '${escapeSql(c.id)}',
  '${escapeSql(c.name)}',
  '${escapeSql(c.canonicalName)}',
  '${escapeSql(c.producer)}',
  NULL,
  NULL,
  ${nowMs},
  NULL
);`;
}

function buildBatchInsert(
  batchId: string,
  cultivarId: string,
  thcPct: number,
  nowMs: number,
): string {
  const batchNumber = `medbud-${thcPct}`;
  return `INSERT OR IGNORE INTO batch
  (id, cultivar_id, batch_number, harvest_date, test_date, expiry_date, irradiation, coa_url,
   thc_pct, cbd_pct, thcv_pct, cbg_pct, cbn_pct, cbc_pct, total_cannabinoids_pct,
   terp_pinene_a, terp_pinene_b, terp_myrcene, terp_limonene, terp_terpinolene,
   terp_linalool, terp_caryophyllene, terp_humulene, terp_ocimene, terp_bisabolol,
   terp_farnesene, terp_other_json, terp_total_pct,
   measurement_status, created_at, submitted_by_patient_id)
VALUES (
  '${escapeSql(batchId)}',
  '${escapeSql(cultivarId)}',
  '${escapeSql(batchNumber)}',
  NULL, NULL, NULL, 'unknown', NULL,
  ${thcPct.toFixed(1)}, NULL, NULL, NULL, NULL, NULL, NULL,
  NULL, NULL, NULL, NULL, NULL,
  NULL, NULL, NULL, NULL, NULL,
  NULL, NULL, NULL,
  'inferred',
  ${nowMs},
  NULL
);`;
}

function executeSqlBatches(batches: string[]): void {
  if (batches.length === 0) return;

  const dir = mkdtempSync(join(tmpdir(), 'phenologue-medbud-'));
  try {
    for (let i = 0; i < batches.length; i++) {
      const sqlFile = join(dir, `chunk-${i}.sql`);
      writeFileSync(sqlFile, batches[i]!);
      const cmd = `npx --no-install wrangler d1 execute phenologue --local --file="${sqlFile}"`;
      console.log(`> ${cmd}`);
      execSync(cmd, { stdio: 'inherit', shell: true });
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  console.log(`> fetching ${SOURCE_URL}`);

  let html = '';
  try {
    html = await fetchHtml(SOURCE_URL);
  } catch (err) {
    console.error(`error: failed to fetch MedBud listing: ${(err as Error).message}`);
    process.exit(1);
  }

  const hits = extractHits(html);
  if (hits.length === 0) {
    console.error(
      'error: no strain links found in HTML — selector may be stale or the page structure changed',
    );
    process.exit(1);
  }

  console.log(`> matched ${hits.length} strain/tier rows from listing`);

  // Group hits by (producer, cultivarName) so each cultivar gets a single row
  // and we collect all THC tiers seen for that cultivar.
  const cultivarMap = new Map<
    string,
    {
      key: CultivarKey;
      record: CultivarRecord;
      thcTiers: Set<number>;
    }
  >();

  const nowMs = Date.now();

  for (const hit of hits) {
    const dedupeKey = `${hit.producer}|||${hit.cultivarName}`;
    let entry = cultivarMap.get(dedupeKey);
    if (!entry) {
      entry = {
        key: { producer: hit.producer, cultivarName: hit.cultivarName },
        record: {
          id: nanoid(21),
          name: hit.cultivarName,
          canonicalName: hit.canonicalName,
          producer: hit.producer,
        },
        thcTiers: new Set<number>(),
      };
      cultivarMap.set(dedupeKey, entry);
    }
    entry.thcTiers.add(hit.thcPct);
  }

  // Build SQL statements.
  const cultivarStmts: string[] = [];
  const batchStmts: string[] = [];
  let cultivarCount = 0;
  let batchCount = 0;

  for (const entry of cultivarMap.values()) {
    cultivarStmts.push(buildCultivarInsert(entry.record, nowMs));
    cultivarCount++;
    for (const thcPct of entry.thcTiers) {
      const batchId = nanoid(21);
      batchStmts.push(buildBatchInsert(batchId, entry.record.id, thcPct, nowMs));
      batchCount++;
    }
  }

  // Print a per-producer summary so the operator can sanity-check.
  const byProducer: Record<string, number> = {};
  for (const entry of cultivarMap.values()) {
    byProducer[entry.key.producer] = (byProducer[entry.key.producer] ?? 0) + 1;
  }
  for (const p of Object.keys(byProducer).sort()) {
    console.log(`  ${p.padEnd(30)} ${byProducer[p]}`);
  }

  // Chunk into batches of 50 statements per file.
  const cultivarChunks = chunk(cultivarStmts, 50).map((c) => c.join('\n'));
  const batchChunks = chunk(batchStmts, 50).map((c) => c.join('\n'));

  // Cultivars first so batch FKs resolve.
  console.log(`> applying ${cultivarChunks.length} cultivar chunk(s)`);
  executeSqlBatches(cultivarChunks);
  console.log(`> applying ${batchChunks.length} batch chunk(s)`);
  executeSqlBatches(batchChunks);

  console.log(`\nImported ${cultivarCount} cultivars, ${batchCount} batches from MedBud`);
  console.log(
    `\nSuggested package.json script entry:\n  "db:import:medbud": "tsx scripts/import-medbud.ts"`,
  );
}

main().catch((err) => {
  console.error(`fatal: ${(err as Error).message}`);
  process.exit(1);
});
