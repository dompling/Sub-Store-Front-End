<template>
  <div class="extension-store-page">
    <section class="store-header">
      <div class="store-header-copy">
        <div class="store-header-icon" aria-hidden="true">
          <font-awesome-icon icon="fa-solid fa-puzzle-piece" />
        </div>
        <div>
          <h1>{{ labels.title }}</h1>
          <p>{{ labels.subtitle }}</p>
        </div>
      </div>
      <button
        type="button"
        class="store-refresh-button"
        :class="{ loading: extensionStore.loading }"
        :aria-label="labels.refresh"
        :title="labels.refresh"
        @click="refresh"
      >
        <font-awesome-icon icon="fa-solid fa-arrow-rotate-right" />
      </button>
    </section>

    <section class="store-toolbar" aria-label="extension filters">
      <div class="store-tabs" role="tablist">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          type="button"
          class="store-tab"
          :class="{ active: activeTab === tab.value }"
          role="tab"
          :aria-selected="activeTab === tab.value"
          @click="activeTab = tab.value"
        >
          {{ tab.label }}
          <span v-if="tab.count !== undefined" class="store-tab-count">{{ tab.count }}</span>
        </button>
      </div>
      <label class="store-search">
        <font-awesome-icon icon="fa-solid fa-magnifying-glass" aria-hidden="true" />
        <input v-model.trim="query" type="search" :placeholder="labels.search" :aria-label="labels.search" />
        <button v-if="query" type="button" :aria-label="labels.clear" @click="query = ''">
          <font-awesome-icon icon="fa-solid fa-circle-xmark" />
        </button>
      </label>
    </section>

    <div
      v-if="extensionStore.discoveryStatus === 'legacy' || (extensionStore.error && ['unknown', 'failed'].includes(extensionStore.discoveryStatus))"
      class="compatibility-note"
      :class="{ warning: extensionStore.discoveryStatus !== 'legacy' }"
      role="status"
    >
      <font-awesome-icon icon="fa-solid fa-circle-info" />
      <span>{{ extensionStore.discoveryStatus === 'legacy' ? labels.compatibility : labels.discoveryFailed }}</span>
      <button type="button" @click="refresh">{{ labels.retry }}</button>
    </div>

    <section v-if="activeTasks.length" class="extension-task-strip" aria-live="polite">
      <div class="task-strip-heading">
        <font-awesome-icon icon="fa-solid fa-clock-rotate-left" />
        <span>{{ labels.tasks }}</span>
      </div>
      <div v-for="task in activeTasks" :key="task.id" class="task-row">
        <span class="task-row-name">{{ task.extensionId || task.id }}</span>
        <span class="task-row-stage">{{ task.stage || task.status || labels.pending }}</span>
        <span v-if="typeof task.progress === 'number'" class="task-row-progress">{{ Math.round(task.progress) }}%</span>
      </div>
    </section>

    <div v-if="extensionStore.loading && !cards.length" class="store-state">
      <span class="store-loading-spinner" aria-hidden="true" />
      <span>{{ labels.loading }}</span>
    </div>

    <div v-else-if="!cards.length" class="store-state store-state-empty">
      <nut-empty image="empty">
        <template #description>
          <h3>{{ labels.empty }}</h3>
          <p>{{ labels.emptyDescription }}</p>
        </template>
      </nut-empty>
    </div>

    <section v-else class="extension-grid">
      <article
        v-for="card in cards"
        :key="card.id"
        class="extension-card"
        :class="`status-${card.availability.status}`"
        @click="openDetails(card.id)"
      >
        <div class="extension-card-main">
          <div class="extension-icon" :class="{ image: isImageIcon(card.manifest?.icon) }">
            <img v-if="isImageIcon(card.manifest?.icon)" :src="card.manifest?.icon as string" alt="" />
            <font-awesome-icon v-else :icon="card.manifest?.icon || 'fa-solid fa-puzzle-piece'" />
          </div>
          <div class="extension-card-copy">
            <div class="extension-title-row">
              <h2 :title="card.manifest?.name || card.name">{{ card.manifest?.name || card.name }}</h2>
              <span class="status-pill" :class="statusTone(card.availability.status)">
                {{ statusLabel(card.availability.status, card.availability.source) }}
              </span>
            </div>
            <p class="extension-version">v{{ card.version }} · {{ publisherName(card.manifest) }}</p>
            <p class="extension-description">{{ card.manifest?.description || card.description || labels.noDescription }}</p>
          </div>
        </div>

        <div v-if="capabilityLabels(card.manifest).length" class="extension-capabilities">
          <span v-for="capability in capabilityLabels(card.manifest)" :key="capability" class="capability-chip">
            {{ capability }}
          </span>
        </div>

        <div class="extension-card-footer" @click.stop>
          <span class="extension-runtime-note">
            <font-awesome-icon :icon="runtimeIcon(card.manifest)" />
            {{ runtimeLabel(card) }}
          </span>
          <div class="extension-card-actions">
            <button type="button" class="details-button" @click="openDetails(card.id)">
              {{ labels.details }}
            </button>
            <button
              type="button"
              class="primary-action"
              :class="{ danger: card.availability.status === 'enabled' && canDisable(card.id) }"
              :disabled="isActionLoading(card.id) || isActionDisabled(card)"
              @click="performPrimaryAction(card)"
            >
              <span v-if="isActionLoading(card.id)" class="button-spinner" />
              <template v-else>{{ primaryActionLabel(card) }}</template>
            </button>
          </div>
        </div>
      </article>
    </section>

    <nut-popup
      v-model:visible="detailVisible"
      position="center"
      pop-class="extension-detail-popup"
      :style="{ width: isMobileViewport ? 'calc(100% - 24px)' : 'min(620px, calc(100% - 48px))' }"
      :close-on-click-overlay="true"
      :lock-scroll="false"
      z-index="12000"
    >
      <div v-if="selectedCard" class="extension-detail">
        <div class="detail-header">
          <div class="detail-icon" :class="{ image: isImageIcon(selectedCard.manifest?.icon) }">
            <img v-if="isImageIcon(selectedCard.manifest?.icon)" :src="selectedCard.manifest?.icon as string" alt="" />
            <font-awesome-icon v-else :icon="selectedCard.manifest?.icon || 'fa-solid fa-puzzle-piece'" />
          </div>
          <div class="detail-heading">
            <div class="detail-title-row">
              <h2>{{ selectedCard.manifest?.name || selectedCard.name }}</h2>
              <span class="status-pill" :class="statusTone(selectedCard.availability.status)">
                {{ statusLabel(selectedCard.availability.status, selectedCard.availability.source) }}
              </span>
            </div>
            <p>v{{ selectedCard.version }} · {{ publisherName(selectedCard.manifest) }}</p>
          </div>
          <button type="button" class="detail-close" :aria-label="labels.close" @click="detailVisible = false">
            <font-awesome-icon icon="fa-solid fa-xmark" />
          </button>
        </div>

        <p class="detail-description">{{ selectedCard.manifest?.description || selectedCard.description || labels.noDescription }}</p>

        <div v-if="selectedCard.manifest?.capabilities?.length" class="detail-section">
          <h3>{{ labels.capabilities }}</h3>
          <div class="detail-chips">
            <span v-for="capability in capabilityLabels(selectedCard.manifest)" :key="capability" class="capability-chip">
              {{ capability }}
            </span>
          </div>
        </div>

        <div v-if="permissionLabels(selectedCard.manifest).length" class="detail-section">
          <h3>{{ labels.permissions }}</h3>
          <div class="detail-chips">
            <span v-for="permission in permissionLabels(selectedCard.manifest)" :key="permission" class="capability-chip">
              {{ permission }}
            </span>
          </div>
        </div>

        <div class="detail-section detail-status-section">
          <h3>{{ labels.runtimeStatus }}</h3>
          <dl class="detail-facts">
            <div><dt>{{ labels.status }}</dt><dd>{{ statusLabel(selectedCard.availability.status, selectedCard.availability.source) }}</dd></div>
            <div><dt>{{ labels.runtime }}</dt><dd>{{ runtimeLabel(selectedCard) }}</dd></div>
            <div v-if="selectedCard.availability.receipt?.selectedVariant"><dt>{{ labels.variant }}</dt><dd>{{ selectedCard.availability.receipt.selectedVariant }}</dd></div>
            <div v-if="selectedCard.availability.receipt?.codeStatus"><dt>{{ labels.codeStatus }}</dt><dd>{{ selectedCard.availability.receipt.codeStatus }}</dd></div>
            <div v-if="selectedCard.availability.backendRevision !== undefined"><dt>{{ labels.revision }}</dt><dd>{{ selectedCard.availability.backendRevision }}</dd></div>
            <div v-if="extensionStore.runtime?.dataGeneration !== undefined"><dt>{{ labels.generation }}</dt><dd>{{ extensionStore.runtime.dataGeneration }}</dd></div>
            <div v-if="selectedCard.availability.receipt?.manifestDigest"><dt>{{ labels.manifestDigest }}</dt><dd :title="selectedCard.availability.receipt.manifestDigest">{{ shortDigest(selectedCard.availability.receipt.manifestDigest) }}</dd></div>
            <div v-if="selectedCard.availability.receipt?.packageDigest"><dt>{{ labels.packageDigest }}</dt><dd :title="selectedCard.availability.receipt.packageDigest">{{ shortDigest(selectedCard.availability.receipt.packageDigest) }}</dd></div>
            <div v-if="selectedCard.availability.retainedReason"><dt>{{ labels.data }}</dt><dd>{{ retainedReasonLabel(selectedCard.availability.retainedReason) }}</dd></div>
          </dl>
        </div>

        <div v-if="requiresAdminToken(selectedCard)" class="detail-token-section">
          <h3>{{ labels.adminToken }}</h3>
          <p>{{ labels.adminTokenDescription }}</p>
          <div class="token-row">
            <input v-model="adminTokenInput" type="password" autocomplete="off" :placeholder="labels.adminTokenPlaceholder" />
            <button
              v-if="extensionStore.adminToken"
              type="button"
              class="details-button"
              @click="clearAdminToken"
            >
              {{ labels.clearToken }}
            </button>
            <button type="button" class="details-button" @click="saveAdminToken">{{ labels.save }}</button>
          </div>
        </div>

        <div v-if="extensionStore.lastActionError" class="detail-error" role="alert">
          <font-awesome-icon icon="fa-solid fa-triangle-exclamation" />
          <span>{{ extensionStore.lastActionError }}</span>
        </div>

        <div class="detail-actions">
          <button
            v-if="canUninstall(selectedCard)"
            type="button"
            class="details-button detail-uninstall-button"
            :disabled="isActionLoading(selectedCard.id)"
            @click="confirmUninstall(selectedCard)"
          >
            {{ labels.uninstall }}
          </button>
          <button type="button" class="details-button" @click="detailVisible = false">{{ labels.close }}</button>
          <button
            v-if="canOpenExtension(selectedCard) && canDisable(selectedCard.id)"
            type="button"
            class="details-button"
            @click="openExtension(selectedCard)"
          >
            {{ labels.open }}
          </button>
          <button
            type="button"
            class="primary-action"
            :class="{ danger: canDisable(selectedCard.id) }"
            :disabled="isActionLoading(selectedCard.id) || isActionDisabled(selectedCard)"
            @click="performPrimaryAction(selectedCard)"
          >
            <span v-if="isActionLoading(selectedCard.id)" class="button-spinner" />
            <template v-else>{{ primaryActionLabel(selectedCard) }}</template>
          </button>
        </div>
      </div>
    </nut-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useExtensionsStore } from '@/store/extensions';
