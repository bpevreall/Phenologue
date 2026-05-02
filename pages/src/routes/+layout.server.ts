import type { LayoutServerLoad } from './$types';

/**
 * Surface the maintenance flag to the universal layout/page tree so client
 * components can render the appropriate UI without re-checking platform env.
 */
export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    maintenance: locals.maintenance ?? false,
  };
};
