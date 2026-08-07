/**
 * Public frontend contracts for the Sub-Store extension host.
 *
 * The backend is allowed to add fields to these payloads, therefore the
 * contracts intentionally keep an `unknown` extension point while the fields
 * used by the UI remain strongly typed.  Do not use a plugin's internal store
 * shape here: this is the wire format shared by the host and every surface.
 */

export type ExtensionKind =
  | 'bundled'
  | 'trusted-official'
  | 'content'
  | 'sandboxed';

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

export type ExtensionInstallationStatus =
  | 'never-installed'
  | 'installed'
  | 'removed';

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

export type ExtensionRuntimeName =
  | 'node'
  | 'qx'
  | 'loon'
  | 'surge'
  | 'stash'
  | 'shadowrocket'
  | 'egern'
  | string;

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
    frontend?: string;
    backend?: string;
    runtimes?: ExtensionRuntimeName[];
  };
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
  capabilities?: string[];
  managementMode?: 'token' | 'read-only' | string;
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
  tasks: ExtensionInstallTask[];
  fetchedAt: number;
}

export interface ExtensionControlOptions {
  adminToken?: string;
  expectedRevision?: string | number;
  idempotencyKey?: string;
  version?: string;
  variant?: string;
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