import type {
  ExtensionAvailability,
  ExtensionCatalogEntry,
  ExtensionManifest,
  ExtensionStatus,
} from '@/extensions/contracts';
import { EXTENSION_IDS } from '@/extensions/registry';
import { useAppNotifyStore } from '@/store/appNotify';
import { Dialog } from '@nutui/nutui';

type StoreTab = 'discover' | 'installed';
type ExtensionCard = ExtensionCatalogEntry & {
  id: string;
  availability: ExtensionAvailability;
  manifest?: ExtensionManifest;
};

const router = useRouter();
const route = useRoute();
const { locale } = useI18n();
const extensionStore = useExtensionsStore();
const { catalog } = storeToRefs(extensionStore);
const { showNotify } = useAppNotifyStore();

const activeTab = ref<StoreTab>('discover');
const query = ref('');
const detailVisible = ref(false);
const selectedId = ref('');
const actionLoadingId = ref('');
const adminTokenInput = ref('');
const isMobileViewport = ref(typeof window !== 'undefined' && window.innerWidth < 600);

const isZh = computed(() => String(locale.value || '').toLowerCase().startsWith('zh'));
const labels = computed(() => isZh.value ? {
  title: '扩展', subtitle: '按需安装和管理 Sub-Store 功能', refresh: '刷新扩展列表', search: '搜索扩展', clear: '清除搜索', discover: '发现', installed: '已安装', loading: '正在读取扩展状态…', empty: '没有匹配的扩展', emptyDescription: '可以清除搜索条件，或稍后重试。', compatibility: '当前后端尚未提供扩展清单，已保留兼容模式。', discoveryFailed: '暂时无法读取扩展运行状态。已保持最后一次可信状态，未将插件自动恢复为兼容模式。', retry: '重新读取', details: '详情', noDescription: '暂无描述', capabilities: '能力', permissions: '权限', runtimeStatus: '运行状态', status: '状态', runtime: '运行实现', variant: '运行变体', codeStatus: '代码状态', revision: '后端版本', generation: '数据代次', manifestDigest: '清单摘要', packageDigest: '包摘要', data: '数据', close: '关闭', save: '保存', adminToken: '管理凭据', adminTokenDescription: '安装、启用和停用需要管理员控制面令牌。令牌只保存在当前页面内存中。', adminTokenPlaceholder: '输入管理令牌', install: '安装', enable: '启用', disable: '停用', open: '打开', reinstall: '重新安装', uninstall: '卸载', uninstallTitle: '卸载扩展？', uninstallDescription: '扩展代码和安装记录会被移除，配置数据默认保留，可在之后重新安装恢复。', unavailable: '需要后端支持', legacy: '兼容模式', bundled: '内置', embedded: '内置运行实现', nodePackage: 'Node 已验证安装包', managed: '已安装', pending: '处理中', incompatible: '不兼容', missing: '未安装', retainedUser: '数据已保留', retainedBackup: '数据已恢复，需重新安装', installSuccess: '扩展安装任务已提交', actionSuccess: '扩展状态已更新', actionFailed: '扩展操作失败', controlReadOnly: '当前后端为只读模式', clearToken: '清除凭据', tasks: '安装任务',
} : {
  title: 'Extensions', subtitle: 'Install and manage Sub-Store features', refresh: 'Refresh extensions', search: 'Search extensions', clear: 'Clear search', discover: 'Discover', installed: 'Installed', loading: 'Loading extension status…', empty: 'No matching extensions', emptyDescription: 'Clear the search or try again later.', compatibility: 'This backend does not expose the extension manifest yet; compatibility mode is active.', discoveryFailed: 'Extension runtime status is temporarily unavailable. The last trusted state is retained and compatibility mode was not reopened.', retry: 'Retry', details: 'Details', noDescription: 'No description', capabilities: 'Capabilities', permissions: 'Permissions', runtimeStatus: 'Runtime status', status: 'Status', runtime: 'Implementation', variant: 'Variant', codeStatus: 'Code status', revision: 'Backend revision', generation: 'Data generation', manifestDigest: 'Manifest digest', packageDigest: 'Package digest', data: 'Data', close: 'Close', save: 'Save', adminToken: 'Admin credential', adminTokenDescription: 'Lifecycle actions require an administrator token. It remains in this page memory only.', adminTokenPlaceholder: 'Enter admin token', install: 'Install', enable: 'Enable', disable: 'Disable', open: 'Open', reinstall: 'Reinstall', uninstall: 'Uninstall', uninstallTitle: 'Uninstall extension?', uninstallDescription: 'Extension code and its receipt will be removed. Data remains available for a later reinstall by default.', unavailable: 'Backend support required', legacy: 'Compatibility mode', bundled: 'Bundled', embedded: 'Embedded implementation', nodePackage: 'Verified Node package', managed: 'Installed', pending: 'Working', incompatible: 'Incompatible', missing: 'Not installed', retainedUser: 'Data retained', retainedBackup: 'Data restored; reinstall required', installSuccess: 'Extension install task submitted', actionSuccess: 'Extension state updated', actionFailed: 'Extension action failed', controlReadOnly: 'This backend is read-only', clearToken: 'Clear credential', tasks: 'Install tasks',
});

