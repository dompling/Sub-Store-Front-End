/**
 * Stable frontend facade for trusted official extension bundles.
 *
 * Extension builds externalize this single module, so they share the Host's
 * Vue/Pinia/Router/i18n instances and UI components instead of bundling a
 * second framework runtime. Keep exports additive within API version 1.
 */
// Compiled Vue SFCs import render helpers directly from `vue`, while the
// extension build maps that external module to this Host facade. Re-export
// the complete public Vue runtime so newly generated templates cannot fail at
// install time when the compiler starts using another public render helper.
export * from 'vue';
export { defineStore, storeToRefs } from 'pinia';
export { useI18n } from 'vue-i18n';
export { useRoute, useRouter } from 'vue-router';
export { Dialog, Toast } from '@nutui/nutui';
export { default as draggable } from 'vuedraggable';

export { default as request } from '@/api';
export { useCodeStore } from '@/store/codeStore';
export { useGlobalStore } from '@/store/global';
export { useMethodStore } from '@/store/methodStore';
export { useSettingsStore } from '@/store/settings';
export { useSubsStore } from '@/store/subs';
export { useSystemStore } from '@/store/system';
export { useHostAPI } from '@/hooks/useHostAPI';
export { useListViewMode } from '@/hooks/useListViewMode';

export { default as ActionBlock } from '@/views/editor/ActionBlock.vue';
export { default as CodeMirrorView } from '@/views/editCode/cmView.vue';
export { default as EditorGroupingTips } from '@/components/EditorGroupingTips.vue';
export { default as IconPopup } from '@/views/icon/IconPopup.vue';
export { default as PreviewPanel } from '@/components/PreviewPanel.vue';
