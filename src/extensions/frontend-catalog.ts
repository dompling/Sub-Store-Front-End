import type { Component } from 'vue';
import type { Router } from 'vue-router';

import { getHostAPIUrl } from '@/hooks/useHostAPI';
import type {
  ExtensionAvailability,
  ExtensionManifest,
  ExtensionRuntimeName,
} from '@/extensions/contracts';
import type {
  FrontendExtensionDefinition,
  FrontendExtensionRouteContribution,
} from './frontend-contracts';
import { configHostingFrontendExtension } from '@/extensions/config-hosting';

type FrontendAsset = string | { path: string; digest?: string };
type FrontendManifest = {
  entrypoint?: string;
  style?: string;
  implementationAbi?: string;
  sdkSpecifier?: string;
  routeBase?: string;
  openPath?: string;
  embeddedBasePath?: string;
  assets?: Record<string, FrontendAsset>;
};

// Keep the SDK import type-only here. Its API/store exports transitively import
// this catalog, so an eager namespace import can read uninitialized bindings.
type FrontendSdkV1 = typeof import('@/extensions/frontend-sdk-v1');
type FrontendRegistrationHost = typeof globalThis & {
  __SUBSTORE_EXTENSION_FRONTEND_SDK_V1__?: FrontendSdkV1;
  __SUBSTORE_REGISTER_FRONTEND_EXTENSION__?: (
    definition: FrontendExtensionDefinition,
  ) => void;
};

const builtInDefinitions: FrontendExtensionDefinition[] = [
  configHostingFrontendExtension,
];
const definitionsById = new Map(
  builtInDefinitions.map(definition => [definition.id, definition]),
);
const builtInIds = new Set(builtInDefinitions.map(definition => definition.id));
const pendingRegistrations = new Set<string>();
const loadPromises = new Map<string, Promise<FrontendExtensionDefinition>>();
const loadPromiseIdentities = new Map<string, string>();
const definitionIdentities = new Map<string, string>();
const stylesById = new Map<string, HTMLStyleElement>();
const routeRemoversById = new Map<string, Array<() => void>>();

export const frontendExtensionDefinitions = builtInDefinitions;
export const frontendExtensionRouteContributions: FrontendExtensionRouteContribution[] =
  builtInDefinitions.flatMap(definition => definition.routes);

const registrationHost = globalThis as FrontendRegistrationHost;
const frontendSdkGlobal = '__SUBSTORE_EXTENSION_FRONTEND_SDK_V1__';
let frontendSdkInstallPromise: Promise<FrontendSdkV1> | null = null;

const installedFrontendSdk = (): FrontendSdkV1 | null => {
  const sdkDescriptor = Object.getOwnPropertyDescriptor(
    registrationHost,
    frontendSdkGlobal,
  );
  if (!sdkDescriptor) return null;
  if (
    !('value' in sdkDescriptor)
    || !sdkDescriptor.value
    || typeof sdkDescriptor.value !== 'object'
    || sdkDescriptor.configurable !== false
    || sdkDescriptor.writable !== false
  ) {
    const error = new Error('Sub-Store frontend extension SDK global is not immutable');
    error.name = 'FrontendExtensionSdkGlobalInvalid';
    throw error;
  }
  return sdkDescriptor.value as FrontendSdkV1;
};

const installFrontendSdkGlobal = async (): Promise<FrontendSdkV1> => {
  const installed = installedFrontendSdk();
  if (installed) return installed;
  if (!frontendSdkInstallPromise) {
    // Extension bundles execute after the Host graph has initialized, making
    // this deferred module load safe even though the SDK exposes Host stores.
    frontendSdkInstallPromise = import('@/extensions/frontend-sdk-v1')
      .then((frontendSdkV1) => {
        const installedDuringImport = installedFrontendSdk();
        if (installedDuringImport) return installedDuringImport;
        Object.defineProperty(
          registrationHost,
          frontendSdkGlobal,
          {
            value: frontendSdkV1,
            configurable: false,
            enumerable: false,
            writable: false,
          },
        );
        return frontendSdkV1;
      })
      .catch((error) => {
        frontendSdkInstallPromise = null;
        throw error;
      });
  }
  return frontendSdkInstallPromise;
};