const tabs = computed(() => {
  const all = catalog.value.map(entry => extensionCard(entry));
  return [
    { value: 'discover' as StoreTab, label: labels.value.discover, count: all.length },
    { value: 'installed' as StoreTab, label: labels.value.installed, count: all.filter(card => isInstalledStatus(card.availability.status)).length },
  ];
});

const extensionCard = (entry: ExtensionCatalogEntry): ExtensionCard => ({
  ...entry,
  id: entry.id,
  availability: extensionStore.availability(entry.id),
  manifest: extensionStore.manifest(entry.id),
});

const allCards = computed(() => catalog.value.map(extensionCard));
const cards = computed(() => {
  const normalizedQuery = query.value.toLowerCase();
  return allCards.value.filter(card => {
    const matchesTab = activeTab.value === 'discover'
      || (activeTab.value === 'installed' && isInstalledStatus(card.availability.status));
    if (!matchesTab) return false;
    if (!normalizedQuery) return true;
    const haystack = [card.id, card.name, card.description, card.manifest?.name, card.manifest?.description]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });
});

const selectedCard = computed(() => allCards.value.find(card => card.id === selectedId.value));
const activeTasks = computed(() => extensionStore.tasks.filter(task => !['succeeded', 'failed', 'cancelled'].includes(String(task.status))).slice(-4));

