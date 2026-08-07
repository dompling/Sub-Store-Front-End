<template>
  <div
    class="page-wrapper"
    :class="{
      'editor-tabs-enabled': editorTabsEnabled,
      'editor-tab-subscriptions': editorTabsEnabled && activeEditorTab === 'subscriptions',
      'editor-tab-groups': editorTabsEnabled && activeEditorTab === 'groups',
      'editor-tab-rules': editorTabsEnabled && activeEditorTab === 'ruleSets',
      'editor-tab-independent': editorTabsEnabled && activeEditorTab === 'independent',
    }"
  >
    <div
      v-if="editorTabsEnabled"
      class="editor-section-tabs"
      :style="{ top: navBarHeight }"
    >
      <div class="editor-section-tab-list" role="tablist">
        <button
          v-for="tab in editorTabs"
          :key="tab.key"
          type="button"
          class="editor-section-tab"
          :class="{ current: activeEditorTab === tab.key }"
          role="tab"
          :aria-selected="activeEditorTab === tab.key"
          @click="activeEditorTab = tab.key"
        >
          {{ tab.title }}
        </button>
      </div>
      <EditorGroupingTips />
    </div>

    <div v-show="!editorTabsEnabled || activeEditorTab === 'subscriptions'" class="form-block-wrapper">
      <nut-form class="form" :model-value="form">
        <div v-show="!editorTabsEnabled || activeEditorTab === 'subscriptions'" class="editor-tab-content">
          <nut-form-item required :label="$t('configGenerator.fields.name')">
            <input
              v-model.trim="form.name"
              class="nut-input-text"
              :disabled="editing"
              :placeholder="$t('configGenerator.placeholders.name')"
              type="text"
            >
          </nut-form-item>
          <nut-form-item :label="$t('configGenerator.fields.displayName')">
            <nut-input v-model.trim="form.displayName" :border="false" input-align="right" class="nut-input-text" :placeholder="$t('configGenerator.placeholders.displayName')" />
          </nut-form-item>
          <nut-form-item :label="$t('configGenerator.fields.remark')">
            <nut-textarea
              v-model="form.remark"
              class="nut-input-text"
              :border="false"
              input-align="right"
              rows="1"
              :autosize="{ maxHeight: 140 }"
              :placeholder="$t('configGenerator.placeholders.remark')"
            />
          </nut-form-item>
          <nut-form-item :label="$t('configGenerator.fields.embeddedSource')" class="ignore-failed-wrapper">
            <div class="switch-wrapper"><nut-switch v-model="embeddedEnabled" /></div>
          </nut-form-item>
          <nut-form-item v-if="embeddedEnabled" :label="$t('configGenerator.fields.source')">
            <nut-input
              :model-value="embeddedSourceInput"
              :border="false"
              input-align="right"
              class="nut-input-text picker-input"
              readonly
              right-icon="rect-right"
              :placeholder="$t('configGenerator.placeholders.source')"
              @click="openEmbeddedSourcePicker"
              @click-right-icon="openEmbeddedSourcePicker"
            />
          </nut-form-item>
        </div>
      </nut-form>
    </div>

    <div v-show="isConfigFormTabActive && (!editorTabsEnabled || activeEditorTab === 'subscriptions')" class="editor-tab-content config-editor-section config-subscriptions-section">
      <div class="form-block-wrapper">
        <div v-if="!editorTabsEnabled" class="sticky-title-wrapper actions-title-wrapper config-section-title">
          <p>{{ $t('configGenerator.subscriptions') }}</p>
          <font-awesome-icon class="toggle fa-toggle" :icon="subscriptionsCollapsed ? 'fa-solid fa-toggle-off' : 'fa-solid fa-toggle-on'" @click="subscriptionsCollapsed = !subscriptionsCollapsed" />
        </div>
        <div v-show="!subscriptionsCollapsed" class="config-section-content">
          <div class="source-theme-panel">
            <div v-if="!form.remoteProxySources.length" class="source-empty-card">
              <span class="source-empty-icon"><font-awesome-icon icon="fa-solid fa-link" /></span>
              <div>
                <strong>{{ $t('configGenerator.noSubscriptionSources') }}</strong>
                <p>{{ $t('configGenerator.noSubscriptionSourcesHelp') }}</p>
              </div>
            </div>
            <draggable
              v-model="form.remoteProxySources"
              class="source-card-list"
              tag="ul"
              :item-key="sourceItemKey"
              animation="200"
              :force-fallback="true"
              handle=".drag-handler"
            >
              <template #item="{ element: source, index }">
                <li class="source-summary-card" :class="{ 'is-disabled': source.enabled === false }" @click="openRemoteSourceEditor(index)">
                  <span class="source-summary-icon" :class="source.source.kind">
                    <font-awesome-icon :icon="source.source.kind === 'sub-store' ? 'fa-solid fa-layer-group' : 'fa-solid fa-link'" />
                  </span>
                  <span class="source-summary-content">
                    <span class="source-summary-heading">
                      <strong>{{ source.name || `${$t('configGenerator.remoteSource')} ${index + 1}` }}</strong>
                      <span class="source-kind-badge">{{ remoteSourceKindLabel(source) }}</span>
                      <span class="source-status-badge" :class="{ disabled: source.enabled === false }">
                        {{ source.enabled === false ? $t('configGenerator.sourceDisabled') : $t('configGenerator.sourceEnabled') }}
                      </span>
                    </span>
                    <span class="source-summary-value">{{ remoteSourceSummary(source) }}</span>
                    <span v-if="remoteSourceFallbackHint(source)" class="source-fallback-hint">
                      <font-awesome-icon icon="fa-solid fa-shuffle" />
                      {{ remoteSourceFallbackHint(source) }}
                    </span>
                  </span>
                  <span class="source-summary-actions">
                    <button type="button" class="source-action edit" :title="$t('configGenerator.edit')" @click.stop="openRemoteSourceEditor(index)">
                      <font-awesome-icon icon="fa-solid fa-pen" />
                    </button>
                    <button type="button" class="source-action delete" :title="$t('configGenerator.delete')" @click.stop="removeRemoteSource(index)">
                      <font-awesome-icon icon="fa-solid fa-trash-can" />
                    </button>
                    <span class="source-action drag-handler" :title="$t('configGenerator.drag')" @click.stop>
                      <font-awesome-icon icon="fa-solid fa-grip" />
                    </span>
                  </span>
                </li>
              </template>
            </draggable>
            <button type="button" class="add-source-button" @click="addRemoteSource">
              <span><font-awesome-icon icon="fa-solid fa-plus" /></span>
              <span>
                <strong>{{ $t('configGenerator.addSubscriptionSource') }}</strong>
                <small>{{ $t('configGenerator.addSubscriptionSourceHelp') }}</small>
              </span>
              <nut-icon name="rect-right" size="13px" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-show="isConfigFormTabActive && (!editorTabsEnabled || activeEditorTab === 'groups')" class="editor-tab-content config-editor-section config-groups-section">
      <div class="form-block-wrapper" :class="{ 'config-editor-tab-offset': editorTabsEnabled }">
        <div v-if="!editorTabsEnabled" class="sticky-title-wrapper actions-title-wrapper config-section-title">
          <p>{{ $t('configGenerator.tabs.groups') }}</p>
        </div>
        <div class="config-section-content">
          <ConfigGeneratorActionBlock
            :checked="groupActionsChecked"
            :list="groupActions"
            :initial-collapsed-ids="initialCollapsedGroupIds"
            :persist-collapse-preference="false"
            hide-default-add
            hide-title
            @addAction="addGroupAction"
            @deleteAction="deleteGroupAction"
            @toggleAction="toggleGroupAction"
          />
          <nut-cell class="list-group-itemsa">
            <div class="list-group-item-titlesa">
              <div class="add-action-title">{{ $t('configGenerator.addGroup') }}</div>
            </div>
            <div class="horizontal-button-container group-type-action-buttons">
              <button
                v-for="option in POLICY_GROUP_TYPE_DEFINITIONS"
                :key="option.value"
                type="button"
                class="custom-button"
                @click="addGroup(option.value)"
              >
                <font-awesome-icon icon="fa-solid fa-plus" />
                {{ $t(`configGenerator.groupTypes.${option.labelKey}`) }}
              </button>
            </div>
          </nut-cell>
        </div>
      </div>
    </div>

    <div v-show="isConfigFormTabActive && (!editorTabsEnabled || activeEditorTab === 'ruleSets')" class="editor-tab-content config-editor-section config-rules-section">
      <div class="form-block-wrapper" :class="{ 'config-editor-tab-offset': editorTabsEnabled }">
        <div v-if="!editorTabsEnabled" class="sticky-title-wrapper actions-title-wrapper config-section-title">
          <p>{{ $t('configGenerator.rule') }}</p>
        </div>
        <div class="config-section-content">
          <ConfigGeneratorActionBlock
            :checked="ruleActionsChecked"
            :list="ruleActions"
            :initial-collapsed-ids="initialCollapsedRuleIds"
            :persist-collapse-preference="false"
            :readonly-name-resolver="resolveRuleActionTitle"
            hide-default-add
            hide-title
            @addAction="addRuleAction"
            @deleteAction="deleteRuleAction"
            @toggleAction="toggleRuleAction"
          />
          <nut-cell class="list-group-itemsa">
            <div class="list-group-item-titlesa">
              <div class="add-action-title">{{ $t('configGenerator.addRule') }}</div>
            </div>
            <div class="horizontal-button-container rule-type-action-buttons">
              <button type="button" class="custom-button" @click="addRuleSet">RULE-SET</button>
              <button v-for="type in inlineRuleTypes" :key="type" type="button" class="custom-button" @click="addRule('inline', type)">{{ type }}</button>
              <button type="button" class="custom-button" @click="addRule('final')">FINAL</button>
            </div>
          </nut-cell>
        </div>
      </div>
    </div>

    <div v-show="isConfigFormTabActive && (!editorTabsEnabled || activeEditorTab === 'independent')" class="editor-tab-content config-editor-section config-independent-section">
      <div class="form-block-wrapper" :class="{ 'config-editor-tab-offset': editorTabsEnabled }">
        <div class="config-section-content">
          <nut-form class="form" :model-value="form">
            <nut-form-item :label="$t('configGenerator.fields.source')">
              <div class="radio-wrapper">
                <nut-radiogroup v-model="independentTarget" direction="horizontal">
                  <nut-radio
                    v-for="target in CONFIG_GENERATOR_TARGET_DEFINITIONS"
                    :key="target.target"
                    shape="button"
                    :label="target.target"
                  >
                    <span class="independent-target-content">
                      <img :src="target.icon" alt="" aria-hidden="true">
                      <span>{{ target.displayName }}</span>
                    </span>
                  </nut-radio>
                </nut-radiogroup>
              </div>
            </nut-form-item>
            <nut-form-item :label="undefined" prop="independentConfig" class="independent-editor-form-item">
              <ConfigGeneratorIndependentEditor
                :key="independentTarget"
                :target="independentTarget"
                :model-value="form.outputs[independentTarget].independentConfig || ''"
                @update:model-value="setIndependentConfig(independentTarget, $event)"
              />
            </nut-form-item>
          </nut-form>
        </div>
      </div>
    </div>
  </div>

  <div class="bottom-btn-wrapper">
    <nut-button class="compare-btn btn" plain shape="square" :loading="previewing" @click="preview">
      <font-awesome-icon v-if="!previewing" icon="fa-solid fa-eye" />
      {{ $t('configGenerator.preview') }}
    </nut-button>
    <nut-button class="submit-btn btn" type="primary" shape="square" :loading="submitting" @click="save">
      <font-awesome-icon v-if="!submitting" icon="fa-solid fa-floppy-disk" />
      {{ $t('specificWord.save') }}
    </nut-button>
  </div>

  <nut-popup
    v-model:visible="remoteSourceEditorVisible"
    pop-class="remote-source-editor-popup"
    position="bottom"
    :style="remoteSourcePopupStyle"
    :lock-scroll="true"
    :safe-area-inset-bottom="true"
    close-icon="close-little"
    closeable
    round
    z-index="10050"
    @closed="clearRemoteSourceDraft"
  >
    <div v-if="remoteSourceDraft" class="remote-source-editor">
      <div class="remote-source-editor-header">
        <span>{{ $t('configGenerator.subscriptions') }}</span>
        <h3>{{ remoteSourceEditingIndex == null ? $t('configGenerator.addSubscriptionSource') : $t('configGenerator.editSubscriptionSource') }}</h3>
        <p>{{ $t('configGenerator.subscriptionSourceEditorHelp') }}</p>
      </div>

      <div class="source-kind-grid">
        <button
          type="button"
          class="source-kind-option"
          :class="{ selected: remoteSourceDraft.source.kind === 'sub-store' }"
          @click="setRemoteSourceDraftKind('sub-store')"
        >
          <span class="source-kind-option-icon"><font-awesome-icon icon="fa-solid fa-layer-group" /></span>
          <span><strong>Sub-Store</strong><small>{{ $t('configGenerator.subStoreSourceHelp') }}</small></span>
          <nut-icon :name="remoteSourceDraft.source.kind === 'sub-store' ? 'check-normal' : 'rect-right'" size="13px" />
        </button>
        <button
          type="button"
          class="source-kind-option"
          :class="{ selected: remoteSourceDraft.source.kind === 'url' }"
          @click="setRemoteSourceDraftKind('url')"
        >
          <span class="source-kind-option-icon"><font-awesome-icon icon="fa-solid fa-link" /></span>
          <span><strong>HTTP(S) URL</strong><small>{{ $t('configGenerator.urlSourceHelp') }}</small></span>
          <nut-icon :name="remoteSourceDraft.source.kind === 'url' ? 'check-normal' : 'rect-right'" size="13px" />
        </button>
      </div>

      <nut-form class="form remote-source-form" :model-value="remoteSourceDraft">
        <nut-form-item required :label="$t('configGenerator.fields.name')">
          <nut-input
            v-model.trim="remoteSourceDraft.name"
            :border="false"
            input-align="right"
            class="nut-input-text"
            :placeholder="$t('configGenerator.placeholders.remoteSourceName')"
          />
        </nut-form-item>

        <nut-form-item class="switch-form-item source-status-form-item">
          <template #label>
            <span class="source-status-label">
              <span>{{ remoteSourceDraft.enabled === false ? $t('configGenerator.sourceDisabled') : $t('configGenerator.sourceEnabled') }}</span>
              <button
                type="button"
                class="source-status-help-button"
                :aria-label="$t('configGenerator.sourceStatusHelp')"
                :title="$t('configGenerator.sourceStatusHelp')"
                @click.stop="openRemoteSourceStatusTips"
              >
                <font-awesome-icon icon="fa-solid fa-circle-question" />
              </button>
            </span>
          </template>
          <div class="source-status-switch">
            <nut-switch
              :model-value="remoteSourceDraft.enabled !== false"
              @update:model-value="setRemoteSourceDraftEnabled"
            />
          </div>
        </nut-form-item>

        <template v-if="remoteSourceDraft.source.kind === 'sub-store'">
          <nut-form-item required :label="$t('configGenerator.fields.source')">
            <nut-input
              :model-value="remoteSourceLabel(remoteSourceDraft)"
              :border="false"
              input-align="right"
              class="nut-input-text picker-input"
              readonly
              right-icon="rect-right"
              :placeholder="$t('configGenerator.placeholders.source')"
              @click="openRemoteDraftSourcePicker"
              @click-right-icon="openRemoteDraftSourcePicker"
            />
          </nut-form-item>
          <nut-form-item :label="$t('configGenerator.fields.publicBaseUrl')">
            <nut-input
              v-model.trim="remoteSourceDraft.source.publicBaseUrl"
              :border="false"
              input-align="right"
              class="nut-input-text"
              :placeholder="$t('configGenerator.placeholders.publicBaseUrl')"
            />
          </nut-form-item>
        </template>

        <template v-else>
          <nut-form-item required label="URL">
            <nut-input
              v-model.trim="remoteSourceDraft.source.url"
              :border="false"
              input-align="right"
              class="nut-input-text"
              :placeholder="$t('configGenerator.placeholders.url')"
            />
          </nut-form-item>
        </template>
      </nut-form>

      <div class="remote-source-editor-footer">
        <button type="button" class="source-editor-cancel" @click="remoteSourceEditorVisible = false">
          {{ $t('specificWord.cancel') }}
        </button>
        <nut-button type="primary" class="source-editor-confirm" @click="saveRemoteSourceDraft">
          {{ $t('specificWord.confirm') }}
        </nut-button>
      </div>
    </div>
  </nut-popup>

  <nut-picker v-model:visible="sourcePickerVisible" v-model="sourceModel" :columns="sourceOptions" @confirm="confirmSource" />
