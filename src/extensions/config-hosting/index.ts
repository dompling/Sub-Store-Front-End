import type { FrontendExtensionDefinition } from '@/extensions/frontend-contracts';

import {
  CONFIG_HOSTING_EXTENSION_ID,
  configHostingManifest,
} from './manifest';
import { configHostingRoutes } from './routes';

export {
  CONFIG_HOSTING_EXTENSION_ID,
  configHostingManifest,
} from './manifest';
export { configHostingRoutes } from './routes';

/**
 * Config hosting keeps its legacy page files for now, but the host only sees
 * this contribution.  That makes its lifecycle gate identical to every
 * other extension and leaves a clean seam for a signed frontend asset loader.
 */
export const configHostingFrontendExtension: FrontendExtensionDefinition = {
  id: CONFIG_HOSTING_EXTENSION_ID,
  manifest: configHostingManifest,
  openPath: '/sync',
  routes: configHostingRoutes,
  legacyFallback: true,
  surfaces: {
    list: () => import('@/views/Sync.vue'),
    editor: () => import('@/views/SyncEditor.vue'),
  },
};

export default configHostingFrontendExtension;

