/**
 * JWT helpers — HS256 using WebCrypto.
 * Cloudflare Workers runtime supports SubtleCrypto natively.
 */

interface JwtClaims {
  sub: string;       // patient_id
  iat: number;       // issued at (seconds)
  exp: number;       // expires at (seconds)
  jti: string;       // unique token id (for revocation)
}

interface JwtHeader {
  alg: string;
  typ?: string;
  kid?: string;
}

const TOKEN_TTL_SECONDS = 24 * 60 * 60;
const CLOCK_SKEW_SECONDS = 60;
const DEV_PLACEHOLDER_KEY = 'local-dev-only-change-before-prod-aaaaaaaaaaaaaaaaaaaaaaaa';
const MIN_KEY_LENGTH = 32;

/**
 * Validates that a JWT signing key is non-empty, sufficiently long, and not
 * the well-known dev placeholder. Throws on failure so the Hono error handler
 * surfaces a clear message rather than the route silently signing/verifying
 * with a known-weak key.
 *
 * Called from middleware/auth.ts on first request and from signing paths.
 */
export function assertSigningKey(key: string | undefined): asserts key is string {
  if (!key || key.length === 0) {
    throw new Error('JWT_SIGNING_KEY is not set; refusing to sign or verify tokens.');
  }
  if (key.length < MIN_KEY_LENGTH) {
    throw new Error(
      `JWT_SIGNING_KEY is too short (${key.length} chars; need >=${MIN_KEY_LENGTH}).`
    );
  }
  if (key === DEV_PLACEHOLDER_KEY) {
    throw new Error(
      'JWT_SIGNING_KEY is the dev placeholder; set a real secret before serving auth.'
    );
  }
}

function base64UrlEncode(data: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof data === 'string') {
    bytes = new TextEncoder().encode(data);
  } else if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
  } else {
    bytes = data;
  }
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(s.length + ((4 - (s.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signJwt(patientId: string, secret: string, jti: string): Promise<string> {
  assertSigningKey(secret);
  const header: JwtHeader = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claims: JwtClaims = {
    sub: patientId,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
    jti,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const claimsB64 = base64UrlEncode(JSON.stringify(claims));
  const signingInput = `${headerB64}.${claimsB64}`;

  const key = await importKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  const sigB64 = base64UrlEncode(signature);

  return `${signingInput}.${sigB64}`;
}

/**
 * verifyJwt validation order (defensive — rejects malformed input early):
 *   1. Token splits into exactly 3 parts.
 *   2. Header parses as JSON and `alg === 'HS256'`, `typ === 'JWT'`.
 *      (alg-confusion mitigation: 'none' or 'RS256' tokens are rejected
 *      regardless of signature, so an attacker can't downgrade us.)
 *   3. HMAC-SHA256 signature verifies against `secret`.
 *   4. Claims parse as JSON.
 *   5. exp >= now (token not expired).
 *   6. iat <= now + 60 (no future-dated tokens, with 1m clock skew).
 *
 * Throws with a generic message on any failure; callers MUST treat any throw
 * as "invalid token" without leaking the specific reason to the client.
 */
export async function verifyJwt(token: string, secret: string): Promise<JwtClaims> {
  assertSigningKey(secret);

  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed token');
  const [headerB64, claimsB64, sigB64] = parts as [string, string, string];

  // Step 2: parse and validate the header BEFORE doing any crypto work.
  let header: JwtHeader;
  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerB64))) as JwtHeader;
  } catch {
    throw new Error('Malformed token header');
  }
  if (header.alg !== 'HS256') {
    // Reject 'none', 'RS256', 'ES256', etc. We are HS256-only.
    throw new Error('Unsupported alg');
  }
  if (header.typ !== undefined && header.typ !== 'JWT') {
    throw new Error('Unsupported typ');
  }

  const key = await importKey(secret);
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    base64UrlDecode(sigB64),
    new TextEncoder().encode(`${headerB64}.${claimsB64}`)
  );
  if (!valid) throw new Error('Invalid signature');

  let claims: JwtClaims;
  try {
    claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(claimsB64))) as JwtClaims;
  } catch {
    throw new Error('Malformed claims');
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== 'number' || claims.exp < now) {
    throw new Error('Token expired');
  }
  if (typeof claims.iat !== 'number' || claims.iat > now + CLOCK_SKEW_SECONDS) {
    // Future-dated token — either clock skew beyond tolerance or forgery.
    throw new Error('Token iat in future');
  }

  return claims;
}