export const registerFrontendExtensionDefinition = (
  definition: FrontendExtensionDefinition,
) => {
  if (!definition?.id || !pendingRegistrations.has(definition.id)) {
    const error = new Error('Unexpected frontend extension registration');
    error.name = 'FrontendExtensionRegistrationRejected';
    throw error;
  }
  const existing = definitionsById.get(definition.id);
  if (existing && builtInIds.has(definition.id)) {
    const error = new Error(`Frontend extension ${definition.id} is built in`);
    error.name = 'FrontendExtensionRegistrationConflict';
    throw error;
  }
  definitionsById.set(definition.id, definition);
};

if (!registrationHost.__SUBSTORE_REGISTER_FRONTEND_EXTENSION__) {
  Object.defineProperty(
    registrationHost,
    '__SUBSTORE_REGISTER_FRONTEND_EXTENSION__',
    {
      value: registerFrontendExtensionDefinition,
      configurable: false,
      enumerable: false,
      writable: false,
    },
  );
}

export const findFrontendExtensionDefinition = (id?: string) =>
  id ? definitionsById.get(id) : undefined;

const frontendManifest = (manifest?: Partial<ExtensionManifest>): FrontendManifest => (
  (manifest?.frontend || {}) as FrontendManifest
);

const manifestAsset = (
  manifest: ExtensionManifest | undefined,
  key: string,
): { path: string; digest?: string } | null => {
  const frontend = frontendManifest(manifest);
  const declared = frontend.assets?.[key];
  if (typeof declared === 'string') return { path: declared };
  if (declared?.path) return declared;
  const path = key === 'entrypoint' ? frontend.entrypoint : frontend.style;
  return path ? { path } : null;
};

const receiptFileDigests = (availability: ExtensionAvailability) => {
  const value = availability.receipt?.fileDigests;
  return value && typeof value === 'object'
    ? value as Record<string, string>
    : {};
};

const frontendDefinitionIdentity = (
  availability: ExtensionAvailability,
  runtime?: ExtensionRuntimeName,
) => {
  const frontend = frontendManifest(availability.manifest);
  const fileDigests = receiptFileDigests(availability);
  const entrypoint = manifestAsset(availability.manifest, 'entrypoint');
  const style = manifestAsset(availability.manifest, 'style');
  return JSON.stringify({
    runtime: runtime || null,
    version: availability.receipt?.version || availability.manifest?.version || null,
    packageDigest: availability.receipt?.packageDigest || null,
    selectedVariant: availability.receipt?.selectedVariant || null,
    implementationAbi: frontend.implementationAbi || null,
    embeddedBasePath: frontend.embeddedBasePath || null,
    entrypointDigest: entrypoint
      ? fileDigests[entrypoint.path] || entrypoint.digest || null
      : null,
    styleDigest: style
      ? fileDigests[style.path] || style.digest || null
      : null,
  });
};

const sha256 = async (text: string) => {
  if (!globalThis.crypto?.subtle) {
    const error = new Error('Browser SHA-256 is unavailable');
    error.name = 'FrontendExtensionCryptoUnavailable';
    throw error;
  }
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map(value => value.toString(16).padStart(2, '0'))
    .join('');
};

const fetchVerifiedText = async (url: string, expectedDigest?: string) => {
  if (!expectedDigest || !/^[a-f0-9]{64}$/i.test(expectedDigest)) {
    const error = new Error('Frontend extension asset has no trusted digest');
    error.name = 'FrontendExtensionDigestMissing';
    throw error;
  }
  const response = await fetch(url, { credentials: 'omit' });
  if (!response.ok) {
    const error = new Error(`Frontend extension asset request failed: HTTP ${response.status}`);
    error.name = 'FrontendExtensionAssetRequestFailed';
    throw error;
  }
  const source = await response.text();
  if ((await sha256(source)) !== expectedDigest.toLowerCase()) {
    const error = new Error('Frontend extension asset digest mismatch');
    error.name = 'FrontendExtensionDigestMismatch';
    throw error;
  }
  return source;
};

const encodedAssetPath = (path: string) => path
  .split('/')
  .map(segment => encodeURIComponent(segment))
  .join('/');

const nodeAssetUrl = (extensionId: string, path: string, digest: string) => {
  const base = getHostAPIUrl().replace(/\/+$/, '');
  return `${base}/api/extensions/${encodeURIComponent(extensionId)}/assets/${encodedAssetPath(path)}?digest=${digest}`;
};

const embeddedAssetUrl = (basePath: string, path: string) => {
  const base = `${import.meta.env.BASE_URL || './'}${basePath.replace(/^\/+|\/+$/g, '')}/`;
  return new URL(path.replace(/^\/+/, ''), new URL(base, document.baseURI)).toString();
};