</template>

<script setup lang="ts">
import { computed, onMounted, provide, reactive, ref, shallowRef, toRaw, watch } from 'vue';
import { storeToRefs } from 'pinia';
import draggable from 'vuedraggable';
import { Dialog, Toast } from '@nutui/nutui';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import EditorGroupingTips from '@/components/EditorGroupingTips.vue';
import ConfigGeneratorActionBlock from '@/views/extensions/editor/ConfigGeneratorActionBlock.vue';
import PolicyGroupActionForm from '@/views/extensions/editor/PolicyGroupActionForm.vue';
import InlineRuleActionForm from '@/views/extensions/editor/InlineRuleActionForm.vue';
import RuleSetActionForm from '@/views/extensions/editor/RuleSetActionForm.vue';
import ConfigGeneratorIndependentEditor from '@/views/extensions/editor/ConfigGeneratorIndependentEditor.vue';
import { POLICY_GROUP_TYPE_DEFINITIONS } from '@/views/extensions/editor/policyGroupCapabilities';
import {
  CONFIG_GENERATOR_TARGET_DEFINITIONS,
  CONFIG_GENERATOR_TARGET_REGISTRY,
  CONFIG_GENERATOR_TARGETS,
  DEFAULT_CONFIG_GENERATOR_TARGET,
} from '@/views/extensions/configGeneratorTargets';
import { useConfigGeneratorStore } from '@/store/configGenerator';
import { useGlobalStore } from '@/store/global';
import { useSettingsStore } from '@/store/settings';
import { useSubsStore } from '@/store/subs';
import { useSystemStore } from '@/store/system';
import { useHostAPI } from '@/hooks/useHostAPI';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const configStore = useConfigGeneratorStore();
const subsStore = useSubsStore();
const globalStore = useGlobalStore();
const settingsStore = useSettingsStore();
const systemStore = useSystemStore();
const { currentUrl } = useHostAPI();
const { appearanceSetting } = storeToRefs(settingsStore);
const { bottomSafeArea } = storeToRefs(globalStore);
const { navBarHeight } = storeToRefs(systemStore);
const { ruleSets } = storeToRefs(configStore);
const padding = computed(() => `${bottomSafeArea.value}px`);

