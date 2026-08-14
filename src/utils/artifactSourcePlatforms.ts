import type {
  ExtensionArtifactSourceDescriptor,
  ExtensionArtifactSourceItem,
  ResourceRefV1,
} from "@/extensions/contracts";

type ArtifactSourceSelection = {
  contributionId: string;
  itemId: string;
};

type ResolveArtifactRepresentationOptions = {
  source?: ExtensionArtifactSourceDescriptor | null;
  item?: ExtensionArtifactSourceItem | null;
  representation?: string;
  platform?: string;
};

type ResolveArtifactPlatformOptions = ResolveArtifactRepresentationOptions & {
  fallbackPlatform?: string;
};

export const DEFAULT_ARTIFACT_PLATFORM = "Stash";
const RESOURCE_REF_SCHEMA = "substore.resource-ref@1";

const uniqueStrings = (values: unknown): string[] => {
  if (!Array.isArray(values)) return [];

  return [
    ...new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map(value => value.trim())
        .filter(Boolean),
    ),
  ];
};

export const artifactSourceContributionId = (
  source?: ExtensionArtifactSourceDescriptor | null,
): string => `${source?.id || source?.sourceId || ""}`.trim();

export const artifactSourcePlatforms = (
  source?: ExtensionArtifactSourceDescriptor | null,
): string[] => uniqueStrings(source?.platforms);

const sourceRepresentations = (
  source?: ExtensionArtifactSourceDescriptor | null,
): string[] => uniqueStrings(source?.representations);

export const artifactSourceRepresentations = (
  source?: ExtensionArtifactSourceDescriptor | null,
  item?: ExtensionArtifactSourceItem | null,
): string[] => {
  const itemRepresentations = uniqueStrings(item?.representations);
  return itemRepresentations.length
    ? itemRepresentations
    : sourceRepresentations(source);
};

export const artifactSourcePlatformForRepresentation = (
  source: ExtensionArtifactSourceDescriptor | null | undefined,
  representation: string | undefined,
): string | undefined => {
  const token = `${representation || ""}`
    .trim()
    .toLowerCase()
    .split(/[-_.]/)[0]
    .replace(/[^a-z0-9]/g, "");
  if (!token) return undefined;

  return artifactSourcePlatforms(source).find(platform => {
    const normalized = platform.toLowerCase().replace(/[^a-z0-9]/g, "");
    const aliases = normalized === "qx"
      ? ["qx", "quantumultx"]
      : [normalized];
    if (["clashmeta", "mihomo"].includes(normalized)) aliases.push("clash");
    if (normalized === "surgemac") aliases.push("surge");
    return aliases.includes(token);
  });
};

export const artifactSourceRepresentationForPlatform = (
  source: ExtensionArtifactSourceDescriptor | null | undefined,
  platform: string | undefined,
): string | undefined => {
  const normalizedPlatform = `${platform || ""}`.trim();
  if (!normalizedPlatform) return undefined;
  const matches = sourceRepresentations(source).filter(
    representation => artifactSourcePlatformForRepresentation(
      source,
      representation,
    ) === normalizedPlatform,
  );
  return matches.length === 1 ? matches[0] : undefined;
};

export const findArtifactSourceDescriptor = (
  sources: ExtensionArtifactSourceDescriptor[] | undefined,
  identity: string | undefined,
) => {
  const normalizedIdentity = `${identity || ""}`.trim();
  if (!normalizedIdentity) return undefined;

  const exact = (sources || []).filter(
    source => artifactSourceContributionId(source) === normalizedIdentity,
  );
  if (exact.length) return exact[0];

  const legacyMatches = (sources || []).filter(
    source => source?.type === normalizedIdentity,
  );
  return legacyMatches.length === 1 ? legacyMatches[0] : undefined;
};

