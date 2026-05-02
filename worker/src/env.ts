/**
 * Cloudflare bindings and runtime variables for the Phenologue Worker.
 */

export interface Env {
  DB: D1Database;
  IMAGES?: R2Bucket;
  CACHE: KVNamespace;
  AGG_QUEUE?: Queue<AggregationJob>;

  METHODOLOGY_VERSION: string;
  API_VERSION: string;
  ENVIRONMENT: 'local' | 'dev' | 'prod';

  JWT_SIGNING_KEY?: string;
  PASSKEY_RP_ID?: string;
  PASSKEY_RP_NAME?: string;
}

export type AggregationJob =
  | { kind: 'session_completed'; session_id: string }
  | { kind: 'batch_chemotype_changed'; batch_id: string }
  | { kind: 'scheduled_recompute' };

export type ContextVars = {
  patient_id?: string;
  request_id?: string;
  claims?: { sub: string; iat: number; exp: number; jti: string };
};
