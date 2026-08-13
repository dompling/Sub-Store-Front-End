import type { ExtensionDirectoryProjection } from '@/extensions/localDirectory';

/**
 * Public frontend contracts for the Sub-Store extension host.
 *
 * The backend is allowed to add fields to these payloads, therefore the
 * contracts intentionally keep an `unknown` extension point while the fields
 * used by the UI remain strongly typed.  Do not use a plugin's internal store
 * shape here: this is the wire format shared by the host and every surface.
 */

export type ExtensionKind = 'bundled' | 'trusted-official' | 'executable' | 'content' | 'sandboxed';

export type ExtensionStatus =
  | 'bundled'
  | 'installed'
  | 'enabled'
  | 'disabled'
  | 'missing'
  | 'unknown'
  | 'incompatible'
  | 'reinstall-required'
  | 'installing'
  | 'updating'
  | 'rolling-back'
  | 'restoring'
  | 'frontend-load-failed'
  | 'activation-failed';

export type ExtensionInstallationStatus = 'never-installed' | 'installed' | 'removed';

export type ExtensionDataStatus = 'none' | 'retained' | 'active';

export type ExtensionCodeStatus =
  | 'bundled'
  | 'installed'
  | 'verified-package-installed'
  | 'verified-package-active'
  | 'verified-package-inactive'
  | 'embedded-inactive'
  | 'embedded-active'
  | 'activation-failed'
  | 'removed'
  | 'missing';

export type ExtensionRuntimeName = 'node' | 'qx' | 'loon' | 'surge' | 'stash' | 'shadowrocket' | 'egern' | string;

export interface ExtensionPublisher {
  id: string;
  name: string;
  verified?: boolean;
}

export interface ExtensionPermission {
  id: string;
  label?: string;
  description?: string;
  required?: boolean;
}

export interface ExtensionRouteContribution {
  id: string;
  path?: string;
  hostSlotId?: string;
  activeMatch?: string;
  titleKey?: string;
  navigationId?: string;
}

export interface ExtensionNavigationContribution {
  id: string;
  label?: string;
  labelKey?: string;
  icon?: string;
  path?: string;
  activeMatch?: string;
  order?: number;
}

export interface ExtensionRuntimeVariant {
  id?: string;
  runtime?: ExtensionRuntimeName;
  version?: string;
  implementationId?: string;
  implementationAbi?: string;
  frontendImplementationAbi?: string;
  frontendAssetDigest?: string;
  packageDigest?: string;
  available?: boolean;
  reason?: string;
}

export interface ExtensionManifest {
  schemaVersion: number;
  id: string;
  kind: ExtensionKind;
  name: string;
  description?: string;
  version: string;
  publisher: ExtensionPublisher;
  license?: string;
  homepage?: string;
  icon?: string;
  host?: {
    apiVersion?: string;
    frontendApiVersion?: string;
    implementationAbi?: string;
    frontend?: string;
    backend?: string;
    runtimes?: ExtensionRuntimeName[];
  };
  frontend?: {
    entrypoint?: string;
    style?: string;
    sdkSpecifier?: string;
    uiKitAbi?: string;
    implementationAbi?: string;
    routeBase?: string;
    openPath?: string;
    embeddedBasePath?: string;
    locales?: Record<string, string>;
    assets?: Record<string, string | { path: string; digest?: string }>;
    [key: string]: unknown;
  };
  trust?: {
    level?: string;
    allowedPublisher?: string;
    allowlistedId?: boolean;
    [key: string]: unknown;
  };
  entrypoints?: Record<string, unknown>;
  requires?: {
    hard?: string[];
    optional?: string[];
    [key: string]: unknown;
  };
  contributes?: Record<string, unknown>;
  permissions?: ExtensionPermission[];
  capabilities?: string[];
  routes?: ExtensionRouteContribution[];
  navigation?: ExtensionNavigationContribution[];
  variants?: ExtensionRuntimeVariant[];
  distribution?: 'bundled' | 'catalog' | 'embedded' | string;
  bundled?: boolean;
}

