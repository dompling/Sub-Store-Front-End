<template>
  <div class="config-generator-action-form-wrapper">
    <nut-form v-if="group" class="form config-generator-action-form" :model-value="context.form">
      <nut-form-item :label="$t('configGenerator.fields.groupName')">
        <nut-input
          v-model.trim="group.name"
          :border="false"
          input-align="right"
          class="nut-input-text"
          :placeholder="$t('configGenerator.placeholders.groupName')"
          @blur="context.refreshGroupActionTitle(group)"
        />
      </nut-form-item>

      <nut-form-item :label="$t('configGenerator.fields.groupType')">
        <button type="button" class="selection-trigger" @click="openGroupTypePicker">
          <span class="selection-trigger-copy">
            <strong>{{ currentGroupTypeLabel }}</strong>
          </span>
          <nut-icon name="rect-right" size="13px" />
        </button>
      </nut-form-item>

      <nut-form-item :label="$t('configGenerator.fields.targetMapping')">
        <span class="target-mapping-text">{{ targetMappingText }}</span>
      </nut-form-item>

      <nut-form-item v-if="hasLegacyRemoteSourceConflict" :label="$t('configGenerator.fields.remoteProxySource')">
        <span class="target-mapping-text is-warning">{{ $t('configGenerator.remoteSourceConflict') }}</span>
      </nut-form-item>

      <template v-if="supportsPolicySources">
        <nut-form-item v-if="supportsRemotePolicySource" :label="$t('configGenerator.fields.remoteProxySource')">
          <nut-input
            :model-value="remoteSourceDisplay"
            :border="false"
            input-align="right"
            class="nut-input-text picker-input"
            readonly
            right-icon="rect-right"
            :placeholder="$t('configGenerator.noRemoteProxySource')"
            @click="openRemoteSourcePicker"
            @click-right-icon="openRemoteSourcePicker"
          />
        </nut-form-item>

        <nut-form-item v-if="supportsRemotePolicySource && showPolicyUpdateInterval" :label="$t('configGenerator.policyUpdateInterval')">
          <nut-input
            :model-value="context.policyUpdateInterval(group)"
            :border="false"
            type="number"
            input-align="right"
            class="nut-input-text"
            :placeholder="$t('configGenerator.policyUpdateIntervalPlaceholder')"
            @update:model-value="context.setPolicyUpdateInterval(group, $event)"
          />
        </nut-form-item>

        <nut-form-item v-if="hasPolicyGroupMembers" :label="$t('configGenerator.fields.members')">
          <div class="policy-chip-list">
            <button
              v-for="option in policyMemberOptions"
              :key="option"
              type="button"
              class="policy-chip"
              :class="{ selected: selectedPolicyMembers.includes(option) }"
              @click="toggleInlinePolicySelection('members', option)"
            >
              <nut-icon v-if="selectedPolicyMembers.includes(option)" name="check-normal" size="12px" />
              {{ option }}
            </button>
          </div>
        </nut-form-item>

        <nut-form-item v-if="hasPolicyGroupMembers" :label="$t('configGenerator.fields.proxyMembers')">
          <nut-input
            v-model="proxyMembersDraft"
            :border="false"
            input-align="right"
            class="nut-input-text"
            :placeholder="$t('configGenerator.placeholders.proxyMembers')"
            @blur="commitProxyMembers"
            @keyup.enter="commitProxyMembers"
          />
        </nut-form-item>

        <nut-form-item v-if="supportsSurgeMembershipOptions" :label="$t('configGenerator.fields.includeAllProxies')" class="switch-form-item">
          <div class="switch-wrapper">
            <nut-switch
              :model-value="Boolean(group.includeAllProxies)"
              @update:model-value="context.setIncludeAllProxies(group, $event)"
            />
          </div>
        </nut-form-item>

        <nut-form-item v-if="supportsSurgeMembershipOptions" class="include-groups-form-item">
          <template #label>
            <span class="field-label-with-help">
              {{ $t('configGenerator.fields.includeOtherGroups') }}
              <button
                type="button"
                class="field-help-button"
                :aria-label="$t('configGenerator.includeOtherGroupsFallbackHelp')"
                :title="$t('configGenerator.includeOtherGroupsFallbackHelp')"
                @click.stop="openIncludeOtherGroupsTips"
              >
                <font-awesome-icon icon="fa-solid fa-circle-question" />
              </button>
            </span>
          </template>
          <div class="include-groups-field">
            <div class="policy-chip-list">
              <button
                v-for="option in availablePolicyGroups"
                :key="option"
                type="button"
                class="policy-chip"
                :class="{ selected: includedPolicyGroups.includes(option) }"
                @click="toggleInlinePolicySelection('include', option)"
              >
                <nut-icon v-if="includedPolicyGroups.includes(option)" name="check-normal" size="12px" />
                {{ option }}
              </button>
              <span v-if="!availablePolicyGroups.length" class="empty-select-hint">
                {{ $t('configGenerator.noAvailablePolicyGroups') }}
              </span>
            </div>
          </div>
        </nut-form-item>

        <nut-form-item v-if="supportsNodeFilter" :label="$t('configGenerator.fields.nodeNameRegex')">
          <nut-input
            v-model.trim="group.nodeNameRegex"
            :border="false"
            input-align="right"
            class="nut-input-text"
            :placeholder="$t('configGenerator.placeholders.nodeNameRegex')"
          />
        </nut-form-item>
      </template>

      <template v-if="showsSurgeHealthCheck">
        <nut-form-item :label="$t('configGenerator.fields.testUrl')">
          <nut-input
            v-model.trim="group.testUrl"
            :border="false"
            input-align="right"
            class="nut-input-text"
            :placeholder="$t('configGenerator.placeholders.testUrl')"
          />
        </nut-form-item>

        <nut-form-item :label="$t('configGenerator.fields.testInterval')">
          <nut-input
            :model-value="context.groupNumber(group, 'interval')"
            :border="false"
            type="number"
            input-align="right"
            class="nut-input-text"
            :placeholder="$t('configGenerator.placeholders.testInterval')"
            @update:model-value="context.setGroupNumber(group, 'interval', $event)"
          />
        </nut-form-item>

        <nut-form-item :label="$t('configGenerator.fields.timeout')">
          <nut-input
            :model-value="context.groupNumber(group, 'timeout')"
            :border="false"
            type="number"
            input-align="right"
            class="nut-input-text"
            :placeholder="$t('configGenerator.placeholders.timeout')"
            @update:model-value="context.setGroupNumber(group, 'timeout', $event)"
          />
        </nut-form-item>
      </template>

      <template v-if="isUrlTestGroup">
        <nut-form-item :label="$t('configGenerator.fields.tolerance')">
          <nut-input
            :model-value="context.groupNumber(group, 'tolerance')"
            :border="false"
            type="number"
            input-align="right"
            class="nut-input-text"
            :placeholder="$t('configGenerator.placeholders.tolerance')"
            @update:model-value="context.setGroupNumber(group, 'tolerance', $event)"
          />
        </nut-form-item>

        <nut-form-item :label="$t('configGenerator.fields.evaluateBeforeUse')" class="switch-form-item">
          <div class="switch-wrapper">
            <nut-switch
              :model-value="context.getSurgeBoolean(group, 'evaluateBeforeUse')"
              @update:model-value="context.setSurgeBoolean(group, 'evaluateBeforeUse', $event)"
            />
          </div>
        </nut-form-item>

        <nut-form-item :label="$t('configGenerator.fields.aliveChecking')" class="switch-form-item">
          <div class="switch-wrapper">
            <nut-switch
              :model-value="context.getQxBoolean(group, 'aliveChecking')"
              @update:model-value="context.setQxBoolean(group, 'aliveChecking', $event)"
            />
          </div>
        </nut-form-item>
      </template>

      <nut-form-item v-if="isLoadBalanceGroup" :label="$t('configGenerator.fields.persistent')" class="switch-form-item">
        <div class="switch-wrapper">
          <nut-switch
            :model-value="surgePersistentValue"
            @update:model-value="context.setSurgeBoolean(group, 'persistent', $event)"
          />
        </div>
      </nut-form-item>

      <nut-form-item v-if="isLoonLoadBalanceGroup" :label="$t('configGenerator.loonLoadBalanceAlgorithm')">
        <nut-input
          :model-value="loonAlgorithmDisplay"
          :border="false"
          input-align="right"
          class="nut-input-text picker-input"
          readonly
          right-icon="rect-right"
          @click="openLoonAlgorithmPicker"
          @click-right-icon="openLoonAlgorithmPicker"
        />
      </nut-form-item>

      <template v-if="isSubnetGroup">
        <nut-form-item :label="$t('configGenerator.fields.subnetDefault')">
          <button type="button" class="selection-trigger" @click="openPolicySelection">
            <span class="selection-trigger-copy">
              <strong>{{ context.subnetDefault(group) }}</strong>
              <small>{{ $t('configGenerator.selectionTapToChange') }}</small>
            </span>
            <nut-icon name="rect-right" size="13px" />
          </button>
        </nut-form-item>

        <nut-form-item :label="$t('configGenerator.fields.subnetRules')">
          <nut-textarea
            :model-value="context.subnetRulesText(group)"
            :border="false"
            input-align="right"
            class="nut-input-text"
            rows="2"
            :autosize="{ maxHeight: 150 }"
            :placeholder="$t('configGenerator.placeholders.subnetRules')"
            @update:model-value="context.setSubnetRulesText(group, $event)"
          />
        </nut-form-item>
      </template>

      <nut-form-item :label="$t('configGenerator.iconUrl')" class="icon-url-form-item">
        <div class="icon-url-field">
          <nut-input
            :model-value="groupIconUrl"
            :border="false"
            input-align="right"
            class="nut-input-text"
            :placeholder="$t('configGenerator.iconUrlPlaceholder')"
            @update:model-value="context.setGroupIconUrl(group, $event)"
          />
          <button
            type="button"
            class="icon-repository-button"
            :aria-label="$t('configGenerator.chooseFromIconRepository')"
            @click="iconPopupVisible = true"
          >
            <img v-if="groupIconUrl" :src="groupIconUrl" alt="">
            <font-awesome-icon v-else icon="fa-solid fa-icons" />
          </button>
        </div>
      </nut-form-item>

      <nut-form-item v-if="supportsSurgeTarget" :label="$t('configGenerator.fields.hidden')" class="switch-form-item">
        <div class="switch-wrapper">
          <nut-switch
            :model-value="context.getSurgeBoolean(group, 'hidden')"
            @update:model-value="context.setSurgeBoolean(group, 'hidden', $event)"
          />
        </div>
      </nut-form-item>

      <nut-form-item v-if="supportsSurgeTarget" :label="$t('configGenerator.fields.noAlert')" class="switch-form-item">
        <div class="switch-wrapper">
          <nut-switch
            :model-value="context.getSurgeBoolean(group, 'noAlert')"
            @update:model-value="context.setSurgeBoolean(group, 'noAlert', $event)"
          />
        </div>
      </nut-form-item>
    </nut-form>

    <nut-picker
      v-model:visible="remoteSourcePickerVisible"
      v-model="remoteSourcePickerModel"
      :columns="remoteSourceColumns"
      @confirm="confirmRemoteSource"
    />

    <nut-picker
      v-model:visible="loonAlgorithmPickerVisible"
      v-model="loonAlgorithmPickerModel"
      :columns="loonAlgorithmColumns"
      @confirm="confirmLoonAlgorithm"
    />

    <nut-popup
      v-model:visible="groupTypePickerVisible"
      pop-class="config-selection-popup"
      position="bottom"
      :style="selectionPopupStyle"
      :lock-scroll="true"
      :safe-area-inset-bottom="true"
      close-icon="close-little"
      closeable
      round
      z-index="10500"
    >
      <div class="selection-sheet">
        <div class="selection-sheet-header">
          <span class="selection-sheet-kicker">{{ $t('configGenerator.group') }}</span>
          <h3>{{ $t('configGenerator.selectGroupType') }}</h3>
          <p>{{ $t('configGenerator.groupTypeFallbackHelp') }}</p>
        </div>
        <div class="group-type-list">
          <section v-for="section in groupTypeSections" :key="section.key" class="group-type-section">
            <h4>{{ section.label }}</h4>
            <button
              v-for="option in section.options"
              :key="option.value"
              type="button"
              class="group-type-option"
              :class="{ selected: option.value === group.type }"
              @click="selectGroupType(option.value)"
            >
              <span class="group-type-option-main">
                <strong>{{ option.label }}</strong>
                <small>{{ option.description }}</small>
                <span class="support-badges">
                  <span
                    v-for="target in targetIds"
                    :key="target"
                    class="support-badge"
                    :class="option.support[target].level"
                  >
                    {{ supportBadgeText(target, option.support[target]) }}
                  </span>
                </span>
              </span>
              <nut-icon :name="option.value === group.type ? 'check-normal' : 'rect-right'" size="14px" />
            </button>
          </section>
        </div>
      </div>
    </nut-popup>

    <nut-popup
      v-model:visible="policySelectionVisible"
      pop-class="config-selection-popup"
      position="bottom"
      :style="selectionPopupStyle"
      :lock-scroll="true"
      :safe-area-inset-bottom="true"
      close-icon="close-little"
      closeable
      round
      z-index="10500"
    >
      <div class="selection-sheet policy-selection-sheet">
        <div class="selection-sheet-header">
          <span class="selection-sheet-kicker">{{ group.name || $t('configGenerator.group') }}</span>
          <h3>{{ policySelectionTitle }}</h3>
          <p>{{ policySelectionDescription }}</p>
        </div>
        <div class="policy-search">
          <font-awesome-icon icon="fa-solid fa-magnifying-glass" />
          <input v-model.trim="policySearch" type="search" :placeholder="$t('configGenerator.searchPolicyGroups')">
        </div>
        <div v-if="filteredPolicyOptions.length" class="policy-option-list">
          <button
            v-for="option in filteredPolicyOptions"
            :key="option"
            type="button"
            class="policy-option"
            :class="{ selected: policySelectionDraft.includes(option) }"
            @click="togglePolicyOption(option)"
          >
            <span class="policy-option-marker">
              <nut-icon v-if="policySelectionDraft.includes(option)" name="check-normal" size="13px" />
            </span>
            <span>{{ option }}</span>
          </button>
        </div>
        <div v-else class="policy-empty-state">
          <font-awesome-icon icon="fa-solid fa-layer-group" />
          <strong>{{ $t('configGenerator.noAvailablePolicyGroups') }}</strong>
          <span>{{ $t('configGenerator.noAvailablePolicyGroupsHelp') }}</span>
        </div>
        <div class="selection-sheet-footer">
          <button type="button" class="selection-secondary" @click="clearPolicySelection">
            {{ $t('configGenerator.clearSelection') }}
          </button>
          <nut-button type="primary" class="selection-confirm" @click="confirmPolicySelection">
            {{ $t('specificWord.confirm') }} · {{ policySelectionDraft.length }}
          </nut-button>
        </div>
      </div>
    </nut-popup>

    <IconPopup
      v-if="iconPopupVisible"
      v-model:visible="iconPopupVisible"
      @setIcon="setIconFromRepository"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue';
