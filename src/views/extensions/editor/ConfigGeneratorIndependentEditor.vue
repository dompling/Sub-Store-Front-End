<template>
  <div class="independent-config-editor">
    <cmView
      :is-read-only="false"
      :id="editorId"
      :placeholder="placeholder"
      :editor-language="editorLanguage"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useCodeStore } from '@/store/codeStore';
import cmView from '@/views/editCode/cmView.vue';
import { CONFIG_GENERATOR_TARGET_REGISTRY } from '@/views/extensions/configGeneratorTargets';

const props = defineProps<{
  modelValue: string;
  target: ConfigGeneratorTarget;
}>();
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>();
const cmStore = useCodeStore();
const editorId = computed(() => `config-generator-independent-${props.target}`);
const targetDefinition = computed(() => CONFIG_GENERATOR_TARGET_REGISTRY[props.target]);
const placeholder = computed(() => targetDefinition.value.independentConfig.placeholder);
const editorLanguage = computed(() => targetDefinition.value.editorLanguage);

watch(
  () => props.modelValue,
  (value) => {
    if (cmStore.EditCode[editorId.value] !== value) {
      cmStore.setEditCode(editorId.value, value);
    }
  },
  { immediate: true },
);

watch(
  () => cmStore.EditCode[editorId.value],
  (value) => {
    const content = value || '';
    if (content !== props.modelValue) emit('update:modelValue', content);
  },
);
</script>

<style lang="scss" scoped>
.independent-config-editor {
  margin-right: -15px;
  margin-left: -15px;
  max-height: 60vh;
  overflow: auto;
}
</style>
