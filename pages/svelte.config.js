import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    alias: {
      $components: 'src/lib/components',
      $styles: 'src/lib/styles',
    },
    prerender: {
      // Missing favicon is a known omission for v0.1; don't fail the build over it.
      // Add a real favicon before public launch and remove this exemption.
      handleHttpError: ({ path, message }) => {
        if (path === '/favicon.ico') return;
        throw new Error(message);
      },
    },
  },
};

export default config;
