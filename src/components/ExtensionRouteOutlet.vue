<template>
  <div class="extension-route-outlet">
    <section v-if="!bootstrapped" class="extension-route-state state-loading">
      <div class="route-state-icon">
        <font-awesome-icon icon="fa-solid fa-puzzle-piece" spin />
      </div>
      <h1>{{ labels.loadingTitle }}</h1>
      <p>{{ labels.loadingDescription }}</p>
    </section>
    <component v-else-if="surfaceComponent" :is="surfaceComponent" />
    <section v-else class="extension-route-state" :class="`state-${availability.status}`">
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
import { computed, defineAsyncComponent, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useExtensionsStore } from '@/store/extensions';
import { EXTENSION_IDS } from '@/extensions/registry';

const route = useRoute();
const router = useRouter();
const extensionStore = useExtensionsStore();
const bootstrapped = ref(false);

const SyncSurface = defineAsyncComponent(() => import('@/views/Sync.vue'));
const SyncEditorSurface = defineAsyncComponent(() => import('@/views/SyncEditor.vue'));

const isEditor = computed(() => route.path.startsWith('/edit/sync/'));
const availability = computed(() => extensionStore.availability(EXTENSION_IDS.CONFIG_HOSTING));
const refreshing = computed(() => extensionStore.refreshing);
const surfaceReady = computed(() => ['enabled', 'bundled'].includes(availability.value.status));
const surfaceComponent = computed(() => {
  if (!surfaceReady.value) return null;
  return isEditor.value ? SyncEditorSurface : SyncSurface;
});

const isZh = computed(() => {
  const locale = document.documentElement.lang || navigator.language || 'zh-CN';
  return locale.toLowerCase().startsWith('zh');
});
const labels = computed(() => isZh.value ? {
  retry: '重新读取',
  loadingTitle: '正在读取配置托管状态',
  loadingDescription: '确认插件运行状态后加载配置托管页面。',
  store: '打开扩展商店',
  reinstall: '重新安装配置托管',
  disabledTitle: '配置托管已停用',
  disabledDescription: '配置托管数据仍会保留。启用后可以继续访问托管配置。',
  missingTitle: '配置托管尚未安装',
  missingDescription: '从扩展商店安装配置托管后，当前页面会自动恢复。',
  reinstallTitle: '配置托管已卸载，数据已保留',
  reinstallBackupTitle: '数据已恢复，需重新安装插件',
  reinstallDescription: '托管配置、引用和归档数据仍保留，重新安装后即可继续使用。',
  incompatibleTitle: '当前后端不兼容配置托管',
  incompatibleDescription: '请升级后端，或在扩展商店查看可用的运行实现。',
  unknownTitle: '暂时无法读取配置托管状态',
  unknownDescription: '未启用兼容兜底，以免绕过已经停用或卸载的插件。请检查后端连接后重试。',
  pendingTitle: '配置托管正在处理中',
  pendingDescription: '安装或更新完成后，此页面会自动恢复。',
  frontendFailedTitle: '配置托管页面加载失败',
  frontendFailedDescription: '后端状态已保留，可以重试页面加载或从扩展商店处理。',
  open: '打开配置托管',
} : {
  retry: 'Retry',
  loadingTitle: 'Reading config hosting status',
  loadingDescription: 'The page will load after the extension handshake completes.',
  store: 'Open extension store',
  reinstall: 'Reinstall config hosting',
  disabledTitle: 'Config hosting is disabled',
  disabledDescription: 'Hosted data is retained. Enable the extension to continue.',
  missingTitle: 'Config hosting is not installed',
  missingDescription: 'Install config hosting from the extension store to restore this page.',
  reinstallTitle: 'Config hosting was uninstalled; data is retained',
  reinstallBackupTitle: 'Data restored; reinstall required',
  reinstallDescription: 'Hosted artifacts, references and archives remain available after reinstall.',
  incompatibleTitle: 'This backend is incompatible with config hosting',
  incompatibleDescription: 'Upgrade the backend or review available runtime variants in the store.',
  unknownTitle: 'Config hosting status is unavailable',
  unknownDescription: 'Compatibility fallback remains closed so a disabled or removed plugin cannot be bypassed. Check the backend and retry.',
  pendingTitle: 'Config hosting is being updated',
  pendingDescription: 'This page will recover after the lifecycle task finishes.',
  frontendFailedTitle: 'Config hosting surface failed to load',
  frontendFailedDescription: 'The backend state is retained. Retry or use the extension store.',
  open: 'Open config hosting',
});

const stateIcon = computed(() => {
  if (availability.value.status === 'disabled') return 'fa-solid fa-pause';
  if (availability.value.status === 'unknown') return 'fa-solid fa-cloud-arrow-up';
  if (availability.value.status === 'incompatible') return 'fa-solid fa-triangle-exclamation';
  if (availability.value.status === 'frontend-load-failed') return 'fa-solid fa-arrow-rotate-right';
  if (['installing', 'updating', 'rolling-back', 'restoring'].includes(availability.value.status)) return 'fa-solid fa-hourglass-half';
  return 'fa-solid fa-cloud-arrow-up';
});

const stateTitle = computed(() => {
  switch (availability.value.status) {
    case 'disabled': return labels.value.disabledTitle;
    case 'installed': return labels.value.pendingTitle;
    case 'bundled': return labels.value.open;
    case 'missing': return labels.value.missingTitle;
    case 'reinstall-required': return availability.value.retainedReason === 'backup-restored' ? labels.value.reinstallBackupTitle : labels.value.reinstallTitle;
    case 'unknown': return labels.value.unknownTitle;
    case 'incompatible': return labels.value.incompatibleTitle;
    case 'frontend-load-failed': return labels.value.frontendFailedTitle;
    case 'installing':
    case 'updating':
    case 'rolling-back':
    case 'restoring': return labels.value.pendingTitle;
    default: return labels.value.missingTitle;
  }
});

const stateDescription = computed(() => {
  switch (availability.value.status) {
    case 'disabled': return labels.value.disabledDescription;
    case 'installed': return labels.value.pendingDescription;
    case 'bundled': return labels.value.open;
    case 'missing': return labels.value.missingDescription;
    case 'reinstall-required': return labels.value.reinstallDescription;
    case 'unknown': return labels.value.unknownDescription;
    case 'incompatible': return labels.value.incompatibleDescription;
    case 'frontend-load-failed': return labels.value.frontendFailedDescription;
    case 'installing':
    case 'updating':
    case 'rolling-back':
    case 'restoring': return labels.value.pendingDescription;
    default: return labels.value.missingDescription;
  }
});

const canOpenStore = computed(() => ['missing', 'reinstall-required'].includes(availability.value.status));
const primaryActionLabel = computed(() => availability.value.status === 'reinstall-required' ? labels.value.reinstall : labels.value.store);

const openStore = () => router.push({ path: '/extensions', query: { id: EXTENSION_IDS.CONFIG_HOSTING } });
const refresh = () => extensionStore.refresh({ force: true, silent: true });

onMounted(async () => {
  await extensionStore.refresh({ silent: true });
  bootstrapped.value = true;
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
