<template>
  <div class="preview-page">
    <section class="preview-workspace" :aria-busy="loading">
      <header class="preview-header">
        <div class="preview-context">
          <span class="preview-eyebrow">{{ $t('configGenerator.previewOutput') }}</span>
          <strong class="preview-project" :title="projectName">{{ projectName }}</strong>
        </div>

        <div
          class="target-switch"
          role="tablist"
          :aria-label="$t('configGenerator.previewTarget')"
        >
          <button
            v-for="option in targetOptions"
            :key="option.value"
            type="button"
            class="target-option"
            :class="{ active: target === option.value }"
            role="tab"
            :aria-selected="target === option.value"
            @click="switchTarget(option.value)"
          >
            <img class="target-option-icon" :src="option.icon" alt="" aria-hidden="true">
            <span class="target-label-full">{{ option.label }}</span>
            <span class="target-label-short">{{ option.shortLabel }}</span>
          </button>
        </div>
      </header>

      <div class="preview-summary" aria-live="polite">
        <div class="preview-state" :class="`is-${previewState}`">
          <span class="state-dot" aria-hidden="true" />
          <span>{{ previewStateLabel }}</span>
        </div>

        <dl class="preview-stats" :aria-label="$t('configGenerator.previewStats.title')">
          <div v-for="item in statsItems" :key="item.key" class="preview-stat">
            <dd>{{ item.value }}</dd>
            <dt>{{ item.label }}</dt>
          </div>
        </dl>
      </div>

      <aside v-if="diagnostics.length" class="preview-diagnostics">
        <div class="diagnostics-heading">
          <font-awesome-icon icon="fa-solid fa-circle-question" />
          <span>{{ $t('configGenerator.previewDiagnostics', { count: diagnostics.length }) }}</span>
        </div>
        <ul>
          <li v-for="(diagnostic, index) in diagnostics" :key="`${diagnostic.level}-${index}`">
            <span class="diagnostic-level" :class="`is-${diagnostic.level}`">
              {{ $t(`configGenerator.previewDiagnosticLevels.${diagnostic.level}`) }}
            </span>
            <span class="diagnostic-message">{{ diagnostic.message }}</span>
          </li>
        </ul>
      </aside>

      <div class="preview-body">
        <Transition name="preview-state" mode="out-in">
          <div v-if="loading" key="loading" class="preview-status-panel">
            <span class="preview-spinner" aria-hidden="true" />
            <h2>{{ $t('configGenerator.previewLoading') }}</h2>
            <p>{{ $t('configGenerator.previewLoadingDescription', { target: activeTargetLabel }) }}</p>
          </div>

          <div v-else-if="error" key="error" class="preview-status-panel is-error" role="alert">
            <span class="status-icon" aria-hidden="true">
              <font-awesome-icon icon="fa-solid fa-circle-xmark" />
            </span>
            <h2>{{ $t('configGenerator.previewFailed') }}</h2>
            <p>{{ previewErrorMessage }}</p>
            <button type="button" class="retry-button" @click="loadPreview(target)">
              <font-awesome-icon icon="fa-solid fa-arrow-rotate-right" />
              {{ $t('configGenerator.previewRetry') }}
            </button>
          </div>

          <div v-else-if="empty" key="empty" class="preview-status-panel is-empty">
            <span class="status-icon" aria-hidden="true">
              <font-awesome-icon icon="fa-solid fa-file-lines" />
            </span>
            <h2>{{ $t('configGenerator.previewEmpty') }}</h2>
            <p>{{ $t('configGenerator.previewEmptyDescription') }}</p>
          </div>

          <div v-else key="editor" class="preview-editor">
            <cmView
              :key="editorId"
              :id="editorId"
              :is-read-only="true"
              :enable-import="false"
              :editor-language="activeTargetDefinition.editorLanguage"
              toolbar-variant="preview"
              :toolbar-actions="['fullscreen', 'search', 'copy', 'panel']"
            />
          </div>
        </Transition>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import cmView from '@/views/editCode/cmView.vue';
import { useCodeStore } from '@/store/codeStore';
import { useConfigGeneratorStore } from '@/store/configGenerator';
import { useGlobalStore } from '@/store/global';
import { useSystemStore } from '@/store/system';
import {
  CONFIG_GENERATOR_TARGET_DEFINITIONS,
  CONFIG_GENERATOR_TARGET_REGISTRY,
  DEFAULT_CONFIG_GENERATOR_TARGET,
  isConfigGeneratorTarget,
} from '@/views/extensions/configGeneratorTargets';

