import { defineStore } from 'pinia';
import { useExtensionsApi } from '@/api/extensions';
import { getHostAPIUrl } from '@/hooks/useHostAPI';
import {
  EXTENSION_CATALOG_FALLBACK,
  EXTENSION_IDS,
  findBundledManifest,
  findCatalogEntry,
  mergeManifest,
} from '@/extensions/registry';
import type {
  ExtensionAvailability,
  ExtensionCatalogEntry,
  ExtensionControlOptions,
  ExtensionDataStatus,
  ExtensionInstallReceipt,
  ExtensionInstallTask,
  ExtensionManifest,
  ExtensionRuntimeEntry,
  ExtensionRuntimeManifest,
  ExtensionStatus,
} from '@/extensions/contracts';

const api = useExtensionsApi();

type ExtensionDiscoveryStatus =
  | 'idle'
  | 'loading'
  | 'manifest'
  | 'legacy'
  | 'failed'
  | 'unknown';

type ExtensionStoreState = {
  runtime: ExtensionRuntimeManifest | null;
  catalog: ExtensionCatalogEntry[];
  installed: ExtensionInstallReceipt[];
  tasks: ExtensionInstallTask[];
  loading: boolean;
  refreshing: boolean;
  error: string;
  lastActionError: string;
  discoveryStatus: ExtensionDiscoveryStatus;
  backendManifestAvailable: boolean;
  controlPlaneAvailable: boolean;
  runtimeHostUrl: string;
  fetchedAt: number;
  adminToken: string;
};

type RefreshOptions = { silent?: boolean; force?: boolean };

const refreshFlights = new WeakMap<object, Promise<boolean>>();
const queuedRefreshFlights = new WeakMap<object, Promise<boolean>>();
const refreshFlightHosts = new WeakMap<object, string>();

const normalizeHostIdentity = (value: string) => {
  const normalized = String(value || '').trim().replace(/\/+$/, '');
  if (!normalized) return normalized;
  try {
    const base = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
    const url = new URL(normalized, base);
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return normalized;
  }
};

const settledStatus = (result: PromiseSettledResult<any>): number | undefined => {
  if (result.status === 'fulfilled') return result.value?.status;
  return result.reason?.response?.status ?? result.reason?.status;
};

const settledError = (result: PromiseSettledResult<any>): string => {
  if (result.status === 'fulfilled') return responseError(result.value);
  return result.reason?.response
    ? responseError(result.reason.response)
    : result.reason?.message || 'EXTENSION_MANIFEST_UNAVAILABLE';
};

const isSuccessfulResponse = (result: PromiseSettledResult<any>): result is PromiseFulfilledResult<any> => result.status === 'fulfilled'
  && result.value?.status >= 200
  && result.value?.status < 300;

const isRecord = (value: unknown): value is Record<string, any> => Boolean(
  value && typeof value === 'object',
);

const responsePayload = (response: any): any => {
  const body = response?.data ?? response;
  if (isRecord(body) && body.status === 'success' && 'data' in body) return body.data;
  if (isRecord(body) && body.status === 'failed') return body;
  return body;
};

const responseError = (response: any): string => {
  const body = responsePayload(response);
  return body?.error?.message || body?.error?.code || body?.message || 'EXTENSION_REQUEST_FAILED';
};

const unwrapArray = <T>(response: any, keys: string[]): T[] => {
  const payload = responsePayload(response);
  if (Array.isArray(payload)) return payload as T[];
  if (!isRecord(payload)) return [];
  for (const key of keys) {
    if (Array.isArray(payload[key])) return payload[key] as T[];
  }
  return [];
};

const unwrapRuntime = (response: any): ExtensionRuntimeManifest | null => {
  const payload = responsePayload(response);
  if (!isRecord(payload)) return null;
  if (payload.runtime && isRecord(payload.runtime)) return payload.runtime as ExtensionRuntimeManifest;
  if (payload.manifest && isRecord(payload.manifest)) return payload.manifest as ExtensionRuntimeManifest;
  if (payload.revision !== undefined || Array.isArray(payload.extensions) || Array.isArray(payload.installed) || Array.isArray(payload.plugins)) {
    return payload as ExtensionRuntimeManifest;
  }
  return null;
};

