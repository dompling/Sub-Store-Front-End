import { defineStore } from 'pinia';
import { useConfigGeneratorApi } from '@/api/configGenerator';

const api = useConfigGeneratorApi();

type ConfigGeneratorApiError = {
  code?: string;
  message?: string;
  details?: unknown;
  issues?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value)
  && typeof value === 'object';

const apiErrorFromResponse = (response: unknown): ConfigGeneratorApiError | undefined => {
  if (!isRecord(response) || !isRecord(response.data)) return undefined;
  if (response.data.status !== 'failed' || !isRecord(response.data.error)) return undefined;
  return response.data.error as ConfigGeneratorApiError;
};

class ConfigGeneratorRequestError extends Error {
  readonly code?: string;
  readonly details?: unknown;
  readonly issues?: unknown;

  constructor(error: ConfigGeneratorApiError = {}) {
    super(error.message || 'CONFIG_GENERATOR_REQUEST_FAILED');
    this.name = 'ConfigGeneratorRequestError';
    this.code = error.code;
    this.details = error.details;
    this.issues = error.issues;
  }
}

const unwrap = <T>(response: unknown, fallback: T): T => {
  const apiError = apiErrorFromResponse(response);
  if (apiError) {
    throw new ConfigGeneratorRequestError(apiError);
  }
  const responseData = isRecord(response) ? response.data : undefined;
  const data = isRecord(responseData) ? responseData.data ?? responseData : responseData;
  return (data ?? fallback) as T;
};

const unwrapList = <T>(response: any, key: string): T[] => {
  const data: any = unwrap(response, []);
  if (Array.isArray(data)) return data as T[];
  if (Array.isArray(data?.[key])) return data[key] as T[];
  return [];
};

const succeeded = (response: any) => response?.data?.status === 'success'
  || response?.data?.data?.status === 'success';

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  if (isRecord(error) && isRecord(error.response)) {
    const responseError = apiErrorFromResponse(error.response);
    if (responseError?.message) return responseError.message;
  }
  return fallback;
};

const getStructuredErrorDetails = (error: unknown): unknown[] => {
  let details: unknown;
  if (error instanceof ConfigGeneratorRequestError) {
    details = error.details ?? error.issues;
  } else if (isRecord(error) && isRecord(error.response)) {
    const responseError = apiErrorFromResponse(error.response);
    details = responseError?.details ?? responseError?.issues;
  }
  if (Array.isArray(details)) return details;
  if (isRecord(details) && Array.isArray(details.issues)) return details.issues;
  return details === undefined || details === null ? [] : [details];
};

type ConfigGeneratorPreviewDraft = {
  name: string;
  project: ConfigProject;
  ruleSets: RemoteRuleSet[];
  target: ConfigGeneratorTarget;
  body: string;
  stats?: Record<string, number>;
  warnings?: unknown[];
  errors?: unknown[];
  error?: string;
};

