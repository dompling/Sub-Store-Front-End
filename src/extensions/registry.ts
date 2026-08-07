import type {
  ExtensionCatalogEntry,
  ExtensionManifest,
  ExtensionRuntimeEntry,
} from '@/extensions/contracts';

/** Stable IDs are part of the public contribution contract. */
export const EXTENSION_IDS = {
  CONFIG_GENERATOR: 'org.substore.config-generator',
  CONFIG_HOSTING: 'org.substore.config-hosting',
} as const;

export const NAVIGATION_IDS = {
  EXTENSIONS_STORE: 'org.substore.extensions.store',
  CONFIG_GENERATOR: 'org.substore.config-generator.navigation',
  CONFIG_HOSTING: 'org.substore.config-hosting.navigation',
} as const;

/**
 * Frontend bundled catalog.
 *
 * This is deliberately metadata-only.  Existing Vue pages remain the
 * canonical bundled implementation until the Host asset loader is available.
 */
export const BUNDLED_EXTENSION_MANIFESTS: ExtensionManifest[] = [
  {
    schemaVersion: 1,
    id: EXTENSION_IDS.CONFIG_GENERATOR,
    kind: 'bundled',
    name: '配置生成器',
    description: '生成 Surge、Quantumult X、Clash 和 Loon 配置。',
    version: '1.0.0',
    publisher: { id: 'org.substore', name: 'Sub-Store', verified: true },
    license: 'GPL-3.0',
    homepage: 'https://github.com/sub-store-org/Sub-Store',
    icon: 'fa-solid fa-code-branch',
    distribution: 'bundled',
    bundled: true,
    capabilities: ['config-project', 'preview', 'artifact-source'],
    routes: [
      {
        id: `${EXTENSION_IDS.CONFIG_GENERATOR}.list`,
        path: '/extensions/config-generator',
        activeMatch: '/extensions/config-generator',
        navigationId: NAVIGATION_IDS.CONFIG_GENERATOR,
      },
    ],
    navigation: [
      {
        id: NAVIGATION_IDS.CONFIG_GENERATOR,
        label: '配置',
        icon: 'fa-solid fa-code-branch',
        path: '/extensions/config-generator',
        activeMatch: '/extensions/config-generator',
        order: 60,
      },
    ],
    variants: [
      { id: 'bundled', runtime: 'node', implementationId: 'config-generator-bundled', available: true },
    ],
  },
  {
    schemaVersion: 1,
    id: EXTENSION_IDS.CONFIG_HOSTING,
    kind: 'trusted-official',
    name: '配置托管',
    description: '托管配置、同步远程仓库，并保留归档与发布链接。',
    version: '1.0.0',
    publisher: { id: 'org.substore', name: 'Sub-Store', verified: true },
    license: 'GPL-3.0',
    homepage: 'https://github.com/sub-store-org/Sub-Store',
    icon: 'fa-solid fa-cloud-arrow-up',
    distribution: 'catalog',
    capabilities: ['artifacts', 'sync', 'archive', 'publisher', 'scheduler'],
    routes: [
      {
        id: `${EXTENSION_IDS.CONFIG_HOSTING}.list`,
        hostSlotId: `${EXTENSION_IDS.CONFIG_HOSTING}.list`,
        path: '/sync',
        activeMatch: '/sync',
        navigationId: NAVIGATION_IDS.CONFIG_HOSTING,
      },
      {
        id: `${EXTENSION_IDS.CONFIG_HOSTING}.edit`,
        hostSlotId: `${EXTENSION_IDS.CONFIG_HOSTING}.edit`,
        path: '/edit/sync/:id',
        activeMatch: '/edit/sync',
      },
    ],
    navigation: [
      {
        id: NAVIGATION_IDS.CONFIG_HOSTING,
        label: '配置托管',
        icon: 'fa-solid fa-cloud-arrow-up',
        path: '/sync',
        activeMatch: '/sync',
        order: 30,
      },
    ],
    variants: [
      {
        id: 'node-official',
        runtime: 'node',
        implementationId: 'config-hosting-node',
        implementationAbi: '1.0.0',
        frontendImplementationAbi: '1.0.0',
        available: true,
      },
      {
        id: 'embedded-official',
        runtime: 'qx',
        implementationId: 'config-hosting-embedded',
        implementationAbi: '1.0.0',
        frontendImplementationAbi: '1.0.0',
        available: true,
      },
    ],
  },
];

export const EXTENSION_CATALOG_FALLBACK: ExtensionCatalogEntry[] =
  BUNDLED_EXTENSION_MANIFESTS.map(manifest => ({
    ...manifest,
    publisher: { ...manifest.publisher },
    installed: manifest.bundled === true,
    latest: true,
  }));

export const findBundledManifest = (id: string) =>
  BUNDLED_EXTENSION_MANIFESTS.find(manifest => manifest.id === id);

export const findCatalogEntry = (
  entries: ExtensionCatalogEntry[],
  id: string,
) => entries.find(entry => entry.id === id) || EXTENSION_CATALOG_FALLBACK.find(entry => entry.id === id);

export const mergeManifest = (
  base: ExtensionManifest | undefined,
  remote?: Partial<ExtensionManifest>,
): ExtensionManifest | undefined => {
  if (!base && !remote?.id) return undefined;
  const next = {
    ...(base || {}),
    ...(remote || {}),
    publisher: {
      ...(base?.publisher || {}),
      ...(remote?.publisher || {}),
    },
  } as ExtensionManifest;
  return next;
};

export const mergeRuntimeEntry = (
  entry: ExtensionRuntimeEntry | undefined,
  manifest?: ExtensionManifest,
) => {
  const mergedManifest = mergeManifest(manifest, entry?.manifest);
  return { entry, manifest: mergedManifest };
};