const isInstalledStatus = (status: ExtensionStatus) => [
  'bundled', 'installed', 'enabled', 'disabled', 'updating', 'installing', 'rolling-back', 'restoring', 'frontend-load-failed', 'activation-failed', 'reinstall-required',
].includes(status);

const isImageIcon = (icon?: unknown): icon is string => typeof icon === 'string' && /^(https?:|data:|\/)/.test(icon);

const publisherName = (manifest?: ExtensionManifest) => manifest?.publisher?.name || 'Sub-Store';

const capabilityLabels = (manifest?: ExtensionManifest) => {
  const map: Record<string, string> = {
    artifacts: isZh.value ? '托管配置' : 'Hosted artifacts',
    sync: isZh.value ? '同步' : 'Sync',
    archive: isZh.value ? '归档' : 'Archive',
    publisher: isZh.value ? '发布链接' : 'Publishers',
    scheduler: isZh.value ? '定时任务' : 'Scheduler',
    'config-project': isZh.value ? '配置项目' : 'Config projects',
    preview: isZh.value ? '预览' : 'Preview',
    'artifact-source': isZh.value ? '来源扩展' : 'Artifact source',
  };
  return (manifest?.capabilities || []).map(capability => map[capability] || capability).slice(0, 5);
};

const permissionLabels = (manifest?: ExtensionManifest) => {
  const map: Record<string, string> = {
    'storage.own': isZh.value ? '插件数据存储' : 'Plugin data storage',
    'resources.list': isZh.value ? '读取资源列表' : 'List resources',
    'resources.read': isZh.value ? '读取资源内容' : 'Read resources',
    'resources.produce': isZh.value ? '生产配置内容' : 'Produce content',
    'references.manage-own': isZh.value ? '管理自身引用' : 'Manage own references',
    'publishers.use': isZh.value ? '使用发布器' : 'Use publishers',
    'credentials.use-handle': isZh.value ? '使用凭据句柄' : 'Use credential handles',
    'scheduler.jobs': isZh.value ? '注册定时任务' : 'Schedule jobs',
    'crypto.age.encrypt': isZh.value ? '使用 Age 加密' : 'Use Age encryption',
    'archive.contribute': isZh.value ? '参与归档' : 'Contribute archives',
    'backup.contribute': isZh.value ? '参与备份' : 'Contribute backups',
    'settings.contribute': isZh.value ? '贡献设置' : 'Contribute settings',
    'routes.namespaced': isZh.value ? '命名空间路由' : 'Namespaced routes',
    'routes.legacy-alias': isZh.value ? '兼容旧路由' : 'Legacy aliases',
    'navigation.register': isZh.value ? '注册导航' : 'Register navigation',
    'commands.register': isZh.value ? '注册命令' : 'Register commands',
  };
  return (manifest?.permissions || []).map(permission => {
    const name = typeof permission === 'string' ? permission : (permission as any)?.name;
    return map[name] || name;
  }).filter(Boolean).slice(0, 12);
};

