<template>
  <div class="page-wrapper config-generator-import">
    <section class="import-hero">
      <span class="import-hero-icon"><font-awesome-icon icon="fa-solid fa-file-import" /></span>
      <div>
        <span class="import-eyebrow">{{ $t('configGenerator.importEyebrow') }}</span>
        <h2>{{ $t('configGenerator.importPageTitle') }}</h2>
        <p>{{ $t('configGenerator.importPageDescription') }}</p>
      </div>
    </section>

    <section class="import-workflow-card">
      <div class="import-step">
        <div class="import-step-heading">
          <span>1</span>
          <div>
            <strong>{{ $t('configGenerator.chooseImportTarget') }}</strong>
            <small>{{ $t('configGenerator.chooseImportTargetHelp') }}</small>
          </div>
        </div>
        <div class="import-target-grid">
          <button
            v-for="target in CONFIG_GENERATOR_IMPORT_TARGET_DEFINITIONS"
            :key="target.target"
            type="button"
            class="import-target-option"
            :class="{ selected: importType === target.target }"
            @click="setImportType(target.target)"
          >
            <span class="target-app-icon">
              <img :src="target.icon" alt="" aria-hidden="true">
            </span>
            <span><strong>{{ target.displayName }}</strong><small>{{ $t(target.importDescriptionKey) }}</small></span>
            <nut-icon v-if="importType === target.target" name="check-normal" size="14px" />
          </button>
        </div>
      </div>

      <div class="import-step file-step">
        <div class="import-step-heading">
          <span>2</span>
          <div>
            <strong>{{ $t('configGenerator.chooseConfigFile') }}</strong>
            <small>{{ $t('configGenerator.chooseConfigFileHelp', { type: importTypeLabel }) }}</small>
          </div>
        </div>

        <button
          type="button"
          class="upload-file-box"
          :class="{ selected: selectedFileName }"
          :aria-label="$t('configGenerator.uploadFile')"
          @click="openFilePicker"
        >
          <template v-if="selectedFileName">
            <span class="upload-client-icon is-ready">
              <img :src="activeImportTarget.icon" alt="" aria-hidden="true">
              <span class="upload-client-badge"><font-awesome-icon icon="fa-solid fa-check" /></span>
            </span>
            <span class="selected-file-copy">
              <span class="file-ready-label"><font-awesome-icon icon="fa-solid fa-circle-check" />{{ $t('configGenerator.fileReady') }}</span>
              <strong>{{ selectedFileName }}</strong>
              <small>{{ selectedFileMeta }}</small>
            </span>
            <span class="replace-file-action">{{ $t('configGenerator.replaceFile') }}</span>
          </template>
          <template v-else>
            <span class="upload-client-icon">
              <img :src="activeImportTarget.icon" alt="" aria-hidden="true">
              <span class="upload-client-badge"><font-awesome-icon icon="fa-solid fa-arrow-up" /></span>
            </span>
            <strong>{{ $t('configGenerator.chooseFileAction') }}</strong>
            <small>{{ $t('configGenerator.selectConfigFile', { type: importTypeLabel }) }}</small>
            <span class="supported-format-pill">{{ supportedFormats }}</span>
          </template>
        </button>
        <input
          ref="fileInput"
          class="surge-file-input"
          type="file"
          accept=".conf,.ini,.txt,.yaml,.yml,text/plain,text/yaml,application/x-yaml"
          @change="selectFile"
        >
      </div>

      <div class="import-safety-note">
        <font-awesome-icon icon="fa-solid fa-shield-halved" />
        <span>{{ $t('configGenerator.importSafetyNote') }}</span>
      </div>

      <nut-button
        class="parse-file-button"
        type="primary"
        :loading="importing"
        :disabled="!content.trim()"
        @click="runImport"
      >
        <font-awesome-icon v-if="!importing" icon="fa-solid fa-wand-magic-sparkles" />
        {{ $t('configGenerator.parseSelectedFile', { type: importTypeLabel }) }}
      </nut-button>
    </section>

    <p class="import-footnote">{{ $t('configGenerator.importFootnote') }}</p>

    <nut-dialog
      v-model:visible="warningDialogVisible"
      teleport="#app"
      pop-class="config-import-warning-dialog auto-dialog"
      :title="$t('configGenerator.importWarningsTitle')"
      :ok-text="$t('configGenerator.importWarningsContinue')"
      :cancel-text="$t('configGenerator.importWarningsCancel')"
      :close-on-click-overlay="false"
      close-on-popstate
      @ok="confirmImportWithWarnings"
      @cancel="clearPendingImport"
      @closed="clearPendingImport"
    >
      <div class="import-warning-dialog-content">
        <p>{{ $t('configGenerator.importWarningsDescription', { count: importWarnings.length }) }}</p>
        <ul>
          <li v-for="(warning, index) in importWarnings" :key="`${warning.path || 'warning'}-${warning.line || 0}-${index}`">
            <span v-if="warningLocation(warning)" class="warning-location">{{ warningLocation(warning) }}</span>
            <span class="warning-message">{{ warning.message }}</span>
          </li>
        </ul>
      </div>
    </nut-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { Toast } from '@nutui/nutui';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useConfigGeneratorStore } from '@/store/configGenerator';
