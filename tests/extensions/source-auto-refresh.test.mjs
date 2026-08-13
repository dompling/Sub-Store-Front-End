import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const readSource = relativePath => readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');

test('refreshes configured extension sources before reading update availability on page entry', async () => {
  const [api, store, view, navBar] = await Promise.all([
    readSource('src/api/extensions/index.ts'),
    readSource('src/store/extensions.ts'),
    readSource('src/views/extensions/ExtensionStore.vue'),
    readSource('src/components/NavBar.vue'),
  ]);

  assert.match(api, /refreshAllSources:[\s\S]*\/api\/admin\/extensions\/sources\/refresh[\s\S]*\/api\/extensions\/sources\/refresh/);
  assert.match(store, /async refreshRemoteSources\(\)/);
  assert.match(store, /api\.refreshAllSources\(\)/);
  assert.match(store, /async refreshForExtensionPageEntry\(\)/);
  assert.match(store, /await this\.refresh\(\{ silent: true, force: true \}\)/);
  assert.match(store, /await this\.refreshRemoteSources\(\)/);
  assert.match(store, /async refreshForExtensionPageReload\(\)/);
  assert.match(view, /extensionStore\.refreshForExtensionPageEntry\(\)/);
  assert.match(view, /watch\([\s\S]*\(\) => route\.path/);
  assert.match(view, /movedWithinExtensionStore[\s\S]*refreshRemoteSourcesIfStale\(\)/);
  assert.doesNotMatch(view, /onMounted\([\s\S]*extensionStore\.refresh\(\{ silent: true \}\)/);
  const navRefreshBlock = navBar.match(/const refresh = async \(\) => \{[\s\S]*?\n\};/)?.[0] || '';
  assert.match(navRefreshBlock, /route\.path === ["']\/extensions["'][\s\S]*extensionsStore\.refreshForExtensionPageReload\(\)/);
  assert.doesNotMatch(navRefreshBlock, /extensionsStore\.refresh\(\{ force: true \}\)/);
});

test('keeps background checks lightweight while periodically refreshing remote catalogs', async () => {
  const [store, initApp, outlet] = await Promise.all([
    readSource('src/store/extensions.ts'),
    readSource('src/utils/initApp.ts'),
    readSource('src/components/ExtensionRouteOutlet.vue'),
  ]);
  const syncBlock = store.match(/startRevisionSync\(\)[\s\S]*?stopRevisionSync\(\)/)?.[0] || '';

  assert.match(store, /const REMOTE_SOURCE_REFRESH_INTERVAL_MS = 5 \* 60 \* 1000/);
  assert.match(syncBlock, /this\.refreshOnRevisionFence\(\)/);
  assert.match(syncBlock, /this\.refreshRemoteSourcesIfStale\(\)/);
  assert.match(syncBlock, /document\.visibilityState === 'visible'/);
  assert.match(initApp, /extensionPreferences\.autoRefresh[\s\S]*extensionsStore\.startRevisionSync\(\)/);
  assert.match(outlet, /extensionPreferences\.autoRefresh[\s\S]*extensionStore\.startRevisionSync\(\)/);
});

test('reports partial and complete failures from a user-requested source refresh', async () => {
  const store = await readSource('src/store/extensions.ts');
  const reloadBlock = store.match(/async refreshForExtensionPageReload\(\)[\s\S]*?async refreshRemoteSourcesIfStale/)?.[0] || '';

  assert.match(reloadBlock, /const payload = responsePayload\(response\)/);
  assert.match(reloadBlock, /Number\(payload\?\.failureCount \|\| 0\)/);
  assert.match(reloadBlock, /Number\(payload\?\.successCount \|\| 0\)/);
  assert.match(reloadBlock, /EXTENSION_SOURCE_REFRESH_PARTIAL_FAILED/);
  assert.match(reloadBlock, /EXTENSION_SOURCE_REFRESH_FAILED/);
  assert.match(reloadBlock, /return successCount > 0/);
});
