/**
 * Batch routes — single-batch detail, COA updates, organoleptic submission,
 * microscope image upload.
 *
 * Detail is public (the catalogue is browsable). All mutations require auth
 * and are recorded in audit_event.
 */

import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import type { Env, ContextVars } from '../env';
import { requireAuth } from '../middleware/auth';
import { recordAudit } from '../lib/audit';
import { refreshBatchChemotype } from '../lib/chemotype';
import { uploadImage, ValidationError } from '../lib/r2';
import { badRequest, notFound } from '../lib/errors';

const batchRoutes = new Hono<{ Bindings: Env; Variables: ContextVars }>();

interface PatchBatchBody {
  coa_url?: string;
  measurement_status?: 'measured' | 'partial' | 'inferred';

  thc_pct?: number;
  cbd_pct?: number;
  thcv_pct?: number;
  cbg_pct?: number;
  cbn_pct?: number;
  cbc_pct?: number;
  total_cannabinoids_pct?: number;

  terp_pinene_a?: number;
  terp_pinene_b?: number;
  terp_myrcene?: number;
  terp_limonene?: number;
  terp_terpinolene?: number;
  terp_linalool?: number;
  terp_caryophyllene?: number;
  terp_humulene?: number;
  terp_ocimene?: number;
  terp_bisabolol?: number;
  terp_farnesene?: number;
  terp_total_pct?: number;
}

interface OrganolepticBody {
  descriptors: string[];
  intensity?: number;
  note?: string;
  is_public?: boolean;
}

interface MicroscopeBody {
  // base64-encoded image data; multipart-on-Workers is heavy, so we accept
  // a JSON envelope for now. Real frontend can sniff this.
  image_base64: string;
  mime_type: string;
  magnification?: number;
  trichome_clear_pct?: number;
  trichome_cloudy_pct?: number;
  trichome_amber_pct?: number;
  density?: 'low' | 'medium' | 'high' | 'very_high';
  note?: string;
  is_public?: boolean;
}

const TERPENE_FIELDS = [
  'terp_pinene_a',
  'terp_pinene_b',
  'terp_myrcene',
  'terp_limonene',
  'terp_terpinolene',
  'terp_linalool',
  'terp_caryophyllene',
  'terp_humulene',
  'terp_ocimene',
  'terp_bisabolol',
  'terp_farnesene',
  'terp_total_pct',
] as const;

const CANNABINOID_FIELDS = [
  'thc_pct',
  'cbd_pct',
  'thcv_pct',
  'cbg_pct',
  'cbn_pct',
  'cbc_pct',
  'total_cannabinoids_pct',
] as const;

// =============================================================
// GET /api/batches/:id — public batch detail
// =============================================================
batchRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');

  const batch = await c.env.DB.prepare(
    `SELECT b.*, c.name AS cultivar_name, c.producer, c.country_origin,
            bc.dominant_terpene, bc.dominant_pct, bc.secondary_terpene,
            bc.secondary_pct, bc.classification
     FROM batch b
     JOIN cultivar c ON b.cultivar_id = c.id
     LEFT JOIN batch_chemotype bc ON bc.batch_id = b.id
     WHERE b.id = ?`
  )
    .bind(id)
    .first();

  if (!batch) return notFound(c, 'Batch not found');

  return c.json({ data: batch });
});