import { useGlobalStore } from '@/store/global';
import { useSubsStore } from '@/store/subs';
import { useHostAPI } from '@/hooks/useHostAPI';
import {
  CONFIG_GENERATOR_IMPORT_TARGET_DEFINITIONS,
  CONFIG_GENERATOR_TARGET_DEFINITIONS,
  CONFIG_GENERATOR_TARGET_REGISTRY,
  DEFAULT_CONFIG_GENERATOR_TARGET,
} from '@/views/extensions/configGeneratorTargets';

const { t } = useI18n();
const router = useRouter();
const configStore = useConfigGeneratorStore();
const globalStore = useGlobalStore();
const subsStore = useSubsStore();
const { currentUrl } = useHostAPI();
const { bottomSafeArea } = storeToRefs(globalStore);
const padding = computed(() => `${bottomSafeArea.value}px`);
const content = ref('');
const fileInput = ref<HTMLInputElement>();
const selectedFileName = ref('');
const selectedFileSize = ref(0);
const importing = ref(false);
const importType = ref<ConfigGeneratorTarget>(DEFAULT_CONFIG_GENERATOR_TARGET);
type ImportWarning = NonNullable<ConfigImportDraft['warnings']>[number];
type PreparedImport = { project: ConfigProject; ruleSets: RemoteRuleSet[] };
const warningDialogVisible = ref(false);
const importWarnings = ref<ImportWarning[]>([]);
const pendingImport = ref<PreparedImport | null>(null);
const activeImportTarget = computed(() => CONFIG_GENERATOR_TARGET_REGISTRY[importType.value]);
const importTypeLabel = computed(() => activeImportTarget.value.displayName);
const supportedFormats = computed(() => activeImportTarget.value.importFormats);
const selectedFileMeta = computed(() => {
  const size = selectedFileSize.value;
  const formattedSize = size >= 1024 * 1024
    ? `${(size / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(size / 1024))} KB`;
  const extension = selectedFileName.value.split('.').pop()?.toUpperCase() || 'TEXT';
  return `${extension} · ${formattedSize} · ${importTypeLabel.value}`;
});

const createUniqueName = (baseName: string, usedNames: Set<string>) => {
  let name = baseName;
  let suffix = 2;
  while (usedNames.has(name)) {
    name = `${baseName}-${suffix}`;
    suffix += 1;
  }
  return name;
};