type PreviewTarget = ConfigGeneratorTarget;
type PreviewState = 'loading' | 'ready' | 'error' | 'empty';
type PreviewDiagnostic = {
  level: 'warning' | 'error';
  message: string;
};

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const codeStore = useCodeStore();
const configStore = useConfigGeneratorStore();
const globalStore = useGlobalStore();
const systemStore = useSystemStore();
const { bottomSafeArea } = storeToRefs(globalStore);
const { navBarHeight } = storeToRefs(systemStore);
const projectName = String(route.params.name || '');
const draft = ref(configStore.takePreviewDraft());
const routeTarget = Array.isArray(route.query.target) ? route.query.target[0] : route.query.target;
const target = ref<PreviewTarget>(isConfigGeneratorTarget(routeTarget)
  ? routeTarget
  : draft.value?.target || DEFAULT_CONFIG_GENERATOR_TARGET);
const loading = ref(true);
const error = ref('');
const empty = ref(false);
const stats = ref<Record<string, number> | undefined>();
const diagnostics = ref<PreviewDiagnostic[]>([]);
const bottomPadding = computed(() => `${bottomSafeArea.value}px`);
let previewRequestId = 0;
let draftPayloadAvailable = true;

const createEditorId = (previewTarget: PreviewTarget) =>
  `config-generator-preview-${projectName}-${previewTarget}`;
const editorId = computed(() => createEditorId(target.value));
const activeTargetDefinition = computed(() => CONFIG_GENERATOR_TARGET_REGISTRY[target.value]);
const activeTargetLabel = computed(() => t(activeTargetDefinition.value.outputLabelKey));
const targetOptions = computed<Array<{ value: PreviewTarget; label: string; shortLabel: string; icon: string }>>(() =>
  CONFIG_GENERATOR_TARGET_DEFINITIONS.map(option => ({
    value: option.target,
    label: t(option.outputLabelKey),
    shortLabel: option.shortName,
    icon: option.icon,
  })));
const previewState = computed<PreviewState>(() => {
  if (loading.value) return 'loading';
  if (error.value) return 'error';
  if (empty.value) return 'empty';
  return 'ready';
});
const previewStateLabel = computed(() => t(`configGenerator.previewStates.${previewState.value}`));
const previewErrorMessage = computed(() => {
  if (error.value === 'CONFIG_GENERATOR_PROJECT_NOT_FOUND') {
    return t('configGenerator.previewProjectNotFound');
  }
  if (error.value === 'CONFIG_GENERATOR_PREVIEW_EMPTY') {
    return t('configGenerator.previewEmptyDescription');
  }
  if (error.value === 'CONFIG_GENERATOR_PREVIEW_FAILED') {
    return t('configGenerator.previewFailedDescription');
  }
  return error.value || t('configGenerator.previewFailedDescription');
});
const statsItems = computed(() => [
  { key: 'nodes', label: t('configGenerator.previewStats.nodes'), value: stats.value?.nodeCount ?? '—' },
  { key: 'groups', label: t('configGenerator.previewStats.groups'), value: stats.value?.groupCount ?? '—' },
  { key: 'rules', label: t('configGenerator.previewStats.rules'), value: stats.value?.ruleCount ?? '—' },
]);

const normalizeDiagnostics = (result: any): PreviewDiagnostic[] => {
  const normalize = (items: unknown, level: PreviewDiagnostic['level']) =>
    (Array.isArray(items) ? items : [])
      .map((item: any) => {
        const message = typeof item === 'string'
          ? item
          : item?.message || item?.reason || item?.code;
        if (!message) return null;
        const location = [item?.path, item?.line ? `:${item.line}` : ''].filter(Boolean).join('');
        return {
          level,
          message: location ? `${location} · ${message}` : String(message),
        } as PreviewDiagnostic;
      })
      .filter((item): item is PreviewDiagnostic => Boolean(item));

  return [
    ...normalize(result?.errors, 'error'),
    ...normalize(result?.warnings, 'warning'),
  ];
};

const applyResult = (result: any, resultTarget: PreviewTarget) => {
  const body = typeof result === 'string' ? result : result?.body ?? result?.content ?? '';
  stats.value = result?.stats;
  diagnostics.value = normalizeDiagnostics(result);
  empty.value = typeof body !== 'string' || body.trim().length === 0;
  codeStore.setEditCode(createEditorId(resultTarget), empty.value ? '' : body);
};

