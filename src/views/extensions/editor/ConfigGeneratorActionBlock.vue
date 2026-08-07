<template>
  <div
    class="config-generator-action-block"
    :class="{
      'config-generator-action-block--hide-default-add': hideDefaultAdd,
      'config-generator-action-block--hide-title': hideTitle,
    }"
  >
    <ActionBlock
      :checked="checked"
      :list="list"
      :source-type="sourceType"
      :initial-collapsed-ids="initialCollapsedIds"
      :persist-collapse-preference="persistCollapsePreference"
      :readonly-name-resolver="readonlyNameResolver"
      @addAction="emit('addAction', $event)"
      @deleteAction="emit('deleteAction', $event)"
      @toggleAction="emit('toggleAction', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { provide, reactive, watch } from 'vue';
import ActionBlock from '@/views/editor/ActionBlock.vue';

const props = defineProps<{
  checked: Array<[string, boolean]>;
  list: ActionModuleProps[];
  sourceType?: string;
  form?: { process?: any[] };
  hideDefaultAdd?: boolean;
  hideTitle?: boolean;
  initialCollapsedIds?: string[] | null;
  persistCollapsePreference?: boolean;
  readonlyNameResolver?: (element: ActionModuleProps) => string;
}>();

const fallbackForm = reactive<{ process: ActionModuleProps[] }>({ process: [] });
const injectedForm = props.form || fallbackForm;
provide('form', injectedForm);

watch(
  () => props.list,
  (list) => {
    if (props.form) return;
    fallbackForm.process.splice(0, fallbackForm.process.length, ...list);
  },
  { deep: true, immediate: true },
);

const emit = defineEmits<{
  (event: 'addAction', selectedOptions: any[]): void;
  (event: 'deleteAction', id: string): void;
  (event: 'toggleAction', id: string): void;
}>();
</script>

<style lang="scss" scoped>
.config-generator-action-block--hide-default-add :deep(.list-group-itemsa),
.config-generator-action-block--hide-title :deep(.sticky-title-wrapper) {
  display: none;
}
</style>