import { Dialog } from '@nutui/nutui';
import { useI18n } from 'vue-i18n';
import IconPopup from '@/views/icon/IconPopup.vue';
import {
  POLICY_GROUP_TYPE_DEFINITIONS,
  policyGroupTypeDefinition,
  type PolicyGroupSupportLevel,
} from './policyGroupCapabilities';
import {
  CONFIG_GENERATOR_TARGET_REGISTRY,
  CONFIG_GENERATOR_TARGETS,
} from '@/views/extensions/configGeneratorTargets';

defineOptions({ inheritAttrs: false });

const { t } = useI18n();
const { id } = defineProps<{ id: string; type?: string; sourceType?: string }>();
const context = inject<any>('configGeneratorActionContext');

const group = computed(() => context?.groupByActionId?.(id));
const targetIds = CONFIG_GENERATOR_TARGETS;
const selectionPopupStyle = {
  height: 'min(82%, 720px)',
  padding: '18px 14px 0',
  backgroundColor: 'var(--background-color)',
};
const sectionOrder = ['portable', 'surge', 'qx', 'loon'] as const;
const sectionLabel = (section: typeof sectionOrder[number]) => ({
  portable: t('configGenerator.groupCapabilities.portable'),
  surge: t('configGenerator.groupCapabilities.surgeOnly'),
  qx: t('configGenerator.groupCapabilities.qxOnly'),
  loon: t('configGenerator.groupCapabilities.loonOnly'),
}[section]);
const groupTypeSections = computed(() => sectionOrder
  .map(section => ({
    key: section,
    label: sectionLabel(section),
    options: POLICY_GROUP_TYPE_DEFINITIONS
      .filter(option => option.section === section)
      .map(option => ({
        ...option,
        label: t(`configGenerator.groupTypes.${option.labelKey}`),
        description: t(`configGenerator.policyMappings.${option.labelKey}`),
      })),
  }))
  .filter(section => section.options.length));
