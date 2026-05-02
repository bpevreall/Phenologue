/**
 * Cultivar routes — catalogue search, detail, batch creation.
 *
 * Cultivars are shared across patients (one row per producer/cultivar combo).
 * Patients can submit new cultivars; we record `submitted_by_patient_id` so
 * data quality issues can be traced back to the contributing user without
 * exposing them in public output.
 *
 * Listing and detail are public; create/batch-create require auth, enforced
 * inline (this router is mounted without a global requireAuth so the catalogue
 * stays browsable to anonymous visitors).
 */

import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import type { Env, ContextVars } from '../env';
import { requireAuth } from '../middleware/auth';
import { refreshBatchChemotype } from '../lib/chemotype';
import { inferTerpeneProfile } from '../lib/inference';
import { badRequest, notFound } from '../lib/errors';

const cultivarRoutes = new Hono<{ Bindings: Env; Variables: ContextVars }>();

interface CreateCultivarBody {
  name: string;
  producer: string;
  country_origin?: string;
  genetic_lineage?: string;
}

interface CreateBatchBody {
  batch_number: string;
  harvest_date?: string;
  test_date?: string;
  expiry_date?: string;
  irradiation?: 'gamma' | 'ebeam' | 'none' | 'unknown';
  coa_url?: string;

  measurement_status: 'measured' | 'partial' | 'inferred';

  // Cannabinoids
  thc_pct?: number;
  cbd_pct?: number;
  thcv_pct?: number;
  cbg_pct?: number;
  cbn_pct?: number;
  cbc_pct?: number;
  total_cannabinoids_pct?: number;

  // Terpenes (provide all/some when measured/partial)
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

  // For measurement_status = 'inferred', supply these and the Worker
  // populates terp_* via inference.
  organoleptic_descriptors?: string[];
}

function canonicalName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// =============================================================
// GET /api/cultivars?q=&producer=
// =============================================================
cultivarRoutes.get('/', async (c) => {
  const q = c.req.query('q');
  const producer = c.req.query('producer');

  let sql =
    `SELECT id, name, producer, country_origin, genetic_lineage,
            canonical_name, created_at
     FROM cultivar WHERE 1=1`;
  const params: (string | number)[] = [];

  if (q) {
    sql += ' AND (canonical_name LIKE ? OR name LIKE ?)';
    const like = `%${q.toLowerCase()}%`;
    params.push(like, like);
  }
  if (producer) {
    sql += ' AND producer = ?';
    params.push(producer);
  }

  sql += ' ORDER BY name LIMIT 100';

  const result = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json({ data: result.results });
});

// =============================================================
// GET /api/cultivars/:id
// =============================================================
cultivarRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');

  const cultivar = await c.env.DB.prepare(
    `SELECT id, name, producer, country_origin, genetic_lineage,
            canonical_name, created_at
     FROM cultivar WHERE id = ?`
  )
    .bind(id)
    .first();

  if (!cultivar) return notFound(c, 'Cultivar not found');

  const batches = await c.env.DB.prepare(
    `SELECT b.id, b.batch_number, b.harvest_date, b.test_date, b.expiry_date,
            b.measurement_status, b.thc_pct, b.cbd_pct, b.terp_total_pct,
            bc.dominant_terpene, bc.secondary_terpene, bc.classification
     FROM batch b
     LEFT JOIN batch_chemotype bc ON bc.batch_id = b.id
     WHERE b.cultivar_id = ?
     ORDER BY b.created_at DESC`
  )
    .bind(id)
    .all();

  return c.json({ data: { ...cultivar, batches: batches.results } });
});

