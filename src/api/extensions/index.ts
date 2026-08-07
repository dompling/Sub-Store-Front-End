import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { getHostAPIUrl } from '@/hooks/useHostAPI';
import { getApiRequestTimeout } from '@/utils/requestTimeout';
import type {
  ExtensionApiEnvelope,
  ExtensionControlOptions,
} from '@/extensions/contracts';

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
  ...(options?.version ? { version: options.version } : {}),
  ...(options?.variant ? { variant: options.variant } : {}),
  ...(options?.expectedRevision !== undefined ? { expectedRevision: options.expectedRevision } : {}),
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
  };
}
