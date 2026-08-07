<template>
  <div class="config-generator-list">
    <Teleport to="body">
      <div
        v-if="projects.length && (appearanceSetting.showFloatingRefreshButton || appearanceSetting.showFloatingAddButton)"
        class="drag-btn-wrapper"
      >
        <nut-drag
          :attract="true"
          :boundary="{ top: 64, left: 16, bottom: bottomSafeArea + 68, right: 16 }"
          :style="{ cursor: 'pointer', left: '15px', bottom: `${bottomSafeArea + 84}px` }"
        >
          <div v-if="appearanceSetting.showFloatingRefreshButton" class="drag-btn refresh" @click="refresh">
            <font-awesome-icon icon="fa-solid fa-arrow-rotate-right" />
          </div>
          <div v-if="appearanceSetting.showFloatingAddButton" class="drag-btn" @click="createProject">
            <font-awesome-icon icon="fa-solid fa-plus" />
          </div>
        </nut-drag>
      </div>
    </Teleport>

    <div v-if="projects.length" class="subs-list-wrapper" :class="{ 'dual-column-mode': isDualColumnMode }">
      <div class="subs-list-container">
        <div class="subs-list-content">
          <div class="title-wrappers">
            <p class="list-title">
              <span class="list-title-text">{{ $t('configGenerator.title') }} ({{ projects.length }})</span>
            </p>
          </div>

          <div class="list-draggable" :class="{ 'dual-column': isDualColumnMode }">
            <div v-for="project in projects" :key="project.name" class="draggable-item">
              <ConfigGeneratorListItem
                :project="project"
                :detail="projectDetail(project)"
                :is-dual-column="isDualColumnMode"
                @publish="openPublishDialog(project)"
                @edit="editProject(project.name)"
                @remove="removeProject(project)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="!loading" class="empty-state-wrapper">
      <nut-empty image="empty">
        <template #description>
          <h3>{{ $t('configGenerator.emptyTitle') }}</h3>
          <p>{{ $t('configGenerator.emptyDescription') }}</p>
        </template>
      </nut-empty>
      <div class="empty-actions">
        <nut-button type="primary" @click="createProject">{{ $t('configGenerator.create') }}</nut-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Dialog, Toast } from '@nutui/nutui';
import { storeToRefs } from 'pinia';
import { computed, createVNode, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useListViewMode } from '@/hooks/useListViewMode';
import { useConfigGeneratorStore } from '@/store/configGenerator';
import { useGlobalStore } from '@/store/global';
import { useMethodStore } from '@/store/methodStore';
import { useSettingsStore } from '@/store/settings';
import ConfigGeneratorListItem from './ConfigGeneratorListItem.vue';
import PreviewPanel from '@/components/PreviewPanel.vue';
import { useHostAPI } from '@/hooks/useHostAPI';
import {
  CONFIG_GENERATOR_TARGET_DEFINITIONS,
  CONFIG_GENERATOR_TARGET_REGISTRY,
  DEFAULT_CONFIG_GENERATOR_TARGET,
} from '@/views/extensions/configGeneratorTargets';

const { t } = useI18n();
const router = useRouter();
const configStore = useConfigGeneratorStore();
const globalStore = useGlobalStore();
const methodStore = useMethodStore();
const settingsStore = useSettingsStore();
const { projects, loading } = storeToRefs(configStore);
const { bottomSafeArea } = storeToRefs(globalStore);
const { appearanceSetting } = storeToRefs(settingsStore);
const { effectiveListViewMode } = useListViewMode();
const isDualColumnMode = computed(() => effectiveListViewMode.value === 'dual-column');
const { currentUrl } = useHostAPI();

const createProject = () => router.push('/extensions/config-generator/edit/UNTITLED');
const importProject = () => router.push('/extensions/config-generator/import');
const editProject = (name: string) => router.push(`/extensions/config-generator/edit/${encodeURIComponent(name)}`);
const refresh = () => configStore.fetchProjects();
const actualRuleCount = (project: ConfigProject) => (project.rules || []).filter(item => !['comment', 'blank'].includes(item.kind)).length;
const sourceModeLabel = (project: ConfigProject) => {
  if (project.embeddedSource && project.remoteProxySources?.length) return t('configGenerator.modeMixed');
  if (project.embeddedSource) return t('configGenerator.modeEmbedded');
  return t('configGenerator.modeRemote');
};
const projectDetail = (project: ConfigProject) => [
  t('configGenerator.groupsCount', { count: project.groups?.length || 0 }),
  t('configGenerator.rulesCount', { count: actualRuleCount(project) }),
  sourceModeLabel(project),
].join(' · ');

const openPublishDialog = (project: ConfigProject) => {
  Dialog({
    title: t('configGenerator.publishTitle'),
    content: createVNode(PreviewPanel, {
      name: project.name,
      displayName: project.displayName,
      type: 'config-project',
      url: `${currentUrl.value}/download/config-project/${encodeURIComponent(project.name)}`,
      general: t(CONFIG_GENERATOR_TARGET_REGISTRY[DEFAULT_CONFIG_GENERATOR_TARGET].outputLabelKey),
      notify: t('configGenerator.linkCopied'),
      desc: t('subPage.panel.tips.desc'),
      includeUnsupportedProxyLabel: t('subPage.panel.options.includeUnsupportedProxy'),
      prettyYamlLabel: t('subPage.panel.options.prettyYaml'),
      noFlowLabel: t('subPage.panel.options.noFlow'),
      displayPreviewInWebPageLabel: t('moreSettingPage.displayPreviewInWebPage'),
      platforms: CONFIG_GENERATOR_TARGET_DEFINITIONS.map(target => ({
        name: t(target.outputLabelKey),
        path: target.target === DEFAULT_CONFIG_GENERATOR_TARGET ? null : target.downloadSuffix,
        icon: target.icon,
      })),
      showSubscriptionOptions: false,
    }),
    popClass: 'auto-dialog',
    noOkBtn: true,
    noCancelBtn: true,
    closeOnClickOverlay: true,
    closeOnPopstate: true,
    lockScroll: false,
  });
};

const removeProject = (project: ConfigProject) => {
  Dialog({
    title: t('configGenerator.deleteTitle'),
    content: project.displayName || project.name,
    popClass: 'auto-dialog',
    okText: t('specificWord.confirm'),
    cancelText: t('specificWord.cancel'),
    onOk: async () => {
      if (await configStore.removeProject(project.name)) Toast.success(t('configGenerator.deleted'));
    },
  });
};

onMounted(() => {
  methodStore.registerMethod('addConfigGenerator', createProject);
  methodStore.registerMethod('importConfigGenerator', importProject);
  configStore.fetchProjects();
});
</script>

<style lang="scss" scoped>
.config-generator-list {
  padding-bottom: calc(v-bind(bottomSafeArea) + 72px);
}

.empty-actions {
  display: flex;
  gap: 8px;
}

.subs-list-wrapper {
  width: 100%;
}

.subs-list-container {
  width: 100%;
}

.subs-list-content {
  width: calc(100% - 1.5rem);
  max-width: 900px;
  margin: 0 auto;
}

.title-wrappers {
  margin-top: 0;
  padding-top: 0;
  color: var(--comment-text-color);
}

.list-title {
  display: flex;
  align-items: center;
  margin: 0;
  padding: 0;
  color: var(--comment-text-color);
  font-size: 13px;
}

.list-draggable {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding-top: 12px;
}

.draggable-item {
  min-width: 0;
  border-radius: var(--item-card-radios);
  overflow: hidden;
}

.list-draggable.dual-column {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
}
</style>