const loadPreview = async (nextTarget: PreviewTarget) => {
  const requestId = ++previewRequestId;
  loading.value = true;
  error.value = '';
  empty.value = false;
  stats.value = undefined;
  diagnostics.value = [];

  try {
    let result: any;
    if (draft.value?.name === projectName) {
      const canUseDraftPayload = draftPayloadAvailable && draft.value.target === nextTarget;
      result = canUseDraftPayload
        ? {
          body: draft.value.body,
          stats: draft.value.stats,
          warnings: draft.value.warnings,
          errors: draft.value.errors,
          error: draft.value.error,
        }
        : await configStore.preview(draft.value.project, draft.value.ruleSets, nextTarget);
      if (canUseDraftPayload) draftPayloadAvailable = false;
    } else {
      const [project] = await Promise.all([
        configStore.getProject(projectName),
        configStore.fetchRuleSets(),
      ]);
      if (!project) throw new Error('CONFIG_GENERATOR_PROJECT_NOT_FOUND');
      result = await configStore.preview(project, configStore.ruleSets, nextTarget);
    }

    if (requestId !== previewRequestId) return;
    if (result == null) {
      diagnostics.value = normalizeDiagnostics({ errors: configStore.previewErrors });
      throw new Error(configStore.error || 'CONFIG_GENERATOR_PREVIEW_FAILED');
    }
    if (result?.error) {
      diagnostics.value = normalizeDiagnostics(result);
      error.value = String(result.error);
      return;
    }
    applyResult(result, nextTarget);
  } catch (previewError: any) {
    if (requestId !== previewRequestId) return;
    if (!diagnostics.value.length) {
      diagnostics.value = normalizeDiagnostics({
        errors: configStore.previewErrors.length
          ? configStore.previewErrors
          : previewError?.details || previewError?.issues,
      });
    }
    error.value = configStore.error || previewError?.message || 'CONFIG_GENERATOR_PREVIEW_FAILED';
  } finally {
    if (requestId === previewRequestId) loading.value = false;
  }
};

const switchTarget = async (value: PreviewTarget) => {
  if (value === target.value) return;
  target.value = value;
  await router.replace({ query: { ...route.query, target: value } });
  await loadPreview(value);
};

onMounted(() => loadPreview(target.value));
</script>

<style lang="scss" scoped>
.preview-page {
  box-sizing: border-box;
  display: flex;
  height: calc(100dvh - v-bind("navBarHeight") - 16px);
  padding: 10px var(--safe-area-side) calc(v-bind("bottomPadding") + 12px);
}

.preview-workspace {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--divider-color) 82%, transparent);
  border-radius: var(--item-card-radios);
  background: var(--card-color);
  box-shadow: 0 14px 38px rgba(18, 24, 38, 0.045);
}

.preview-header {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 58px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--divider-color);
}

.preview-context {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.preview-eyebrow {
  color: var(--comment-text-color);
  font-size: 11px;
  line-height: 1.2;
}

.preview-project {
  max-width: min(46vw, 380px);
  overflow: hidden;
  color: var(--primary-text-color);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.target-switch {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 3px;
  padding: 3px;
  border-radius: 18px;
  background: var(--divider-color);
}

.target-option {
  display: inline-flex;
  min-height: 30px;
  align-items: center;
  gap: 6px;
  padding: 5px 11px;
  border: 1px solid transparent;
  border-radius: 15px;
  background: transparent;
  color: var(--second-text-color);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;

  &.active {
    border-color: var(--primary-color);
    background: var(--card-color);
    color: var(--primary-color);
  }

  &:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }
}

.target-option-icon {
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  object-fit: contain;
}

.target-label-short {
  display: none;
}

.preview-summary {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  min-height: 48px;
  padding: 7px 16px;
  border-bottom: 1px solid var(--divider-color);
  background: color-mix(in srgb, var(--background-color) 52%, var(--card-color));
}

.preview-state {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
  color: var(--comment-text-color);
  font-size: 12px;
  white-space: nowrap;
}

.state-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--lowest-text-color);
}

.preview-state.is-loading .state-dot {
  background: var(--primary-color);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary-color) 15%, transparent);
  animation: state-pulse 1.4s ease-in-out infinite;
}

.preview-state.is-ready .state-dot {
  background: var(--succeed-color, var(--primary-color));
}

.preview-state.is-error .state-dot {
  background: var(--danger-color);
}

.preview-stats {
  display: flex;
  align-items: stretch;
  margin: 0;
}