const createTargetOutputs = () => Object.fromEntries(
  CONFIG_GENERATOR_TARGET_DEFINITIONS.map(target => [
    target.target,
    { independentConfig: target.independentConfig.defaultValue },
  ]),
) as ConfigProject['outputs'];

const createEmptyProject = (): ConfigProject => {
  const outputs = createTargetOutputs();
  outputs.surge = { ...outputs.surge, includeUnsupportedProxy: false };
  return {
    name: '',
    displayName: '',
    remark: '',
    remoteProxySources: [],
    groups: [],
    rules: [],
    outputs,
  };
};

const form = reactive<ConfigProject>(createEmptyProject());
const editing = computed(() => Boolean(route.params.name && route.params.name !== 'UNTITLED'));
const submitting = ref(false);
const previewing = ref(false);
const independentTarget = ref<ConfigGeneratorTarget>(DEFAULT_CONFIG_GENERATOR_TARGET);
const sourcePickerVisible = ref(false);
const sourceModel = ref<string[]>([]);
const sourcePickerPurpose = ref<'embedded' | 'remote-draft'>('embedded');
const remoteSourceEditorVisible = ref(false);
const remoteSourceEditingIndex = ref<number | null>(null);
const remoteSourceDraft = ref<RemoteProxySource | null>(null);
const remoteSourcePopupStyle = {
  height: 'min(86%, 760px)',
  padding: '18px 14px 0',
  backgroundColor: 'var(--background-color)',
};
const persistedRuleSetNames = ref(new Set<string>());
const pendingRuleSetDeletionNames = ref(new Set<string>());
const editorTabs = computed(() => [
  { key: 'subscriptions', title: t('configGenerator.tabs.subscriptions') },
  { key: 'groups', title: t('configGenerator.tabs.groups') },
  { key: 'ruleSets', title: t('configGenerator.tabs.rules') },
  { key: 'independent', title: t('configGenerator.tabs.independent') },
]);
const activeEditorTab = ref('subscriptions');
const editorGroupingMode = computed<EditorGroupingMode>(() => appearanceSetting.value.editorGroupingMode || 'edit-only');
const editorTabsEnabled = computed(() => {
  if (editorGroupingMode.value === 'disabled') return false;
  if (editorGroupingMode.value === 'always') return true;
  return editing.value;
});
const isConfigFormTabActive = computed(() => !editorTabsEnabled.value || editorTabs.value.some(tab => tab.key === activeEditorTab.value));

