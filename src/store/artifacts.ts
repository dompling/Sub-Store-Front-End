import { useArtifactsApi } from '@/api/artifacts';
import { EXTENSION_IDS } from '@/extensions/registry';
import i18n from '@/locales';
import { useAppNotifyStore } from '@/store/appNotify';
import { useExtensionsStore } from '@/store/extensions';
import { runFrontendRequestTask } from '@/utils/requestConcurrency';
import { defineStore } from 'pinia';

const { t } = i18n.global;
const artifactsApi = useArtifactsApi();
const artifactsFetchFlights = new WeakMap<object, {
  runtimeKey: string;
  promise: Promise<boolean>;
}>();

const configHostingAvailability = () => useExtensionsStore().availability(
  EXTENSION_IDS.CONFIG_HOSTING,
);

const configHostingAvailable = () => {
  const availability = configHostingAvailability();
  return ['enabled', 'bundled'].includes(availability.status)
    || availability.source === 'legacy-fallback';
};

const configHostingRuntimeKey = () => {
  const extensionsStore = useExtensionsStore();
  const availability = configHostingAvailability();
  return [
    extensionsStore.runtimeHostUrl || 'default-host',
    availability.source,
    availability.status,
    availability.backendRevision ?? extensionsStore.revision,
    extensionsStore.runtime?.dataGeneration ?? 'legacy',
    availability.receipt?.packageDigest || availability.codeStatus || 'no-package',
  ].join(':');
};

export const useArtifactsStore = defineStore('artifactsStore', {
  state: (): ArtifactsStoreState => {
    return {
      artifacts: [],
      loadedRuntimeKey: '',
      loadedAt: 0,
    };
  },
  getters: {
    configHostingAvailable: () => configHostingAvailable(),
    cacheFresh: state => Boolean(
      state.loadedAt
      && configHostingAvailable()
      && state.loadedRuntimeKey === configHostingRuntimeKey(),
    ),
  },
  actions: {
    invalidateArtifactsCache(clearArtifacts = false) {
      this.loadedRuntimeKey = '';
      this.loadedAt = 0;
      if (clearArtifacts) this.artifacts = [];
    },
    markArtifactsCacheLoaded() {
      this.loadedRuntimeKey = configHostingRuntimeKey();
      this.loadedAt = Date.now();
    },
    async ensureFreshArtifactsData() {
      if (!configHostingAvailable()) {
        this.invalidateArtifactsCache(true);
        return false;
      }
      if (this.cacheFresh) return true;
      return this.fetchArtifactsData();
    },
    async fetchArtifactsData() {
      // Configuration hosting is an optional extension. Core editors call
      // this refresh after renames/restores, so an intentionally disabled or
      // removed plugin must be a quiet no-op rather than a global 409 toast.
      if (!configHostingAvailable()) {
        this.invalidateArtifactsCache(true);
        return false;
      }
      const storeIdentity = this as unknown as object;
      let runtimeKey = configHostingRuntimeKey();
      const activeFlight = artifactsFetchFlights.get(storeIdentity);
      if (activeFlight) {
        if (activeFlight.runtimeKey === runtimeKey) return activeFlight.promise;
        await activeFlight.promise.catch(() => false);
        if (!configHostingAvailable()) {
          this.invalidateArtifactsCache(true);
          return false;
        }
        runtimeKey = configHostingRuntimeKey();
      }

      const fetchPromise = (async () => {
        const response = await runFrontendRequestTask(
          () => artifactsApi.getArtifacts(),
          'artifacts.getArtifacts',
        );
        // Do not let a slow response from the previous Host/lifecycle
        // generation overwrite the active extension snapshot.
        if (!configHostingAvailable() || configHostingRuntimeKey() !== runtimeKey) {
          return false;
        }
        if (response?.data?.status === 'success') {
          this.artifacts = response.data.data || [];
          this.markArtifactsCacheLoaded();
          return true;
        }
        return false;
      })();
      const trackedFetchPromise = fetchPromise.finally(() => {
        if (artifactsFetchFlights.get(storeIdentity)?.promise === trackedFetchPromise) {
          artifactsFetchFlights.delete(storeIdentity);
        }
      });
      artifactsFetchFlights.set(storeIdentity, {
        runtimeKey,
        promise: trackedFetchPromise,
      });
      return trackedFetchPromise;
    },
    async createArtifact(data: Artifact) {
      const { showNotify } = useAppNotifyStore();
      const res = await artifactsApi.createArtifact(data);
      if (res?.data?.status === 'success') {
        await this.fetchArtifactsData();
        showNotify({
          title: t('syncPage.addArtForm.succeedNotify'),
          type: 'success',
        });
        return true;
      }
      return false;
    },
    async editArtifact(name: string, data: Artifact) {
      const { showNotify } = useAppNotifyStore();

      const res = await artifactsApi.editArtifact(name, data);
      if (res?.data?.status === 'success') {
        await this.fetchArtifactsData();
        showNotify({
          title: t('syncPage.editArtForm.succeedNotify'),
          type: 'success',
        });
        return true;
      }
      return false;
    },
    async deleteArtifact(
      name: string,
      mode?: DeleteMode,
      isShowNotify: boolean = true,
    ) {
      const { showNotify } = useAppNotifyStore();

      const { data } = await artifactsApi.deleteArtifact(name, mode);
      if (data.status === 'success') {
        await this.fetchArtifactsData();
        const remote = data.data?.remote;
        const remoteNotice =
          remote?.status === 'placeholder_retained'
            ? t('syncPage.deleteArt.remotePlaceholderNotice')
            : remote?.status === 'failed'
              ? t('syncPage.deleteArt.remoteDeleteFailedNotice')
              : '';
        isShowNotify && showNotify({
          title:
            mode === 'archive'
              ? t('archivePage.liveDelete.succeedNotify')
              : t('syncPage.deleteArt.succeedNotify'),
          content: remoteNotice,
          type:
            remote?.status === 'failed'
              ? 'warning'
              : mode === 'archive'
                ? 'success'
                : 'danger',
          duration: remoteNotice ? 5000 : undefined,
        });
        return true;
      }

      return false;
    },
    async restoreArtifacts() {
      const { showNotify } = useAppNotifyStore();

      const res = await artifactsApi.restoreArtifacts();
      if (res?.data?.status === 'success') {
        await this.fetchArtifactsData();
        showNotify({
          type: "success",
          title: t(`myPage.notify.restore.succeed`),
          content: ``,
        });
      }
    },
    async syncAllArtifact() {
      const { showNotify } = useAppNotifyStore();

      const res = await artifactsApi.syncAllArtifact();
      if (res?.data?.status === 'success') {
        await this.fetchArtifactsData();
        showNotify({
          title: t('syncPage.syncAllSucceed'),
          type: 'success',
        });
      } else {
        await this.fetchArtifactsData();
      }
    },
    async syncOneArtifact(name: string) {
      const { showNotify } = useAppNotifyStore();

      const res = await artifactsApi.syncOneArtifact(name);
      if (res?.data?.status === 'success') {
        const index = this.artifacts.findIndex(item => item.name === name);
        if (index === -1) this.artifacts.push(res.data.data);
        else this.artifacts[index] = res.data.data;
        this.markArtifactsCacheLoaded();
        showNotify({
          title: t('syncPage.syncAllSucceed'),
          type: 'success',
        });
      }
    },
  },
});
