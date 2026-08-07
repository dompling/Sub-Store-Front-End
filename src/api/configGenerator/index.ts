import request from '@/api';
import { AxiosPromise } from 'axios';

export function useConfigGeneratorApi() {
  return {
    getProjects: (): AxiosPromise<MyAxiosRes> => request({
      url: '/api/extensions/config-generator/projects',
      method: 'get',
    }),
    getProject: (name: string): AxiosPromise<MyAxiosRes> => request({
      url: `/api/extensions/config-generator/project/${encodeURIComponent(name)}`,
      method: 'get',
    }),
    createProject: (data: ConfigProject): AxiosPromise<MyAxiosRes> => request({
      url: '/api/extensions/config-generator/projects',
      method: 'post',
      data,
    }),
    updateProject: (name: string, data: Partial<ConfigProject>): AxiosPromise<MyAxiosRes> => request({
      url: `/api/extensions/config-generator/project/${encodeURIComponent(name)}`,
      method: 'patch',
      data,
    }),
    deleteProject: (name: string): AxiosPromise<MyAxiosRes> => request({
      url: `/api/extensions/config-generator/project/${encodeURIComponent(name)}`,
      method: 'delete',
    }),
    getRuleSets: (): AxiosPromise<MyAxiosRes> => request({
      url: '/api/extensions/config-generator/rule-sets',
      method: 'get',
    }),
    createRuleSet: (data: RemoteRuleSet): AxiosPromise<MyAxiosRes> => request({
      url: '/api/extensions/config-generator/rule-sets',
      method: 'post',
      data,
    }),
    updateRuleSet: (name: string, data: RemoteRuleSet): AxiosPromise<MyAxiosRes> => request({
      url: `/api/extensions/config-generator/rule-set/${encodeURIComponent(name)}`,
      method: 'patch',
      data,
    }),
    deleteRuleSet: (name: string): AxiosPromise<MyAxiosRes> => request({
      url: `/api/extensions/config-generator/rule-set/${encodeURIComponent(name)}`,
      method: 'delete',
    }),
    preview: (target: ConfigGeneratorTarget, data: unknown): AxiosPromise<MyAxiosRes> => request({
      url: `/api/extensions/config-generator/preview/${target}`,
      method: 'post',
      data,
    }),
    importConfig: (
      target: ConfigGeneratorTarget,
      content: string,
      sourceContext?: unknown,
    ): AxiosPromise<MyAxiosRes> => request({
      url: `/api/extensions/config-generator/import/${target}`,
      method: 'post',
      data: { content, sourceContext },
    }),
    getArtifactSources: (): AxiosPromise<MyAxiosRes> => request({
      url: '/api/extensions/artifact-sources',
      method: 'get',
    }),
  };
}