const subscriptionsCollapsed = ref(false);
const collapsedPanels = ref(new Set<string>());
const isPanelCollapsed = (key: string) => collapsedPanels.value.has(key);
const togglePanel = (key: string) => {
  const next = new Set(collapsedPanels.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  collapsedPanels.value = next;
};
const expandPanel = (key: string) => {
  const next = new Set(collapsedPanels.value);
  next.delete(key);
  collapsedPanels.value = next;
};
const itemKeys = new WeakMap<object, string>();
let nextItemKey = 0;
const getItemKey = (prefix: string, item: object) => {
  let key = itemKeys.get(item);
  if (!key) {
    key = `${prefix}-${nextItemKey++}`;
    itemKeys.set(item, key);
  }
  return key;
};
const groupItemKey = (group: PolicyGroup) => getItemKey('group', group);
const sourceItemKey = (source: RemoteProxySource) => getItemKey('remote-source', source);
const ruleItemKey = (rule: RuleBinding) => getItemKey('rule', rule);
const initialCollapsedGroupIds = ref<string[] | null>(null);
const initialCollapsedRuleIds = ref<string[] | null>(null);
const isRuleActionVisible = (rule: RuleBinding) => rule.kind !== 'comment'
  && rule.kind !== 'blank'
  && !(rule.kind === 'inline' && rule.type === 'PROCESS-NAME');
const captureInitialCollapsedActionIds = (collapseExisting: boolean) => {
  initialCollapsedGroupIds.value = collapseExisting
    ? form.groups.map(groupItemKey)
    : [];
  initialCollapsedRuleIds.value = collapseExisting
    ? form.rules.filter(isRuleActionVisible).map(ruleItemKey)
    : [];
};
const remoteProxySourceOptions = computed(() => form.remoteProxySources.filter(source => source.enabled !== false && source.name.trim()));
const inlineRuleTypes = [
  'DOMAIN',
  'DOMAIN-SUFFIX',
  'DOMAIN-KEYWORD',
  'IP-CIDR',
  'IP-CIDR6',
  'GEOIP',
  'IP-ASN',
  'USER-AGENT',
  'URL-REGEX',
] as const;

const embeddedEnabled = computed({
  get: () => Boolean(form.embeddedSource),
  set: (value: boolean) => {
    if (value && !form.embeddedSource) form.embeddedSource = { type: 'collection', name: '' };
    if (!value) delete form.embeddedSource;
  },
});

const sourceOptions = computed(() => [
  {
    value: 'subscription',
    text: t('specificWord.singleSub'),
    children: subsStore.subs.map(item => ({ value: item.name, text: item.displayName || item['display-name'] || item.name })),
  },
  {
    value: 'collection',
    text: t('specificWord.collectionSub'),
    children: subsStore.collections.map(item => ({ value: item.name, text: item.displayName || item['display-name'] || item.name })),
  },
].filter(item => item.children.length));

const embeddedSourceInput = computed(() => form.embeddedSource
  ? `${form.embeddedSource.type} - ${form.embeddedSource.name}`
  : '');

const migrateLegacyProjectBindings = () => {
  const legacySourceTargets = new Map<string, Set<ConfigGeneratorTarget>>();
  const conflictingLegacySources = new Set<string>();
  const recordLegacyTarget = (sourceName: string | undefined, target: ConfigGeneratorTarget) => {
    if (!sourceName) return;
    const targets = legacySourceTargets.get(sourceName) || new Set<ConfigGeneratorTarget>();
    targets.add(target);
    legacySourceTargets.set(sourceName, targets);
  };

  form.groups.forEach((group) => {
    const legacySources = CONFIG_GENERATOR_TARGETS
      .map((target) => {
        const sourceName = group.targetOptions?.[target]?.remoteProxySource;
        recordLegacyTarget(sourceName, target);
        return sourceName;
      })
      .filter((sourceName): sourceName is string => Boolean(sourceName));
    if (new Set(legacySources).size > 1) {
      legacySources.forEach(sourceName => conflictingLegacySources.add(sourceName));
    }
  });

  form.remoteProxySources.forEach((source) => {
    if (
      source.source.kind !== 'url'
      || source.source.mode === 'auto'
      || source.source.target
    ) return;
    if (conflictingLegacySources.has(source.name)) return;
    const targets = legacySourceTargets.get(source.name);
    // No binding evidence means genuinely unclassified; preserve that state
    // so the backend can apply its explicit target fallback rules.
    if (targets?.size === 1) source.source.target = [...targets][0];
  });

  form.groups.forEach((group) => {
    const surgeOptions = group.targetOptions?.surge;
    const qxOptions = group.targetOptions?.qx;
    const legacySources = [...new Set(CONFIG_GENERATOR_TARGETS
      .map(target => group.targetOptions?.[target]?.remoteProxySource)
      .filter((sourceName): sourceName is string => Boolean(sourceName)))];

    if (!group.remoteProxySource
      && !qxOptions?.resourceTagRegex
      && legacySources.length === 1) {
      [group.remoteProxySource] = legacySources;
    }
    if (group.iconUrl === undefined && surgeOptions?.iconUrl !== undefined) {
      group.iconUrl = surgeOptions.iconUrl;
    }
  });
};

const resetForm = (project?: ConfigProject) => {
  Object.assign(form, createEmptyProject(), JSON.parse(JSON.stringify(project || {})));
  form.remoteProxySources ||= [];
  form.remoteProxySources.forEach((source) => {
    if (source.source.kind !== 'url') return;
    source.source.mode = 'auto';
    source.source.publicBaseUrl ||= currentUrl.value || window.location.origin;
    delete source.source.target;
  });
  form.groups ||= [];
  form.rules ||= [];
  migrateLegacyProjectBindings();
  form.outputs ||= createEmptyProject().outputs;
  CONFIG_GENERATOR_TARGETS.forEach((target) => {
    const output = form.outputs[target] || {};
    output.independentConfig ??= CONFIG_GENERATOR_TARGET_REGISTRY[target].independentConfig.defaultValue;
    form.outputs[target] = output;
  });
  sourceModel.value = form.embeddedSource ? [form.embeddedSource.type, form.embeddedSource.name] : [];
  activeEditorTab.value = 'subscriptions';
  pendingRuleSetDeletionNames.value = new Set();
};

const setIndependentConfig = (target: ConfigGeneratorTarget, content: string) => {
  form.outputs[target].independentConfig = content;
};

const addGroup = (type: PolicyGroup['type'] = 'select') => {
  const index = form.groups.push({ name: '', type, members: [] }) - 1;
  expandPanel(`group-${index}`);
};
const isGroupInUse = (name: string, index: number) => Boolean(name) && (
  form.groups.some((group, groupIndex) => groupIndex !== index && (
    (group.members || []).some(member => member.kind === 'group' && member.value === name)
    || (group.members || []).some(member => member.kind === 'conditional' && member.policy === name)
    || (group.includeOtherGroups || []).includes(name)
    || group.targetOptions?.surge?.subnetDefault === name
    || (group.targetOptions?.surge?.subnetRules || []).some(rule => rule.policy === name)
  ))
  || form.rules.some(rule => 'policy' in rule && rule.policy === name)
);
const removeGroup = (index: number) => {
  const group = form.groups[index];
  if (!group) return;
  if (isGroupInUse(group.name, index)) {
    Toast.warn(t('configGenerator.groupInUse'));
    return;
  }
  form.groups.splice(index, 1);
};
const isGroupEnabled = (group: PolicyGroup) => !group.disabled;
const setGroupEnabled = (group: PolicyGroup, enabled: boolean) => {
  if (enabled) delete group.disabled;
  else group.disabled = true;
};
const updateGroupType = (group: PolicyGroup, value: PolicyGroup['type']) => { group.type = value; };
const availableGroupMembers = (group: PolicyGroup) => form.groups
  .map(item => item.name)
  .filter(name => Boolean(name) && name !== group.name);
const availablePolicyMembers = (group: PolicyGroup) => ['DIRECT', 'REJECT', ...availableGroupMembers(group)];
const selectedPolicyMembers = (group: PolicyGroup) => (group.members || [])
  .filter(member => member.kind === 'builtin' || member.kind === 'group')
  .map(member => member.value);
const setSelectedPolicyMembers = (group: PolicyGroup, values: string[]) => {
  const allowed = new Set(availablePolicyMembers(group));
  const selected = [...new Set(values)].filter(value => allowed.has(value));
  const pending = new Set(selected);
  const members: PolicyGroup['members'] = [];
  (group.members || []).forEach((member) => {
    if (member.kind !== 'builtin' && member.kind !== 'group') {
      members.push(member);
      return;
    }
    if (!pending.has(member.value)) return;
    pending.delete(member.value);
    members.push(member);
  });
  selected.forEach((value) => {
    if (!pending.has(value)) return;
    members.push(value === 'DIRECT' || value === 'REJECT'
      ? { kind: 'builtin', value }
      : { kind: 'group', value });
  });
  group.members = members;
};
const proxyMembersText = (group: PolicyGroup) => (group.members || [])
  .filter(member => member.kind === 'proxy')
  .map(member => member.value)
  .join(', ');
const setProxyMembersText = (group: PolicyGroup, value: string) => {
  const selected = [...new Set(String(value || '')
    .split(/[,，\n]+/)
    .map(item => item.trim())
    .filter(Boolean))];
  const pending = new Set(selected);
  const members: PolicyGroup['members'] = [];
  (group.members || []).forEach((member) => {
    if (member.kind !== 'proxy') {
      members.push(member);
      return;
    }
    if (!pending.has(member.value)) return;
    pending.delete(member.value);
    members.push(member);
  });
  selected.forEach((value) => {
    if (!pending.has(value)) return;
    members.push({ kind: 'proxy', value });
  });
  group.members = members;
};
const setIncludeAllProxies = (group: PolicyGroup, value: boolean) => {
  group.includeAllProxies = Boolean(value);
};
const hasLegacyRemoteSourceConflict = (group: PolicyGroup) => {
  if (group.remoteProxySource) return false;
  const sources = CONFIG_GENERATOR_TARGETS
    .map(target => group.targetOptions?.[target]?.remoteProxySource)
    .filter(Boolean);
  return new Set(sources).size > 1;
};
const groupRemoteSource = (group: PolicyGroup) => {
  if (hasLegacyRemoteSourceConflict(group)) return '';
  return group.remoteProxySource || CONFIG_GENERATOR_TARGETS
    .map(target => group.targetOptions?.[target]?.remoteProxySource)
    .find(Boolean) || '';
};
const setGroupRemoteSource = (group: PolicyGroup, source: string) => {
  const available = new Set(remoteProxySourceOptions.value.map(item => item.name));
  const selected = available.has(source) ? source : '';
  CONFIG_GENERATOR_TARGETS.forEach((target) => {
    const options = group.targetOptions?.[target];
    if (options) delete options.remoteProxySource;
  });
  if (!selected) {
    delete group.remoteProxySource;
    return;
  }
  delete group.targetOptions?.qx?.resourceTagRegex;
  group.remoteProxySource = selected;
};
const setIncludeOtherGroups = (group: PolicyGroup, values: string[]) => {
  const names = [...new Set(values.filter(value => value && value !== group.name))];
  if (names.length) group.includeOtherGroups = names;
  else delete group.includeOtherGroups;
};
const groupNumber = (group: PolicyGroup, key: 'interval' | 'tolerance' | 'timeout') => {
  const value = group[key];
  return value === undefined ? '' : String(value);
};
const setGroupNumber = (group: PolicyGroup, key: 'interval' | 'tolerance' | 'timeout', value: string | number) => {
  const input = String(value ?? '').trim();
  if (!input) {
    delete group[key];
    return;
  }
  const number = Number(input);
  if (Number.isFinite(number)) group[key] = number;
};
const policyUpdateInterval = (group: PolicyGroup) => group.policyUpdateInterval === undefined ? '' : String(group.policyUpdateInterval);
const setPolicyUpdateInterval = (group: PolicyGroup, value: string | number) => {
  const input = String(value ?? '').trim();
  if (!input) {
    delete group.policyUpdateInterval;
    return;
  }
  const number = Number(input);
  if (Number.isFinite(number)) group.policyUpdateInterval = number;
};
const getSurgeBoolean = (group: PolicyGroup, key: 'hidden' | 'noAlert' | 'evaluateBeforeUse' | 'persistent') =>
  Boolean(group.targetOptions?.surge?.[key]);
const setSurgeBoolean = (group: PolicyGroup, key: 'hidden' | 'noAlert' | 'evaluateBeforeUse' | 'persistent', value: boolean) => {
  group.targetOptions ||= {};
  group.targetOptions.surge ||= {};
  group.targetOptions.surge[key] = Boolean(value);
};
const getQxBoolean = (group: PolicyGroup, key: 'aliveChecking') => Boolean(group.targetOptions?.qx?.[key]);
const setQxBoolean = (group: PolicyGroup, key: 'aliveChecking', value: boolean) => {
  group.targetOptions ||= {};
  group.targetOptions.qx ||= {};
  group.targetOptions.qx[key] = Boolean(value);
};
const loonAlgorithm = (group: PolicyGroup) => group.targetOptions?.loon?.algorithm || '';
const setLoonAlgorithm = (group: PolicyGroup, value: string) => {
  const algorithm = ['Random', 'PCC', 'Round-Robin'].includes(value)
    ? value as NonNullable<NonNullable<PolicyGroup['targetOptions']>['loon']>['algorithm']
    : undefined;
  if (!algorithm) {
    delete group.targetOptions?.loon?.algorithm;
    return;
  }
  group.targetOptions ||= {};
  group.targetOptions.loon ||= {};
  group.targetOptions.loon.algorithm = algorithm;
};
const groupIconUrl = (group: PolicyGroup) => group.iconUrl || group.targetOptions?.surge?.iconUrl || '';
const setGroupIconUrl = (group: PolicyGroup, value: string) => {
  const text = value.trim();
  delete group.targetOptions?.surge?.iconUrl;
  if (!text) {
    delete group.iconUrl;
    return;
  }
  group.iconUrl = text;
};
const subnetDefault = (group: PolicyGroup) => group.targetOptions?.surge?.subnetDefault || 'DIRECT';
const setSubnetDefault = (group: PolicyGroup, value: string) => {
  group.targetOptions ||= {};
  group.targetOptions.surge ||= {};
  group.targetOptions.surge.subnetDefault = value;
};
const subnetRulesText = (group: PolicyGroup) => (group.targetOptions?.surge?.subnetRules || [])
  .map(rule => `${rule.expression} = ${rule.policy}`)
  .join('\n');
const setSubnetRulesText = (group: PolicyGroup, value: string) => {
  const rules = value.split(/\r?\n/).flatMap((line) => {
    const separator = line.indexOf('=');
    if (separator < 0) return [];
    const expression = line.slice(0, separator).trim();
    const policy = line.slice(separator + 1).trim();
    return expression && policy ? [{ expression, policy }] : [];
  });
  group.targetOptions ||= {};
  group.targetOptions.surge ||= {};
  group.targetOptions.surge.subnetRules = rules;
};
const addRule = (kind: RuleBinding['kind'] = 'inline', inlineType = 'DOMAIN') => {
  const rule = kind === 'remote'
    ? { kind: 'remote' as const, ruleSet: '', policy: 'DIRECT' }
    : kind === 'final'
      ? { kind: 'final' as const, policy: 'DIRECT' }
      : { kind: 'inline' as const, type: inlineType, value: '', policy: 'DIRECT' };
  const index = form.rules.push(rule) - 1;
  expandPanel(`rule-${index}`);
};
const addRuleSet = () => {
  const name = `rule-set-${Date.now()}`;
  const bindingName = `rule-set-${form.rules.filter(rule => rule.kind === 'remote').length + 1}`;
  ruleSets.value.push({ name, source: { kind: 'url', url: '', target: DEFAULT_CONFIG_GENERATOR_TARGET } });
  form.rules.push({ kind: 'remote', name: bindingName, ruleSet: name, policy: 'DIRECT' });
};
const isPersistedRuleSet = (name: string) => persistedRuleSetNames.value.has(name);
const removeRule = (index: number) => form.rules.splice(index, 1);
const isRuleSetReferencedByForm = (name: string) => form.rules.some(
  rule => rule.kind === 'remote' && rule.ruleSet === name,
);
const detachUnusedRuleSet = (ruleSet: RemoteRuleSet) => {
  if (isRuleSetReferencedByForm(ruleSet.name)) return;
  if (isPersistedRuleSet(ruleSet.name)) {
    pendingRuleSetDeletionNames.value = new Set([
      ...pendingRuleSetDeletionNames.value,
      ruleSet.name,
    ]);
    return;
  }
  const index = ruleSets.value.indexOf(ruleSet);
  if (index >= 0) ruleSets.value.splice(index, 1);
};
const isRuleEnabled = (rule: RuleBinding) => rule.kind === 'inline' || rule.kind === 'remote' ? !rule.disabled : true;
const setRuleEnabled = (rule: RuleBinding, enabled: boolean) => {
  if (rule.kind !== 'inline' && rule.kind !== 'remote') return;
  if (enabled) delete rule.disabled;
  else rule.disabled = true;
};
const ruleType = (rule: RuleBinding) => {
  if (rule.kind === 'remote') return 'RULE-SET';
  if (rule.kind === 'inline') return rule.type;
  return rule.kind;
};
const ruleActionTitle = (rule: RuleBinding) => {
  if (rule.kind !== 'remote') return ruleType(rule);
  const name = rule.name?.trim() || rule.ruleSet?.trim();
  return name ? `RULE-SET · ${name}` : 'RULE-SET';
};
const ruleValue = (rule: RuleBinding) => {
  if (rule.kind === 'comment') return rule.text;
  if (rule.kind === 'remote') return rule.ruleSet;
  if (rule.kind === 'inline') return rule.value;
  if (rule.kind === 'final') return rule.policy;
  return '';
};
const updateRuleValue = (index: number, value: string) => {
  const rule = form.rules[index];
  if (!rule) return;
  if (rule.kind === 'comment') rule.text = value;
  else if (rule.kind === 'remote') rule.ruleSet = value;
  else if (rule.kind === 'inline') rule.value = value;
  else if (rule.kind === 'final') rule.policy = value;
};
const rulePolicy = (rule: RuleBinding) => ('policy' in rule ? rule.policy : '');
const updateRulePolicy = (index: number, policy: string) => {
  const rule = form.rules[index];
  if (rule && 'policy' in rule) rule.policy = policy;
};
const rulePlaceholder = (rule: RuleBinding) => {
  if (rule.kind === 'comment') return t('configGenerator.placeholders.comment');
  if (rule.kind === 'inline') return t('configGenerator.placeholders.ruleValue');
  if (rule.kind === 'final') return t('configGenerator.placeholders.policy');
  return '';
};

const groupActions = reactive<ActionModuleProps[]>([]);
const groupActionsChecked = reactive<Array<[string, boolean]>>([]);
const ruleActions = reactive<ActionModuleProps[]>([]);
const ruleActionsChecked = reactive<Array<[string, boolean]>>([]);
const groupActionNames = new Map<string, string>();

const groupByActionId = (id: string) => form.groups.find(group => groupItemKey(group) === id);
const ruleByActionId = (id: string) => form.rules.find(rule => ruleItemKey(rule) === id);
const resolveRuleActionTitle = (action: ActionModuleProps) => {
  const rule = ruleByActionId(action.id);
  return rule ? ruleActionTitle(rule) : action.customName;
};
const ruleSetByActionId = (id: string) => {
  const rule = ruleByActionId(id);
  return rule?.kind === 'remote'
    ? ruleSets.value.find(ruleSet => ruleSet.name === rule.ruleSet)
    : undefined;
};

const syncChecked = (checked: Array<[string, boolean]>, actions: ActionModuleProps[]) => {
  const previous = new Map(checked);
  checked.splice(0, checked.length, ...actions.map(action => [action.id, previous.get(action.id) ?? true] as [string, boolean]));
};

const syncGroupActions = () => {
  const existing = new Map(groupActions.map(action => [action.id, action]));
  const next = form.groups.map((group) => {
    const id = groupItemKey(group);
    const action = existing.get(id);
    if (action) return action;

    groupActionNames.set(id, group.name);
    return {
      id,
      type: t('configGenerator.group'),
      customName: group.name,
      tipsDes: '',
      component: shallowRef(PolicyGroupActionForm),
      enabled: isGroupEnabled(group),
    };
  });
  groupActions.splice(0, groupActions.length, ...next);
  syncChecked(groupActionsChecked, groupActions);
};

const syncRuleActions = () => {
  const existing = new Map(ruleActions.map(action => [action.id, action]));
  const next = form.rules
    .filter(isRuleActionVisible)
    .map((rule) => {
    const id = ruleItemKey(rule);
    const action = existing.get(id);
    if (action) {
      action.nameEditable = rule.kind !== 'remote';
      return action;
    }

    return {
      id,
      type: ruleType(rule),
      customName: ruleActionTitle(rule),
      tipsDes: '',
      component: shallowRef(rule.kind === 'remote' ? RuleSetActionForm : InlineRuleActionForm),
      enabled: isRuleEnabled(rule),
      nameEditable: rule.kind !== 'remote',
    };
    });
  ruleActions.splice(0, ruleActions.length, ...next);
  syncChecked(ruleActionsChecked, ruleActions);
};

const reorderFromActions = <T extends object>(source: T[], actions: ActionModuleProps[], getId: (item: T) => string) => {
  const sourceById = new Map(source.map(item => [getId(item), item]));
  const ordered = actions.map(action => sourceById.get(action.id)).filter((item): item is T => Boolean(item));
  if (ordered.length !== source.length || ordered.every((item, index) => item === source[index])) return;
  source.splice(0, source.length, ...ordered);
};

const syncGroupActionNames = () => {
  form.groups.forEach((group) => {
    const id = groupItemKey(group);
    const action = groupActions.find(item => item.id === id);
    const previousName = groupActionNames.get(id);
    if (action && action.customName === previousName) action.customName = group.name;
    groupActionNames.set(id, group.name);
  });
};

const refreshGroupActionTitle = (group: PolicyGroup) => {
  const id = groupItemKey(group);
  const action = groupActions.find(item => item.id === id);
  if (action) action.customName = group.name;
  groupActionNames.set(id, group.name);
};

const syncGroupNamesFromActions = () => {
  groupActions.forEach((action) => {
    const group = groupByActionId(action.id);
    if (group && action.customName !== groupActionNames.get(action.id)) group.name = action.customName;
  });
};

const syncGroupActionEnabled = () => {
  groupActions.forEach((action) => {
    const group = groupByActionId(action.id);
    if (group) setGroupEnabled(group, action.enabled !== false);
  });
};

const syncRuleActionEnabled = () => {
  ruleActions.forEach((action) => {
    const rule = ruleByActionId(action.id);
    if (!rule) return;
    if (rule.kind !== 'inline' && rule.kind !== 'remote') {
      action.enabled = true;
      return;
    }
    const enabled = action.enabled !== false;
    setRuleEnabled(rule, enabled);
  });
};
const addGroupAction = () => addGroup('select');
const deleteGroupAction = (id: string) => {
  const group = groupByActionId(id);
  const index = group ? form.groups.indexOf(group) : -1;
  if (index >= 0) removeGroup(index);
};
const toggleGroupAction = (id: string) => {
  const action = groupActions.find(item => item.id === id);
  if (action) action.enabled = !action.enabled;
};

const addRuleAction = () => addRule('inline', 'DOMAIN');
const deleteRuleAction = (id: string) => {
  const rule = ruleByActionId(id);
  const index = rule ? form.rules.indexOf(rule) : -1;
  if (index < 0 || !rule) return;
  if (rule.kind !== 'remote') {
    removeRule(index);
    return;
  }
  const ruleSet = ruleSetByActionId(id);
  removeRule(index);
  if (ruleSet) detachUnusedRuleSet(ruleSet);
};
const toggleRuleAction = (id: string) => {
  const action = ruleActions.find(item => item.id === id);
  if (action) action.enabled = !action.enabled;
};

watch(() => form.groups.map(group => groupItemKey(group)), syncGroupActions, { immediate: true });
watch(() => form.rules.map(rule => ruleItemKey(rule)), syncRuleActions, { immediate: true });
watch(() => form.groups.map(group => `${groupItemKey(group)}:${group.name}`), syncGroupActionNames);
watch(() => groupActions.map(action => action.id), () => reorderFromActions(form.groups, groupActions, groupItemKey));
watch(() => ruleActions.map(action => action.id), () => reorderFromActions(form.rules, ruleActions, ruleItemKey));
watch(groupActions, () => {
  syncGroupNamesFromActions();
  syncGroupActionEnabled();
}, { deep: true });
watch(ruleActions, syncRuleActionEnabled, { deep: true });

provide('configGeneratorActionContext', {
  form,
  groupByActionId,
  refreshGroupActionTitle,
  ruleByActionId,
  ruleSetByActionId,
  updateGroupType,
  availableGroupMembers,
  availablePolicyMembers,
  selectedPolicyMembers,
  setSelectedPolicyMembers,
  proxyMembersText,
  setProxyMembersText,
  setIncludeAllProxies,
  groupRemoteSource,
  hasLegacyRemoteSourceConflict,
  setGroupRemoteSource,
  setIncludeOtherGroups,
  groupNumber,
  setGroupNumber,
  policyUpdateInterval,
  setPolicyUpdateInterval,
  getSurgeBoolean,
  setSurgeBoolean,
  getQxBoolean,
  setQxBoolean,
  loonAlgorithm,
  setLoonAlgorithm,
  groupIconUrl,
  setGroupIconUrl,
  subnetDefault,
  setSubnetDefault,
  subnetRulesText,
  setSubnetRulesText,
  ruleType,
  ruleValue,
  updateRuleValue,
  rulePolicy,
  updateRulePolicy,
  rulePlaceholder,
});

const validate = () => {
  if (!form.name || !/^[a-zA-Z\d._-]+$/.test(form.name)) {
    Toast.warn(t('configGenerator.invalidName'));
    return false;
  }
  if (form.rules.some(rule => rule.kind === 'remote' && !ruleSets.value.some(ruleSet => ruleSet.name === rule.ruleSet))) {
    Toast.warn(t('configGenerator.remoteRuleSetRequired'));
    return false;
  }
  return true;
};

const saveRuleSets = async () => {
  for (const ruleSet of ruleSets.value) {
    if (
      pendingRuleSetDeletionNames.value.has(ruleSet.name)
      && !isRuleSetReferencedByForm(ruleSet.name)
    ) continue;
    const success = await configStore.saveRuleSet(ruleSet, isPersistedRuleSet(ruleSet.name));
    if (!success) {
      Toast.warn(configStore.error || t('configGenerator.operationFailed'));
      return false;
    }
  }
  await configStore.fetchRuleSets();
  persistedRuleSetNames.value = new Set(ruleSets.value.map(ruleSet => ruleSet.name));
  return true;
};

const cleanupDetachedRuleSets = async () => {
  const candidates = [...pendingRuleSetDeletionNames.value];
  pendingRuleSetDeletionNames.value = new Set();
  if (!candidates.length) return true;

  const referencedNames = new Set(configStore.projects.flatMap(project =>
    (project.rules || []).flatMap(rule => rule.kind === 'remote' ? [rule.ruleSet] : [])));
  let success = true;
  for (const name of candidates) {
    if (referencedNames.has(name)) continue;
    if (!(await configStore.removeRuleSet(name))) success = false;
  }
  await configStore.fetchRuleSets();
  persistedRuleSetNames.value = new Set(ruleSets.value.map(ruleSet => ruleSet.name));
  return success;
};

const normalizeLegacyRuleSetTarget = (ruleSet: RemoteRuleSet) => {
  if (ruleSet.source.kind === 'url' && !ruleSet.source.target) {
    // Rule sets created before multi-target output were consumed as Surge
    // lists. Make that legacy ownership explicit so the selected radio value,
    // preview behavior, and persisted data cannot disagree.
    ruleSet.source.target = DEFAULT_CONFIG_GENERATOR_TARGET;
  }
  return ruleSet;
};

const save = async () => {
  if (!validate()) return;
  submitting.value = true;
  try {
    if (!(await saveRuleSets())) return;
    const success = await configStore.saveProject(JSON.parse(JSON.stringify(toRaw(form))), editing.value);
    if (success) {
      Toast.success(t('configGenerator.saved'));
      if (!(await cleanupDetachedRuleSets())) {
        Toast.warn(configStore.error || t('configGenerator.operationFailed'));
      }
      router.replace('/extensions/config-generator');
    } else {
      Toast.warn(configStore.error || t('configGenerator.operationFailed'));
    }
  } finally {
    submitting.value = false;
  }
};

const preview = async () => {
  if (!validate()) return;
  previewing.value = true;
  try {
    const project = JSON.parse(JSON.stringify(toRaw(form))) as ConfigProject;
    const availableRuleSets = JSON.parse(JSON.stringify(toRaw(ruleSets.value))) as RemoteRuleSet[];
    const result = await configStore.preview(project, availableRuleSets, independentTarget.value);
    if (!result) {
      if (configStore.previewErrors.length) {
        configStore.setPreviewDraft({
          name: project.name,
          project,
          ruleSets: availableRuleSets,
          target: independentTarget.value,
          body: '',
          errors: [...configStore.previewErrors],
          error: configStore.error || 'CONFIG_GENERATOR_PREVIEW_FAILED',
        });
        router.push(`/extensions/config-generator/preview/${encodeURIComponent(project.name)}?target=${independentTarget.value}`);
        return;
      }
      Toast.warn(configStore.error || t('configGenerator.operationFailed'));
      return;
    }
    const body = typeof result === 'string' ? result : result?.body ?? result?.content ?? '';
    if (!body) {
      Toast.warn(configStore.error || t('configGenerator.operationFailed'));
      return;
    }
    configStore.setPreviewDraft({
      name: project.name,
      project,
      ruleSets: availableRuleSets,
      target: independentTarget.value,
      body,
      stats: result?.stats,
      warnings: result?.warnings,
      errors: result?.errors,
    });
    router.push(`/extensions/config-generator/preview/${encodeURIComponent(project.name)}?target=${independentTarget.value}`);
  } finally {
    previewing.value = false;
  }
};

const addRemoteSource = () => {
  remoteSourceEditingIndex.value = null;
  remoteSourceDraft.value = {
    name: '',
    source: {
      kind: 'sub-store',
      type: 'subscription',
      name: '',
      publicBaseUrl: currentUrl.value || window.location.origin,
    },
    enabled: true,
  };
  remoteSourceEditorVisible.value = true;
};
const openRemoteSourceEditor = (index: number) => {
  const source = form.remoteProxySources[index];
  if (!source) return;
  remoteSourceEditingIndex.value = index;
  remoteSourceDraft.value = JSON.parse(JSON.stringify(source));
  remoteSourceEditorVisible.value = true;
};
const clearRemoteSourceDraft = () => {
  remoteSourceEditingIndex.value = null;
  remoteSourceDraft.value = null;
};
const removeRemoteSource = (index: number) => {
  const source = form.remoteProxySources[index];
  if (!source) return;
  const isInUse = form.groups.some(group => group.remoteProxySource === source.name
    || CONFIG_GENERATOR_TARGETS.some(
      target => group.targetOptions?.[target]?.remoteProxySource === source.name,
    ));
  if (isInUse) {
    Toast.warn(t('configGenerator.remoteSourceInUse'));
    return;
  }
  form.remoteProxySources.splice(index, 1);
};
const setRemoteSourceDraftKind = (kind: 'sub-store' | 'url') => {
  const source = remoteSourceDraft.value;
  if (!source || source.source.kind === kind) return;
  source.source = kind === 'sub-store'
    ? {
        kind,
        type: 'subscription',
        name: '',
        publicBaseUrl: currentUrl.value || window.location.origin,
      }
    : {
        kind,
        url: '',
        mode: 'auto',
        publicBaseUrl: currentUrl.value || window.location.origin,
      };
};
const setRemoteSourceDraftEnabled = (enabled: boolean) => {
  const source = remoteSourceDraft.value;
  if (!source) return;
  if (enabled) delete source.enabled;
  else source.enabled = false;
};
const openRemoteSourceStatusTips = () => {
  const source = remoteSourceDraft.value;
  const title = source?.enabled === false
    ? t('configGenerator.sourceDisabled')
    : t('configGenerator.sourceEnabled');
  Dialog({
    title,
    content: t('configGenerator.sourceStatusHelp'),
    popClass: 'auto-dialog',
    textAlign: 'left',
    noCancelBtn: true,
    okText: t('specificWord.confirm'),
    closeOnClickOverlay: true,
    closeOnPopstate: true,
  });
};
const openEmbeddedSourcePicker = () => {
  sourcePickerPurpose.value = 'embedded';
  sourceModel.value = form.embeddedSource
    ? [form.embeddedSource.type, form.embeddedSource.name]
    : [];
  sourcePickerVisible.value = true;
};
const openRemoteDraftSourcePicker = () => {
  const source = remoteSourceDraft.value?.source;
  sourcePickerPurpose.value = 'remote-draft';
  sourceModel.value = source?.kind === 'sub-store' ? [source.type, source.name] : [];
  sourcePickerVisible.value = true;
};
const confirmSource = ({ selectedValue }: any) => {
  const value = selectedValue || sourceModel.value;
  if (!value?.[0] || !value?.[1]) return;
  if (sourcePickerPurpose.value === 'remote-draft' && remoteSourceDraft.value) {
    remoteSourceDraft.value.source = {
      kind: 'sub-store',
      type: value[0],
      name: value[1],
      publicBaseUrl: currentUrl.value || window.location.origin,
    };
    if (!remoteSourceDraft.value.name.trim()) remoteSourceDraft.value.name = value[1];
  } else {
    form.embeddedSource = { type: value[0], name: value[1] };
  }
};
const remoteSourceLabel = (item: RemoteProxySource) => item.source.kind === 'sub-store'
  ? `${item.source.type} - ${item.source.name}`
  : '';
const remoteSourceKindLabel = (item: RemoteProxySource) => item.source.kind === 'sub-store'
  ? 'Sub-Store'
  : item.source.mode === 'auto'
    ? t('configGenerator.automaticSourceBadge')
    : item.source.target
      ? CONFIG_GENERATOR_TARGET_REGISTRY[item.source.target].displayName
      : 'URL';
const remoteSourceSummary = (item: RemoteProxySource) => item.source.kind === 'sub-store'
  ? `${remoteSourceLabel(item)} · ${item.source.publicBaseUrl}`
  : item.source.url || t('configGenerator.sourceUrlNotConfigured');
const remoteSourceFallbackHint = (item: RemoteProxySource) => {
  if (item.source.kind !== 'url') return '';
  if (item.source.mode === 'auto') return t('configGenerator.automaticSourceShort');
  if (!item.source.target) return t('configGenerator.remoteSourceTargetRequiredShort');
  return t(CONFIG_GENERATOR_TARGET_REGISTRY[item.source.target].sourceHelp.summaryKey);
};
const replaceRemoteSourceReferences = (previousName: string, nextName: string) => {
  if (!previousName || previousName === nextName) return;
  form.groups.forEach((group) => {
    if (group.remoteProxySource === previousName) group.remoteProxySource = nextName;
    CONFIG_GENERATOR_TARGETS.forEach((target) => {
      const options = group.targetOptions?.[target];
      if (options?.remoteProxySource === previousName) options.remoteProxySource = nextName;
    });
  });
};
const saveRemoteSourceDraft = () => {
  const draft = remoteSourceDraft.value;
  if (!draft?.name.trim()) {
    Toast.warn(t('configGenerator.sourceNameRequired'));
    return;
  }
  const duplicate = form.remoteProxySources.some((source, index) =>
    index !== remoteSourceEditingIndex.value && source.name === draft.name.trim());
  if (duplicate) {
    Toast.warn(t('configGenerator.sourceNameDuplicate'));
    return;
  }
  if (draft.source.kind === 'sub-store') {
    if (!draft.source.name || !draft.source.type) {
      Toast.warn(t('configGenerator.sourceSelectionRequired'));
      return;
    }
    draft.source.publicBaseUrl ||= currentUrl.value || window.location.origin;
  } else {
    try {
      const url = new URL(draft.source.url);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    } catch (_) {
      Toast.warn(t('configGenerator.sourceUrlRequired'));
      return;
    }
    draft.source.mode = 'auto';
    draft.source.publicBaseUrl ||= currentUrl.value || window.location.origin;
    delete draft.source.target;
  }
  draft.name = draft.name.trim();
  const next = JSON.parse(JSON.stringify(draft)) as RemoteProxySource;
  if (remoteSourceEditingIndex.value == null) {
    form.remoteProxySources.push(next);
  } else {
    const previousName = form.remoteProxySources[remoteSourceEditingIndex.value]?.name || '';
    form.remoteProxySources.splice(remoteSourceEditingIndex.value, 1, next);
    replaceRemoteSourceReferences(previousName, next.name);
  }
  remoteSourceEditorVisible.value = false;
};
const upgradeRecognizedSubStoreRemoteSources = () => {
  const publicBaseUrl = (currentUrl.value || window.location.origin).replace(/\/$/, '');
  const candidates = [
    ...subsStore.subs.map(item => ({ type: 'subscription' as const, name: item.name })),
    ...subsStore.collections.map(item => ({ type: 'collection' as const, name: item.name })),
  ];
  const byUrl = new Map<string, { type: 'subscription' | 'collection'; name: string }>();
  candidates.forEach((candidate) => {
    const path = candidate.type === 'collection'
      ? `/download/collection/${encodeURIComponent(candidate.name)}`
      : `/download/${encodeURIComponent(candidate.name)}`;
    const suffixes = [
      '',
      ...CONFIG_GENERATOR_TARGET_DEFINITIONS.map(target => `/${target.downloadSuffix}`),
    ];
    suffixes.forEach(suffix => byUrl.set(`${publicBaseUrl}${path}${suffix}`, candidate));
  });
  form.remoteProxySources.forEach((source) => {
    if (source.source.kind !== 'url') return;
    const native = byUrl.get(source.source.url);
    if (!native) return;
    source.source = {
      kind: 'sub-store',
      type: native.type,
      name: native.name,
      publicBaseUrl,
    };
  });
};

onMounted(async () => {
  const projectName = route.params.name as string | undefined;
  const isNewProject = !projectName || projectName === 'UNTITLED';
  let importedRuleSets: RemoteRuleSet[] = [];

  if (isNewProject) {
    const importedProject = configStore.takeImportedProject();
    importedRuleSets = configStore.takeImportedRuleSets();
    resetForm(importedProject || undefined);
  } else {
    const project = await configStore.getProject(projectName).catch(() => null);
    if (!project) {
      router.replace('/extensions/config-generator');
      return;
    }
    resetForm(project);
  }
  captureInitialCollapsedActionIds(!isNewProject);

  await Promise.all([
    !subsStore.subs.length && !subsStore.collections.length ? subsStore.fetchSubsData() : Promise.resolve(),
    configStore.fetchRuleSets(),
  ]);
  upgradeRecognizedSubStoreRemoteSources();
  ruleSets.value.forEach(normalizeLegacyRuleSetTarget);
  persistedRuleSetNames.value = new Set(ruleSets.value.map(ruleSet => ruleSet.name));
  if (isNewProject) {
    const names = new Set(ruleSets.value.map(ruleSet => ruleSet.name));
    ruleSets.value.push(...importedRuleSets
      .filter(ruleSet => !names.has(ruleSet.name))
      .map(normalizeLegacyRuleSetTarget));
  }
});
</script>

<style lang="scss" scoped>
.page-wrapper {
  padding: 0 var(--safe-area-side) calc(v-bind("padding") + 101px) var(--safe-area-side);

  :deep(.nut-cell-group__warp) {
    border-radius: var(--item-card-radios);
  }
}

.radio-wrapper {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;

  :deep(.nut-radiogroup) {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: center;
    gap: 5px;
  }

  :deep(.nut-radio) {
    display: inline-flex;
    align-items: center;
    margin: 0;
    line-height: 1;
  }

  :deep(.nut-radio__button.false) {
    background: var(--divider-color);
    border-color: transparent;
    color: var(--second-text-color);
  }

  :deep(.nut-radio__button) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    height: 30px;
    padding: 0 9px;
    line-height: 18px;
    white-space: nowrap;
  }
}

