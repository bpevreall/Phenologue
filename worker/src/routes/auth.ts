/**
 * Auth routes — registration, login, /me.
 *
 * Passkey registration/login are placeholders to be filled in by the
 * webauthn implementation. Password fallback uses argon2id via @noble/hashes.
 *
 * Security notes:
 *   - /register returns the same generic 200 whether the email is new or
 *     already registered. This is account-enumeration mitigation v1; the
 *     full email-verification flow lands in v0.2.
 *   - Password compare uses constant-time byte comparison. Argon2id already
 *     dominates the timing surface, but the explicit constant-time check
 *     eliminates a reviewer red-flag and protects future code paths that
 *     might hash-compare without a KDF.
 */

import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { argon2id } from '@noble/hashes/argon2';
import type { Env } from '../env';
import { signJwt } from '../lib/jwt';

const authRoutes = new Hono<{ Bindings: Env }>();

const ARGON2_PARAMS = { t: 3, m: 64 * 1024, p: 1, dkLen: 32 } as const;

interface RegisterBody {
  email: string;
  password: string;
  pseudonym?: string;
}

interface LoginBody {
  email: string;
  password: string;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

/**
 * Constant-time byte-array comparison. Returns false immediately if lengths
 * differ (length is not a secret); otherwise iterates every byte XOR'ing
 * differences into an accumulator so total work is independent of where the
 * first divergence occurs.
 *
 * Exported for unit tests.
 */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = argon2id(new TextEncoder().encode(password), salt, ARGON2_PARAMS);
  return `${bytesToHex(salt)}:${bytesToHex(hash)}`;
}

/**
 * Verify a password against the stored "salt:hash" string using argon2id and
 * a constant-time byte comparison. Exported so the patient-routes re-auth
 * gate (POST /export, DELETE /) can call it without duplicating logic.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const computed = argon2id(new TextEncoder().encode(password), hexToBytes(saltHex), ARGON2_PARAMS);
  const expected = hexToBytes(hashHex);
  return constantTimeEqual(computed, expected);
}

const REGISTER_RESPONSE = {
  data: {
    ok: true,
    message: 'If this email is new, your account has been created.',
  },
};

authRoutes.post('/register', async (c) => {
  const body = (await c.req.json()) as RegisterBody;

  if (!body.email || !body.password || body.password.length < 12) {
    return c.json(
      {
        data: null,
        errors: [{ code: 'bad_request', message: 'Email + password (>=12 chars) required' }],
      },
      400
    );
  }

  // Account-enumeration mitigation: respond identically whether or not the
  // email is already registered. We still must NOT create a duplicate row,
  // so we check existence and short-circuit silently if it exists.
  const existing = await c.env.DB.prepare('SELECT patient_id FROM patient_pii WHERE email = ?')
    .bind(body.email)
    .first();

  if (existing) {
    // Optionally log internally for ops visibility — never echo to the
    // client. Console output goes to Workers logs only.
    console.log(`register: email already registered (silent)`);
    return c.json(REGISTER_RESPONSE, 200);
  }

  const patientId = nanoid(21);
  const now = Date.now();
  const passwordHash = await hashPassword(body.password);

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO patient (id, created_at, pseudonym, methodology_version)
       VALUES (?, ?, ?, ?)`
    ).bind(patientId, now, body.pseudonym ?? null, c.env.METHODOLOGY_VERSION),
    c.env.DB.prepare('INSERT INTO patient_pii (patient_id, email) VALUES (?, ?)').bind(
      patientId,
      body.email
    ),
    c.env.DB.prepare(
      'INSERT INTO patient_auth (patient_id, password_hash) VALUES (?, ?)'
    ).bind(patientId, passwordHash),
  ]);

  // The client must call POST /api/auth/login to obtain a JWT. We deliberately
  // do NOT include the token in the register response so the new-vs-existing
  // response shape is identical.
  return c.json(REGISTER_RESPONSE, 200);
});

authRoutes.post('/login', async (c) => {
  const body = (await c.req.json()) as LoginBody;

  const row = await c.env.DB.prepare(
    `SELECT pa.patient_id, pa.password_hash, pa.failed_attempts, pa.locked_until
     FROM patient_auth pa JOIN patient_pii pp ON pa.patient_id = pp.patient_id
     WHERE pp.email = ?`
  )
    .bind(body.email)
    .first<{
      patient_id: string;
      password_hash: string | null;
      failed_attempts: number;
      locked_until: number | null;
    }>();

  if (!row || !row.password_hash) {
    return c.json(
      { data: null, errors: [{ code: 'invalid_credentials', message: 'Login failed' }] },
      401
    );
  }

  if (row.locked_until && row.locked_until > Date.now()) {
    return c.json(
      { data: null, errors: [{ code: 'locked', message: 'Account temporarily locked' }] },
      423
    );
  }

  const ok = await verifyPassword(body.password, row.password_hash);
  if (!ok) {
    await c.env.DB.prepare(
      'UPDATE patient_auth SET failed_attempts = failed_attempts + 1 WHERE patient_id = ?'
    )
      .bind(row.patient_id)
      .run();
    return c.json(
      { data: null, errors: [{ code: 'invalid_credentials', message: 'Login failed' }] },
      401
    );
  }

  await c.env.DB.prepare(
    'UPDATE patient_auth SET failed_attempts = 0, last_login_at = ? WHERE patient_id = ?'
  )
    .bind(Date.now(), row.patient_id)
    .run();

  if (!c.env.JWT_SIGNING_KEY) {
    return c.json(
      { data: null, errors: [{ code: 'misconfigured', message: 'JWT key not set' }] },
      500
    );
  }

  const token = await signJwt(row.patient_id, c.env.JWT_SIGNING_KEY, nanoid(16));
  return c.json({ data: { token, patient_id: row.patient_id } });
});

authRoutes.get('/me', async (c) => {
  const authHeader = c.req.header('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ data: null }, 401);
  }
  // Minimal /me — full implementation belongs in patient routes
  return c.json({ data: { ok: true } });
});

// Passkey stubs — implementation deferred
authRoutes.post('/passkey/register', (c) =>
  c.json({ data: null, errors: [{ code: 'not_implemented', message: 'Coming in v0.2' }] }, 501)
);
authRoutes.post('/passkey/login', (c) =>
  c.json({ data: null, errors: [{ code: 'not_implemented', message: 'Coming in v0.2' }] }, 501)
);

export { authRoutes };