const runtimeIcon = (manifest?: ExtensionManifest) => {
  if (manifest?.id === EXTENSION_IDS.CONFIG_GENERATOR) return 'fa-solid fa-code-branch';
  return 'fa-solid fa-server';
};

const runtimeLabel = (card: ExtensionCard) => {
  if (card.availability.source === 'legacy-fallback') return labels.value.legacy;
  if (card.availability.source === 'bundled') return labels.value.bundled;
  if (card.availability.receipt?.codeStatus === 'embedded-inactive' || card.manifest?.distribution === 'embedded') return labels.value.embedded;
  if (card.availability.receipt?.selectedVariant === 'node' || String(card.availability.receipt?.codeStatus || '').startsWith('verified-package')) return labels.value.nodePackage;
  if (card.availability.status === 'installing' || card.availability.status === 'updating') return labels.value.pending;
  return card.manifest?.host?.runtimes?.join(' / ') || (isZh.value ? '当前后端' : 'Current backend');
};

const statusTone = (status: ExtensionStatus) => {
  if (status === 'enabled') return 'success';
  if (['installing', 'updating', 'rolling-back', 'restoring'].includes(status)) return 'pending';
  if (['unknown', 'incompatible', 'missing', 'reinstall-required', 'frontend-load-failed', 'activation-failed'].includes(status)) return 'warning';
  return 'muted';
};

const statusLabel = (status: ExtensionStatus, source?: ExtensionAvailability['source']) => {
  if (source === 'legacy-fallback') return labels.value.legacy;
  const map: Partial<Record<ExtensionStatus, string>> = {
    bundled: labels.value.bundled,
    installed: labels.value.managed,
    enabled: labels.value.managed,
    disabled: `${labels.value.disable} · ${isZh.value ? '已停用' : 'disabled'}`,
    unknown: labels.value.unavailable,
    missing: labels.value.missing,
    incompatible: labels.value.incompatible,
    'reinstall-required': labels.value.reinstall,
    installing: labels.value.pending,
    updating: labels.value.pending,
    'rolling-back': labels.value.pending,
    restoring: labels.value.pending,
    'frontend-load-failed': labels.value.unavailable,
  };
  return map[status] || status;
};

const shortDigest = (digest?: string) => digest ? `${digest.slice(0, 10)}…${digest.slice(-8)}` : '';

const retainedReasonLabel = (reason?: 'user-uninstalled' | 'backup-restored') => reason === 'backup-restored'
  ? labels.value.retainedBackup
  : labels.value.retainedUser;

const canDisable = (id: string) => {
  const availability = extensionStore.availability(id);
  return availability.status === 'enabled' && extensionStore.canManage;
};

const canUninstall = (card: ExtensionCard) => extensionStore.canManage
  && card.availability.source === 'runtime'
  && card.manifest?.kind !== 'bundled'
  && (
    card.availability.receipt?.installationStatus === 'installed'
    || ['enabled', 'disabled', 'installed', 'frontend-load-failed', 'activation-failed'].includes(card.availability.status)
  );

const extensionOpenPath = (id: string) => {
  if (id === EXTENSION_IDS.CONFIG_GENERATOR) return '/extensions/config-generator';
  if (id === EXTENSION_IDS.CONFIG_HOSTING) return '/sync';
  return undefined;
};

const canOpenExtension = (card: ExtensionCard) => Boolean(extensionOpenPath(card.id))
  && ['enabled', 'bundled'].includes(card.availability.status);

const openExtension = async (card: ExtensionCard) => {
  const path = extensionOpenPath(card.id);
  if (!path) return;
  detailVisible.value = false;
  await router.push(path);
};