const currentGroupType = computed(() => policyGroupTypeDefinition(group.value?.type));
const currentGroupTypeLabel = computed(() => currentGroupType.value
  ? t(`configGenerator.groupTypes.${currentGroupType.value.labelKey}`)
  : t('configGenerator.selectGroupType'));
const supportsSurgeTarget = computed(() => currentGroupType.value?.support.surge.level !== 'unsupported');
const supportsPolicySources = computed(() => group.value?.type !== 'subnet');
const supportsRemotePolicySource = computed(() => supportsPolicySources.value && group.value?.type !== 'ssid');
const supportsSurgeMembershipOptions = computed(() => supportsPolicySources.value && supportsSurgeTarget.value);
const supportsNodeFilter = computed(() => supportsPolicySources.value && group.value?.type !== 'ssid');
const showsSurgeHealthCheck = computed(() => supportsSurgeTarget.value
  && ['url-test', 'fallback', 'load-balance'].includes(group.value?.type));
const isUrlTestGroup = computed(() => group.value?.type === 'url-test');
const isLoadBalanceGroup = computed(() => currentGroupType.value?.support.surge.output === 'load-balance');
const isLoonLoadBalanceGroup = computed(() => currentGroupType.value?.support.loon.output === 'load-balance');
const isSubnetGroup = computed(() => group.value?.type === 'subnet');
const targetMappingText = computed(() => currentGroupType.value
  ? t(`configGenerator.policyMappings.${currentGroupType.value.labelKey}`)
  : '');
