import { defineStore } from 'pinia';

const EXTENSION_PREFERENCES_STORAGE_KEY = 'sub-store-extension-store-preferences';

export interface ExtensionPreferencesState {
  showUpdateBadges: boolean;
  showRuntimeStatus: boolean;
  autoRefresh: boolean;
  prioritizeUpdates: boolean;
}

const DEFAULT_EXTENSION_PREFERENCES: ExtensionPreferencesState = Object.freeze({
  showUpdateBadges: true,
  showRuntimeStatus: true,
  autoRefresh: true,
  prioritizeUpdates: true,
});

const readPreferences = (): ExtensionPreferencesState => {
  if (typeof window === 'undefined') return { ...DEFAULT_EXTENSION_PREFERENCES };
  try {
    const cached = JSON.parse(window.localStorage.getItem(EXTENSION_PREFERENCES_STORAGE_KEY) || '{}');
    return {
      showUpdateBadges: cached.showUpdateBadges !== false,
      showRuntimeStatus: cached.showRuntimeStatus !== false,
      autoRefresh: cached.autoRefresh !== false,
      prioritizeUpdates: cached.prioritizeUpdates !== false,
    };
  } catch {
    return { ...DEFAULT_EXTENSION_PREFERENCES };
  }
};

export const useExtensionPreferencesStore = defineStore('extensionPreferences', {
  state: (): ExtensionPreferencesState => readPreferences(),
  actions: {
    save() {
      if (typeof window === 'undefined') return;
      try {
        window.localStorage.setItem(EXTENSION_PREFERENCES_STORAGE_KEY, JSON.stringify({
          showUpdateBadges: this.showUpdateBadges,
          showRuntimeStatus: this.showRuntimeStatus,
          autoRefresh: this.autoRefresh,
          prioritizeUpdates: this.prioritizeUpdates,
        }));
      } catch {
        // UI preferences must never make the extension store unusable when
        // storage is unavailable or restricted by the browser.
      }
    },
    reset() {
      Object.assign(this, DEFAULT_EXTENSION_PREFERENCES);
      this.save();
    },
  },
});
