import type { Component } from 'vue';
import type { RouteMeta } from 'vue-router';

import type {
  ExtensionManifest,
  ExtensionRouteContribution,
} from '@/extensions/contracts';

/**
 * The host-facing contract for a frontend extension.
 *
 * Definitions may be bundled with the Host or registered at runtime by a
 * verified official package. The extension owns its routes and surfaces;
 * the Host owns trust checks, lifecycle state and mounting decisions.
 */
export interface FrontendExtensionRouteMeta extends RouteMeta {
  title: string;
  needTabBar: boolean;
  needNavBack: boolean;
  backPath?: string;
  supportsListViewMode?: boolean;
  supportsListSearch?: boolean;
  listSearchPlaceholderKey?: string;
  hideSideBarInWideScreenNarrowMode?: boolean;
  extensionId: string;
  extensionSurfaceId: string;
  pageActions?: {
    addCommand?: string;
    addLabelKey?: string;
    importCommand?: string;
    importLabelKey?: string;
    manageCommand?: string;
  };
}

export interface FrontendExtensionRouteContribution extends ExtensionRouteContribution {
  path: string;
  extensionId: string;
  extensionSurfaceId: string;
  meta: FrontendExtensionRouteMeta;
}

export type FrontendExtensionSurfaceLoader = () => Promise<{
  default?: Component;
} | Component>;

export interface FrontendExtensionDefinition {
  id: string;
  manifest?: ExtensionManifest;
  version?: string;
  implementationAbi?: string;
  /** The route that should open when a user selects the extension in the store. */
  openPath?: string;
  routes: FrontendExtensionRouteContribution[];
  surfaces: Record<string, FrontendExtensionSurfaceLoader>;
  /** Whether an old Host without the Extension API may use this build surface. */
  legacyFallback?: boolean;
  /** Release resources owned by the extension before it is unloaded. */
  dispose?: () => void | Promise<void>;
}