const hasLegacyRemoteSourceConflict = computed(() => Boolean(
  group.value && context?.hasLegacyRemoteSourceConflict?.(group.value),
));
const groupTypePickerVisible = ref(false);
const remoteSourcePickerVisible = ref(false);
const remoteSourcePickerModel = ref<string[]>([]);
const loonAlgorithmPickerVisible = ref(false);
const loonAlgorithmPickerModel = ref<string[]>([]);
const targetDisplayName = (target?: ConfigGeneratorTarget) => target
  ? CONFIG_GENERATOR_TARGET_REGISTRY[target].displayName
  : '?';
const remoteProxySourceOptions = computed(() => (context?.form?.remoteProxySources || [])
  .filter((source: any) => source.enabled !== false && source.name?.trim()));
const remoteSourceColumns = computed(() => [
  { text: t('configGenerator.noRemoteProxySource'), value: '' },
  ...remoteProxySourceOptions.value.map((source: any) => {
    const target = source.source?.kind === 'url'
      ? targetDisplayName(source.source.target)
      : 'Sub-Store';
    return { text: `${source.name} · ${target}`, value: source.name };
  }),
]);
const remoteSourceDisplay = computed(() => context?.groupRemoteSource?.(group.value) || '');
const automaticLoonAlgorithm = computed(() => {
  if (group.value?.type === 'round-robin') return 'Round-Robin';
  if (group.value?.type === 'dest-hash') return 'PCC';
  return t('configGenerator.loonAlgorithmNativeDefault');
});
const loonAlgorithmColumns = computed(() => [
  {
    text: t('configGenerator.loonAlgorithmAutomatic', { value: automaticLoonAlgorithm.value }),
    value: '',
  },
  { text: 'Random', value: 'Random' },
  { text: 'PCC', value: 'PCC' },
  { text: 'Round-Robin', value: 'Round-Robin' },
]);
const loonAlgorithmDisplay = computed(() => {
  const value = context?.loonAlgorithm?.(group.value) || '';
  return loonAlgorithmColumns.value.find(option => option.value === value)?.text
    || loonAlgorithmColumns.value[0].text;
});
const hasPolicyGroupMembers = computed(() => supportsPolicySources.value);
const showPolicyUpdateInterval = computed(() => Boolean(remoteSourceDisplay.value)
  || group.value?.policyUpdateInterval !== undefined
  || group.value?.type === 'smart');
