<template>
  <div class="tab-bar-wrapper" :class="{ 'is-wide-screen-visible': isWideScreenNarrowModeActive }">
    <nut-tabbar
      unactive-color=""
      v-model:visible="activeTab"
      :bottom="true"
      class="tabbar"
      size="22px"
    >
      <nut-tabbar-item class="tabbar-item" to="/subs" icon="link" />
      <nut-tabbar-item
        v-show="!shouldHideFilesTab"
        class="tabbar-item"
        to="/files"
        icon="category"
      />

      <nut-tabbar-item
        v-show="!shouldHideSyncTab"
        class="tabbar-item"
        to="/sync"
        icon="refresh2"
      />
      <nut-tabbar-item
        v-show="shouldShowShareTab"
        class="tabbar-item"
        to="/shares"
      >
        <template #icon>
          <font-awesome-icon
            class="tabbar-share-icon"
            icon="fa-solid fa-share-nodes"
          />
        </template>
      </nut-tabbar-item>

      <nut-tabbar-item class="tabbar-item" to="/my" icon="setting" :dot="env.hasNewVersion"/>
    </nut-tabbar>
  </div>
</template>

<script lang="ts" setup>
  import { useWideScreenNarrowMode } from '@/hooks/useWideScreenNarrowMode';
  import { useGlobalStore } from '@/store/global';
  import { useSettingsStore } from '@/store/settings';
  import { storeToRefs } from 'pinia';
  import { computed, ref } from 'vue';
  import { onBeforeRouteUpdate, useRoute } from 'vue-router';
  import { NAVIGATION_IDS } from '@/extensions/registry';

  const route = useRoute();
  const TAB_NAVIGATION = [
    { id: 'org.substore.core.subscriptions', path: '/subs' },
    { id: 'org.substore.core.files', path: '/files' },
    { id: NAVIGATION_IDS.CONFIG_HOSTING, path: '/sync' },
    { id: 'org.substore.core.shares', path: '/shares' },
    { id: 'org.substore.core.settings', path: '/my' },
  ] as const;
  const navigationIdForPath = (path: string) => {
    if (path === '/sync' || path.startsWith('/edit/sync/')) return NAVIGATION_IDS.CONFIG_HOSTING;
    return TAB_NAVIGATION.find(item => path === item.path || path.startsWith(`${item.path}/`))?.id
      || 'org.substore.core.settings';
  };
  const activeNavigationId = ref(navigationIdForPath(route.path));
  const activeTab = computed({
    get: () => Math.max(0, TAB_NAVIGATION.findIndex(item => item.id === activeNavigationId.value)),
    set: (index: number) => {
      activeNavigationId.value = TAB_NAVIGATION[index]?.id || activeNavigationId.value;
    },
  });
  const { isWideScreenNarrowModeActive } = useWideScreenNarrowMode();



  const globalStore = useGlobalStore();
  const settingsStore = useSettingsStore();
  const { appearanceSetting, hasFetchedSettings, hasCachedAppearanceNavigationSetting } = storeToRefs(settingsStore);
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

  const {
    bottomSafeArea,
    // istabBar,
    // istabBar2,
    env
  } = storeToRefs(globalStore);
  const style = {
    height: `${bottomSafeArea.value + 12 + 44}px`,
    paddingBottom: bottomSafeArea.value + 'px',
  };
  onBeforeRouteUpdate((to, from, next) => {
    activeNavigationId.value = navigationIdForPath(to.path);
    // const scrollTop = document.documentElement.scrollTop || document.body.scrollTop
    // globalStore.setSavedPositions(from.path, { left: 0, top: scrollTop })
    next();
  });
</script>

<style lang="scss" scoped>
  .tab-bar-wrapper {
    z-index: 101;
    bottom: 0;
    @include centered-fixed-container;

    @media screen and (min-width: 768px) {
      display: none !important;
    }

    &.is-wide-screen-visible {
      @media screen and (min-width: 768px) {
        display: block !important;
      }
    }

    .tabbar {
      padding-top: 8px;
      padding-bottom: v-bind('style.paddingBottom');
      box-shadow: none;
      backdrop-filter: blur(var(--tab-bar-blur));
      -webkit-backdrop-filter: blur(var(--tab-bar-blur));
      background: var(--tab-bar-color);
      @media screen and (min-width: 768px) {
        border-radius: var(--item-card-radios);
        overflow: hidden;
      }
    }

    :deep(.tabbar-item) {
      cursor: pointer;

      &.nut-tabbar-item__icon--unactive {
        color: var(--lowest-text-color);
      }

      & > .nut-tabbar-item_icon-box > .nut-tabbar-item_icon-box_nav-word {
        margin-top: 8px;
        font-weight: 600;
      }

      .tabbar-share-icon {
        width: 22px;
        height: 22px;
        font-size: 22px;
      }
    }
  }
</style>
