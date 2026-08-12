import { Dialog } from '@nutui/nutui';
import { registerSW } from 'virtual:pwa-register';

import i18n from '@/locales';

let updateDialogVisible = false;

export const registerPwaUpdate = () => {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  const updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      if (updateDialogVisible) return;
      updateDialogVisible = true;
      const { t } = i18n.global;
      Dialog({
        title: t('globalNotify.refresh.updateAvailableTitle'),
        content: t('globalNotify.refresh.updateAvailableContent'),
        popClass: 'auto-dialog',
        textAlign: 'left',
        okText: t('globalNotify.refresh.reloadNow'),
        cancelText: t('globalNotify.refresh.updateLater'),
        closeOnPopstate: true,
        closeOnClickOverlay: false,
        lockScroll: false,
        beforeClose: () => {
          updateDialogVisible = false;
          return true;
        },
        onClosed: () => {
          updateDialogVisible = false;
        },
        onOk: async () => {
          updateDialogVisible = false;
          await updateServiceWorker(true);
        },
      });
    },
  });
};
