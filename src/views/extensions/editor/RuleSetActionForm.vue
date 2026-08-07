<template>
  <nut-form v-if="ruleSet" class="form config-generator-action-form" :model-value="context.form">
    <nut-form-item :label="$t('configGenerator.fields.ruleKind')">
      <nut-input
        model-value="RULE-SET"
        :border="false"
        input-align="right"
        class="nut-input-text"
        readonly
        placeholder="RULE-SET"
      />
    </nut-form-item>

    <nut-form-item>
      <template #label>
        <span class="rule-name-label">
          {{ $t('configGenerator.fields.ruleName') }}
          <button
            type="button"
            class="rule-name-tips-button"
            :aria-label="$t('configGenerator.ruleNameHelp')"
            :title="$t('configGenerator.ruleNameHelp')"
            @click.stop="openRuleNameTips"
          >
            <font-awesome-icon icon="fa-solid fa-circle-question" />
          </button>
        </span>
      </template>
      <nut-input
        v-model.trim="ruleBindingName"
        :border="false"
        input-align="right"
        class="nut-input-text"
        :placeholder="$t('configGenerator.placeholders.ruleName')"
      />
    </nut-form-item>

    <nut-form-item v-if="ruleSet.source.kind === 'url'" :label="$t('configGenerator.fields.ruleSetUrl')">
      <nut-input
        v-model.trim="ruleSetUrl"
        :border="false"
        input-align="right"
        class="nut-input-text"
        :placeholder="$t('configGenerator.placeholders.ruleSetUrl')"
      />
    </nut-form-item>

    <nut-form-item v-if="ruleSet.source.kind === 'url'" :label="$t('configGenerator.fields.ruleSetTarget')">
      <div class="radio-wrapper">
        <nut-radiogroup v-model="ruleSetTarget" direction="horizontal">
          <nut-radio
            v-for="target in CONFIG_GENERATOR_TARGET_DEFINITIONS"
            :key="target.target"
            shape="button"
            :label="target.target"
          >
            <span class="rule-target-content">
              <img :src="target.icon" alt="" aria-hidden="true">
              <span>{{ target.displayName }}</span>
            </span>
          </nut-radio>
        </nut-radiogroup>
      </div>
    </nut-form-item>

    <nut-form-item v-else :label="$t('configGenerator.fields.builtinRuleSet')">
      <nut-input
        :model-value="ruleSet.source.value"
        :border="false"
        input-align="right"
        class="nut-input-text"
        readonly
      />
    </nut-form-item>

    <nut-form-item :label="$t('configGenerator.fields.policy')">
      <div class="radio-wrapper">
        <nut-radiogroup
          :model-value="remoteRule?.policy || 'DIRECT'"
          direction="horizontal"
          @update:model-value="updatePolicy"
        >
          <nut-radio v-for="policy in policyOptions" :key="policy" shape="button" :label="policy">
            {{ policy }}
          </nut-radio>
        </nut-radiogroup>
      </div>
    </nut-form-item>
  </nut-form>
</template>

<script setup lang="ts">
import { Dialog } from '@nutui/nutui';
import { computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  CONFIG_GENERATOR_TARGET_DEFINITIONS,
  DEFAULT_CONFIG_GENERATOR_TARGET,
} from '@/views/extensions/configGeneratorTargets';
import {
  getRemoteRuleBindingName,
  setRemoteRuleBindingName,
} from '@/views/extensions/editor/ruleBindingPresentation';

const { id } = defineProps<{ id: string }>();
const context = inject<any>('configGeneratorActionContext');
const { t } = useI18n();

const ruleSet = computed(() => context?.ruleSetByActionId?.(id));
const remoteRule = computed(() => {
  const rule = context?.ruleByActionId?.(id);
  return rule?.kind === 'remote' ? rule : undefined;
});
const ruleBindingName = computed({
  get: () => getRemoteRuleBindingName(remoteRule.value),
  set: (value: string) => {
    if (!remoteRule.value) return;
    setRemoteRuleBindingName(remoteRule.value, value);
  },
});
const ruleSetUrl = computed({
  get: () => ruleSet.value?.source?.kind === 'url' ? ruleSet.value.source.url : '',
  set: (value: string) => {
    if (ruleSet.value?.source?.kind === 'url') ruleSet.value.source.url = value;
  },
});
const ruleSetTarget = computed<ConfigGeneratorTarget>({
  get: () => ruleSet.value?.source?.kind === 'url'
    ? ruleSet.value.source.target || DEFAULT_CONFIG_GENERATOR_TARGET
    : DEFAULT_CONFIG_GENERATOR_TARGET,
  set: (value) => {
    if (ruleSet.value?.source?.kind === 'url') ruleSet.value.source.target = value;
  },
});
const policyOptions = computed(() => [
  'DIRECT',
  'REJECT',
  ...(context?.form?.groups || []).map((group: any) => group.name).filter(Boolean),
]);

const updatePolicy = (policy: string) => {
  const index = context?.form?.rules?.indexOf(remoteRule.value) ?? -1;
  if (index >= 0) context?.updateRulePolicy?.(index, policy);
};
const openRuleNameTips = () => {
  Dialog({
    title: t('configGenerator.fields.ruleName'),
    content: t('configGenerator.ruleNameHelp'),
    popClass: 'auto-dialog',
    textAlign: 'left',
    noCancelBtn: true,
    okText: t('specificWord.confirm'),
    closeOnClickOverlay: true,
    closeOnPopstate: true,
  });
};
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

.rule-name-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.rule-name-tips-button {
  display: inline-flex;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  margin: 0;
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

.rule-target-content {
  display: inline-flex;
  align-items: center;
  gap: 5px;

  img {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    object-fit: contain;
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
</style>