const resolveAsset = (
  availability: ExtensionAvailability,
  runtime: ExtensionRuntimeName | undefined,
  asset: { path: string; digest?: string },
) => {
  const frontend = frontendManifest(availability.manifest);
  const digest = receiptFileDigests(availability)[asset.path] || asset.digest;
  const nodePackage = runtime === 'node'
    && availability.receipt?.selectedVariant === 'node';
  if (nodePackage) {
    return {
      digest,
      url: nodeAssetUrl(availability.extensionId, asset.path, String(digest || '')),
    };
  }
  if (!frontend.embeddedBasePath) {
    const error = new Error('No embedded frontend asset is available for this runtime');
    error.name = 'FrontendExtensionEmbeddedAssetMissing';
    throw error;
  }
  return {
    digest,
    url: embeddedAssetUrl(frontend.embeddedBasePath, asset.path),
  };
};

const installStyle = (extensionId: string, source: string) => {
  stylesById.get(extensionId)?.remove();
  const style = document.createElement('style');
  style.dataset.substoreExtension = extensionId;
  style.textContent = source;
  document.head.appendChild(style);
  stylesById.set(extensionId, style);
};

const executeTrustedBundle = async (extensionId: string, source: string) => {
  const blobUrl = URL.createObjectURL(
    new Blob([source], { type: 'application/javascript' }),
  );
  try {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.async = true;
      script.dataset.substoreExtension = extensionId;
      script.src = blobUrl;
      script.onload = () => {
        script.remove();
        resolve();
      };
      script.onerror = () => {
        script.remove();
        reject(new Error(`Failed to execute frontend extension ${extensionId}`));
      };
      document.head.appendChild(script);
    });
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
};

const verifiedExecutableCodeStatuses = new Set([
  'verified-package-installed',
  'verified-package-active',
  'verified-package-inactive',
]);

const assertVerifiedFrontend = (
  availability: ExtensionAvailability,
  runtime?: ExtensionRuntimeName,
) => {
  const manifest = availability.manifest;
  const officialPackage = manifest?.kind === 'trusted-official'
    && manifest.trust?.level === 'official-root'
    && manifest.trust?.allowlistedId === true;
  const verificationMode = availability.receipt?.verificationMode;
  const executablePackage = manifest?.kind === 'executable'
    && runtime === 'node'
    && availability.receipt?.installationStatus === 'installed'
    && (verificationMode === 'source-integrity' || verificationMode === 'local-integrity')
    && verifiedExecutableCodeStatuses.has(
      String(availability.codeStatus || availability.receipt?.codeStatus || ''),
    );
  if (!officialPackage && !executablePackage) {
    const error = new Error('Frontend extension is not backed by a verified executable package');
    error.name = 'FrontendExtensionTrustRejected';
    throw error;
  }
};

export const ensureFrontendExtensionDefinition = async (
  availability: ExtensionAvailability,
  runtime?: ExtensionRuntimeName,
) => {
  const identity = frontendDefinitionIdentity(availability, runtime);
  const existing = findFrontendExtensionDefinition(availability.extensionId);
  if (existing) {
    if (
      builtInIds.has(availability.extensionId)
      || definitionIdentities.get(availability.extensionId) === identity
    ) {
      return existing;
    }
    await disposeFrontendExtension(availability.extensionId);
  }
  const active = loadPromises.get(availability.extensionId);
  if (active) {
    if (loadPromiseIdentities.get(availability.extensionId) === identity) {
      return active;
    }
    try {
      await active;
    } catch {
      // A superseded load is cleaned below before the new signed identity runs.
    }
    await disposeFrontendExtension(availability.extensionId);
  }

  const promise = (async () => {
    assertVerifiedFrontend(availability, runtime);
    const entrypoint = manifestAsset(availability.manifest, 'entrypoint');
    if (!entrypoint) {
      const error = new Error('Frontend extension entrypoint is missing');
      error.name = 'FrontendExtensionEntrypointMissing';
      throw error;
    }
    const style = manifestAsset(availability.manifest, 'style');
    const entryAsset = resolveAsset(availability, runtime, entrypoint);
    const styleAsset = style ? resolveAsset(availability, runtime, style) : null;
    const [scriptSource, styleSource] = await Promise.all([
      fetchVerifiedText(entryAsset.url, entryAsset.digest),
      styleAsset
        ? fetchVerifiedText(styleAsset.url, styleAsset.digest)
        : Promise.resolve(''),
    ]);
    await installFrontendSdkGlobal();
    if (styleSource) installStyle(availability.extensionId, styleSource);
    pendingRegistrations.add(availability.extensionId);
    try {
      await executeTrustedBundle(availability.extensionId, scriptSource);
    } finally {
      pendingRegistrations.delete(availability.extensionId);
    }
    const definition = findFrontendExtensionDefinition(availability.extensionId);
    if (!definition) {
      const error = new Error('Frontend extension did not register a surface definition');
      error.name = 'FrontendExtensionRegistrationMissing';
      throw error;
    }
    const requiredAbi = frontendManifest(availability.manifest).implementationAbi;
    if (requiredAbi && definition.implementationAbi !== requiredAbi) {
      definitionsById.delete(availability.extensionId);
      const error = new Error('Frontend extension implementation ABI mismatch');
      error.name = 'FrontendExtensionAbiMismatch';
      throw error;
    }
    definitionIdentities.set(availability.extensionId, identity);
    return definition;
  })().catch((error) => {
    stylesById.get(availability.extensionId)?.remove();
    stylesById.delete(availability.extensionId);
    definitionsById.delete(availability.extensionId);
    definitionIdentities.delete(availability.extensionId);
    throw error;
  }).finally(() => {
    loadPromises.delete(availability.extensionId);
    loadPromiseIdentities.delete(availability.extensionId);
  });
  loadPromises.set(availability.extensionId, promise);
  loadPromiseIdentities.set(availability.extensionId, identity);
  return promise;
};

