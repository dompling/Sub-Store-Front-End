type ArtifactSourcePlatformDescriptor = {
  type?: string;
  platforms?: unknown;
};

type ResolveArtifactSourcePlatformOptions = {
  sources?: ArtifactSourcePlatformDescriptor[];
  type?: string;
  platform?: string;
  fallbackPlatform?: string;
};

export const DEFAULT_ARTIFACT_PLATFORM = "Stash";

export const artifactSourcePlatforms = (
  source?: ArtifactSourcePlatformDescriptor | null,
): string[] => {
  if (!Array.isArray(source?.platforms)) return [];

  return [
    ...new Set(
      source.platforms
        .filter((platform): platform is string => typeof platform === "string")
        .map(platform => platform.trim())
        .filter(Boolean),
    ),
  ];
};

export const findArtifactSourceDescriptor = (
  sources: ArtifactSourcePlatformDescriptor[] | undefined,
  type: string | undefined,
) => (sources || []).find(source => source?.type === type);

export const resolveArtifactSourcePlatform = ({
  sources,
  type,
  platform,
  fallbackPlatform = DEFAULT_ARTIFACT_PLATFORM,
}: ResolveArtifactSourcePlatformOptions): string => {
  const source = findArtifactSourceDescriptor(sources, type);
  const platforms = artifactSourcePlatforms(source);
  if (!platforms.length) return platform || fallbackPlatform;

  return platforms.includes(platform || "") ? platform! : platforms[0];
};
