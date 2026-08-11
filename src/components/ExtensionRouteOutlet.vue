<template>
  <div class="extension-route-outlet">
    <section v-if="!bootstrapped" class="extension-route-state state-loading">
      <div class="route-state-icon">
        <font-awesome-icon icon="fa-solid fa-puzzle-piece" spin />
      </div>
      <h1>{{ labels.loadingTitle }}</h1>
      <p>{{ labels.loadingDescription }}</p>
    </section>
    <component
      v-else-if="surfaceComponent"
      :is="surfaceComponent"
      :key="surfaceKey"
    />
    <section v-else class="extension-route-state" :class="`state-${effectiveStatus}`">
      <div class="route-state-icon">
        <font-awesome-icon :icon="stateIcon" />
      </div>
      <h1>{{ stateTitle }}</h1>
      <p>{{ stateDescription }}</p>
      <div class="route-state-actions">
        <nut-button v-if="canOpenStore" type="primary" size="small" @click="openStore">
          {{ primaryActionLabel }}
        </nut-button>
        <nut-button plain size="small" :loading="refreshing" @click="refresh">
          {{ labels.retry }}
        </nut-button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue';
import { computed, markRaw, onMounted, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useExtensionsStore } from '@/store/extensions';
import {
  disposeFrontendExtension,
  ensureFrontendExtensionDefinition,
  findFrontendExtensionDefinition,
  loadFrontendExtensionSurface,
  registerFrontendExtensionRoutes,
  resolveExtensionIdForPath,
} from '@/extensions/frontend-catalog';

const route = useRoute();
const router = useRouter();
const extensionStore = useExtensionsStore();
const bootstrapped = ref(false);
const surfaceComponent = shallowRef<Component | null>(null);
const surfaceLoadError = ref('');
let surfaceLoadGeneration = 0;

const manifestCandidates = computed(() => [
  ...extensionStore.runtimeEntries.map(entry => entry.manifest),
  ...extensionStore.catalog,
]);
const extensionId = computed(() => String(
  route.meta.extensionId
  || resolveExtensionIdForPath(route.path, manifestCandidates.value)
  || '',
));
const extensionSurfaceId = computed(() => String(route.meta.extensionSurfaceId || ''));
const frontendDefinition = computed(() => findFrontendExtensionDefinition(extensionId.value));
const availability = computed(() => extensionStore.availability(extensionId.value));
const extensionName = computed(() => (
  availability.value.manifest?.name
  || frontendDefinition.value?.manifest?.name
  || extensionId.value
  || '扩展'
));
const refreshing = computed(() => extensionStore.refreshing);
const surfaceReady = computed(() => ['enabled', 'bundled'].includes(availability.value.status));
const effectiveStatus = computed(() => surfaceReady.value && surfaceLoadError.value
  ? 'frontend-load-failed'
  : availability.value.status);
const surfaceKey = computed(() => `${extensionId.value}:${extensionSurfaceId.value}:${route.fullPath}`);

const loadSurface = async () => {
  const generation = ++surfaceLoadGeneration;
  surfaceComponent.value = null;
  surfaceLoadError.value = '';
  if (!bootstrapped.value) return;
  if (!surfaceReady.value) {
    if (extensionId.value) {
      try {
        await disposeFrontendExtension(extensionId.value);
      } catch (error: any) {
        if (generation !== surfaceLoadGeneration) return;
        surfaceLoadError.value = error?.message || 'FRONTEND_EXTENSION_DISPOSE_FAILED';
        console.error('[extensions] frontend disposal failed', error);
      }
    }
    return;
  }
  if (!extensionId.value) {
    surfaceLoadError.value = 'FRONTEND_EXTENSION_ROUTE_INVALID';
    return;
  }
  try {
    const definition = await ensureFrontendExtensionDefinition(
      availability.value,
      extensionStore.runtime?.runtime,
    );
    const routesAdded = registerFrontendExtensionRoutes(
      router,
      definition,
      () => import('@/components/ExtensionRouteOutlet.vue'),
    );
    if (generation !== surfaceLoadGeneration) return;
    if (route.meta.dynamicExtensionRoute && routesAdded) {
      await router.replace(route.fullPath);
      return;
    }
    if (!extensionSurfaceId.value) {
      surfaceLoadError.value = 'FRONTEND_EXTENSION_ROUTE_INVALID';
      return;
    }
    const component = await loadFrontendExtensionSurface(
      extensionId.value,
      extensionSurfaceId.value,
    );
    if (generation !== surfaceLoadGeneration) return;
    surfaceComponent.value = markRaw(component);
  } catch (error: any) {
    if (generation !== surfaceLoadGeneration) return;
    surfaceLoadError.value = error?.message || 'FRONTEND_EXTENSION_SURFACE_LOAD_FAILED';
  }
};