const primaryActionLabel = (card: ExtensionCard) => {
  switch (card.availability.status) {
    case 'bundled': return extensionOpenPath(card.id) ? labels.value.open : labels.value.managed;
    case 'enabled': return canDisable(card.id) ? labels.value.disable : extensionOpenPath(card.id) ? labels.value.open : labels.value.managed;
    case 'installed': return extensionStore.canManage ? labels.value.enable : labels.value.unavailable;
    case 'disabled': return extensionStore.canManage ? labels.value.enable : labels.value.unavailable;
    case 'reinstall-required':
    case 'missing': return extensionStore.canManage ? (card.availability.status === 'reinstall-required' ? labels.value.reinstall : labels.value.install) : labels.value.unavailable;
    case 'unknown':
    case 'incompatible': return labels.value.unavailable;
    default: return labels.value.pending;
  }
};

const isActionDisabled = (card: ExtensionCard) => {
  if ((card.availability.status === 'enabled' || card.availability.status === 'bundled') && extensionOpenPath(card.id)) return false;
  if (['installing', 'updating', 'rolling-back', 'restoring'].includes(card.availability.status)) return true;
  if (['unknown', 'incompatible'].includes(card.availability.status)) return true;
  return !extensionStore.canManage && !(
    card.availability.status === 'enabled' && card.availability.source === 'legacy-fallback'
  );
};

const isActionLoading = (id: string) => actionLoadingId.value === id;

const requiresAdminToken = (card: ExtensionCard) => card.availability.source !== 'bundled'
  && card.availability.source !== 'legacy-fallback'
  && extensionStore.managementMode === 'token';

const saveAdminToken = () => {
  extensionStore.setAdminToken(adminTokenInput.value);
  adminTokenInput.value = '';
};

const clearAdminToken = () => {
  extensionStore.clearAdminToken();
  adminTokenInput.value = '';
};

const openDetails = (id: string) => {
  selectedId.value = id;
  extensionStore.lastActionError = '';
  detailVisible.value = true;
};

const performPrimaryAction = async (card: ExtensionCard) => {
  if ((card.availability.status === 'enabled' || card.availability.status === 'bundled') && !canDisable(card.id) && extensionOpenPath(card.id)) {
    detailVisible.value = false;
    await router.push(extensionOpenPath(card.id) as string);
    return;
  }
  if (isActionDisabled(card)) return;
  actionLoadingId.value = card.id;
  let succeeded = false;
  if (card.availability.status === 'enabled') succeeded = await extensionStore.disable(card.id);
  else if (card.availability.status === 'bundled') succeeded = false;
  else if (card.availability.status === 'installed') succeeded = await extensionStore.enable(card.id);
  else if (card.availability.status === 'disabled') succeeded = await extensionStore.enable(card.id);
  else if (card.availability.status === 'reinstall-required' || card.availability.status === 'missing') succeeded = await extensionStore.install(card.id);
  actionLoadingId.value = '';
  if (succeeded) {
    showNotify({ title: labels.value.actionSuccess, type: 'primary' });
    detailVisible.value = false;
  } else {
    showNotify({ title: extensionStore.lastActionError || labels.value.actionFailed, type: 'danger' });
  }
};

const confirmUninstall = (card: ExtensionCard) => {
  Dialog({
    title: labels.value.uninstallTitle,
    content: labels.value.uninstallDescription,
    popClass: 'auto-dialog',
    textAlign: 'left',
    okText: labels.value.uninstall,
    cancelText: labels.value.close,
    closeOnPopstate: true,
    lockScroll: false,
    onOk: async () => {
      actionLoadingId.value = card.id;
      const succeeded = await extensionStore.uninstall(card.id);
      actionLoadingId.value = '';
      if (succeeded) {
        showNotify({ title: labels.value.actionSuccess, type: 'primary' });
        detailVisible.value = false;
      } else {
        showNotify({ title: extensionStore.lastActionError || labels.value.actionFailed, type: 'danger' });
      }
    },
  });
};

const refresh = async () => {
  await extensionStore.refresh({ force: true });
};

const handleResize = () => { isMobileViewport.value = window.innerWidth < 600; };

onMounted(() => {
  extensionStore.refresh({ silent: true });
  extensionStore.startRevisionSync();
  window.addEventListener('resize', handleResize);
  if (typeof route.query.id === 'string') openDetails(route.query.id);
});

onBeforeUnmount(() => window.removeEventListener('resize', handleResize));
</script>

<style lang="scss" scoped>
.extension-store-page {
  width: 100%;
  min-height: 100%;
  padding: 16px var(--safe-area-side) calc(24px + var(--safe-area-bottom, 0px));
  box-sizing: border-box;
}

.store-header,
.store-toolbar,
.extension-card,
.compatibility-note {
  border-radius: var(--item-card-radios);
  background: var(--card-color);
  color: var(--second-text-color);
}

.store-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  max-width: 920px;
  margin: 0 auto 12px;
  padding: 16px;
}

.store-header-copy {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.store-header-icon,
.extension-icon,
.detail-icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 12%, var(--card-color));
}

