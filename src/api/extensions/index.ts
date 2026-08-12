import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { getHostAPIUrl } from '@/hooks/useHostAPI';
import { getApiRequestTimeout } from '@/utils/requestTimeout';
import type {
  ExtensionApiEnvelope,
  ExtensionControlOptions,
  ExtensionSourceControlOptions,
} from '@/extensions/contracts';
import type { ExtensionDirectoryProjection } from '@/extensions/localDirectory';

export const EXTENSION_DIRECTORY_CONTENT_TYPE = 'application/vnd.substore.extension-directory+json';

/**
 * Extension discovery intentionally uses a small, silent client.  Older
 * Sub-Store builds do not expose these endpoints and a 404 must not result in
 * a global error toast during app startup; the store handles that response as
 * a compatibility fallback instead.
 */
const extensionRequest = <T = unknown>(
  config: AxiosRequestConfig,
): Promise<AxiosResponse<ExtensionApiEnvelope<T> | T>> => {
  const headers = {
    'Content-Type': 'application/json',
    ...(config.headers || {}),
  };

  return axios.request<ExtensionApiEnvelope<T> | T>({
    baseURL: getHostAPIUrl(),
    timeout: getApiRequestTimeout(),
    ...config,
    headers,
  });
};

const controlHeaders = (options?: ExtensionControlOptions) => {
  const headers: Record<string, string> = {};
  if (options?.adminToken) headers.Authorization = `Bearer ${options.adminToken}`;
  if (options?.expectedRevision !== undefined) {
    headers['X-Sub-Store-Extension-Revision'] = String(options.expectedRevision);
  }
  if (options?.idempotencyKey) headers['X-Idempotency-Key'] = options.idempotencyKey;
  return headers;
};

const controlBody = (options?: ExtensionControlOptions) => ({
  // A version is always selected from catalog release metadata. The backend
  // resolves its declared package URL/digest; clients must never derive one.
  ...(options?.version?.trim() ? { version: options.version.trim() } : {}),
  ...(options?.variant ? { variant: options.variant } : {}),
  ...(options?.expectedRevision !== undefined ? { expectedRevision: options.expectedRevision } : {}),
});

const sourceControlBody = (options?: ExtensionSourceControlOptions) => ({
  ...(options?.url ? { url: options.url } : {}),
  ...(options?.name ? { name: options.name } : {}),
  ...(options?.version ? { version: options.version } : {}),
  ...(options?.variant ? { variant: options.variant } : {}),
  ...(options?.expectedRevision !== undefined ? { expectedRevision: options.expectedRevision } : {}),
  // Source mutations are retried after a revision fence.  Keeping the key in
  // the body as well as the header lets hosts that only inspect JSON remain
  // idempotent, while older hosts simply ignore the additive field.
  ...(options?.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {}),
});

export function useExtensionsApi() {
  return {
    getRuntime: (etag?: string) => extensionRequest({
      url: '/api/extensions/runtime',
      method: 'get',
      headers: etag ? { 'If-None-Match': etag } : undefined,
      validateStatus: status => (status >= 200 && status < 300) || status === 304,
    }),
    getCatalog: () => extensionRequest({ url: '/api/extensions/catalog', method: 'get' }),
    getInstalled: () => extensionRequest({ url: '/api/extensions/installed', method: 'get' }),
    getArtifactSources: () => extensionRequest({
      url: '/api/extensions/artifact-sources',
      method: 'get',
      validateStatus: status => (status >= 200 && status < 300) || status === 404 || status === 405,
    }),
    getSources: () => extensionRequest({
      url: '/api/extensions/sources',
      method: 'get',
      // Source management was introduced after the catalog API.  A 404/405
      // is a valid response for an older host and is handled by the store.
      validateStatus: status => (status >= 200 && status < 300) || status === 404 || status === 405,
    }),
    getOne: (id: string) => extensionRequest({
      url: `/api/extensions/${encodeURIComponent(id)}`,
      method: 'get',
    }),
    getHealth: (id: string) => extensionRequest({
      url: `/api/extensions/${encodeURIComponent(id)}/health`,
      method: 'get',
    }),
    getTask: (taskId: string) => extensionRequest({
      url: `/api/extensions/tasks/${encodeURIComponent(taskId)}`,
      method: 'get',
    }),
    inspectLocalPackage: (
      projection: ExtensionDirectoryProjection,
      options?: ExtensionControlOptions,
    ) => extensionRequest({
      url: '/api/admin/extensions/packages/inspect',
      method: 'post',
      headers: {
        ...controlHeaders(options),
        'Content-Type': EXTENSION_DIRECTORY_CONTENT_TYPE,
      },
      data: projection,
    }),
    installLocal: (
      id: string,
      projection: ExtensionDirectoryProjection,
      options?: ExtensionControlOptions,
    ) => extensionRequest({
      url: `/api/admin/extensions/${encodeURIComponent(id)}/install-local`,
      method: 'post',
      headers: {
        ...controlHeaders(options),
        'Content-Type': EXTENSION_DIRECTORY_CONTENT_TYPE,
      },
      data: projection,
    }),
    install: (id: string, options?: ExtensionControlOptions) => extensionRequest({
      url: `/api/admin/extensions/${encodeURIComponent(id)}/install`,
      method: 'post',
      headers: controlHeaders(options),
      data: controlBody(options),
    }),
    enable: (id: string, options?: ExtensionControlOptions) => extensionRequest({
      url: `/api/admin/extensions/${encodeURIComponent(id)}/enable`,
      method: 'post',
      headers: controlHeaders(options),
      data: controlBody(options),
    }),
    disable: (id: string, options?: ExtensionControlOptions) => extensionRequest({
      url: `/api/admin/extensions/${encodeURIComponent(id)}/disable`,
      method: 'post',
      headers: controlHeaders(options),
      data: controlBody(options),
    }),
    update: (id: string, options?: ExtensionControlOptions) => extensionRequest({
      url: `/api/admin/extensions/${encodeURIComponent(id)}/update`,
      method: 'post',
      headers: controlHeaders(options),
      data: controlBody(options),
    }),
    rollback: (id: string, options?: ExtensionControlOptions) => extensionRequest({
      url: `/api/admin/extensions/${encodeURIComponent(id)}/rollback`,
      method: 'post',
      headers: controlHeaders(options),
      data: controlBody(options),
    }),
    uninstall: (id: string, options?: ExtensionControlOptions) => extensionRequest({
      url: `/api/admin/extensions/${encodeURIComponent(id)}`,
      method: 'delete',
      headers: controlHeaders(options),
      data: controlBody(options),
    }),
    purgeData: (id: string, options?: ExtensionControlOptions) => extensionRequest({
      url: `/api/admin/extensions/${encodeURIComponent(id)}/data`,
      method: 'delete',
      headers: controlHeaders(options),
      data: controlBody(options),
    }),
    addSource: (options: ExtensionSourceControlOptions) => extensionRequest({
      url: '/api/admin/extensions/sources',
      method: 'post',
      headers: controlHeaders(options),
      data: sourceControlBody(options),
    }),
    refreshSource: (id: string, options?: ExtensionSourceControlOptions) => extensionRequest({
      url: `/api/admin/extensions/sources/${encodeURIComponent(id)}/refresh`,
      method: 'post',
      headers: controlHeaders(options),
      data: sourceControlBody(options),
    }),
    removeSource: (id: string, options?: ExtensionSourceControlOptions) => extensionRequest({
      url: `/api/admin/extensions/sources/${encodeURIComponent(id)}`,
      method: 'delete',
      headers: controlHeaders(options),
      data: sourceControlBody(options),
    }),
  };
}
