import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';

/**
 * Maintenance-mode guard.
 *
 * When `MAINTENANCE_MODE=true` is set on the Cloudflare Pages project (prod),
 * only the public-info routes are reachable; everything else redirects to `/`.
 * The home page itself reads `locals.maintenance` (set below) to render the
 * "private beta" landing copy in place of the normal hero.
 *
 * Env vars on Cloudflare Pages are exposed via `platform.env` at request time.
 * Set MAINTENANCE_MODE=true in the Pages prod project; leave unset in dev.
 */

const PUBLIC_ROUTES = new Set<string>(['/', '/about', '/methodology']);

const PUBLIC_PREFIXES = [
  '/_app/',         // SvelteKit static assets
  '/favicon',
  '/robots.txt',
];

function isPublic(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export const handle: Handle = async ({ event, resolve }) => {
  const maintenance = event.platform?.env?.MAINTENANCE_MODE === 'true';
  event.locals.maintenance = maintenance;

  if (maintenance && !isPublic(event.url.pathname)) {
    throw redirect(307, '/');
  }

  return resolve(event);
};
