<template>
  <nut-form v-if="rule" class="form config-generator-action-form" :model-value="context.form">
    <nut-form-item :label="$t('configGenerator.fields.ruleKind')">
      <nut-input
        :model-value="displayType"
        :border="false"
        input-align="right"
        class="nut-input-text"
        readonly
        :placeholder="$t('configGenerator.fields.ruleKind')"
      />
    </nut-form-item>

    <nut-form-item v-if="showsValue" :label="valueLabel">
      <nut-input
        :model-value="context.ruleValue(rule)"
        :border="false"
        input-align="right"
        class="nut-input-text"
        :placeholder="context.rulePlaceholder(rule)"
        @update:model-value="updateValue"
      />
    </nut-form-item>

    <nut-form-item v-if="showsPolicy" :label="$t('configGenerator.fields.policy')">
      <div class="radio-wrapper">
        <nut-radiogroup
          :model-value="context.rulePolicy(rule)"
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
import { computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const { id } = defineProps<{ id: string }>();
const context = inject<any>('configGeneratorActionContext');

const rule = computed(() => context?.ruleByActionId?.(id));
const displayType = computed(() => rule.value ? context?.ruleType?.(rule.value) || '' : '');
const ruleIndex = computed(() => context?.form?.rules?.indexOf(rule.value) ?? -1);
const showsValue = computed(() => rule.value && rule.value.kind !== 'blank' && rule.value.kind !== 'final');
const showsPolicy = computed(() => rule.value && ['inline', 'final'].includes(rule.value.kind));
const valueLabel = computed(() => rule.value?.kind === 'comment'
  ? t('configGenerator.fields.comment')
  : t('configGenerator.fields.ruleValue'));
const policyOptions = computed(() => [
  'DIRECT',
  'REJECT',
  ...(context?.form?.groups || []).map((group: any) => group.name).filter(Boolean),
]);

const updateValue = (value: string) => {
  if (ruleIndex.value >= 0) context?.updateRuleValue?.(ruleIndex.value, value);
};

const updatePolicy = (policy: string) => {
  if (ruleIndex.value >= 0) context?.updateRulePolicy?.(ruleIndex.value, policy);
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
