/**
 * Phenologue Worker — entry point.
 *
 * Hono-based API router. Mounts feature modules and wires middleware.
 * Methodology version is bound at the env level and stamped onto every response.
 *
 * In addition to the HTTP `fetch` handler, this module exposes:
 *   - `queue` — consumer for AGG_QUEUE jobs (aggregation rebuilds)
 *   - `scheduled` — daily cron entry point for full aggregate recompute
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';

import type { Env, AggregationJob } from './env';
import { authRoutes } from './routes/auth';
import { patientRoutes } from './routes/patient';
import { cultivarRoutes } from './routes/cultivar';
import { batchRoutes } from './routes/batch';
import { imageRoutes } from './routes/image';
import { sessionRoutes } from './routes/session';
import { intakeRoutes } from './routes/intake';
import { coachRoutes } from './routes/coach';
import { reportRoutes } from './routes/report';
import { publicRoutes } from './routes/public';
import { responseEnvelope } from './middleware/envelope';
import { rateLimit } from './middleware/rate-limit';
import { requireAuth } from './middleware/auth';
import { handleAggregationJob, scheduledRecompute } from './lib/aggregation';

const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', logger());
app.use('*', secureHeaders());
app.use(
  '*',
  cors({
    origin: (origin) => {
      const allowed = [
        'https://phenologue.uk',
        'https://www.phenologue.uk',
        'https://phenologue.pages.dev',
        'https://dev.phenologue.uk',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
      ];
      return allowed.includes(origin) ? origin : null;
    },
    credentials: true,
  })
);
app.use('*', responseEnvelope());
app.use('*', rateLimit());

// Health check
app.get('/health', (c) =>
  c.json({
    ok: true,
    methodology_version: c.env.METHODOLOGY_VERSION,
    api_version: c.env.API_VERSION,
    environment: c.env.ENVIRONMENT,
  })
);

// Public routes (no auth required)
app.route('/api/public', publicRoutes);
app.route('/api/auth', authRoutes);

// Routes that require auth on every endpoint
app.use('/api/patient/*', requireAuth());
app.use('/api/sessions/*', requireAuth());
app.use('/api/reports/*', requireAuth());
app.route('/api/patient', patientRoutes);
app.use('/api/sessions/intake/*', requireAuth());
app.route('/api/sessions/intake', intakeRoutes);
app.route('/api/sessions', sessionRoutes);
app.use('/api/coach/*', requireAuth());
app.route('/api/coach', coachRoutes);
app.route('/api/reports', reportRoutes);

// Mixed routers — public reads, auth required only on mutating endpoints
// (enforced inline in each handler).
app.route('/api/cultivars', cultivarRoutes);
app.route('/api/batches', batchRoutes);
app.route('/api/images', imageRoutes);

// 404
app.notFound((c) =>
  c.json(
    {
      data: null,
      errors: [{ code: 'not_found', message: 'Endpoint not found' }],
    },
    404
  )
);

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json(
    {
      data: null,
      errors: [{ code: 'internal_error', message: 'An unexpected error occurred' }],
    },
    500
  );
});

export default {
  fetch: app.fetch,

  async queue(batch: MessageBatch<AggregationJob>, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      try {
        await handleAggregationJob(env, msg.body);
        msg.ack();
      } catch (err) {
        console.error('Aggregation job failed:', err);
        msg.retry();
      }
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(scheduledRecompute(env));
  },
};
