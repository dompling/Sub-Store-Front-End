import type { ExtensionManifest } from '@/extensions/contracts';

export const CONFIG_HOSTING_EXTENSION_ID = 'org.substore.config-hosting';

export const configHostingManifest: ExtensionManifest = {
  schemaVersion: 1,
  id: CONFIG_HOSTING_EXTENSION_ID,
  kind: 'trusted-official',
  name: '配置托管',
  description: '托管配置、同步远程仓库，并保留归档与发布链接。',
  version: '1.0.0',
  publisher: { id: 'org.substore', name: 'Sub-Store', verified: true },
  license: 'GPL-3.0',
  homepage: 'https://github.com/sub-store-org/Sub-Store',
  icon: 'fa-solid fa-cloud-arrow-up',
  distribution: 'store',
  capabilities: ['artifacts', 'sync', 'archive', 'publisher', 'scheduler'],
  routes: [
    {
      id: `${CONFIG_HOSTING_EXTENSION_ID}.list`,
      path: '/sync',
      activeMatch: '/sync',
    },
    {
      id: `${CONFIG_HOSTING_EXTENSION_ID}.edit`,
      path: '/edit/sync/:id',
      activeMatch: '/edit/sync',
    },
  ],
  variants: [
    {
      id: 'node-official',
      runtime: 'node',
      implementationId: 'org.substore.config-hosting@1/node',
      implementationAbi: 'config-hosting@1',
      frontendImplementationAbi: 'config-hosting-ui@1',
      available: true,
    },
    {
      id: 'embedded-official',
      runtime: 'qx',
      implementationId: 'org.substore.config-hosting@1/qx',
      implementationAbi: 'config-hosting@1',
      frontendImplementationAbi: 'config-hosting-ui@1',
      available: true,
    },
  ],
};