.preview-stat {
  display: grid;
  grid-template-columns: auto auto;
  align-items: baseline;
  gap: 4px;
  min-width: 68px;
  padding: 0 12px;
  border-left: 1px solid var(--divider-color);

  &:first-child {
    border-left: 0;
  }

  dt,
  dd {
    margin: 0;
  }

  dd {
    color: var(--primary-text-color);
    font-size: 14px;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  dt {
    color: var(--comment-text-color);
    font-size: 11px;
  }
}

.preview-diagnostics {
  flex: 0 0 auto;
  max-height: 140px;
  overflow: auto;
  padding: 10px 16px;
  border-bottom: 1px solid var(--divider-color);
  background: color-mix(in srgb, var(--warning-color, #d59a26) 8%, var(--card-color));
  color: var(--second-text-color);
  font-size: 12px;
}

.diagnostics-heading {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 7px;
  color: var(--primary-text-color);
  font-weight: 600;
}

.preview-diagnostics ul {
  display: grid;
  gap: 5px;
  margin: 0;
}

.preview-diagnostics li {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.diagnostic-level {
  flex: 0 0 auto;
  color: var(--warning-color, #b87800);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;

  &.is-error {
    color: var(--danger-color);
  }
}

.diagnostic-message {
  overflow-wrap: anywhere;
}

.preview-body {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  background: var(--card-color);
}

.preview-editor {
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 0;
}

.preview-editor :deep(.cmviewRef) {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  border-radius: 0;
  overflow: hidden;
}

.preview-editor :deep(.cm-editor-host) {
  flex: 1 1 auto;
  min-height: 0;
}

.preview-editor :deep(.cm-editor) {
  height: 100%;
}

.preview-status-panel {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  box-sizing: border-box;
  min-height: 310px;
  padding: 40px 24px;
  color: var(--comment-text-color);
  text-align: center;

  h2 {
    margin: 16px 0 7px;
    color: var(--primary-text-color);
    font-size: 16px;
    font-weight: 600;
  }

  p {
    max-width: 440px;
    margin: 0;
    font-size: 13px;
    line-height: 1.55;
    overflow-wrap: anywhere;
  }
}

.preview-spinner {
  width: 25px;
  height: 25px;
  box-sizing: border-box;
  border: 2px solid color-mix(in srgb, var(--primary-color) 18%, transparent);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: preview-spin 0.82s linear infinite;
}

.status-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 13px;
  background: var(--divider-color);
  color: var(--comment-text-color);
  font-size: 18px;
}

.preview-status-panel.is-error .status-icon {
  background: color-mix(in srgb, var(--danger-color) 12%, transparent);
  color: var(--danger-color);
}

.retry-button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 34px;
  margin-top: 18px;
  padding: 7px 14px;
  border: 1px solid var(--divider-color);
  border-radius: 17px;
  background: var(--background-color);
  color: var(--second-text-color);
  font-size: 12px;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }
}

.preview-state-enter-active,
.preview-state-leave-active {
  transition: opacity 140ms ease, transform 140ms ease;
}

.preview-state-enter-from,
.preview-state-leave-to {
  opacity: 0;
  transform: translateY(3px);
}

@keyframes preview-spin {
  to { transform: rotate(360deg); }
}

@keyframes state-pulse {
  50% { opacity: 0.45; }
}

@media (max-width: 560px) {
  .preview-page {
    height: calc(100dvh - v-bind("navBarHeight") - 8px);
    padding-top: 10px;
    padding-bottom: calc(v-bind("bottomPadding") + 8px);
  }

  .preview-header {
    min-height: 62px;
    padding: 9px 12px;
  }

  .preview-project {
    max-width: 32vw;
    font-size: 13px;
  }

  .target-option {
    min-height: 29px;
    gap: 4px;
    padding: 5px 8px;
  }

  .target-option-icon {
    width: 16px;
    height: 16px;
    flex-basis: 16px;
  }

  .target-label-full {
    display: none;
  }

  .target-label-short {
    display: inline;
  }

  .preview-summary {
    gap: 8px;
    padding: 7px 12px;
  }

  .preview-state {
    font-size: 11px;
  }

  .preview-stat {
    display: flex;
    min-width: 0;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 0 8px;

    dd {
      font-size: 13px;
      line-height: 1.15;
    }

    dt {
      font-size: 10px;
      line-height: 1.15;
    }
  }

  .preview-diagnostics {
    padding-right: 12px;
    padding-left: 12px;
  }

  .preview-status-panel {
    min-height: 260px;
    padding: 32px 20px;
  }
}

@media (max-width: 370px) {
  .preview-context {
    display: none;
  }

  .preview-header {
    justify-content: flex-end;
  }

  .preview-summary {
    align-items: flex-start;
    flex-direction: column;
  }

  .preview-stats {
    width: 100%;
    justify-content: space-between;
  }

  .preview-stat {
    flex: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .preview-spinner,
  .preview-state.is-loading .state-dot {
    animation: none;
  }

  .target-option,
  .preview-state-enter-active,
  .preview-state-leave-active {
    transition: none;
  }
}
</style>