const normalizeProjectName = (value: string, fallback: string) => {
  const normalized = value
    .replace(/\.[^.]+$/, '')
    .trim()
    .replace(/[^a-zA-Z\d._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
};

const prepareImport = (draft: ConfigImportDraft) => {
  const fileBaseName = selectedFileName.value.replace(/\.[^.]+$/, '').trim();
  const projectName = createUniqueName(
    normalizeProjectName(fileBaseName, `${importType.value}-config`),
    new Set(configStore.projects.map(project => project.name)),
  );
  const usedRuleSetNames = new Set(configStore.ruleSets.map(ruleSet => ruleSet.name));
  const renamedRuleSets = new Map<string, string>();
  const ruleSets = (draft.ruleSets || []).map((ruleSet, index) => {
    const name = createUniqueName(
      `${projectName}-${normalizeProjectName(ruleSet.name, `rule-set-${index + 1}`)}`,
      usedRuleSetNames,
    );
    usedRuleSetNames.add(name);
    renamedRuleSets.set(ruleSet.name, name);
    return { ...ruleSet, name };
  });
  const outputs = Object.fromEntries(CONFIG_GENERATOR_TARGET_DEFINITIONS.map(target => [
    target.target,
    { ...draft.project.outputs?.[target.target] },
  ])) as ConfigProject['outputs'];
  outputs.surge = {
    includeUnsupportedProxy: false,
    ...outputs.surge,
  };

  return {
    project: {
      ...draft.project,
      name: projectName,
      displayName: fileBaseName || projectName,
      remoteProxySources: draft.project.remoteProxySources || [],
      groups: draft.project.groups || [],
      rules: (draft.project.rules || []).map(rule => rule.kind === 'remote'
        ? { ...rule, ruleSet: renamedRuleSets.get(rule.ruleSet) || rule.ruleSet }
        : rule),
      outputs,
    } as ConfigProject,
    ruleSets,
  };
};

const setImportType = (value: ConfigGeneratorTarget) => { importType.value = value; };
const openFilePicker = () => fileInput.value?.click();
const selectFile = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    content.value = await file.text();
    selectedFileName.value = file.name;
    selectedFileSize.value = file.size;
  } catch (_) {
    Toast.warn(t('configGenerator.fileReadFailed'));
  } finally {
    input.value = '';
  }
};

const sourceContext = async () => {
  if (!subsStore.subs.length && !subsStore.collections.length) await subsStore.fetchSubsData();
  const publicBaseUrl = currentUrl.value || window.location.origin;
  return {
    remoteProxySources: [
      ...subsStore.subs.map(item => ({
        name: item.name,
        source: { kind: 'sub-store', type: 'subscription', name: item.name, publicBaseUrl },
      })),
      ...subsStore.collections.map(item => ({
        name: item.name,
        source: { kind: 'sub-store', type: 'collection', name: item.name, publicBaseUrl },
      })),
    ],
  };
};

const warningLocation = (warning: ImportWarning) => [
  warning.path,
  warning.line ? `:${warning.line}` : '',
].filter(Boolean).join('');

const clearPendingImport = () => {
  pendingImport.value = null;
  importWarnings.value = [];
};

const savePreparedImport = async ({ project, ruleSets }: PreparedImport) => {
  for (const ruleSet of ruleSets) {
    if (!(await configStore.saveRuleSet(ruleSet))) {
      Toast.warn(configStore.error || t('configGenerator.operationFailed'));
      return false;
    }
  }

  if (!(await configStore.saveProject(project))) {
    Toast.warn(configStore.error || t('configGenerator.operationFailed'));
    return false;
  }

  Toast.success(t('configGenerator.saved'));
  await router.replace(`/extensions/config-generator/edit/${encodeURIComponent(project.name)}`);
  return true;
};

const confirmImportWithWarnings = async () => {
  const prepared = pendingImport.value;
  if (!prepared) return;
  warningDialogVisible.value = false;
  importing.value = true;
  try {
    await savePreparedImport(prepared);
  } finally {
    importing.value = false;
    clearPendingImport();
  }
};

const runImport = async () => {
  if (!content.value.trim()) {
    Toast.warn(t('configGenerator.configFileRequired', { type: importTypeLabel.value }));
    return;
  }
  importing.value = true;
  try {
    const availableSources = await sourceContext();
    const draft = await configStore.importConfig(importType.value, content.value, availableSources);
    if (!draft) {
      Toast.warn(configStore.error || t('configGenerator.operationFailed'));
      return;
    }

    const [projectsLoaded, ruleSetsLoaded] = await Promise.all([
      configStore.fetchProjects(),
      configStore.fetchRuleSets(),
    ]);
    if (!projectsLoaded || !ruleSetsLoaded) {
      Toast.warn(configStore.error || t('configGenerator.operationFailed'));
      return;
    }
    const { project, ruleSets } = prepareImport(draft);
    if (draft.warnings?.length) {
      pendingImport.value = { project, ruleSets };
      importWarnings.value = [...draft.warnings];
      warningDialogVisible.value = true;
      return;
    }
    await savePreparedImport({ project, ruleSets });
  } finally {
    importing.value = false;
  }
};
</script>