const includedPolicyGroups = computed<string[]>(() => group.value?.includeOtherGroups || []);
const availablePolicyGroups = computed<string[]>(() => context?.availableGroupMembers?.(group.value) || []);
const policyMemberOptions = computed<string[]>(() => context?.availablePolicyMembers?.(group.value) || ['DIRECT', 'REJECT']);
const selectedPolicyMembers = computed<string[]>(() => context?.selectedPolicyMembers?.(group.value) || []);
const proxyMembersValue = computed(() => group.value ? context?.proxyMembersText?.(group.value) || '' : '');
const proxyMembersDraft = ref('');
const groupIconUrl = computed(() => context?.groupIconUrl?.(group.value) || '');
const iconPopupVisible = ref(false);
const surgePersistentValue = computed(() => {
  const explicitValue = group.value?.targetOptions?.surge?.persistent;
  if (explicitValue !== undefined) return Boolean(explicitValue);
  return Boolean(currentGroupType.value?.value === 'dest-hash');
});

const policySelectionVisible = ref(false);
const policySelectionMode = ref<'subnet'>('subnet');
const policySelectionDraft = ref<string[]>([]);
const policySearch = ref('');
const policySelectionOptions = computed<string[]>(() => ['DIRECT', 'REJECT', ...availablePolicyGroups.value]);
const filteredPolicyOptions = computed(() => {
  const keyword = policySearch.value.trim().toLowerCase();
  if (!keyword) return policySelectionOptions.value;
  return policySelectionOptions.value.filter(option => option.toLowerCase().includes(keyword));
});
const policySelectionTitle = computed(() => t('configGenerator.selectSubnetDefault'));
const policySelectionDescription = computed(() => t('configGenerator.selectSubnetDefaultHelp'));