// =============================================================
// PATCH /api/batches/:id — update COA / terpenes (auth)
// =============================================================
batchRoutes.patch('/:id', requireAuth(), async (c) => {
  const patientId = c.get('patient_id')!;
  const id = c.req.param('id');
  const body = (await c.req.json()) as PatchBatchBody;

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (body.coa_url !== undefined) {
    updates.push('coa_url = ?');
    values.push(body.coa_url || null);
  }
  if (body.measurement_status !== undefined) {
    if (!['measured', 'partial', 'inferred'].includes(body.measurement_status)) {
      return badRequest(c, 'measurement_status must be measured/partial/inferred');
    }
    updates.push('measurement_status = ?');
    values.push(body.measurement_status);
  }

  for (const field of [...CANNABINOID_FIELDS, ...TERPENE_FIELDS]) {
    if (body[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(body[field] ?? null);
    }
  }

  if (updates.length === 0) {
    return badRequest(c, 'No fields supplied to update');
  }

  values.push(id);
  await c.env.DB.prepare(`UPDATE batch SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  const chemo = await refreshBatchChemotype(c.env.DB, id);

  await recordAudit(c.env.DB, {
    actorPatientId: patientId,
    action: 'batch.update',
    targetType: 'batch',
    targetId: id,
    metadata: { fields: Object.keys(body) },
    ip: c.req.header('cf-connecting-ip'),
    userAgent: c.req.header('user-agent'),
  });

  return c.json({ data: { ok: true, chemotype: chemo } });
});

// =============================================================
// POST /api/batches/:id/organoleptic — patient organoleptic assessment (auth)
// =============================================================
batchRoutes.post('/:id/organoleptic', requireAuth(), async (c) => {
  const patientId = c.get('patient_id')!;
  const batchId = c.req.param('id');
  const body = (await c.req.json()) as OrganolepticBody;

  if (!Array.isArray(body.descriptors) || body.descriptors.length === 0) {
    return badRequest(c, 'descriptors[] required');
  }

  const batch = await c.env.DB.prepare('SELECT id FROM batch WHERE id = ?')
    .bind(batchId)
    .first();
  if (!batch) return notFound(c, 'Batch not found');

  const id = nanoid(16);
  await c.env.DB.prepare(
    `INSERT INTO organoleptic_assessment
       (id, batch_id, patient_id, assessed_at, descriptors_json, intensity, note, is_public)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      batchId,
      patientId,
      Date.now(),
      JSON.stringify(body.descriptors),
      body.intensity ?? null,
      body.note ?? null,
      body.is_public ? 1 : 0
    )
    .run();

  return c.json({ data: { id } }, 201);
});

// =============================================================
// POST /api/batches/:id/images — upload microscope image (auth)
// =============================================================
batchRoutes.post('/:id/images', requireAuth(), async (c) => {
  const patientId = c.get('patient_id')!;
  const batchId = c.req.param('id');
  const body = (await c.req.json()) as MicroscopeBody;

  if (!body.image_base64 || !body.mime_type) {
    return badRequest(c, 'image_base64 and mime_type required');
  }

  const batch = await c.env.DB.prepare('SELECT id FROM batch WHERE id = ?')
    .bind(batchId)
    .first();
  if (!batch) return notFound(c, 'Batch not found');

  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(body.image_base64), (ch) => ch.charCodeAt(0));
  } catch {
    return badRequest(c, 'image_base64 is not valid base64');
  }

  let upload;
  try {
    upload = await uploadImage(
      c.env.IMAGES,
      patientId,
      batchId,
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      body.mime_type
    );
  } catch (err) {
    if (err instanceof ValidationError) return badRequest(c, err.message);
    throw err;
  }

  const id = nanoid(16);
  await c.env.DB.prepare(
    `INSERT INTO microscope_image
       (id, batch_id, patient_id, captured_at, r2_key, mime_type, bytes,
        magnification, trichome_clear_pct, trichome_cloudy_pct, trichome_amber_pct,
        density, note, is_public)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      batchId,
      patientId,
      Date.now(),
      upload.r2_key,
      upload.mime_type,
      upload.bytes,
      body.magnification ?? null,
      body.trichome_clear_pct ?? null,
      body.trichome_cloudy_pct ?? null,
      body.trichome_amber_pct ?? null,
      body.density ?? null,
      body.note ?? null,
      body.is_public ? 1 : 0
    )
    .run();

  return c.json({ data: { id, r2_key: upload.r2_key } }, 201);
});

// =============================================================
// GET /api/batches/:id/images — list images visible to caller
// =============================================================
batchRoutes.get('/:id/images', async (c) => {
  const batchId = c.req.param('id');
  const patientId = c.get('patient_id');

  // Public images are always visible. Patient's own images are visible to
  // them when authenticated.
  let sql =
    `SELECT id, captured_at, magnification,
            trichome_clear_pct, trichome_cloudy_pct, trichome_amber_pct,
            density, is_public
     FROM microscope_image WHERE batch_id = ?`;
  const params: (string | number)[] = [batchId];

  if (patientId) {
    sql += ' AND (is_public = 1 OR patient_id = ?)';
    params.push(patientId);
  } else {
    sql += ' AND is_public = 1';
  }

  sql += ' ORDER BY captured_at DESC';

  const result = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json({ data: result.results });
});

export { batchRoutes };