.store-header-icon {
  width: 42px;
  height: 42px;
  border-radius: 13px;
  font-size: 19px;
}

.store-header h1 {
  margin: 0;
  color: var(--primary-text-color);
  font-size: 18px;
  line-height: 1.3;
}

.store-header p {
  margin: 4px 0 0;
  color: var(--comment-text-color);
  font-size: 12px;
}

.store-refresh-button,
.detail-close,
.store-search button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border: 0;
  background: transparent;
  color: var(--comment-text-color);
  cursor: pointer;
}

.store-refresh-button {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--divider-color);
}

.store-refresh-button:hover,
.store-refresh-button:focus-visible,
.detail-close:hover,
.detail-close:focus-visible {
  color: var(--primary-color);
}

.store-refresh-button.loading svg {
  animation: extension-spin 0.8s linear infinite;
}

.store-toolbar {
  display: flex;
  max-width: 920px;
  margin: 0 auto 12px;
  padding: 6px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.store-tabs {
  display: flex;
  min-width: 0;
  gap: 4px;
}

.store-tab {
  border: 0;
  border-radius: 9px;
  padding: 8px 11px;
  color: var(--comment-text-color);
  background: transparent;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.store-tab.active {
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 10%, var(--card-color));
  font-weight: 600;
}

.store-tab-count {
  margin-left: 4px;
  color: var(--lowest-text-color);
  font-size: 11px;
}

.store-search {
  display: flex;
  min-width: 120px;
  max-width: 220px;
  flex: 1 1 auto;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--divider-color);
  border-radius: 9px;
  padding: 0 8px;
  color: var(--comment-text-color);
}

.store-search input {
  min-width: 0;
  width: 100%;
  border: 0;
  outline: 0;
  padding: 8px 0;
  color: var(--primary-text-color);
  background: transparent;
  font-size: 12px;
}

.store-search input::placeholder {
  color: var(--lowest-text-color);
}

.store-search button {
  padding: 0;
}

.compatibility-note {
  display: flex;
  max-width: 920px;
  align-items: center;
  gap: 8px;
  margin: 0 auto 12px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--primary-color) 25%, var(--divider-color));
  color: var(--comment-text-color);
  font-size: 12px;
}

.compatibility-note svg {
  flex: 0 0 auto;
  color: var(--primary-color);
}

.compatibility-note.warning {
  border-color: color-mix(in srgb, var(--danger-color) 25%, var(--divider-color));
}

.compatibility-note.warning svg {
  color: var(--danger-color);
}

.compatibility-note span {
  min-width: 0;
  flex: 1;
}

.compatibility-note button {
  border: 0;
  padding: 0;
  color: var(--primary-color);
  background: transparent;
  cursor: pointer;
  white-space: nowrap;
}

.extension-task-strip {
  max-width: 920px;
  margin: 0 auto 12px;
  padding: 10px 12px;
  border: 1px solid var(--divider-color);
  border-radius: var(--item-card-radios);
  color: var(--comment-text-color);
  background: var(--card-color);
  font-size: 11px;
}

.task-strip-heading {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 5px;
  color: var(--primary-text-color);
  font-weight: 600;
}

.task-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 5px;
}

.task-row-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-row-stage { color: var(--primary-color); }
.task-row-progress { color: var(--lowest-text-color); }

.extension-grid {
  display: grid;
  max-width: 920px;
  margin: 0 auto;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.extension-card {
  display: flex;
  min-width: 0;
  min-height: 208px;
  flex-direction: column;
  padding: 16px;
  cursor: pointer;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.extension-card:hover {
  box-shadow: 0 8px 24px color-mix(in srgb, var(--primary-text-color) 8%, transparent);
  transform: translateY(-1px);
}

.extension-card-main {
  display: flex;
  min-width: 0;
  gap: 12px;
}

.extension-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  font-size: 20px;
}

.extension-icon.image img,
.detail-icon.image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}

.extension-card-copy {
  min-width: 0;
  flex: 1;
}

