interface ArtifactsStoreState {
  artifacts: Artifact[];
}

type ArtifactsPlatform =
  | 'Surge'
  | 'SurgeMac'
  | 'QX'
  | 'Loon'
  | 'Clash'
  | 'Surfboard'
  | 'Stash'
  | 'ShadowRocket'
  | 'Egern'
  | 'ClashMeta'
  | 'sing-box'
  | 'V2Ray'
  | 'URI'
  | 'JSON';

type ArtifactType = 'collection' | 'subscription' | 'file' | 'config-project';

interface Artifact {
  name: string;
  displayName?: string;
  remark?: string;
  icon?: string;
  isIconColor?: boolean;
  iconFit?: ImageFit | null;
  type: ArtifactType;
  source: string;
  platform: ArtifactsPlatform;
  tag?: string[];
  sync?: boolean;
  cron?: string;
  upload?: boolean;
  includeUnsupportedProxy?: boolean;
  prettyYaml?: boolean;
  'age-public-key'?: string;
  updated?: number;
  url?: string;
}

interface ArtifactForm {
  name: string;
  displayName?: string;
  remark?: string;
  icon?: string;
  iconFit?: ImageFit | null;
  type: ArtifactType;
  source: [string, string];
  platform: ArtifactsPlatform;
  tag?: string[];
  sync?: boolean;
  cron?: string;
  upload?: boolean;
  includeUnsupportedProxy?: boolean;
  prettyYaml?: boolean;
  'age-public-key'?: string;
  updated?: number;
  url?: string;
}
