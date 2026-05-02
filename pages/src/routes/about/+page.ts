// Pure-content public page — prerender for fast first paint.
// The /about route is in the maintenance-mode allow-list and serves the same
// HTML to every visitor, so we bake it at build time. The hooks.server.ts
// guard still applies for protected routes; this just removes the SSR cold
// start (~42s on uncached requests) for /about itself.
export const prerender = true;
