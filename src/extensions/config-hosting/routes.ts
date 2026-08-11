import type { FrontendExtensionRouteContribution } from '@/extensions/frontend-contracts';
import { CONFIG_HOSTING_EXTENSION_ID } from './manifest';

export const configHostingRoutes: FrontendExtensionRouteContribution[] = [
  {
    id: `${CONFIG_HOSTING_EXTENSION_ID}.list`,
    path: '/sync',
    extensionId: CONFIG_HOSTING_EXTENSION_ID,
    extensionSurfaceId: 'list',
    meta: {
      title: 'sync',
      needTabBar: false,
      needNavBack: true,
      backPath: '/extensions',
      supportsListViewMode: true,
      supportsListSearch: true,
      extensionId: CONFIG_HOSTING_EXTENSION_ID,
      extensionSurfaceId: 'list',
      pageActions: {
        addCommand: 'addSync',
        addLabelKey: 'syncPage.add',
      },
    },
  },
  {
    id: `${CONFIG_HOSTING_EXTENSION_ID}.edit`,
    path: '/edit/sync/:id',
    extensionId: CONFIG_HOSTING_EXTENSION_ID,
    extensionSurfaceId: 'editor',
    meta: {
      title: 'syncEditor',
      needTabBar: false,
      needNavBack: true,
      backPath: '/sync',
      extensionId: CONFIG_HOSTING_EXTENSION_ID,
      extensionSurfaceId: 'editor',
    },
  },
];