<style lang="scss" scoped>
.config-generator-import {
  box-sizing: border-box;
  width: 100%;
  display: grid;
  gap: 14px;
  padding: 10px var(--safe-area-side) calc(v-bind(padding) + 28px);
}

.surge-file-input {
  display: none;
}

.import-hero,
.import-workflow-card {
  border: 1px solid var(--divider-color);
  border-radius: var(--item-card-radios);
  background: var(--card-background-color);
}

.import-hero {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 20px;
  overflow: hidden;

  &::after {
    position: absolute;
    top: -42px;
    right: -30px;
    width: 150px;
    height: 150px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--primary-color) 8%, transparent);
    content: '';
    pointer-events: none;
  }

  h2,
  p {
    margin: 0;
  }

  h2 {
    margin-top: 4px;
    color: var(--primary-text-color);
    font-size: 20px;
    line-height: 1.3;
  }

  p {
    max-width: 640px;
    margin-top: 7px;
    color: var(--comment-text-color);
    font-size: 12px;
    line-height: 1.6;
  }
}

.import-hero-icon {
  position: relative;
  z-index: 1;
  display: inline-flex;
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: color-mix(in srgb, var(--primary-color) 12%, transparent);
  color: var(--primary-color);
  font-size: 18px;
}

.import-eyebrow {
  color: var(--primary-color);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: .1em;
  text-transform: uppercase;
}

.import-workflow-card {
  display: grid;
  gap: 18px;
  padding: 18px;
}

.import-step {
  display: grid;
  gap: 12px;
}

.import-step-heading {
  display: flex;
  align-items: flex-start;
  gap: 10px;

  > span {
    display: inline-flex;
    width: 24px;
    height: 24px;
    flex: 0 0 24px;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: color-mix(in srgb, var(--primary-color) 12%, transparent);
    color: var(--primary-color);
    font-size: 11px;
    font-weight: 650;
  }

  > div {
    display: grid;
    gap: 3px;
  }

  strong {
    color: var(--primary-text-color);
    font-size: 13px;
    line-height: 1.4;
  }

  small {
    color: var(--comment-text-color);
    font-size: 11px;
    line-height: 1.5;
  }
}

.import-target-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.import-target-option {
  display: flex;
  min-width: 0;
  min-height: 70px;
  align-items: center;
  gap: 10px;
  padding: 11px;
  border: 1px solid var(--divider-color);
  border-radius: 12px;
  background: var(--background-color);
  color: var(--primary-text-color);
  text-align: left;
  cursor: pointer;
  transition: border-color .18s ease, background-color .18s ease, transform .18s ease;

  &:active {
    transform: scale(.99);
  }

  &.selected {
    border-color: color-mix(in srgb, var(--primary-color) 50%, var(--divider-color));
    background: color-mix(in srgb, var(--primary-color) 7%, var(--background-color));
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
    font-size: 10px;
    line-height: 1.4;
  }

  > .nut-icon {
    flex: 0 0 auto;
    color: var(--primary-color);
  }
}

.target-app-icon {
  display: inline-flex;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--divider-color) 82%, transparent);
  border-radius: 12px;
  background: var(--card-background-color);
  box-shadow: 0 4px 12px rgba(18, 24, 38, 0.05);

  img {
    width: 34px;
    height: 34px;
    object-fit: contain;
  }
}

.file-step {
  padding-top: 17px;
  border-top: 1px solid var(--divider-color);
}

.upload-file-box {
  display: flex;
  width: 100%;
  min-height: 156px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 18px;
  border: 1px dashed var(--divider-color);
  border-radius: 14px;
  background: color-mix(in srgb, var(--primary-color) 2.5%, var(--background-color));
  color: var(--secondary-text-color);
  text-align: center;
  cursor: pointer;
  transition: border-color .18s ease, background-color .18s ease;

  &:hover,
  &.selected {
    border-color: color-mix(in srgb, var(--primary-color) 52%, var(--divider-color));
    background: color-mix(in srgb, var(--primary-color) 6%, var(--background-color));
  }

  > strong {
    color: var(--primary-text-color);
    font-size: 13px;
  }

  > small {
    max-width: 100%;
    color: var(--comment-text-color);
    font-size: 11px;
    line-height: 1.5;
  }

  &.selected {
    min-height: 94px;
    flex-direction: row;
    justify-content: flex-start;
    text-align: left;
  }
}