watch(
  [
    bootstrapped,
    extensionId,
    extensionSurfaceId,
    () => availability.value.status,
    () => extensionStore.runtime?.revision,
  ],
  loadSurface,
  { immediate: true },
);

const isZh = computed(() => {
  const locale = document.documentElement.lang || navigator.language || 'zh-CN';
  return locale.toLowerCase().startsWith('zh');
});
const labels = computed(() => isZh.value ? {
  retry: '重新读取',
  loadingTitle: `正在读取${extensionName.value}状态`,
  loadingDescription: `确认插件运行状态后加载${extensionName.value}页面。`,
  store: '打开扩展商店',
  reinstall: `重新安装${extensionName.value}`,
  disabledTitle: `${extensionName.value}已停用`,
  disabledDescription: '插件数据仍会保留。启用后可以继续访问当前功能。',
  installedTitle: `${extensionName.value}尚未启用`,
  installedDescription: '安装已完成，请在扩展商店启用后继续使用。',
  missingTitle: `${extensionName.value}尚未安装`,
  missingDescription: `从扩展商店安装${extensionName.value}后，当前页面会自动恢复。`,
  reinstallTitle: `${extensionName.value}已卸载，数据已保留`,
  reinstallBackupTitle: '数据已恢复，需重新安装插件',
  reinstallDescription: '插件数据和引用仍保留，重新安装后即可继续使用。',
  incompatibleTitle: `当前后端不兼容${extensionName.value}`,
  incompatibleDescription: '请升级后端，或在扩展商店查看可用的运行实现。',
  activationFailedTitle: `${extensionName.value}启动失败`,
  activationFailedDescription: '已保留安装记录和数据。请在扩展商店重试，或查看后端日志。',
  unknownTitle: `暂时无法读取${extensionName.value}状态`,
  unknownDescription: '未启用兼容兜底，以免绕过已经停用或卸载的插件。请检查后端连接后重试。',
  pendingTitle: `${extensionName.value}正在处理中`,
  pendingDescription: '安装或更新完成后，此页面会自动恢复。',
  frontendFailedTitle: `${extensionName.value}页面加载失败`,
  frontendFailedDescription: '后端状态已保留，可以重试页面加载或从扩展商店处理。',
  open: `打开${extensionName.value}`,
} : {
  retry: 'Retry',
  loadingTitle: `Reading ${extensionName.value} status`,
  loadingDescription: 'The page will load after the extension handshake completes.',
  store: 'Open extension store',
  reinstall: `Reinstall ${extensionName.value}`,
  disabledTitle: `${extensionName.value} is disabled`,
  disabledDescription: 'Extension data is retained. Enable it to continue.',
  installedTitle: `${extensionName.value} is not enabled`,
  installedDescription: 'Installation is complete. Enable the extension to continue.',
  missingTitle: `${extensionName.value} is not installed`,
  missingDescription: `Install ${extensionName.value} from the extension store to restore this page.`,
  reinstallTitle: `${extensionName.value} was uninstalled; data is retained`,
  reinstallBackupTitle: 'Data restored; reinstall required',
  reinstallDescription: 'Extension data and references remain available after reinstall.',
  incompatibleTitle: `This backend is incompatible with ${extensionName.value}`,
  incompatibleDescription: 'Upgrade the backend or review available runtime variants in the store.',
  activationFailedTitle: `${extensionName.value} failed to start`,
  activationFailedDescription: 'Installation records and data were retained. Retry in the extension store or inspect backend logs.',
  unknownTitle: `${extensionName.value} status is unavailable`,
  unknownDescription: 'Compatibility fallback remains closed so a disabled or removed plugin cannot be bypassed. Check the backend and retry.',
  pendingTitle: `${extensionName.value} is being updated`,
  pendingDescription: 'This page will recover after the lifecycle task finishes.',
  frontendFailedTitle: `${extensionName.value} surface failed to load`,
  frontendFailedDescription: 'The backend state is retained. Retry or use the extension store.',
  open: `Open ${extensionName.value}`,
});

