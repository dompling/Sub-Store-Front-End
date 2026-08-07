export type PolicyGroupSupportLevel = 'exact' | 'fallback' | 'unsupported';

export interface PolicyGroupTypeDefinition {
  value: PolicyGroup['type'];
  labelKey: string;
  section: 'portable' | 'surge' | 'qx' | 'loon';
  support: Record<ConfigGeneratorTarget, {
    level: PolicyGroupSupportLevel;
    output?: string;
  }>;
}

export const POLICY_GROUP_TYPE_DEFINITIONS: PolicyGroupTypeDefinition[] = [
  {
    value: 'select',
    labelKey: 'select',
    section: 'portable',
    support: {
      surge: { level: 'exact', output: 'select' },
      qx: { level: 'exact', output: 'static' },
      clash: { level: 'exact', output: 'select' },
      loon: { level: 'exact', output: 'select' },
    },
  },
  {
    value: 'fallback',
    labelKey: 'fallback',
    section: 'portable',
    support: {
      surge: { level: 'exact', output: 'fallback' },
      qx: { level: 'exact', output: 'available' },
      clash: { level: 'exact', output: 'fallback' },
      loon: { level: 'exact', output: 'fallback' },
    },
  },
  {
    value: 'url-test',
    labelKey: 'urlTest',
    section: 'portable',
    support: {
      surge: { level: 'exact', output: 'url-test' },
      qx: { level: 'exact', output: 'url-latency-benchmark' },
      clash: { level: 'exact', output: 'url-test' },
      loon: { level: 'exact', output: 'url-test' },
    },
  },
  {
    value: 'smart',
    labelKey: 'smart',
    section: 'surge',
    support: {
      surge: { level: 'exact', output: 'smart' },
      qx: { level: 'fallback', output: 'url-latency-benchmark' },
      clash: { level: 'fallback', output: 'url-test' },
      loon: { level: 'fallback', output: 'url-test' },
    },
  },
  {
    value: 'load-balance',
    labelKey: 'loadBalance',
    section: 'surge',
    support: {
      surge: { level: 'exact', output: 'load-balance' },
      qx: { level: 'fallback', output: 'round-robin' },
      clash: { level: 'fallback', output: 'load-balance' },
      loon: { level: 'exact', output: 'load-balance' },
    },
  },
  {
    value: 'subnet',
    labelKey: 'subnet',
    section: 'surge',
    support: {
      surge: { level: 'exact', output: 'subnet' },
      qx: { level: 'unsupported' },
      clash: { level: 'unsupported' },
      loon: { level: 'unsupported' },
    },
  },
  {
    value: 'round-robin',
    labelKey: 'roundRobin',
    section: 'qx',
    support: {
      surge: { level: 'fallback', output: 'load-balance' },
      qx: { level: 'exact', output: 'round-robin' },
      clash: { level: 'fallback', output: 'load-balance / round-robin' },
      loon: { level: 'fallback', output: 'load-balance' },
    },
  },
  {
    value: 'dest-hash',
    labelKey: 'destHash',
    section: 'qx',
    support: {
      surge: { level: 'fallback', output: 'load-balance + persistent' },
      qx: { level: 'exact', output: 'dest-hash' },
      clash: { level: 'fallback', output: 'load-balance / consistent-hashing' },
      loon: { level: 'fallback', output: 'load-balance' },
    },
  },
  {
    value: 'ssid',
    labelKey: 'ssid',
    section: 'qx',
    support: {
      surge: { level: 'unsupported' },
      qx: { level: 'exact', output: 'ssid' },
      clash: { level: 'unsupported' },
      loon: { level: 'exact', output: 'ssid' },
    },
  },
];

export const policyGroupTypeDefinition = (type?: PolicyGroup['type']) =>
  POLICY_GROUP_TYPE_DEFINITIONS.find(item => item.value === type);
