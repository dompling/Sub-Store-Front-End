<template>
  <div class="side-bar-wrapper" :class="{ 'is-expanded': isExpanded }">
    <div class="sidebar-content">
      <div class="menu-items">
        <div 
          class="menu-item" 
          :class="{ active: activeNavigationId === CORE_NAVIGATION_IDS.SUBSCRIPTIONS }"
          @click="router.push('/subs')"
        >
          <nut-icon name="link" size="22px" />
          <span class="label" v-show="isExpanded">{{ $t('tabBar.sub') }}</span>
        </div>

        <div 
          v-show="!shouldHideFilesTab"
          class="menu-item" 
          :class="{ active: activeNavigationId === CORE_NAVIGATION_IDS.FILES }"
          @click="router.push('/files')"
        >
          <nut-icon name="category" size="22px" />
          <span class="label" v-show="isExpanded">{{ $t('tabBar.file') }}</span>
        </div>

        <div 
          v-show="!shouldHideSyncTab"
          class="menu-item" 
          :class="{ active: activeNavigationId === NAVIGATION_IDS.CONFIG_HOSTING }"
          @click="router.push('/sync')"
        >
          <nut-icon name="refresh2" size="22px" />
          <span class="label" v-show="isExpanded">{{ $t('tabBar.sync') }}</span>
        </div>

        <div 
          v-show="shouldShowShareTab"
          class="menu-item" 
          :class="{ active: activeNavigationId === CORE_NAVIGATION_IDS.SHARES }"
          @click="router.push('/shares')"
        >
          <font-awesome-icon icon="fa-solid fa-share-nodes" style="font-size: 20px; width: 22px; height: 22px;" />
          <span class="label" v-show="isExpanded">{{ $t('tabBar.share') }}</span>
        </div>

        <div 
          v-show="env?.feature?.archive"
          class="menu-item" 
          :class="{ active: activeNavigationId === CORE_NAVIGATION_IDS.ARCHIVES }"
          @click="router.push('/archives')"
        >
          <font-awesome-icon icon="fa-solid fa-box-archive" style="font-size: 20px; width: 22px; height: 22px;" />
          <span class="label" v-show="isExpanded">{{ $t('tabBar.archive') }}</span>
        </div>

        <div
          v-show="configGeneratorVisible"
          class="menu-item"
          :class="{ active: activeNavigationId === NAVIGATION_IDS.CONFIG_GENERATOR }"
          @click="router.push('/extensions/config-generator')"
        >
          <font-awesome-icon icon="fa-solid fa-code-branch" style="font-size: 20px; width: 22px; height: 22px;" />
          <span class="label" v-show="isExpanded">{{ $t('tabBar.configGenerator') }}</span>
        </div>

        <div
          class="menu-item"
          :class="{ active: activeNavigationId === NAVIGATION_IDS.EXTENSIONS_STORE }"
          @click="router.push('/extensions')"
        >
          <font-awesome-icon icon="fa-solid fa-puzzle-piece" style="font-size: 20px; width: 22px; height: 22px;" />
          <span class="label" v-show="isExpanded">{{ $t('navBar.pagesTitle.extensions') }}</span>
        </div>

        <div 
          class="menu-item" 
          :class="{ active: activeNavigationId === CORE_NAVIGATION_IDS.SETTINGS }"
          @click="router.push('/my')"
        >
          <div class="icon-container">
            <nut-icon name="setting" size="22px" />
            <div v-if="env.hasNewVersion" class="nut-badge__content sup is-dot"></div>
          </div>
          <span class="label" v-show="isExpanded">{{ $t('tabBar.my') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useGlobalStore } from '@/store/global';
import { useSettingsStore } from '@/store/settings';
import { useSystemStore } from "@/store/system";
import { SIDEBAR_EXPANDED_BREAKPOINT } from "@/store/system";
import { storeToRefs } from 'pinia';
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useWindowSize } from '@vueuse/core';
import { useExtensionsStore } from '@/store/extensions';
import { EXTENSION_IDS, NAVIGATION_IDS } from '@/extensions/registry';

const route = useRoute();
const router = useRouter();
const CORE_NAVIGATION_IDS = {
  SUBSCRIPTIONS: 'org.substore.core.subscriptions',
  FILES: 'org.substore.core.files',
  SHARES: 'org.substore.core.shares',
  ARCHIVES: 'org.substore.core.archives',
  SETTINGS: 'org.substore.core.settings',
} as const;