export const findArtifactSourceItem = (
  source: ExtensionArtifactSourceDescriptor | null | undefined,
  identity: string | undefined,
) => {
  const normalizedIdentity = `${identity || ""}`.trim();
  if (!normalizedIdentity) return undefined;

  return (source?.items || []).find(item => (
    item?.ref?.id === normalizedIdentity || item?.name === normalizedIdentity
  ));
};

export const findArtifactSourceByRef = (
  sources: ExtensionArtifactSourceDescriptor[] | undefined,
  ref: ResourceRefV1 | undefined,
) => {
  if (!ref) return undefined;
  return (sources || []).find(source => (
    artifactSourceContributionId(source) === ref.providerContributionId
      && source.ownerExtensionId === ref.providerId
      && source.type === ref.type
      && source.contract === ref.contract
  ));
};

export const isResourceRefV1 = (value: unknown): value is ResourceRefV1 => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const ref = value as Partial<ResourceRefV1>;
  return ref.schema === RESOURCE_REF_SCHEMA
    && [
      ref.providerId,
      ref.providerContributionId,
      ref.type,
      ref.id,
      ref.contract,
    ].every(field => typeof field === "string" && Boolean(field.trim()));
};

export const resourceRefFromArtifactSource = (
  source: ExtensionArtifactSourceDescriptor | null | undefined,
  item: ExtensionArtifactSourceItem | null | undefined,
): ResourceRefV1 | undefined => {
  if (isResourceRefV1(item?.ref)) return { ...item.ref };

  const providerContributionId = artifactSourceContributionId(source);
  const providerId = `${source?.ownerExtensionId || ""}`.trim();
  const type = `${source?.type || ""}`.trim();
  const id = `${item?.name || ""}`.trim();
  const contract = `${source?.contract || ""}`.trim();
  if (![providerId, providerContributionId, type, id, contract].every(Boolean)) {
    return undefined;
  }

  return {
    schema: RESOURCE_REF_SCHEMA,
    providerId,
    providerContributionId,
    type,
    id,
    contract,
  };
};

export const resolveArtifactSourceRepresentation = ({
  source,
  item,
  representation,
  platform,
}: ResolveArtifactRepresentationOptions): string => {
  const representations = artifactSourceRepresentations(source, item);
  if (!representations.length) return "";
  const current = `${representation || ""}`.trim();
  if (representations.includes(current)) return current;

  const mapped = artifactSourceRepresentationForPlatform(source, platform);
  if (mapped && representations.includes(mapped)) return mapped;
  const normalizedPlatform = `${platform || ""}`.trim();
  const platformHasMultipleRepresentations = normalizedPlatform
    && artifactSourcePlatforms(source).includes(normalizedPlatform)
    && representations.filter(
      candidate => artifactSourcePlatformForRepresentation(source, candidate)
        === normalizedPlatform,
    ).length > 1;
  if (platformHasMultipleRepresentations) return "";
  return representations.length === 1 ? representations[0] : "";
};

export const resolveArtifactSourcePlatform = ({
  source,
  item,
  representation,
  platform,
  fallbackPlatform = DEFAULT_ARTIFACT_PLATFORM,
}: ResolveArtifactPlatformOptions): string => {
  const mapped = artifactSourcePlatformForRepresentation(source, representation);
  if (mapped) return mapped;

  const platforms = artifactSourcePlatforms(source);
  if (!platforms.length) return platform || fallbackPlatform;
  if (platforms.includes(platform || "")) return platform!;

  const resolvedRepresentation = resolveArtifactSourceRepresentation({
    source,
    item,
    representation,
    platform,
  });
  return artifactSourcePlatformForRepresentation(source, resolvedRepresentation)
    || platforms[0];
};

export const artifactSourceSelection = (
  source: ExtensionArtifactSourceDescriptor,
  item: ExtensionArtifactSourceItem,
): ArtifactSourceSelection | null => {
  const contributionId = artifactSourceContributionId(source);
  const itemId = `${item?.ref?.id || item?.name || ""}`.trim();
  return contributionId && itemId ? { contributionId, itemId } : null;
};
