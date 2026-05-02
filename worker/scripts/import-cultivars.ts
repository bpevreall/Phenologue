/**
 * import-cultivars.ts
 *
 * Bulk-imports a producer/cultivar catalogue from a CSV. Designed to accept
 * MedBud's curated catalogue when (if) a data partnership is in place — but
 * will work with any CSV that has the columns documented below.
 *
 * Usage:
 *   pnpm exec tsx scripts/import-cultivars.ts --local --file ../data/medbud-cultivars.csv
 *   pnpm exec tsx scripts/import-cultivars.ts --env dev --remote --file ../data/medbud-cultivars.csv
 *
 * Required columns (case-insensitive header):
 *   producer        — string, exact producer name
 *   name            — string, cultivar marketing name
 *
 * Optional columns:
 *   country_origin   — ISO 3166 alpha-2 or country name
 *   genetic_lineage  — free text, e.g. "Lemonnade x Cookies"
 *   thc_label        — MedBud-style "T22" or numeric percent (used purely for
 *                      operator sanity-checking; NOT inserted as a measurement)
 *   medbud_url       — source URL, stored as a comment-style attribution
 *
 * Notes:
 *   - canonical_name is computed from `name` if not supplied.
 *   - Existing rows (matched on canonical_name + producer) are kept; updates go
 *     through PATCH /api/cultivars/:id, not this importer.
 *   - This script does NOT import batch-level or per-COA data. Batches are
 *     ingested separately because batch identity changes constantly and the
 *     import shape is different. See `import-batches.ts` (todo).
 *   - Every imported row gets `submitted_by_patient_id = NULL` and a comment
 *     in `genetic_lineage` recording the source URL when supplied, so any
 *     patient or admin can trace provenance back to the source catalogue.
 *
 * The importer is deliberately conservative: it only INSERTs new cultivars,
 * never updates or deletes. To swap in a fresh catalogue, run a manual
 * inspection of diff before re-running.
 */

import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

interface RunOpts {
  local: boolean;
  remote?: boolean;
  env?: 'dev' | 'prod';
  dbName?: string;
  file: string;
  dryRun: boolean;
}

interface CultivarRow {
  producer: string;
  name: string;
  canonical_name: string;
  country_origin: string | null;
  genetic_lineage: string | null;
  source_url: string | null;
  thc_label: string | null;
}

function canonicalName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = parseCsvRow(lines[0]!).map((h) => h.toLowerCase());
  const out: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvRow(lines[i]!);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]!] = (cells[j] ?? '').trim();
    }
    out.push(row);
  }
  return out;
}

function parseCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === ',') {
        out.push(cur);
        cur = '';
      } else if (ch === '"') {
        inQuotes = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

function normalise(rows: Array<Record<string, string>>): CultivarRow[] {
  const out: CultivarRow[] = [];
  for (const r of rows) {
    if (!r.producer || !r.name) continue;
    out.push({
      producer: r.producer,
      name: r.name,
      canonical_name: r.canonical_name?.length ? r.canonical_name : canonicalName(r.name),
      country_origin: r.country_origin || null,
      genetic_lineage: r.genetic_lineage || null,
      source_url: r.medbud_url || r.source_url || null,
      thc_label: r.thc_label || null,
    });
  }
  return out;
}

function escapeSql(s: string): string {
  return s.replace(/'/g, "''");
}

function buildInsertSql(rows: CultivarRow[]): string {
  if (rows.length === 0) return '';
  const stmts = rows.map((r) => {
    const lineageWithSource = [r.genetic_lineage, r.source_url ? `(source: ${r.source_url})` : null]
      .filter(Boolean)
      .join(' ')
      .trim();
    const lineage = lineageWithSource.length > 0 ? lineageWithSource : null;
    return `INSERT OR IGNORE INTO cultivar
  (id, name, canonical_name, producer, country_origin, genetic_lineage, created_at, submitted_by_patient_id)
VALUES (
  'imp_' || lower(hex(randomblob(8))),
  '${escapeSql(r.name)}',
  '${escapeSql(r.canonical_name)}',
  '${escapeSql(r.producer)}',
  ${r.country_origin ? `'${escapeSql(r.country_origin)}'` : 'NULL'},
  ${lineage ? `'${escapeSql(lineage)}'` : 'NULL'},
  CAST(strftime('%s','now') AS INTEGER) * 1000,
  NULL
);`;
  });
  return stmts.join('\n');
}

function parseArgs(argv: string[]): RunOpts {
  let file = '';
  let local = true;
  let remote = false;
  let env: 'dev' | 'prod' | undefined;
  let dbName: string | undefined;
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file') file = argv[++i] ?? '';
    else if (a === '--local') local = true;
    else if (a === '--remote') {
      local = false;
      remote = true;
    } else if (a === '--env') {
      const v = argv[++i];
      if (v === 'dev' || v === 'prod') env = v;
    } else if (a === '--db') dbName = argv[++i];
    else if (a === '--dry-run') dryRun = true;
  }

  if (!file) {
    console.error('--file <path-to-csv> is required');
    process.exit(1);
  }
  return { local, remote, env, dbName, file, dryRun };
}

function defaultDbName(opts: RunOpts): string {
  if (opts.dbName) return opts.dbName;
  if (opts.env === 'dev') return 'phenologue-dev';
  if (opts.env === 'prod') return 'phenologue-prod';
  return 'phenologue';
}

function run(opts: RunOpts): void {
  const csv = readFileSync(opts.file, 'utf8');
  const rows = normalise(parseCsv(csv));
  console.log(`> parsed ${rows.length} cultivar rows from ${opts.file}`);

  // Print a summary of producers + counts so the operator can sanity-check
  // before anything hits the database.
  const byProducer: Record<string, number> = {};
  for (const r of rows) byProducer[r.producer] = (byProducer[r.producer] ?? 0) + 1;
  for (const p of Object.keys(byProducer).sort()) {
    console.log(`  ${p.padEnd(30)} ${byProducer[p]}`);
  }

  if (opts.dryRun) {
    console.log('> dry run — no changes applied');
    return;
  }

  const sql = buildInsertSql(rows);
  const dir = mkdtempSync(join(tmpdir(), 'phenologue-import-'));
  const sqlFile = join(dir, 'cultivars.sql');
  writeFileSync(sqlFile, sql);

  const flags: string[] = [];
  if (opts.local) flags.push('--local');
  if (opts.remote) flags.push('--remote');
  if (opts.env) flags.push('--env', opts.env);

  const cmd = `npx --no-install wrangler d1 execute ${defaultDbName(opts)} ${flags.join(' ')} --file="${sqlFile}"`;
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', shell: true });
  console.log(`> imported ${rows.length} cultivars (existing rows skipped via INSERT OR IGNORE)`);
}

run(parseArgs(process.argv.slice(2)));
