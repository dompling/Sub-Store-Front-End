import clashIcon from '@/assets/icons/clash_color.png';
import loonIcon from '@/assets/icons/loon_color.png';
import qxIcon from '@/assets/icons/quanx_color.png';
import surgeIcon from '@/assets/icons/surge_color.png';

export type ConfigGeneratorEditorLanguage = 'ini' | 'yaml';

export interface ConfigGeneratorTargetDefinition {
  availability: 'available' | 'planned';
  supportsImport: boolean;
  displayName: string;
  shortName: string;
  icon: string;
  outputLabelKey: string;
  editorLanguage: ConfigGeneratorEditorLanguage;
  independentConfig: {
    defaultValue: string;
    placeholder: string;
  };
  downloadSuffix: string;
  sourceHelp: {
    formatKey: string;
    summaryKey: string;
    detailKey: string;
  };
  importDescriptionKey: string;
  importFormats: string;
}

export const DEFAULT_CONFIG_GENERATOR_TARGET: ConfigGeneratorTarget = 'surge';

// "clash" intentionally means the classic Clash / Clash for Windows format.
// Mihomo-specific syntax must be registered as a separate target when supported.
export const CONFIG_GENERATOR_TARGET_REGISTRY: Record<
  ConfigGeneratorTarget,
  ConfigGeneratorTargetDefinition
> = {
  surge: {
    availability: 'available',
    supportsImport: true,
    displayName: 'Surge',
    shortName: 'Surge',
    icon: surgeIcon,
    outputLabelKey: 'configGenerator.surgeOutput',
    editorLanguage: 'ini',
    independentConfig: {
      defaultValue: '[General]\n\n[Host]\n\n[Rule]\n\n[MITM]\n',
      placeholder: '[General]\n\n[Host]\n\n[MITM]',
    },
    downloadSuffix: 'Surge',
    sourceHelp: {
      formatKey: 'configGenerator.surgeSourceFormatHelp',
      summaryKey: 'configGenerator.surgeSourceCrossTargetShort',
      detailKey: 'configGenerator.surgeSourceCrossTargetHelp',
    },
    importDescriptionKey: 'configGenerator.importSurgeDescription',
    importFormats: '.conf · .ini · .txt',
  },
  qx: {
    availability: 'available',
    supportsImport: true,
    displayName: 'Quantumult X',
    shortName: 'QX',
    icon: qxIcon,
    outputLabelKey: 'configGenerator.qxOutput',
    editorLanguage: 'ini',
    independentConfig: {
      defaultValue: '[general]\nresource_parser_url=https://raw.githubusercontent.com/KOP-XIAO/QuantumultX/master/Scripts/resource-parser.js\n\n[dns]\n\n[mitm]\n',
      placeholder: '[general]\n\n[dns]\n\n[mitm]',
    },
    downloadSuffix: 'QX',
    sourceHelp: {
      formatKey: 'configGenerator.qxSourceFormatHelp',
      summaryKey: 'configGenerator.qxSourceTargetOnlyShort',
      detailKey: 'configGenerator.qxSourceTargetOnlyHelp',
    },
    importDescriptionKey: 'configGenerator.importQxDescription',
    importFormats: '.conf · .ini · .txt',
  },
  clash: {
    availability: 'available',
    supportsImport: true,
    displayName: 'Clash',
    shortName: 'Clash',
    icon: clashIcon,
    outputLabelKey: 'configGenerator.clashOutput',
    editorLanguage: 'yaml',
    independentConfig: {
      defaultValue: 'mode: rule\n\nproxies: []\nproxy-groups: []\nrules:\n  - MATCH,DIRECT\n',
      placeholder: 'mode: rule\n\nproxies: []\nproxy-groups: []\nrules:\n  - MATCH,DIRECT',
    },
    downloadSuffix: 'Clash',
    sourceHelp: {
      formatKey: 'configGenerator.clashSourceFormatHelp',
      summaryKey: 'configGenerator.clashSourceTargetOnlyShort',
      detailKey: 'configGenerator.clashSourceTargetOnlyHelp',
    },
    importDescriptionKey: 'configGenerator.importClashDescription',
    importFormats: '.yaml · .yml',
  },
  loon: {
    availability: 'available',
    supportsImport: true,
    displayName: 'Loon',
    shortName: 'Loon',
    icon: loonIcon,
    outputLabelKey: 'configGenerator.loonOutput',
    editorLanguage: 'ini',
    independentConfig: {
      defaultValue: '[General]\n\n[Proxy]\n\n[Proxy Group]\n\n[Rule]\n',
      placeholder: '[General]\n\n[Proxy]\n\n[Proxy Group]\n\n[Rule]',
    },
    downloadSuffix: 'Loon',
    sourceHelp: {
      formatKey: 'configGenerator.loonSourceFormatHelp',
      summaryKey: 'configGenerator.loonSourceTargetOnlyShort',
      detailKey: 'configGenerator.loonSourceTargetOnlyHelp',
    },
    importDescriptionKey: 'configGenerator.importLoonDescription',
    importFormats: '.conf · .ini · .txt',
  },
};

export const CONFIG_GENERATOR_REGISTERED_TARGETS = Object.keys(
  CONFIG_GENERATOR_TARGET_REGISTRY,
) as ConfigGeneratorTarget[];

export const CONFIG_GENERATOR_TARGETS = CONFIG_GENERATOR_REGISTERED_TARGETS.filter(
  target => CONFIG_GENERATOR_TARGET_REGISTRY[target].availability === 'available',
);

export const CONFIG_GENERATOR_REGISTERED_TARGET_DEFINITIONS = CONFIG_GENERATOR_REGISTERED_TARGETS.map(target => ({
  target,
  ...CONFIG_GENERATOR_TARGET_REGISTRY[target],
}));

export const CONFIG_GENERATOR_TARGET_DEFINITIONS = CONFIG_GENERATOR_TARGETS.map(target => ({
  target,
  ...CONFIG_GENERATOR_TARGET_REGISTRY[target],
}));

export const CONFIG_GENERATOR_IMPORT_TARGET_DEFINITIONS = CONFIG_GENERATOR_TARGET_DEFINITIONS
  .filter(target => target.supportsImport);

export const isConfigGeneratorTarget = (value: unknown): value is ConfigGeneratorTarget =>
  typeof value === 'string'
  && CONFIG_GENERATOR_TARGETS.includes(value as ConfigGeneratorTarget);