const stateIcon = computed(() => {
  if (effectiveStatus.value === 'disabled') return 'fa-solid fa-pause';
  if (effectiveStatus.value === 'unknown') return 'fa-solid fa-puzzle-piece';
  if (['incompatible', 'activation-failed'].includes(effectiveStatus.value)) return 'fa-solid fa-triangle-exclamation';
  if (effectiveStatus.value === 'frontend-load-failed') return 'fa-solid fa-arrow-rotate-right';
  if (['installing', 'updating', 'rolling-back', 'restoring'].includes(effectiveStatus.value)) return 'fa-solid fa-hourglass-half';
  return frontendDefinition.value?.manifest?.icon
    || availability.value.manifest?.icon
    || 'fa-solid fa-puzzle-piece';
});

const stateTitle = computed(() => {
  switch (effectiveStatus.value) {
    case 'disabled': return labels.value.disabledTitle;
    case 'installed': return labels.value.installedTitle;
    case 'bundled': return labels.value.open;
    case 'missing': return labels.value.missingTitle;
    case 'reinstall-required': return availability.value.retainedReason === 'backup-restored' ? labels.value.reinstallBackupTitle : labels.value.reinstallTitle;
    case 'unknown': return labels.value.unknownTitle;
    case 'incompatible': return labels.value.incompatibleTitle;
    case 'activation-failed': return labels.value.activationFailedTitle;
    case 'frontend-load-failed': return labels.value.frontendFailedTitle;
    case 'installing':
    case 'updating':
    case 'rolling-back':
    case 'restoring': return labels.value.pendingTitle;
    default: return labels.value.missingTitle;
  }
});

const stateDescription = computed(() => {
  switch (effectiveStatus.value) {
    case 'disabled': return labels.value.disabledDescription;
    case 'installed': return labels.value.installedDescription;
    case 'bundled': return labels.value.open;
    case 'missing': return labels.value.missingDescription;
    case 'reinstall-required': return labels.value.reinstallDescription;
    case 'unknown': return labels.value.unknownDescription;
    case 'incompatible': return labels.value.incompatibleDescription;
    case 'activation-failed': return labels.value.activationFailedDescription;
    case 'frontend-load-failed': return labels.value.frontendFailedDescription;
    case 'installing':
    case 'updating':
    case 'rolling-back':
    case 'restoring': return labels.value.pendingDescription;
    default: return labels.value.missingDescription;
  }
});

const canOpenStore = computed(() => !['unknown', 'installing', 'updating', 'rolling-back', 'restoring'].includes(effectiveStatus.value));
const primaryActionLabel = computed(() => effectiveStatus.value === 'reinstall-required' ? labels.value.reinstall : labels.value.store);

const openStore = () => router.push({ path: '/extensions', query: { id: extensionId.value } });
const refresh = async () => {
  await extensionStore.refresh({ force: true, silent: true });
  await loadSurface();
};

onMounted(async () => {
  try {
    await extensionStore.refresh({ silent: true });
  } finally {
    bootstrapped.value = true;
  }
  extensionStore.startRevisionSync();
});
</script>

<style lang="scss" scoped>
.extension-route-outlet {
  width: 100%;
  min-height: 100%;
}

.extension-route-state {
  display: flex;
  min-height: min(520px, calc(100vh - 140px));
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 32px var(--safe-area-side);
  text-align: center;
}

.route-state-icon {
  display: inline-flex;
  width: 58px;
  height: 58px;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 12%, var(--card-color));
  font-size: 24px;
}

.state-disabled .route-state-icon { color: var(--comment-text-color); background: var(--card-color); }
.state-unknown .route-state-icon { color: var(--comment-text-color); background: var(--card-color); }
.state-incompatible .route-state-icon { color: var(--danger-color); background: color-mix(in srgb, var(--danger-color) 10%, transparent); }
.state-loading .route-state-icon { color: var(--primary-color); }

.extension-route-state h1 {
  margin: 18px 0 0;
  color: var(--primary-text-color);
  font-size: 18px;
}

.extension-route-state p {
  max-width: 430px;
  margin: 8px 0 0;
  color: var(--comment-text-color);
  font-size: 13px;
  line-height: 1.6;
}

.route-state-actions {
  display: flex;
  margin-top: 20px;
  gap: 8px;
}
</style>
