type ConfigGeneratorTarget = 'surge' | 'qx' | 'clash' | 'loon';

interface RemoteProxySource {
  name: string;
  source:
    | { kind: 'sub-store'; type: 'subscription' | 'collection'; name: string; publicBaseUrl: string }
    | {
        kind: 'url';
        url: string;
        mode?: 'auto' | 'passthrough';
        target?: ConfigGeneratorTarget;
        publicBaseUrl?: string;
      };
  enabled?: boolean;
  targetOptions?: {
    qx?: {
      tag?: string;
      updateInterval?: number;
      optParser?: boolean;
    };
    clash?: {
      updateInterval?: number;
    };
  };
}

interface PolicyGroup {
  name: string;
  remark?: string;
  type:
    | 'select'
    | 'url-test'
    | 'fallback'
    | 'load-balance'
    | 'subnet'
    | 'smart'
    | 'round-robin'
    | 'dest-hash'
    | 'ssid';
  members: Array<
    | { kind: 'builtin'; value: 'DIRECT' | 'REJECT' }
    | { kind: 'group'; value: string }
    | { kind: 'conditional'; value: string; policy: string }
    | { kind: 'proxy'; value: string }
  >;
  includeAllProxies?: boolean;
  includeOtherGroups?: string[];
  nodeNameRegex?: string;
  testUrl?: string;
  interval?: number;
  tolerance?: number;
  timeout?: number;
  policyUpdateInterval?: number;
  remoteProxySource?: string;
  iconUrl?: string;
  disabled?: boolean;
  targetOptions?: {
    surge?: {
      hidden?: boolean;
      noAlert?: boolean;
      iconUrl?: string;
      remoteProxySource?: string;
      evaluateBeforeUse?: boolean;
      persistent?: boolean;
      subnetDefault?: string;
      subnetRules?: Array<{ expression: string; policy: string }>;
    };
    qx?: {
      aliveChecking?: boolean;
      resourceTagRegex?: string;
      remoteProxySource?: string;
    };
    clash?: {
      remoteProxySource?: string;
    };
    loon?: {
      remoteProxySource?: string;
      algorithm?: 'Random' | 'PCC' | 'Round-Robin';
    };
  };
}

interface RemoteRuleSet {
  name: string;
  source:
    | { kind: 'url'; url: string; target?: ConfigGeneratorTarget }
    | { kind: 'builtin'; value: 'SYSTEM' | 'LAN' };
  enabled?: boolean;
  updateInterval?: number;
  remark?: string;
  targetOptions?: {
    qx?: {
      optParser?: boolean;
    };
  };
}

type RuleBinding =
  | { kind: 'comment'; text: string }
  | { kind: 'blank' }
  | { kind: 'remote'; name?: string; ruleSet: string; policy: string; disabled?: boolean; noResolve?: boolean }
  | { kind: 'inline'; type: string; value: string; policy: string; disabled?: boolean; noResolve?: boolean }
  | { kind: 'final'; policy: string; dnsFailed?: boolean };

interface SurgeOutput {
  includeUnsupportedProxy?: boolean;
  independentConfig?: string;
}

interface QxOutput {
  independentConfig?: string;
}

interface ClashOutput {
  independentConfig?: string;
}

interface LoonOutput {
  includeUnsupportedProxy?: boolean;
  independentConfig?: string;
}

interface ConfigProject {
  name: string;
  displayName?: string;
  remark?: string;
  embeddedSource?: { type: 'subscription' | 'collection'; name: string };
  remoteProxySources: RemoteProxySource[];
  groups: PolicyGroup[];
  rules: RuleBinding[];
  process?: Process[];
  outputs: {
    surge?: SurgeOutput;
    qx?: QxOutput;
    clash?: ClashOutput;
    loon?: LoonOutput;
  };
  revision?: number;
  updated?: number;
}

interface ConfigImportDraft {
  project: Omit<ConfigProject, 'name' | 'revision'>;
  ruleSets: RemoteRuleSet[];
  detected: {
    groupCount: number;
    ruleCount: number;
    remoteProxySources: number;
  };
  warnings?: Array<{ path?: string; message: string; line?: number }>;
}