.upload-client-icon {
  position: relative;
  display: inline-flex;
  width: 52px;
  height: 52px;
  flex: 0 0 52px;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--divider-color) 82%, transparent);
  border-radius: 16px;
  background: var(--card-background-color);
  box-shadow: 0 8px 20px rgba(18, 24, 38, 0.065);

  img {
    width: 44px;
    height: 44px;
    object-fit: contain;
  }

  &.is-ready .upload-client-badge {
    background: #168056;
  }
}

.upload-client-badge {
  position: absolute;
  right: -4px;
  bottom: -3px;
  display: inline-flex;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--background-color);
  border-radius: 50%;
  background: var(--primary-color);
  color: #fff;
  font-size: 9px;
}

.supported-format-pill {
  padding: 4px 9px;
  border-radius: 8px;
  background: var(--divider-color);
  color: var(--comment-text-color);
  font-size: 9px;
  letter-spacing: .04em;
}

.selected-file-copy {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 3px;

  strong,
  small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: var(--primary-text-color);
    font-size: 13px;
  }

  small {
    color: var(--comment-text-color);
    font-size: 10px;
  }
}

.file-ready-label {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #168056;
  font-size: 10px;
  font-weight: 600;
}

.replace-file-action {
  flex: 0 0 auto;
  color: var(--primary-color);
  font-size: 11px;
  font-weight: 550;
}

.import-safety-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, #22a06b 25%, transparent);
  border-radius: 11px;
  background: color-mix(in srgb, #22a06b 6%, var(--card-background-color));
  color: var(--secondary-text-color);
  font-size: 11px;
  line-height: 1.5;

  svg {
    flex: 0 0 auto;
    margin-top: 2px;
    color: #168056;
  }
}

.parse-file-button {
  width: 100%;
  min-height: 44px;
  border-radius: 11px;

  svg {
    margin-right: 6px;
  }
}

.import-footnote {
  padding: 0 5px;
  margin: -2px 0 0;
  color: var(--comment-text-color);
  font-size: 10px;
  line-height: 1.5;
  text-align: center;
}

@media (max-width: 560px) {
  .import-hero {
    padding: 16px;

    h2 {
      font-size: 18px;
    }
  }

  .import-hero-icon {
    width: 40px;
    height: 40px;
    flex-basis: 40px;
  }

  .import-workflow-card {
    gap: 16px;
    padding: 14px;
  }

  .import-target-grid {
    grid-template-columns: 1fr;
  }

  .import-target-option {
    min-height: 64px;
  }

  .upload-file-box.selected {
    align-items: flex-start;
  }

  .replace-file-action {
    align-self: center;
  }
}

@media (min-width: 561px) and (max-width: 820px) {
  .import-target-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 380px) {
  .import-hero {
    gap: 10px;
  }

  .upload-file-box.selected {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
  }

  .replace-file-action {
    grid-column: 2;
    justify-self: start;
  }
}

:global(.config-import-warning-dialog) {
  width: min(440px, calc(100vw - 32px)) !important;
}

:global(.config-import-warning-dialog > .nut-dialog) {
  width: 100%;
}

.import-warning-dialog-content {
  display: grid;
  gap: 12px;
  color: var(--secondary-text-color);
  text-align: left;

  p {
    margin: 0;
    font-size: 13px;
    line-height: 1.55;
  }

  ul {
    display: grid;
    max-height: min(46vh, 360px);
    gap: 8px;
    padding: 0;
    margin: 0;
    overflow-y: auto;
    list-style: none;
  }

  li {
    display: grid;
    gap: 4px;
    padding: 10px 12px;
    border: 1px solid color-mix(in srgb, var(--warning-color, #e6a23c) 30%, transparent);
    border-radius: 8px;
    background: color-mix(in srgb, var(--warning-color, #e6a23c) 8%, var(--card-background-color));
  }
}

.warning-location {
  color: var(--comment-text-color);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  overflow-wrap: anywhere;
}

.warning-message {
  color: var(--primary-text-color);
  font-size: 13px;
  line-height: 1.5;
  overflow-wrap: break-word;
  word-break: normal;
}

</style>
