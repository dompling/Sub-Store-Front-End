interface ArtifactsStoreState {
  artifacts: Artifact[];
  loadedRuntimeKey: string;
  loadedAt: number;
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

type KnownArtifactType = 'collection' | 'subscription' | 'file' | 'config-project';
type ArtifactType = KnownArtifactType | (string & {});

interface Artifact {
  name: string;
  displayName?: string;
  remark?: string;
  icon?: string;
  isIconColor?: boolean;
  iconFit?: ImageFit | null;
  type: ArtifactType;
  source: string;
  sourceRef?: import('@/extensions/contracts').ResourceRefV1;
  representation?: string;
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
  sourceRef?: import('@/extensions/contracts').ResourceRefV1;
  representation?: string;
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