export const registerFrontendExtensionRoutes = (
  router: Router,
  definition: FrontendExtensionDefinition,
  outlet: any,
) => {
  if (routeRemoversById.has(definition.id)) return false;
  const removers = definition.routes.map((route) => {
    const name = `extension:${definition.id}:${route.id}`;
    if (router.hasRoute(name)) return () => undefined;
    return router.addRoute('app-layout', {
      name,
      path: route.path,
      component: outlet,
      meta: route.meta,
    });
  });
  routeRemoversById.set(definition.id, removers);
  return true;
};

export const disposeFrontendExtension = async (extensionId: string) => {
  if (builtInIds.has(extensionId)) return;
  const definition = definitionsById.get(extensionId);
  const disposalErrors: unknown[] = [];
  try {
    await definition?.dispose?.();
  } catch (error) {
    disposalErrors.push(error);
  } finally {
    const routeRemovers = routeRemoversById.get(extensionId) || [];
    routeRemoversById.delete(extensionId);
    for (const remove of routeRemovers) {
      try {
        remove();
      } catch (error) {
        disposalErrors.push(error);
      }
    }

    const style = stylesById.get(extensionId);
    stylesById.delete(extensionId);
    try {
      style?.remove();
    } catch (error) {
      disposalErrors.push(error);
    }
    definitionsById.delete(extensionId);
    definitionIdentities.delete(extensionId);
  }

  if (disposalErrors.length === 1) throw disposalErrors[0];
  if (disposalErrors.length > 1) {
    const error = new Error(`Frontend extension ${extensionId} disposal failed`);
    error.name = 'FrontendExtensionDisposeFailed';
    (error as Error & { errors: unknown[] }).errors = disposalErrors;
    throw error;
  }
};

const unwrapComponent = (loaded: { default?: Component } | Component): Component => {
  if (loaded && typeof loaded === 'object' && 'default' in loaded && loaded.default) {
    return loaded.default;
  }
  return loaded as Component;
};

export const loadFrontendExtensionSurface = async (
  extensionId: string,
  surfaceId: string,
): Promise<Component> => {
  const definition = findFrontendExtensionDefinition(extensionId);
  const loader = definition?.surfaces?.[surfaceId];
  if (!loader) {
    const error = new Error(`Frontend surface ${extensionId}/${surfaceId} is not registered`);
    error.name = 'FrontendExtensionSurfaceNotFound';
    throw error;
  }
  return unwrapComponent(await loader());
};

export const resolveExtensionOpenPath = (
  id?: string,
  manifest?: ExtensionManifest,
) => findFrontendExtensionDefinition(id)?.openPath
  || frontendManifest(manifest).openPath
  || frontendManifest(manifest).routeBase;

export const resolveExtensionIdForPath = (
  path: string,
  manifests: Array<Partial<ExtensionManifest> | undefined>,
) => manifests.find((manifest) => {
  const routeBase = frontendManifest(manifest).routeBase;
  return routeBase && (path === routeBase || path.startsWith(`${routeBase}/`));
})?.id;
