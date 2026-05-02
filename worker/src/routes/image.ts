/**
 * Image routes — fetch image bytes by id, toggle public flag.
 *
 * Bytes are served via the Worker (not signed-URL redirect) so we can apply
 * row-level access checks every time. The R2 key is never exposed to clients.
 *
 * Security note (Stream C):
 *   - Default: every request must present a valid bearer JWT (requireAuth
 *     applied to '*'). The previous behaviour read patient_id from context
 *     for unauthenticated requests, which silently returned undefined and
 *     left the door open to ID-enumeration without a working ACL check.
 *   - Public images (is_public=1) are explicitly served without auth via a
 *     dedicated `/public/:id` endpoint, mounted BEFORE the requireAuth
 *     middleware. The public path is the only auth-bypass route in this
 *     module and it is explicit and obvious.
 */

import { Hono } from 'hono';
import type { Env, ContextVars } from '../env';
import { requireAuth } from '../middleware/auth';
import { fetchImage, imageResponse } from '../lib/r2';
import { badRequest, notFound, unauthorized } from '../lib/errors';

const imageRoutes = new Hono<{ Bindings: Env; Variables: ContextVars }>();

interface PatchImageBody {
  is_public?: boolean;
  note?: string;
}

// =============================================================
// GET /api/images/public/:id — explicit no-auth route for public images
// =============================================================
// Mounted BEFORE the requireAuth middleware so it remains reachable by
// unauthenticated clients. Only serves bytes when `is_public = 1`; private
// images return 404 from this path so we don't leak existence.
imageRoutes.get('/public/:id', async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(
    'SELECT r2_key, is_public, mime_type FROM microscope_image WHERE id = ?'
  )
    .bind(id)
    .first<{ r2_key: string; is_public: number; mime_type: string }>();

  if (!row || !row.is_public) return notFound(c, 'Image not found');

  const obj = await fetchImage(c.env.IMAGES, row.r2_key);
  if (!obj) return notFound(c, 'Image data missing');
  return imageResponse(obj);
});

// All other routes in this module require auth.
imageRoutes.use('*', requireAuth());

// =============================================================
// GET /api/images/:id — serve image bytes (auth required)
// =============================================================
// The owner sees their own images. Public images can also be served here
// to authenticated callers (e.g. when browsing other patients' shared
// captures); unauthenticated callers must use /public/:id above.
imageRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const patientId = c.get('patient_id')!;

  const row = await c.env.DB.prepare(
    'SELECT r2_key, patient_id, is_public, mime_type FROM microscope_image WHERE id = ?'
  )
    .bind(id)
    .first<{ r2_key: string; patient_id: string; is_public: number; mime_type: string }>();

  if (!row) return notFound(c, 'Image not found');

  // Owner OR public image — otherwise refuse.
  if (row.patient_id !== patientId && !row.is_public) {
    return unauthorized(c, 'Image is not public');
  }

  const obj = await fetchImage(c.env.IMAGES, row.r2_key);
  if (!obj) return notFound(c, 'Image data missing');

  return imageResponse(obj);
});

// =============================================================
// PATCH /api/images/:id — update flags (owner only)
// =============================================================
imageRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const patientId = c.get('patient_id')!;
  const body = (await c.req.json()) as PatchImageBody;

  const row = await c.env.DB.prepare(
    'SELECT patient_id FROM microscope_image WHERE id = ?'
  )
    .bind(id)
    .first<{ patient_id: string }>();

  if (!row) return notFound(c, 'Image not found');
  if (row.patient_id !== patientId) {
    return unauthorized(c, 'Not the image owner');
  }

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (body.is_public !== undefined) {
    updates.push('is_public = ?');
    values.push(body.is_public ? 1 : 0);
  }
  if (body.note !== undefined) {
    updates.push('note = ?');
    values.push(body.note || null);
  }

  if (updates.length === 0) return badRequest(c, 'No updateable fields supplied');

  values.push(id);
  await c.env.DB.prepare(`UPDATE microscope_image SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  return c.json({ data: { ok: true } });
});

export { imageRoutes };
