/**
 * One-shot dev utility: reset a local account's password.
 * Usage: tsx scripts/reset-password.ts
 */
import { argon2id } from '@noble/hashes/argon2';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ARGON2_PARAMS = { t: 3, m: 64 * 1024, p: 1, dkLen: 32 } as const;
const EMAIL = 'brendon@phenologue.local';
const NEW_PASSWORD = 'phenologue2026';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

const salt = new Uint8Array(16);
// deterministic seed for reproducibility in dev
for (let i = 0; i < 16; i++) salt[i] = i + 1;

const hash = argon2id(new TextEncoder().encode(NEW_PASSWORD), salt, ARGON2_PARAMS);
const stored = `${bytesToHex(salt)}:${bytesToHex(hash)}`;

const sql = `
UPDATE patient_auth
SET password_hash = '${stored}', failed_attempts = 0, locked_until = NULL
WHERE patient_id = (
  SELECT patient_id FROM patient_pii WHERE email = '${EMAIL}'
);
`;

const dir = mkdtempSync(join(tmpdir(), 'pheno-reset-'));
const sqlFile = join(dir, 'reset.sql');
writeFileSync(sqlFile, sql);

execSync(`npx wrangler d1 execute phenologue --local --file "${sqlFile}"`, { stdio: 'inherit' });

rmSync(dir, { recursive: true });

console.log(`\nPassword reset for ${EMAIL}`);
console.log(`New password: ${NEW_PASSWORD}`);