export interface ExtensionInstallReceipt {
  extensionId: string;
  version?: string;
  manifestDigest?: string;
  packageDigest?: string;
  frontendAssetDigest?: string;
  selectedVariant?: string;
  implementationAbi?: string;
  frontendImplementationAbi?: string;
  installationStatus: ExtensionInstallationStatus;
  dataStatus: ExtensionDataStatus;
  codeStatus?: ExtensionCodeStatus;
  retainedReason?: 'user-uninstalled' | 'backup-restored';
  installedAt?: number;
  enabled?: boolean;
  verificationMode?: 'trusted-signature' | 'source-integrity' | 'local-integrity' | string;
  fileDigests?: Record<string, string>;
  rollbackAvailable?: boolean;
  rollbackVersions?: string[];
  [key: string]: unknown;
}

/**
 * A catalog source managed by the extension host.  Source payloads are
 * intentionally extensible because third-party catalogs may add health and
 * provenance fields without requiring a frontend release.
 */
export interface ExtensionSource {
  id: string;
  url: string;
  name?: string;
  /** Explicit author of the catalog document; never inferred from its URL or entries. */
  publisher: Pick<ExtensionPublisher, 'id' | 'name'> | null;
  type?: 'github' | 'http' | 'https' | string;
  status?: 'active' | 'ready' | 'refreshing' | 'failed' | 'disabled' | string;
  enabled?: boolean;
  error?: string;
  /** Number of catalog entries returned by the host source projection. */
  entryCount?: number;
  /** Backward-compatible UI alias used by older source adapters. */
  lastFetchedAt?: number;
  /** Last persisted source change reported by the current Extension Host. */
  updatedAt?: number;
  extensionCount?: number;
  lastError?: { code?: string; message?: string } | null;
  revision?: string | number;
  [key: string]: unknown;
}

export interface ExtensionArtifactSourceItem {
  name: string;
  displayName?: string;
  [key: string]: unknown;
}

/** A source picker contribution exposed by an enabled backend extension. */
export interface ExtensionArtifactSourceDescriptor {
  type: string;
  labelKey?: string;
  platforms?: string[];
  items: ExtensionArtifactSourceItem[];
  ownerExtensionId?: string;
  status: ExtensionStatus;
  [key: string]: unknown;
}

export interface ExtensionAvailability {
  extensionId: string;
  status: ExtensionStatus;
  source: 'runtime' | 'bundled' | 'legacy-fallback' | 'catalog';
  manifest?: ExtensionManifest;
  receipt?: ExtensionInstallReceipt;
  reasonCode?: string;
  reason?: string;
  taskId?: string;
  backendRevision?: string | number;
  requiredFrontendImplementationAbi?: string;
  retainedReason?: 'user-uninstalled' | 'backup-restored';
  codeStatus?: ExtensionCodeStatus;
  dataStatus?: ExtensionDataStatus;
  /** The installed manifest is retained, but its third-party catalog was removed. */
  sourceMissing?: boolean;
}

export interface ExtensionRuntimeManifest {
  schemaVersion?: number;
  revision: string | number;
  etag?: string;
  backend?: string;
  frontend?: string;
  sdkAbi?: string;
  uiKitAbi?: string;
  runtime?: ExtensionRuntimeName;
  capabilities?:
    | string[]
    | {
        supportsTrustedOfficialPackage?: boolean;
        [key: string]: unknown;
      };
  managementMode?: 'open' | 'token' | 'read-only' | string;
  storageConsistency?: 'strong-cas' | 'single-writer-required' | string;
  restoreIsolation?: 'full' | 'data-only' | 'none' | string;
  /** Stable identity of the Host/storage instance that produced this snapshot. */
  instanceId?: string;
  storageIdentity?: string;
  extensions?: ExtensionRuntimeEntry[];
  installed?: ExtensionRuntimeEntry[];
  plugins?: ExtensionRuntimeEntry[];
  [key: string]: unknown;
}