.independent-target-content {
  display: inline-flex;
  align-items: center;
  gap: 5px;

  img {
    width: 18px;
    height: 18px;
    flex: 0 0 18px;
    object-fit: contain;
  }
}

.option-checkboxes {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 5px;

  :deep(.nut-checkbox) {
    margin: 0;
  }
}

.empty-select-hint {
  color: var(--comment-text-color);
  font-size: 12px;
  text-align: right;
}

.form-block-wrapper {
  position: relative;

  :deep(.nut-form-item__label) {
    width: auto;
  }

  :deep(.nut-form-item__body) {
    justify-content: flex-end;
  }

  :deep(.nut-input-text .nut-input-right-icon) {
    margin-left: 8px;
  }
}

.picker-input {
  cursor: pointer;

  :deep(.nut-input),
  :deep(.nut-input-value),
  :deep(.nut-input-inner),
  :deep(.nut-input-right-icon) {
    cursor: pointer;
  }
}

.ignore-failed-wrapper {
  flex-direction: row;
  justify-content: space-between;

  .switch-wrapper {
    display: flex;
    justify-content: flex-end;
  }
}

.list-group {
  min-height: 20px;
}

.config-section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--comment-text-color);

  .toggle {
    margin-left: 18px;
    margin-right: auto;
    color: var(--unimportant-icon-color);
    cursor: pointer;
  }
}