const supportBadgeText = (
  target: ConfigGeneratorTarget,
  support: { level: PolicyGroupSupportLevel; output?: string },
) => {
  const targetLabel = CONFIG_GENERATOR_TARGET_REGISTRY[target].shortName;
  const levelLabel = t(`configGenerator.supportLevels.${support.level}`);
  return `${targetLabel} · ${levelLabel}${support.output ? ` ${support.output}` : ''}`;
};
const openGroupTypePicker = () => { groupTypePickerVisible.value = true; };
const openIncludeOtherGroupsTips = () => {
  Dialog({
    title: t('configGenerator.fields.includeOtherGroups'),
    content: t('configGenerator.includeOtherGroupsFallbackHelp'),
    popClass: 'auto-dialog',
    textAlign: 'left',
    noCancelBtn: true,
    okText: t('specificWord.confirm'),
    closeOnClickOverlay: true,
    closeOnPopstate: true,
  });
};
const selectGroupType = (value: PolicyGroup['type']) => {
  context?.updateGroupType?.(group.value, value);
  groupTypePickerVisible.value = false;
};
const openRemoteSourcePicker = () => {
  remoteSourcePickerModel.value = [remoteSourceDisplay.value];
  remoteSourcePickerVisible.value = true;
};
const confirmRemoteSource = ({ selectedValue }: any) => {
  context?.setGroupRemoteSource?.(group.value, selectedValue?.[0] || '');
};
const openLoonAlgorithmPicker = () => {
  loonAlgorithmPickerModel.value = [context?.loonAlgorithm?.(group.value) || ''];
  loonAlgorithmPickerVisible.value = true;
};
const confirmLoonAlgorithm = ({ selectedValue }: any) => {
  context?.setLoonAlgorithm?.(group.value, selectedValue?.[0] || '');
};
const toggleInlinePolicySelection = (mode: 'members' | 'include', option: string) => {
  const current = mode === 'members' ? selectedPolicyMembers.value : includedPolicyGroups.value;
  const next = new Set(current);
  if (next.has(option)) next.delete(option);
  else next.add(option);
  if (mode === 'members') context?.setSelectedPolicyMembers?.(group.value, [...next]);
  else context?.setIncludeOtherGroups?.(group.value, [...next]);
};
const commitProxyMembers = () => {
  if (group.value) context?.setProxyMembersText?.(group.value, proxyMembersDraft.value);
};
const openPolicySelection = () => {
  policySearch.value = '';
  policySelectionDraft.value = [context?.subnetDefault?.(group.value) || 'DIRECT'];
  policySelectionVisible.value = true;
};
const togglePolicyOption = (option: string) => {
  policySelectionDraft.value = [option];
};
const clearPolicySelection = () => { policySelectionDraft.value = ['DIRECT']; };
const confirmPolicySelection = () => {
  context?.setSubnetDefault?.(group.value, policySelectionDraft.value[0] || 'DIRECT');
  policySelectionVisible.value = false;
};
const setIconFromRepository = (icon: { url?: string | null }) => {
  context?.setGroupIconUrl?.(group.value, icon?.url || '');
  iconPopupVisible.value = false;
};