export const useConfigGeneratorStore = defineStore('configGenerator', {
  state: () => ({
    projects: [] as ConfigProject[],
    ruleSets: [] as RemoteRuleSet[],
    previewDraft: null as ConfigGeneratorPreviewDraft | null,
    importedProject: null as ConfigProject | null,
    importedRuleSets: [] as RemoteRuleSet[],
    loading: false,
    error: '',
    previewErrors: [] as unknown[],
  }),
  actions: {
    async fetchProjects() {
      this.loading = true;
      try {
        this.projects = unwrapList<ConfigProject>(await api.getProjects(), 'projects');
        return true;
      } catch (error: any) {
        this.error = getErrorMessage(error, 'CONFIG_GENERATOR_LOAD_FAILED');
        return false;
      } finally {
        this.loading = false;
      }
    },
    async fetchRuleSets() {
      try {
        this.ruleSets = unwrapList<RemoteRuleSet>(await api.getRuleSets(), 'ruleSets');
        return true;
      } catch (error: any) {
        this.error = getErrorMessage(error, 'CONFIG_GENERATOR_RULE_SET_LOAD_FAILED');
        return false;
      }
    },
    async getProject(name: string) {
      return unwrap(await api.getProject(name), null) as ConfigProject | null;
    },
    async saveRuleSet(ruleSet: RemoteRuleSet, editing = false) {
      try {
        const response = editing
          ? await api.updateRuleSet(ruleSet.name, ruleSet)
          : await api.createRuleSet(ruleSet);
        if (!succeeded(response)) {
          this.error = (response?.data as any)?.error?.message || 'CONFIG_GENERATOR_RULE_SET_SAVE_FAILED';
          return false;
        }
        return true;
      } catch (error: any) {
        this.error = getErrorMessage(error, 'CONFIG_GENERATOR_RULE_SET_SAVE_FAILED');
        return false;
      }
    },
    async removeRuleSet(name: string) {
      try {
        const response = await api.deleteRuleSet(name);
        if (!succeeded(response)) {
          this.error = (response?.data as any)?.error?.message || 'CONFIG_GENERATOR_RULE_SET_DELETE_FAILED';
          return false;
        }
        await this.fetchRuleSets();
        return true;
      } catch (error: any) {
        this.error = getErrorMessage(error, 'CONFIG_GENERATOR_RULE_SET_DELETE_FAILED');
        return false;
      }
    },
    async saveProject(project: ConfigProject, editing = false) {
      try {
        const response = editing
          ? await api.updateProject(project.name, project)
          : await api.createProject(project);
        if (!succeeded(response)) {
          this.error = (response?.data as any)?.error?.message || 'CONFIG_GENERATOR_SAVE_FAILED';
          return false;
        }
        await this.fetchProjects();
        return true;
      } catch (error: any) {
        this.error = getErrorMessage(error, 'CONFIG_GENERATOR_SAVE_FAILED');
        return false;
      }
    },
    async removeProject(name: string) {
      try {
        const response = await api.deleteProject(name);
        if (!succeeded(response)) {
          this.error = (response?.data as any)?.error?.message || 'CONFIG_GENERATOR_DELETE_FAILED';
          return false;
        }
        await this.fetchProjects();
        return true;
      } catch (error: any) {
        this.error = getErrorMessage(error, 'CONFIG_GENERATOR_DELETE_FAILED');
        return false;
      }
    },
    async preview(
      project: ConfigProject,
      ruleSets: RemoteRuleSet[] | undefined,
      target: ConfigGeneratorTarget,
    ) {
      this.error = '';
      this.previewErrors = [];
      try {
        return unwrap(await api.preview(target, { project, ruleSets }), null) as any;
      } catch (error: unknown) {
        this.error = getErrorMessage(error, 'CONFIG_GENERATOR_PREVIEW_FAILED');
        this.previewErrors = getStructuredErrorDetails(error);
        return null;
      }
    },
    setPreviewDraft(draft: ConfigGeneratorPreviewDraft) {
      this.previewDraft = draft;
    },
    takePreviewDraft() {
      const draft = this.previewDraft;
      this.previewDraft = null;
      return draft;
    },
    async importConfig(target: ConfigGeneratorTarget, content: string, sourceContext?: unknown) {
      try {
        return unwrap(await api.importConfig(target, content, sourceContext), null) as ConfigImportDraft | null;
      } catch (error: any) {
        this.error = getErrorMessage(error, 'CONFIG_GENERATOR_IMPORT_FAILED');
        return null;
      }
    },
    setImportedProject(project: ConfigProject, ruleSets: RemoteRuleSet[] = []) {
      this.importedProject = project;
      this.importedRuleSets = ruleSets;
    },
    takeImportedProject() {
      const project = this.importedProject;
      this.importedProject = null;
      return project;
    },
    takeImportedRuleSets() {
      const ruleSets = this.importedRuleSets;
      this.importedRuleSets = [];
      return ruleSets;
    },
  },
});