.config-section-content {
  margin-top: 12px;
}

.source-theme-panel {
  position: relative;
  padding: 12px;
  overflow: hidden;
  border-radius: var(--item-card-radios);
  background: var(--card-color);
}

.source-empty-card,
.source-summary-card,
.add-source-button {
  border: 1px solid var(--divider-color);
  border-radius: var(--item-card-radios);
  background: var(--card-background-color);
}

.source-empty-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px;
  color: var(--comment-text-color);

  strong,
  p {
    margin: 0;
  }

  strong {
    color: var(--primary-text-color);
    font-size: 14px;
  }

  p {
    margin-top: 5px;
    font-size: 12px;
    line-height: 1.5;
  }
}

.source-empty-icon,
.source-summary-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-color);
}

.source-empty-icon {
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  border-radius: 13px;
  background: color-mix(in srgb, var(--primary-color) 10%, transparent);
}

.source-card-list {
  display: grid;
  gap: 9px;
  min-height: 0;
  padding: 0;
  margin: 0;
  list-style: none;
}

.source-summary-card {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
  padding: 13px;
  cursor: pointer;

  &.is-disabled {
    opacity: .68;
  }
}

.source-summary-icon {
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--primary-color) 10%, transparent);

  &.url {
    background: color-mix(in srgb, #7c5ce7 11%, transparent);
    color: #7154cf;
  }
}

