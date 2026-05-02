/**
 * R2 helpers — microscope image upload and signed-URL retrieval.
 *
 * Images are keyed by `images/<patient_id>/<batch_id>/<random>.<ext>` so
 * row-level access checks can short-circuit by inspecting the key.
 * Public images (is_public=1) are served from a cached fetch at the Worker;
 * non-public images use a signed URL with 5-minute expiry.
 */

import { nanoid } from 'nanoid';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export interface UploadResult {
  r2_key: string;
  bytes: number;
  mime_type: string;
}

export async function uploadImage(
  bucket: R2Bucket,
  patientId: string,
  batchId: string,
  data: ArrayBuffer,
  mimeType: string
): Promise<UploadResult> {
  if (!ALLOWED_MIME.has(mimeType)) {
    throw new ValidationError(`Unsupported mime type: ${mimeType}`);
  }
  if (data.byteLength > MAX_BYTES) {
    throw new ValidationError(`Image exceeds ${MAX_BYTES} bytes`);
  }

  const ext = mimeType.split('/')[1]!;
  const key = `images/${patientId}/${batchId}/${nanoid(16)}.${ext}`;

  await bucket.put(key, data, {
    httpMetadata: { contentType: mimeType },
    customMetadata: { patient_id: patientId, batch_id: batchId },
  });

  return { r2_key: key, bytes: data.byteLength, mime_type: mimeType };
}

export async function fetchImage(
  bucket: R2Bucket,
  r2Key: string
): Promise<R2ObjectBody | null> {
  return bucket.get(r2Key);
}

/**
 * Streaming response for an R2 object. Used by the image-serving endpoint
 * after row-level authorisation checks have passed.
 */
export function imageResponse(obj: R2ObjectBody): Response {
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('cache-control', 'private, max-age=300');
  return new Response(obj.body, { headers });
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