const activeNavigationId = computed(() => {
  const path = route.path;
  if (path.startsWith('/extensions/config-generator')) return NAVIGATION_IDS.CONFIG_GENERATOR;
  if (path === '/extensions') return NAVIGATION_IDS.EXTENSIONS_STORE;
  if (path.startsWith('/edit/sync/') || path === '/sync') return NAVIGATION_IDS.CONFIG_HOSTING;
  if (path.startsWith('/files') || path.startsWith('/edit/files/')) return CORE_NAVIGATION_IDS.FILES;
  if (path.startsWith('/subs') || path.startsWith('/edit/subs/') || path.startsWith('/edit/collections/')) return CORE_NAVIGATION_IDS.SUBSCRIPTIONS;
  if (path.startsWith('/shares') || path.startsWith('/edit/shares/')) return CORE_NAVIGATION_IDS.SHARES;
  if (path.startsWith('/archives')) return CORE_NAVIGATION_IDS.ARCHIVES;
  return CORE_NAVIGATION_IDS.SETTINGS;
});

const { width: windowWidth } = useWindowSize();

const isExpanded = computed(() => {
  return windowWidth.value >= SIDEBAR_EXPANDED_BREAKPOINT;
});

const globalStore = useGlobalStore();
const settingsStore = useSettingsStore();
const systemStore = useSystemStore();
const extensionsStore = useExtensionsStore();

const { appearanceSetting, hasFetchedSettings, hasCachedAppearanceNavigationSetting } = storeToRefs(settingsStore);
const { env } = storeToRefs(globalStore);
const { navBarHeight } = storeToRefs(systemStore);
const shouldHideFilesTab = computed(() => {
  if (hasCachedAppearanceNavigationSetting.value) {
    return !!appearanceSetting.value.istabBar2;
  }

  if (!hasFetchedSettings.value) {
    return false;
  }

  return !!appearanceSetting.value.istabBar2;
});
const shouldHideSyncTab = computed(() => {
  if (hasCachedAppearanceNavigationSetting.value) {
    return !!appearanceSetting.value.istabBar;
  }

  if (!hasFetchedSettings.value) {
    return false;
  }

  return !!appearanceSetting.value.istabBar;
});
const shouldHideShareTab = computed(() => {
  if (hasCachedAppearanceNavigationSetting.value) {
    return !!appearanceSetting.value.istabBar3;
  }

  if (!hasFetchedSettings.value) {
    return false;
  }

  return !!appearanceSetting.value.istabBar3;
});
const shouldShowShareTab = computed(() => {
  return !!env.value?.feature?.share && !shouldHideShareTab.value;
});
const configGeneratorVisible = computed(() => {
  const availability = extensionsStore.availability(EXTENSION_IDS.CONFIG_GENERATOR);
  return availability.status === 'enabled'
    || !!(env.value?.feature?.configGenerator || env.value?.feature?.['config-generator']);
});

onMounted(() => {
  extensionsStore.refresh({ silent: true });
  extensionsStore.startRevisionSync();
});

</script>

<style lang="scss" scoped>
.side-bar-wrapper {
  display: none; // Hidden by default, shown on medium+ screens

  @media screen and (min-width: 768px) {
    display: flex;
    flex-direction: column;
    position: fixed;
    height: max-content;
    top: calc(v-bind(navBarHeight) + 16px);
    width: 60px;
    padding: 8px 0;
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 101;
    
    // User requested border & card background
    background: var(--tab-bar-color);
    border: 1px solid var(--divider-color);
    border-radius: var(--item-card-radios, 20px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    backdrop-filter: blur(var(--tab-bar-blur, 20px));
    -webkit-backdrop-filter: blur(var(--tab-bar-blur, 20px));

    // Anchor purely to the left of the .page-body
    left: calc(50vw - 315px);
    transform: translateX(-100%);
  }

  @media screen and (min-width: 900px) {
    left: calc(50vw - 350px);
  }

  @media screen and (min-width: 1200px) {
    left: calc(50vw - 450px);
  }

  &.is-expanded {
    width: 160px;
  }

  .sidebar-content {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: 100%;
  }

  .menu-items {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }

  .menu-item {
    cursor: pointer;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    color: var(--lowest-text-color);
    width: 100%;
    padding: 14px 24px;
    transition: color 0.2s, background 0.2s;

    &.active {
      color: var(--primary-color);
    }

    &:hover:not(.active) {
      color: var(--primary-text-color);
    }

    .icon-container {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .label {
      margin-left: 14px;
      font-weight: 600;
      white-space: nowrap;
      font-size: 14px;
      line-height: 1;
    }
  }

  // Adjustments for collapsed icon-only mode
  &:not(.is-expanded) {
    .menu-item {
      padding: 14px 0;
      justify-content: center;
    }
  }

  .nut-badge__content.is-dot {
    position: absolute;
    top: -2px;
    right: -2px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--nut-badge-background-color, #e2231a);
  }
}
</style>