// =============================================================
// POST /api/cultivars — create from patient submission (auth)
// =============================================================
cultivarRoutes.post('/', requireAuth(), async (c) => {
  const patientId = c.get('patient_id')!;
  const body = (await c.req.json()) as CreateCultivarBody;

  if (!body.name || !body.producer) {
    return badRequest(c, 'name and producer are required');
  }

  const canonical = canonicalName(body.name);

  const existing = await c.env.DB.prepare(
    'SELECT id FROM cultivar WHERE canonical_name = ? AND producer = ?'
  )
    .bind(canonical, body.producer)
    .first<{ id: string }>();

  if (existing) {
    return c.json({ data: { id: existing.id, existed: true } });
  }

  const id = nanoid(16);
  await c.env.DB.prepare(
    `INSERT INTO cultivar (id, name, canonical_name, producer, country_origin,
                           genetic_lineage, created_at, submitted_by_patient_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      body.name,
      canonical,
      body.producer,
      body.country_origin ?? null,
      body.genetic_lineage ?? null,
      Date.now(),
      patientId
    )
    .run();

  return c.json({ data: { id, existed: false } }, 201);
});

// =============================================================
// GET /api/cultivars/:id/batches
// =============================================================
cultivarRoutes.get('/:id/batches', async (c) => {
  const id = c.req.param('id');

  const result = await c.env.DB.prepare(
    `SELECT b.*, bc.dominant_terpene, bc.secondary_terpene, bc.classification
     FROM batch b
     LEFT JOIN batch_chemotype bc ON bc.batch_id = b.id
     WHERE b.cultivar_id = ?
     ORDER BY b.created_at DESC`
  )
    .bind(id)
    .all();

  return c.json({ data: result.results });
});

// =============================================================
// POST /api/cultivars/:id/batches — create batch (auth)
// =============================================================
cultivarRoutes.post('/:id/batches', requireAuth(), async (c) => {
  const patientId = c.get('patient_id')!;
  const cultivarId = c.req.param('id');
  const body = (await c.req.json()) as CreateBatchBody;

  if (!body.batch_number || !body.measurement_status) {
    return badRequest(c, 'batch_number and measurement_status required');
  }
  if (!['measured', 'partial', 'inferred'].includes(body.measurement_status)) {
    return badRequest(c, 'measurement_status must be measured/partial/inferred');
  }

  const cultivar = await c.env.DB.prepare('SELECT id FROM cultivar WHERE id = ?')
    .bind(cultivarId)
    .first();
  if (!cultivar) return notFound(c, 'Cultivar not found');

  // Build the terpene profile. For 'inferred' status, run the inference
  // pipeline against the supplied organoleptic descriptors.
  let terpenes: Partial<CreateBatchBody> = body;
  let inferredFrom: string[] = [];
  if (body.measurement_status === 'inferred') {
    if (!body.organoleptic_descriptors?.length) {
      return badRequest(
        c,
        'inferred batches must include organoleptic_descriptors'
      );
    }
    const inferred = await inferTerpeneProfile(c.env.DB, body.organoleptic_descriptors);
    terpenes = { ...terpenes, ...inferred };
    inferredFrom = inferred.inferred_from;
  }

  const id = nanoid(16);
  const now = Date.now();

  await c.env.DB.prepare(
    `INSERT INTO batch
       (id, cultivar_id, batch_number, harvest_date, test_date, expiry_date,
        irradiation, coa_url,
        thc_pct, cbd_pct, thcv_pct, cbg_pct, cbn_pct, cbc_pct, total_cannabinoids_pct,
        terp_pinene_a, terp_pinene_b, terp_myrcene, terp_limonene, terp_terpinolene,
        terp_linalool, terp_caryophyllene, terp_humulene, terp_ocimene, terp_bisabolol,
        terp_farnesene, terp_total_pct,
        measurement_status, created_at, submitted_by_patient_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?,
             ?, ?, ?, ?, ?, ?, ?,
             ?, ?, ?, ?, ?,
             ?, ?, ?, ?, ?,
             ?, ?,
             ?, ?, ?)`
  )
    .bind(
      id,
      cultivarId,
      body.batch_number,
      body.harvest_date ?? null,
      body.test_date ?? null,
      body.expiry_date ?? null,
      body.irradiation ?? null,
      body.coa_url ?? null,
      body.thc_pct ?? null,
      body.cbd_pct ?? null,
      body.thcv_pct ?? null,
      body.cbg_pct ?? null,
      body.cbn_pct ?? null,
      body.cbc_pct ?? null,
      body.total_cannabinoids_pct ?? null,
      terpenes.terp_pinene_a ?? null,
      terpenes.terp_pinene_b ?? null,
      terpenes.terp_myrcene ?? null,
      terpenes.terp_limonene ?? null,
      terpenes.terp_terpinolene ?? null,
      terpenes.terp_linalool ?? null,
      terpenes.terp_caryophyllene ?? null,
      terpenes.terp_humulene ?? null,
      terpenes.terp_ocimene ?? null,
      terpenes.terp_bisabolol ?? null,
      terpenes.terp_farnesene ?? null,
      terpenes.terp_total_pct ?? null,
      body.measurement_status,
      now,
      patientId
    )
    .run();

  // The 0003 trigger has stamped top-two terpenes; refresh classification.
  const chemo = await refreshBatchChemotype(c.env.DB, id);

  return c.json(
    {
      data: {
        id,
        chemotype: chemo,
        inferred_from: inferredFrom,
      },
    },
    201
  );
});

export { cultivarRoutes };
