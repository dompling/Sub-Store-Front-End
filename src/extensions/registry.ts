import type {
  ExtensionCatalogEntry,
  ExtensionManifest,
  ExtensionRuntimeEntry,
} from '@/extensions/contracts';
import {
  CONFIG_HOSTING_EXTENSION_ID,
  configHostingManifest,
} from '@/extensions/config-hosting';

/** Stable IDs are part of the public contribution contract. */
export const EXTENSION_IDS = {
  CONFIG_HOSTING: CONFIG_HOSTING_EXTENSION_ID,
} as const;

export const NAVIGATION_IDS = {
  EXTENSIONS_STORE: 'org.substore.extensions.store',
} as const;

export const EXTENSION_STORE_COMMANDS = {
  add: 'extensions.store.add',
  toggleManagement: 'extensions.store.toggle-management',
} as const;

/** Build-time metadata catalog; lifecycle state always comes from the Host. */
export const FRONTEND_EXTENSION_MANIFESTS: ExtensionManifest[] = [
  configHostingManifest,
];

export const EXTENSION_CATALOG_FALLBACK: ExtensionCatalogEntry[] =
  FRONTEND_EXTENSION_MANIFESTS.map(manifest => ({
    ...manifest,
    publisher: { ...manifest.publisher },
    installed: manifest.bundled === true,
    latest: true,
  }));

export const findFrontendManifest = (id: string) =>
  FRONTEND_EXTENSION_MANIFESTS.find(manifest => manifest.id === id);

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