export interface ExtensionRuntimeEntry {
  id: string;
  status?: ExtensionStatus;
  installationStatus?: ExtensionInstallationStatus;
  dataStatus?: ExtensionDataStatus;
  codeStatus?: ExtensionCodeStatus;
  retainedReason?: 'user-uninstalled' | 'backup-restored';
  reasonCode?: string;
  reason?: string;
  taskId?: string;
  enabled?: boolean;
  manifest?: Partial<ExtensionManifest>;
  receipt?: ExtensionInstallReceipt;
  version?: string;
  availableVersion?: string;
  updateAvailable?: boolean;
  rollbackAvailable?: boolean;
  rollbackVersions?: string[];
  [key: string]: unknown;
}

/**
 * An immutable release advertised by a catalog source.
 *
 * `version` remains the user-facing SemVer while Git metadata records the
 * repository revision that produced it. Package locations and digests stay
 * catalog-declared so the frontend never constructs a download URL from a
 * user-selected version.
 */
export interface ExtensionCatalogRelease {
  version: string;
  releasedAt?: string | number;
  gitTag?: string;
  gitCommit?: string;
  manifest?: Partial<ExtensionManifest>;
  packageUrl?: string;
  packageUrls?: Record<string, string>;
  packageDigest?: string;
  packageDigests?: Record<string, string>;
  latest?: boolean;
  yanked?: boolean;
  /** False when provenance is retained but no verified package is published. */
  installable?: boolean;
  [key: string]: unknown;
}

export interface ExtensionCatalogEntry extends Partial<ExtensionManifest> {
  id: string;
  name: string;
  version: string;
  kind?: ExtensionKind;
  description?: string;
  publisher?: ExtensionPublisher;
  distribution?: string;
  permissions?: ExtensionPermission[];
  variants?: ExtensionRuntimeVariant[];
  installed?: boolean;
  latest?: boolean;
  yanked?: boolean;
  updateAvailable?: boolean;
  installedVersion?: string;
  availableVersion?: string;
  rollbackAvailable?: boolean;
  rollbackVersions?: string[];
  /** Remote, source-backed releases. Local rollback packages are separate. */
  releases?: ExtensionCatalogRelease[];
  /** Source identity is optional for bundled/legacy entries. */
  sourceId?: string;
  sourceUrl?: string;
  sourceName?: string;
  /** Installed community extension whose catalog source is no longer configured. */
  sourceMissing?: boolean;
}

export interface ExtensionInstallTask {
  id: string;
  extensionId?: string;
  action?: 'install' | 'enable' | 'disable' | 'update' | 'rollback' | 'uninstall' | string;
  status?: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | string;
  progress?: number;
  stage?: string;
  error?: { code?: string; message?: string; details?: unknown } | string;
  createdAt?: number;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface ExtensionRuntimeSnapshot {
  runtime: ExtensionRuntimeManifest | null;
  catalog: ExtensionCatalogEntry[];
  installed: ExtensionInstallReceipt[];
  sources?: ExtensionSource[];
  tasks: ExtensionInstallTask[];
  fetchedAt: number;
}

export interface ExtensionControlOptions {
  adminToken?: string;
  expectedRevision?: string | number;
  idempotencyKey?: string;
  version?: string;
  variant?: string;
  reinstall?: boolean;
}

export interface ExtensionSourceControlOptions extends ExtensionControlOptions {
  url?: string;
  name?: string;
}

export interface ExtensionLocalPackageInspection {
  extensionId: string;
  manifest: ExtensionManifest;
  receipt?: ExtensionInstallReceipt | Record<string, unknown>;
  selectedVariant?: string;
  packageDigest?: string;
  fileCount?: number;
  totalBytes?: number;
  verificationMode?: string;
  compatibility?: unknown;
  warnings?: unknown[];
  diagnostics?: unknown[];
  [key: string]: unknown;
}

export interface ExtensionLocalPackageRequest {
  projection: ExtensionDirectoryProjection;
  options?: ExtensionControlOptions;
}

export interface ExtensionApiEnvelope<T> {
  status?: 'success' | 'failed';
  data?: T;
  error?: {
    code?: string;
    type?: string;
    message?: string;
    details?: unknown;
  };
  [key: string]: unknown;
}