.source-summary-content {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 4px;
}

.source-summary-heading {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;

  strong {
    min-width: 0;
    overflow: hidden;
    color: var(--primary-text-color);
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.source-kind-badge {
  flex: 0 0 auto;
  padding: 3px 7px;
  border-radius: 7px;
  background: var(--divider-color);
  color: var(--comment-text-color);
  font-size: 10px;
}

.source-status-badge {
  flex: 0 0 auto;
  padding: 3px 7px;
  border-radius: 7px;
  background: color-mix(in srgb, #22a06b 12%, transparent);
  color: #168056;
  font-size: 10px;

  &.disabled {
    background: color-mix(in srgb, var(--comment-text-color) 13%, transparent);
    color: var(--comment-text-color);
  }
}

.source-summary-value {
  overflow: hidden;
  color: var(--comment-text-color);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-fallback-hint {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--warning-color, #b86909);
  font-size: 10px;
}

.source-summary-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
}

.source-action {
  display: inline-flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--lowest-text-color);
  cursor: pointer;

  &.delete {
    color: var(--danger-color);
  }

  &.drag-handler {
    cursor: grab;
  }
}

.add-source-button {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 11px;
  padding: 13px;
  margin-top: 9px;
  color: var(--primary-text-color);
  text-align: left;
  cursor: pointer;

  > span:first-child {
    display: inline-flex;
    width: 38px;
    height: 38px;
    flex: 0 0 38px;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background: color-mix(in srgb, var(--primary-color) 12%, transparent);
    color: var(--primary-color);
  }

  > span:nth-child(2) {
    display: grid;
    min-width: 0;
    flex: 1;
    gap: 3px;
  }

  strong {
    font-size: 13px;
  }

  small {
    color: var(--comment-text-color);
    font-size: 11px;
  }

  > .nut-icon {
    color: var(--lowest-text-color);
  }
}

.remote-source-editor {
  display: flex;
  height: 100%;
  flex-direction: column;
  overflow: hidden;
}

.remote-source-editor-header {
  padding: 3px 30px 14px 2px;

  span {
    color: var(--primary-color);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  h3,
  p {
    margin: 0;
  }

  h3 {
    margin-top: 4px;
    color: var(--primary-text-color);
    font-size: 19px;
  }

  p {
    margin-top: 7px;
    color: var(--comment-text-color);
    font-size: 12px;
    line-height: 1.5;
  }
}

.source-kind-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 10px;
}

.source-kind-option {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 9px;
  padding: 11px;
  border: 1px solid var(--divider-color);
  border-radius: 12px;
  background: var(--card-background-color);
  color: var(--primary-text-color);
  text-align: left;
  cursor: pointer;

  &.selected {
    border-color: color-mix(in srgb, var(--primary-color) 48%, var(--divider-color));
    background: color-mix(in srgb, var(--primary-color) 7%, var(--card-background-color));
  }

  > span:nth-child(2) {
    display: grid;
    min-width: 0;
    flex: 1;
    gap: 3px;
  }

  strong,
  small {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  strong {
    font-size: 12px;
    white-space: nowrap;
  }

  small {
    color: var(--comment-text-color);
    font-size: 10px;
    line-height: 1.35;
  }

  > .nut-icon {
    color: var(--primary-color);
  }
}

.source-kind-option-icon {
  display: inline-flex;
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  background: color-mix(in srgb, var(--primary-color) 10%, transparent);
  color: var(--primary-color);
}

.remote-source-form {
  min-height: 0;
  overflow-y: auto;
  border-radius: var(--item-card-radios);
}

.remote-source-editor-footer {
  display: flex;
  gap: 8px;
  padding: 10px 0 max(8px, env(safe-area-inset-bottom));
  margin-top: auto;
  border-top: 1px solid var(--divider-color);
}

.source-editor-cancel,
.source-editor-confirm {
  min-height: 42px;
  border-radius: 10px;
}

.source-editor-cancel {
  min-width: 96px;
  padding: 0 16px;
  border: 1px solid var(--divider-color);
  background: transparent;
  color: var(--secondary-text-color);
  cursor: pointer;
}

.source-editor-confirm {
  flex: 1;
}

.source-status-form-item {
  align-items: center;
  justify-content: space-between !important;

  :deep(.nut-form-item__label) {
    width: auto;
    min-width: 0;
    flex: 1 1 auto;
  }

  :deep(.nut-form-item__body) {
    flex: 0 0 auto;
    margin-left: auto;
  }
}

.source-status-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--comment-text-color);
  white-space: nowrap;
}

.source-status-help-button {
  display: inline-flex;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--second-text-color);
  cursor: pointer;

  &:hover,
  &:focus-visible {
    color: var(--primary-color);
    outline: none;
  }

  svg {
    width: 13px;
    height: 13px;
  }
}

