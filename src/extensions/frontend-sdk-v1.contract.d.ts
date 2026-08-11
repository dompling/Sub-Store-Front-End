type VueRuntimeExports = typeof import('vue');
type FrontendSdkV1Exports = typeof import('./frontend-sdk-v1');
type MissingVueRuntimeExports = Exclude<
  keyof VueRuntimeExports,
  keyof FrontendSdkV1Exports
>;
type AssertNoMissingExports<T extends never> = T;

/**
 * The extension build maps its complete `vue` external to the Frontend SDK
 * global. Keep this exhaustive so compiler helpers such as defineComponent,
 * openBlock and createElementBlock cannot disappear unnoticed.
 */
export type FrontendSdkV1VueRuntimeContract = AssertNoMissingExports<
  MissingVueRuntimeExports
>;