const unwrapTask = (response: any): ExtensionInstallTask | null => {
  const payload = responsePayload(response);
  if (!isRecord(payload)) return null;
  if (isRecord(payload.task)) return payload.task as ExtensionInstallTask;
  if (payload.taskId) return { ...payload, id: String(payload.taskId) } as ExtensionInstallTask;
  if (payload.id && (payload.status || payload.action || payload.extensionId)) return payload as ExtensionInstallTask;
  return null;
};

const normalizeReceipt = (item: any): ExtensionInstallReceipt | null => {
  if (!isRecord(item)) return null;
  const extensionId = item.extensionId || item.id;
  if (!extensionId || typeof extensionId !== 'string') return null;
  const installationStatus = item.installationStatus
    || (item.status === 'removed' ? 'removed' : item.installed === false ? 'never-installed' : 'installed');
  const dataStatus: ExtensionDataStatus = item.dataStatus
    || (item.retainedReason ? 'retained' : installationStatus === 'installed' ? 'active' : 'none');
  return {
    ...item,
    extensionId,
    installationStatus,
    dataStatus,
  } as ExtensionInstallReceipt;
};

const normalizeCatalogEntry = (item: any): ExtensionCatalogEntry | null => {
  if (!isRecord(item) || typeof item.id !== 'string') return null;
  const bundled = findBundledManifest(item.id);
  return {
    ...(bundled || {}),
    ...item,
    publisher: { ...(bundled?.publisher || {}), ...(item.publisher || {}) },
    name: item.name || bundled?.name || item.id,
    version: item.version || bundled?.version || '0.0.0',
  } as ExtensionCatalogEntry;
};

const normalizeRuntimeEntry = (item: any): ExtensionRuntimeEntry | null => {
  if (!isRecord(item)) return null;
  const id = item.id || item.extensionId;
  if (typeof id !== 'string') return null;
  const rawStatus = item.status || item.availability?.status || item.state;
  const statusAliases: Record<string, ExtensionStatus> = {
    'installed-disabled': 'disabled',
    'installed-enabled': 'enabled',
    'not-installed': 'missing',
    'never-installed': 'missing',
    'backend-update-required': 'incompatible',
    'frontend-missing': 'incompatible',
    'backend-missing': 'incompatible',
  };
  return {
    ...item,
    ...(isRecord(item.availability) ? item.availability : {}),
    id,
    status: statusAliases[String(rawStatus)] || rawStatus,
  } as ExtensionRuntimeEntry;
};

const statusFromEntry = (entry?: ExtensionRuntimeEntry, receipt?: ExtensionInstallReceipt): ExtensionStatus => {
  if (entry?.status === 'installed' && (entry.enabled === true || receipt?.enabled === true)) return 'enabled';
  if (entry?.status === 'installed' && (entry.enabled === false || receipt?.enabled === false)) return 'disabled';
  if (entry?.status) return entry.status;
  if (entry?.installationStatus === 'removed' && (entry.dataStatus === 'retained' || entry.retainedReason)) {
    return 'reinstall-required';
  }
  if (receipt?.installationStatus === 'removed' && receipt.dataStatus === 'retained') {
    return 'reinstall-required';
  }
  if (entry?.status === 'enabled' || receipt?.enabled === true) return 'enabled';
  if (entry?.status === 'disabled' || receipt?.enabled === false) return 'disabled';
  if (entry?.installationStatus === 'installed' || receipt?.installationStatus === 'installed') return 'disabled';
  return 'missing';
};

const statusReason = (entry?: ExtensionRuntimeEntry, receipt?: ExtensionInstallReceipt) => {
  if (entry?.reason) return entry.reason;
  if (entry?.reasonCode) return entry.reasonCode;
  if (receipt?.retainedReason === 'backup-restored') return 'BACKUP_RESTORED';
  if (receipt?.retainedReason === 'user-uninstalled') return 'USER_UNINSTALLED';
  return undefined;
};