.source-status-switch {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-left: 18px;
}

@media (min-width: 700px) {
  :global(.remote-source-editor-popup) {
    right: 0 !important;
    left: 0 !important;
    width: min(620px, calc(100vw - 48px)) !important;
    height: min(640px, calc(100vh - 64px)) !important;
    margin-right: auto;
    margin-left: auto;
  }
}

@media (max-width: 520px) {
  .source-summary-actions .edit {
    display: none;
  }

  .source-kind-grid {
    grid-template-columns: 1fr;
  }

  .source-status-switch {
    margin-left: 12px;
  }
}

.config-editor-tab-offset {
  padding-top: 45px;
}

.config-generator-action-block {
  :deep(.sticky-title-wrapper),
  :deep(.list-group-itemsa),
  :deep(.action-block-tip),
  :deep(.paste-action) {
    display: none;
  }
}

.list-group-item {
  display: flex;
  flex-direction: column;
  box-shadow: none;

  .list-group-item-title {
    display: flex;
    justify-content: space-between;
    width: 100%;
    padding-bottom: 12px;
    margin-bottom: 12px;
    border-bottom: 1px solid var(--divider-color);
    color: var(--comment-text-color);

    &.collapsed {
      padding-bottom: 0;
      margin-bottom: 0;
      border-bottom: 0;
    }

    .left {
      display: flex;
      flex: 1;
      align-items: center;
      padding-right: 5px;
      color: var(--second-text-color);
      font-size: 12px;
      font-weight: bold;
      cursor: pointer;

      .collapsed {
        margin-right: 6px;
        color: var(--unimportant-icon-color);
      }
    }

    .right {
      display: flex;
      align-items: center;
      flex-shrink: 0;

      .action-switch {
        display: flex;
        align-items: center;
        padding-right: 8px;

        span {
          flex-shrink: 0;
          font-size: 12px;
          font-weight: normal;
          cursor: pointer;
        }

        .my-switch {
          width: 18px;

          :deep(.nut-icon) {
            font-size: 16px;
          }
        }
      }

      .icon-button {
        padding: 0 8px;
        cursor: pointer;
      }

      .delete {
        padding: 0 8px;
        color: var(--danger-color);
        cursor: pointer;
      }

      .drag-handler {
        padding-left: 8px;
        color: var(--lowest-text-color);
        cursor: grab;

        &:active {
          cursor: grabbing;
        }
      }
    }
  }
}

.list-group-itemsa {
  display: flex;
  flex-direction: column;
  box-shadow: none;

  .list-group-item-titlesa {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 1px 0 12px 12px;
    border-bottom: 1px solid var(--divider-color);
    color: var(--comment-text-color);
    font-size: 12px;

    .add-action-title {
      display: inline-flex;
      align-items: center;
      min-width: 0;
    }

    span {
      margin-right: 6px;
    }

    svg {
      color: var(--unimportant-icon-color);
    }
  }

  .horizontal-button-container {
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
    margin: 10px;
    border-radius: 15px;
    background-color: var(--card-color);
  }

  .custom-button {
    display: inline-flex;
    flex: 1 1 132px;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    min-width: 0;
    min-height: 40px;
    padding: 9px 15px;
    border: 0;
    border-radius: 18px;
    background: var(--divider-color);
    color: var(--second-text-color);
    font-size: 14px;
    font-weight: normal;
    line-height: 1.35;
    text-align: center;
    cursor: pointer;

    svg {
      margin-right: 5px;
    }
  }

  .horizontal-button-container.compact-action-buttons {
    gap: 6px;

    .custom-button {
      flex: 0 0 auto;
      min-height: 32px;
      padding: 6px 12px;
      border-radius: 16px;
    }
  }

  .horizontal-button-container.rule-type-action-buttons {
    .custom-button {
      flex: 0 0 auto;
      min-width: 0;
      white-space: nowrap;
    }
  }

  .horizontal-button-container.group-type-action-buttons {
    .custom-button {
      flex: 0 0 auto;
      min-width: 0;
      white-space: nowrap;
    }
  }
}

.bottom-btn-wrapper {
  position: fixed;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: space-between;
  bottom: 0;
  left: 0;
  width: 100%;
  padding: 8px var(--safe-area-side) calc(v-bind("padding") + 8px) var(--safe-area-side);
  z-index: 20;
  background: var(--background-color);
  border-top: 1px solid var(--divider-color);
  @include centered-fixed-container;

  .btn {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    padding: 4px 12px;
    font-size: 14px;

    svg {
      margin-right: 4px;
    }
  }

  .compare-btn {
    width: calc(40% - 3px);
    background: transparent;
  }

  .submit-btn {
    width: calc(60% - 3px);
  }

}
</style>