.extension-title-row,
.detail-title-row {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.extension-title-row h2,
.detail-title-row h2 {
  min-width: 0;
  overflow: hidden;
  margin: 0;
  color: var(--primary-text-color);
  font-size: 16px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.extension-version,
.detail-heading p {
  margin: 3px 0 0;
  color: var(--lowest-text-color);
  font-size: 11px;
}

.extension-description {
  display: -webkit-box;
  overflow: hidden;
  margin: 8px 0 0;
  color: var(--comment-text-color);
  font-size: 12px;
  line-height: 1.55;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.status-pill {
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 3px 7px;
  font-size: 10px;
  line-height: 1.2;
  white-space: nowrap;
}

.status-pill.success { color: var(--succeed-color); background: color-mix(in srgb, var(--succeed-color) 12%, transparent); }
.status-pill.pending { color: var(--primary-color); background: color-mix(in srgb, var(--primary-color) 12%, transparent); }
.status-pill.warning { color: var(--warning-color, #d88900); background: color-mix(in srgb, var(--warning-color, #d88900) 12%, transparent); }
.status-pill.muted { color: var(--comment-text-color); background: color-mix(in srgb, var(--comment-text-color) 10%, transparent); }

.extension-capabilities,
.detail-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 14px;
}

.capability-chip {
  border-radius: 999px;
  padding: 3px 7px;
  color: var(--comment-text-color);
  background: var(--background-color);
  font-size: 10px;
  line-height: 1.2;
}

.extension-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
  padding-top: 16px;
}

.extension-runtime-note {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 5px;
  overflow: hidden;
  color: var(--lowest-text-color);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.extension-card-actions,
.detail-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
}

.details-button,
.primary-action {
  min-height: 30px;
  border-radius: 8px;
  padding: 0 10px;
  font-size: 11px;
  cursor: pointer;
}

.details-button {
  border: 1px solid var(--divider-color);
  color: var(--comment-text-color);
  background: transparent;
}

.detail-uninstall-button {
  margin-right: auto;
  border-color: color-mix(in srgb, var(--danger-color) 35%, var(--divider-color));
  color: var(--danger-color);
}

.primary-action {
  border: 1px solid var(--primary-color);
  color: var(--primary-color);
  background: transparent;
}

.primary-action:not(:disabled):hover {
  color: var(--card-color);
  background: var(--primary-color);
}

.primary-action.danger {
  border-color: var(--danger-color);
  color: var(--danger-color);
}

.primary-action.danger:not(:disabled):hover {
  color: var(--card-color);
  background: var(--danger-color);
}

.primary-action:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.button-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: extension-spin 0.8s linear infinite;
}

.store-state {
  display: flex;
  min-height: 220px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--comment-text-color);
  font-size: 13px;
}

.store-loading-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid var(--divider-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: extension-spin 0.8s linear infinite;
}

.store-state-empty {
  flex-direction: column;
}

.extension-detail {
  max-height: min(760px, calc(100vh - 48px));
  overflow: auto;
  padding: 20px;
  border-radius: var(--item-card-radios);
  color: var(--second-text-color);
  background: var(--popup-color);
}

.detail-header {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.detail-icon {
  width: 54px;
  height: 54px;
  border-radius: 16px;
  font-size: 23px;
}

.detail-heading {
  min-width: 0;
  flex: 1;
}

.detail-close {
  width: 30px;
  height: 30px;
  border-radius: 50%;
}

.detail-description {
  margin: 18px 0 0;
  color: var(--comment-text-color);
  font-size: 13px;
  line-height: 1.6;
}

.detail-section {
  margin-top: 20px;
}

.detail-section h3,
.detail-token-section h3 {
  margin: 0;
  color: var(--primary-text-color);
  font-size: 13px;
}

.detail-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin: 8px 0 0;
  overflow: hidden;
  border-radius: 9px;
  background: var(--divider-color);
}

.detail-facts > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
  padding: 9px;
  background: var(--card-color);
}

.detail-facts dt {
  color: var(--lowest-text-color);
  font-size: 10px;
}

.detail-facts dd {
  overflow: hidden;
  margin: 0;
  color: var(--second-text-color);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-token-section {
  margin-top: 20px;
}

.detail-token-section p {
  margin: 5px 0 8px;
  color: var(--comment-text-color);
  font-size: 11px;
  line-height: 1.5;
}

.token-row {
  display: flex;
  gap: 6px;
}

.token-row input {
  min-width: 0;
  flex: 1;
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  padding: 7px 9px;
  outline: 0;
  color: var(--primary-text-color);
  background: var(--card-color);
  font-size: 12px;
}

.detail-error {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin-top: 16px;
  padding: 9px;
  border-radius: 8px;
  color: var(--danger-color);
  background: color-mix(in srgb, var(--danger-color) 8%, transparent);
  font-size: 11px;
  line-height: 1.4;
}

.detail-actions {
  justify-content: flex-end;
  margin-top: 22px;
}

@keyframes extension-spin {
  to { transform: rotate(360deg); }
}

@media screen and (max-width: 767px) {
  .extension-store-page { padding-top: 10px; }
  .store-header { padding: 13px; }
  .store-toolbar { flex-wrap: wrap; }
  .store-search { max-width: none; order: 2; flex-basis: 100%; }
  .extension-grid { grid-template-columns: minmax(0, 1fr); gap: 10px; }
  .extension-card { min-height: 190px; padding: 13px; }
}

@media screen and (max-width: 420px) {
  .store-header h1 { font-size: 16px; }
  .store-header p { font-size: 11px; }
  .store-tab { padding-inline: 8px; }
  .extension-card-footer { align-items: flex-end; flex-direction: column; }
  .extension-runtime-note { align-self: flex-start; max-width: 100%; }
  .extension-card-actions { width: 100%; justify-content: flex-end; }
  .detail-facts { grid-template-columns: minmax(0, 1fr); }
}

@media (prefers-reduced-motion: reduce) {
  .extension-card { transition: none; }
  .store-refresh-button.loading svg,
  .button-spinner { animation: none; }
}
</style>