export const useExtensionsStore = defineStore('extensions', {
  state: (): ExtensionStoreState => ({
    runtime: null,
    catalog: [...EXTENSION_CATALOG_FALLBACK],
    installed: [],
    tasks: [],
    loading: false,
    refreshing: false,
    error: '',
    lastActionError: '',
    discoveryStatus: 'idle',
    backendManifestAvailable: false,
    controlPlaneAvailable: false,
    runtimeHostUrl: '',
    fetchedAt: 0,
    // Admin credentials are intentionally memory-only; never persist this.
    adminToken: '',
  }),

  getters: {
    revision: state => state.runtime?.revision ?? 0,
    managementMode: state => state.runtime?.managementMode || 'read-only',
    canManage: state => state.controlPlaneAvailable && (
      state.runtime?.managementMode === 'local-socket'
      || (state.runtime?.managementMode === 'token' && Boolean(state.adminToken))
    ),
    hasRuntimeManifest: state => state.backendManifestAvailable,
    hasTrustedRuntimeSnapshot: state => Boolean(
      state.runtime
      && state.runtimeHostUrl
      && ['manifest', 'failed'].includes(state.discoveryStatus),
    ),
    runtimeEntries: state => {
      const entries = state.runtime?.extensions || state.runtime?.installed || state.runtime?.plugins || [];
      return entries.map(normalizeRuntimeEntry).filter(Boolean) as ExtensionRuntimeEntry[];
    },
  },

  actions: {
    async refresh(options: RefreshOptions = {}) {
      const storeIdentity = this as unknown as object;
      const requestHostUrl = normalizeHostIdentity(getHostAPIUrl());
      const activeFlight = refreshFlights.get(storeIdentity);
      if (activeFlight) {
        const hostChangedDuringFlight = refreshFlightHosts.get(storeIdentity) !== requestHostUrl;
        if (!options.force && !hostChangedDuringFlight) return activeFlight;
        const queuedFlight = queuedRefreshFlights.get(storeIdentity);
        if (queuedFlight) return queuedFlight;
        const nextFlight = activeFlight
          .catch(() => false)
          .then(() => this.refresh({ ...options, force: false }))
          .finally(() => {
            if (queuedRefreshFlights.get(storeIdentity) === nextFlight) {
              queuedRefreshFlights.delete(storeIdentity);
            }
          });
        queuedRefreshFlights.set(storeIdentity, nextFlight);
        return nextFlight;
      }

      if (this.runtimeHostUrl && this.runtimeHostUrl !== requestHostUrl) {
        this.resetRuntimeSnapshot(requestHostUrl);
      } else if (!this.runtimeHostUrl) {
        this.runtimeHostUrl = requestHostUrl;
      }

      const refreshPromise = (async () => {
        this.refreshing = true;
        this.discoveryStatus = 'loading';
        if (!options.silent) this.loading = true;
        this.error = '';

        try {
          const [runtimeResult, catalogResult, installedResult] = await Promise.allSettled([
            api.getRuntime(this.runtime?.etag),
            api.getCatalog(),
            api.getInstalled(),
          ]);

          // Ignore a response that completed after the user switched Host API.
          // A later init/visibility refresh will populate the new Host snapshot.
          if (normalizeHostIdentity(getHostAPIUrl()) !== requestHostUrl) {
            this.resetRuntimeSnapshot(normalizeHostIdentity(getHostAPIUrl()));
            this.discoveryStatus = 'idle';
            return false;
          }

          const runtimeStatus = settledStatus(runtimeResult);
          const explicitLegacyBackend = runtimeStatus === 404 || runtimeStatus === 405;
          const retainedRuntime = this.runtime && this.runtimeHostUrl === requestHostUrl
            ? this.runtime
            : null;

          if (runtimeResult.status === 'fulfilled' && runtimeResult.value?.status === 304 && retainedRuntime) {
            this.backendManifestAvailable = true;
            this.discoveryStatus = 'manifest';
          } else if (isSuccessfulResponse(runtimeResult)) {
            const runtime = unwrapRuntime(runtimeResult.value);
            if (runtime) {
              runtime.etag = runtimeResult.value.headers?.etag || runtime.etag;
              this.runtime = runtime;
              this.runtimeHostUrl = requestHostUrl;
              this.backendManifestAvailable = true;
              this.discoveryStatus = 'manifest';
            } else {
              this.backendManifestAvailable = Boolean(retainedRuntime);
              this.discoveryStatus = retainedRuntime ? 'failed' : 'unknown';
              this.error = 'EXTENSION_RUNTIME_MANIFEST_INVALID';
            }
          } else if (explicitLegacyBackend) {
            this.runtime = null;
            this.installed = [];
            this.tasks = [];
            this.backendManifestAvailable = false;
            this.discoveryStatus = 'legacy';
          } else {
            // A transient 5xx/timeout/network failure must not fail open into
            // legacy mode. Keep a snapshot only when it belongs to this Host.
            this.runtime = retainedRuntime;
            this.backendManifestAvailable = Boolean(retainedRuntime);
            this.discoveryStatus = retainedRuntime ? 'failed' : 'unknown';
            if (!retainedRuntime) {
              this.installed = [];
              this.tasks = [];
            }
            this.error = settledError(runtimeResult);
          }

          this.controlPlaneAvailable = Boolean(this.runtime && (
            this.runtime.managementMode === 'token'
            || this.runtime.managementMode === 'local-socket'
          ));

          if (isSuccessfulResponse(catalogResult)) {
            const remoteCatalog = unwrapArray<ExtensionCatalogEntry>(catalogResult.value, ['catalog', 'entries', 'extensions'])
              .map(normalizeCatalogEntry)
              .filter(Boolean) as ExtensionCatalogEntry[];
            this.catalog = remoteCatalog.length > 0
              ? this.mergeCatalog(remoteCatalog)
              : [...EXTENSION_CATALOG_FALLBACK];
          } else if (this.discoveryStatus === 'legacy' || !this.catalog.length) {
            this.catalog = [...EXTENSION_CATALOG_FALLBACK];
          }

          if (isSuccessfulResponse(installedResult)) {
            const installedPayload = responsePayload(installedResult.value);
            const installedRevision = isRecord(installedPayload)
              ? installedPayload.revision
              : undefined;
            const revisionMatches = !this.backendManifestAvailable
              || installedRevision === undefined
              || String(installedRevision) === String(this.revision);
            if (revisionMatches) {
              this.installed = unwrapArray<any>(installedResult.value, ['items', 'installed', 'extensions', 'receipts'])
                .map(normalizeReceipt)
                .filter(Boolean) as ExtensionInstallReceipt[];
            } else {
              this.installed = [];
            }
          } else if (this.discoveryStatus === 'legacy' || !this.backendManifestAvailable) {
            this.installed = [];
          }

          const runtimeEntries = this.runtimeEntries;
          const taskEntries = runtimeEntries
            .map(entry => entry.taskId ? ({
              id: entry.taskId,
              extensionId: entry.id,
              status: entry.status,
            }) : null)
            .filter(Boolean) as ExtensionInstallTask[];
          this.tasks = this.mergeTasks(taskEntries, this.tasks);
          this.fetchedAt = Date.now();

          if (!this.error && this.discoveryStatus === 'legacy') {
            this.error = 'LEGACY_EXTENSION_API_UNAVAILABLE';
          }
          return this.backendManifestAvailable || this.discoveryStatus === 'legacy';
        } finally {
          this.refreshing = false;
          this.loading = false;
        }
      })();

      const trackedRefreshPromise = refreshPromise.finally(() => {
        if (refreshFlights.get(storeIdentity) === trackedRefreshPromise) {
          refreshFlights.delete(storeIdentity);
          refreshFlightHosts.delete(storeIdentity);
        }
      });
      refreshFlights.set(storeIdentity, trackedRefreshPromise);
      refreshFlightHosts.set(storeIdentity, requestHostUrl);
      return trackedRefreshPromise;
    },

    resetRuntimeSnapshot(hostUrl = normalizeHostIdentity(getHostAPIUrl())) {
      this.runtime = null;
      this.catalog = [...EXTENSION_CATALOG_FALLBACK];
      this.installed = [];
      this.tasks = [];
      this.backendManifestAvailable = false;
      this.controlPlaneAvailable = false;
      this.runtimeHostUrl = hostUrl;
      this.discoveryStatus = 'idle';
      this.error = '';
      this.lastActionError = '';
      this.adminToken = '';
      this.fetchedAt = 0;
    },

    mergeCatalog(remoteCatalog: ExtensionCatalogEntry[]) {
      const byId = new Map<string, ExtensionCatalogEntry>();
      [...EXTENSION_CATALOG_FALLBACK, ...remoteCatalog].forEach(entry => {
        const previous = byId.get(entry.id);
        byId.set(entry.id, {
          ...(previous || {}),
          ...entry,
          publisher: {
            id: entry.publisher?.id || previous?.publisher?.id || 'unknown',
            name: entry.publisher?.name || previous?.publisher?.name || 'Unknown',
            verified: entry.publisher?.verified ?? previous?.publisher?.verified,
          },
        });
      });
      return [...byId.values()];
    },

    mergeTasks(next: ExtensionInstallTask[], previous: ExtensionInstallTask[]) {
      const byId = new Map<string, ExtensionInstallTask>();
      [...previous, ...next].forEach(task => {
        if (task?.id) byId.set(task.id, { ...(byId.get(task.id) || {}), ...task });
      });
      return [...byId.values()].slice(-40);
    },

    availability(extensionId: string): ExtensionAvailability {
      const catalogEntry = findCatalogEntry(this.catalog, extensionId);
      const bundledManifest = findBundledManifest(extensionId);
      const manifest = mergeManifest(
        bundledManifest,
        catalogEntry as Partial<ExtensionManifest> | undefined,
      );
      const entry = this.runtimeEntries.find(item => item.id === extensionId);
      const receipt = this.installed.find(item => item.extensionId === extensionId)
        || (entry?.receipt ? normalizeReceipt(entry.receipt) || undefined : undefined);

      if (entry || receipt || this.backendManifestAvailable) {
        const status = statusFromEntry(entry, receipt);
        return {
          extensionId,
          status,
          source: 'runtime',
          manifest,
          receipt,
          reasonCode: entry?.reasonCode,
          reason: statusReason(entry, receipt),
          taskId: entry?.taskId,
          backendRevision: this.revision,
          requiredFrontendImplementationAbi: entry?.requiredFrontendImplementationAbi as string | undefined,
          retainedReason: entry?.retainedReason || receipt?.retainedReason,
          codeStatus: entry?.codeStatus || receipt?.codeStatus,
          dataStatus: entry?.dataStatus || receipt?.dataStatus,
        };
      }

      // Preserve the established /sync experience only after the Host has
      // explicitly answered that the extension discovery API does not exist.
      // A timeout or 5xx must remain fail-closed instead of reviving a plugin
      // that a newer Host may have disabled or uninstalled.
      if (
        extensionId === EXTENSION_IDS.CONFIG_HOSTING
        && this.discoveryStatus === 'legacy'
      ) {
        return {
          extensionId,
          status: 'enabled',
          source: 'legacy-fallback',
          manifest,
          reason: 'LEGACY_CONFIG_HOSTING',
          codeStatus: 'bundled',
          dataStatus: 'active',
        };
      }
      if (
        ['idle', 'loading', 'unknown', 'failed'].includes(this.discoveryStatus)
      ) {
        return {
          extensionId,
          status: 'unknown',
          source: 'catalog',
          manifest,
          reason: this.error || 'EXTENSION_MANIFEST_UNAVAILABLE',
          reasonCode: 'EXTENSION_DISCOVERY_UNAVAILABLE',
        };
      }
      return {
        extensionId,
        status: 'missing',
        source: 'catalog',
        manifest,
      };
    },

    manifest(extensionId: string) {
      const bundled = findBundledManifest(extensionId);
      const entry = findCatalogEntry(this.catalog, extensionId);
      return mergeManifest(bundled, entry as Partial<ExtensionManifest> | undefined);
    },

    setAdminToken(token: string) {
      this.adminToken = token.trim();
    },

    clearAdminToken() {
      this.adminToken = '';
    },

    controlOptions(extra: Partial<ExtensionControlOptions> = {}): ExtensionControlOptions {
      return {
        adminToken: this.adminToken || undefined,
        expectedRevision: this.revision,
        idempotencyKey: `ext-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        ...extra,
      };
    },

    async runControlAction(
      action: 'install' | 'enable' | 'disable' | 'update' | 'rollback' | 'uninstall',
      extensionId: string,
      extra: Partial<ExtensionControlOptions> = {},
    ) {
      this.lastActionError = '';
      const options = this.controlOptions(extra);
      try {
        const response = await api[action === 'uninstall' ? 'uninstall' : action](extensionId, options);
        if (!response || response.status < 200 || response.status >= 300) {
          this.lastActionError = responseError(response);
          return false;
        }
        const task = unwrapTask(response);
        if (task) {
          this.tasks = this.mergeTasks([task], this.tasks);
          const taskSucceeded = await this.waitForTask(task.id);
          if (!taskSucceeded) {
            await this.refresh({ silent: true, force: true });
            return false;
          }
        }
        await this.refresh({ silent: true, force: true });
        return true;
      } catch (error: any) {
        this.lastActionError = error?.response ? responseError(error.response) : error?.message || 'EXTENSION_CONTROL_UNAVAILABLE';
        return false;
      }
    },

    async waitForTask(taskId: string, maxAttempts = 30) {
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        await new Promise(resolve => window.setTimeout(resolve, 500));
        try {
          const response = await api.getTask(taskId);
          if (!response || response.status < 200 || response.status >= 300) return false;
          const task = unwrapTask(response);
          if (!task) return true;
          this.tasks = this.mergeTasks([task], this.tasks);
          if (['succeeded', 'failed', 'cancelled'].includes(String(task.status))) {
            if (task.status !== 'succeeded') this.lastActionError = typeof task.error === 'string'
              ? task.error
              : task.error?.message || 'EXTENSION_TASK_FAILED';
            return task.status === 'succeeded';
          }
        } catch {
          return false;
        }
      }
      this.lastActionError = 'EXTENSION_TASK_TIMEOUT';
      return false;
    },

    async install(extensionId: string, options: Partial<ExtensionControlOptions> = {}) {
      return this.runControlAction('install', extensionId, options);
    },
    async enable(extensionId: string, options: Partial<ExtensionControlOptions> = {}) {
      return this.runControlAction('enable', extensionId, options);
    },
    async disable(extensionId: string, options: Partial<ExtensionControlOptions> = {}) {
      return this.runControlAction('disable', extensionId, options);
    },
    async update(extensionId: string, options: Partial<ExtensionControlOptions> = {}) {
      return this.runControlAction('update', extensionId, options);
    },
    async rollback(extensionId: string, options: Partial<ExtensionControlOptions> = {}) {
      return this.runControlAction('rollback', extensionId, options);
    },
    async uninstall(extensionId: string, options: Partial<ExtensionControlOptions> = {}) {
      return this.runControlAction('uninstall', extensionId, options);
    },

    async refreshOnRevisionFence() {
      return this.refresh({ silent: true, force: true });
    },

    startRevisionSync() {
      if (typeof window === 'undefined') return;
      const state = this as any;
      if (state.__revisionSyncStarted) return;
      state.__revisionSyncStarted = true;
      state.__revisionTimer = window.setInterval(() => {
        if (document.visibilityState === 'visible') this.refreshOnRevisionFence();
      }, 30000);
      state.__revisionVisibility = () => {
        if (document.visibilityState === 'visible') this.refreshOnRevisionFence();
      };
      state.__revisionOnline = () => this.refreshOnRevisionFence();
      document.addEventListener('visibilitychange', state.__revisionVisibility);
      window.addEventListener('online', state.__revisionOnline);
    },

    stopRevisionSync() {
      const state = this as any;
      if (!state.__revisionSyncStarted) return;
      window.clearInterval(state.__revisionTimer);
      document.removeEventListener('visibilitychange', state.__revisionVisibility);
      window.removeEventListener('online', state.__revisionOnline);
      state.__revisionSyncStarted = false;
    },
  },
});