watch(proxyMembersValue, (value) => {
  proxyMembersDraft.value = value;
}, { immediate: true });

</script>

<style lang="scss" scoped>
.config-generator-action-form {
  width: 100%;

  :deep(.nut-form-item__label) {
    width: auto;
  }

  :deep(.nut-form-item__body) {
    justify-content: flex-end;
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

.selection-trigger {
  display: flex;
  width: min(100%, 440px);
  min-width: 0;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--primary-text-color);
  text-align: right;
  cursor: pointer;

  .nut-icon {
    flex: 0 0 auto;
    color: var(--lowest-text-color);
  }
}

.selection-trigger-copy {
  display: grid;
  min-width: 0;
  gap: 3px;

  strong,
  small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    font-size: 13px;
    font-weight: 500;
  }

  small {
    color: var(--comment-text-color);
    font-size: 11px;
  }
}

.policy-chip-list {
  display: flex;
  width: min(100%, 620px);
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.include-groups-field {
  display: flex;
  width: min(100%, 620px);
  margin-left: auto;
  justify-content: flex-end;
}

.include-groups-form-item {
  :deep(.nut-form-item__body) {
    margin-left: auto;
  }
}

.field-label-with-help {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.field-help-button {
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

.policy-chip {
  display: inline-flex;
  min-height: 30px;
  align-items: center;
  gap: 4px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: var(--divider-color);
  color: var(--second-text-color);
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
  cursor: pointer;

  &.selected {
    border-color: color-mix(in srgb, var(--primary-color) 40%, var(--divider-color));
    background: color-mix(in srgb, var(--primary-color) 13%, var(--divider-color));
    color: var(--primary-color);
  }
}

.selection-count {
  display: inline-flex;
  min-width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  padding: 0 7px;
  border-radius: 11px;
  background: color-mix(in srgb, var(--primary-color) 14%, transparent);
  color: var(--primary-color);
  font-size: 11px;
  font-weight: 600;
}

.target-mapping-text {
  max-width: min(100%, 440px);
  color: var(--comment-text-color);
  font-size: 12px;
  line-height: 1.5;
  text-align: right;

  &.is-warning {
    color: var(--warning-color, #d97706);
  }
}

.icon-url-field {
  display: flex;
  width: min(100%, 620px);
  min-width: 0;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-left: auto;

  :deep(.nut-input-text) {
    min-width: 0;
    flex: 1 1 auto;
  }
}

.icon-url-form-item {
  :deep(.nut-form-item__label),
  :deep(.nut-form-item__body),
  :deep(.nut-form-item__body__slots) {
    align-items: center;
  }

  :deep(.nut-form-item__body__slots) {
    width: 100%;
  }
}

.icon-repository-button {
  display: inline-flex;
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  margin-left: auto;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid var(--divider-color);
  border-radius: 10px;
  background: var(--background-color);
  color: var(--primary-color);
  cursor: pointer;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}

.switch-form-item {
  flex-direction: row;
  justify-content: space-between;
}

.switch-wrapper {
  display: flex;
  justify-content: flex-end;
}

.selection-sheet {
  display: flex;
  height: 100%;
  flex-direction: column;
  overflow: hidden;
}

.selection-sheet-header {
  padding: 3px 30px 14px 2px;

  h3,
  p {
    margin: 0;
  }

  h3 {
    margin-top: 4px;
    color: var(--primary-text-color);
    font-size: 19px;
    line-height: 1.25;
  }

  p {
    margin-top: 7px;
    color: var(--comment-text-color);
    font-size: 12px;
    line-height: 1.5;
  }
}

.selection-sheet-kicker {
  color: var(--primary-color);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.group-type-list,
.policy-option-list {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.group-type-list {
  display: grid;
  gap: 14px;
  padding-bottom: 20px;
}

.group-type-section {
  display: grid;
  gap: 7px;

  h4 {
    margin: 0 2px;
    color: var(--comment-text-color);
    font-size: 11px;
    font-weight: 500;
  }
}

.group-type-option {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--divider-color);
  border-radius: 12px;
  background: var(--card-background-color);
  color: var(--primary-text-color);
  text-align: left;
  cursor: pointer;

  &.selected {
    border-color: color-mix(in srgb, var(--primary-color) 45%, var(--divider-color));
    background: color-mix(in srgb, var(--primary-color) 7%, var(--card-background-color));
  }

  > .nut-icon {
    flex: 0 0 auto;
    color: var(--primary-color);
  }
}

.group-type-option-main {
  display: grid;
  min-width: 0;
  gap: 5px;

  strong {
    font-size: 14px;
  }

  small {
    color: var(--comment-text-color);
    font-size: 11px;
    line-height: 1.45;
  }
}

.support-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.support-badge {
  display: inline-flex;
  align-items: center;
  min-height: 21px;
  padding: 3px 7px;
  border-radius: 7px;
  font-size: 10px;
  line-height: 1.3;

  &.exact {
    background: color-mix(in srgb, #22a06b 13%, transparent);
    color: #168056;
  }

  &.fallback {
    background: color-mix(in srgb, #d97706 13%, transparent);
    color: #b45d05;
  }

  &.unsupported {
    background: color-mix(in srgb, var(--comment-text-color) 12%, transparent);
    color: var(--comment-text-color);
  }
}

.policy-selection-sheet {
  padding-bottom: 10px;
}

.policy-search {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 12px;
  margin-bottom: 10px;
  border: 1px solid var(--divider-color);
  border-radius: 11px;
  background: var(--card-background-color);
  color: var(--comment-text-color);

  input {
    width: 100%;
    min-width: 0;
    border: 0;
    outline: none;
    background: transparent;
    color: var(--primary-text-color);
    font: inherit;
    font-size: 13px;
  }
}

.policy-option-list {
  display: grid;
  align-content: start;
  gap: 7px;
  padding: 1px 1px 12px;
}

.policy-option {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 10px;
  padding: 9px 11px;
  border: 1px solid var(--divider-color);
  border-radius: 11px;
  background: var(--card-background-color);
  color: var(--primary-text-color);
  text-align: left;
  cursor: pointer;

  &.selected {
    border-color: color-mix(in srgb, var(--primary-color) 45%, var(--divider-color));
    background: color-mix(in srgb, var(--primary-color) 7%, var(--card-background-color));
  }
}

.policy-option-marker {
  display: inline-flex;
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--divider-color);
  border-radius: 7px;
  color: var(--primary-color);
}

.policy-empty-state {
  display: flex;
  min-height: 180px;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: var(--comment-text-color);
  text-align: center;

  svg {
    margin-bottom: 4px;
    font-size: 24px;
  }

  strong {
    color: var(--secondary-text-color);
    font-size: 13px;
  }

  span {
    max-width: 300px;
    font-size: 11px;
    line-height: 1.5;
  }
}

.selection-sheet-footer {
  display: flex;
  gap: 8px;
  padding: 10px 0 max(8px, env(safe-area-inset-bottom));
  margin-top: auto;
  border-top: 1px solid var(--divider-color);
}

.selection-secondary,
.selection-confirm {
  min-height: 42px;
  border-radius: 10px;
}

.selection-secondary {
  min-width: 88px;
  padding: 0 16px;
  border: 1px solid var(--divider-color);
  background: transparent;
  color: var(--secondary-text-color);
  cursor: pointer;
}

.selection-confirm {
  flex: 1;
}

@media (min-width: 700px) {
  .selection-trigger,
  .target-mapping-text,
  .icon-url-field {
    width: 100%;
    max-width: none;
  }

  .policy-chip-list {
    width: 100%;
  }

  :global(.config-selection-popup) {
    right: 0 !important;
    left: 0 !important;
    width: min(620px, calc(100vw - 48px)) !important;
    margin-right: auto;
    margin-left: auto;
  }
}
</style>
