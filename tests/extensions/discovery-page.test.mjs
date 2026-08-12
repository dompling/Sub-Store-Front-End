import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const readSource = relativePath => readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');

test('registers a searchable App Store-style discovery route with extension settings', async () => {
  const [router, navBar, registry] = await Promise.all([
    readSource('src/router/index.ts'),
    readSource('src/components/NavBar.vue'),
    readSource('src/extensions/registry.ts'),
  ]);

  assert.match(router, /path:\s*['"]\/extensions\/discover['"][\s\S]*needNavBack:\s*true/);
  assert.match(router, /path:\s*['"]\/extensions\/discover['"][\s\S]*backPath:\s*['"]\/extensions['"]/);
  assert.match(router, /path:\s*['"]\/extensions\/discover['"][\s\S]*supportsListSearch:\s*true/);
  assert.match(router, /path:\s*['"]\/extensions\/discover['"][\s\S]*hideNavTitle:\s*true/);
  assert.match(router, /settingsCommand:\s*EXTENSION_STORE_COMMANDS\.settings/);
  assert.match(router, /sourcesCommand:\s*EXTENSION_STORE_COMMANDS\.sources/);
  assert.match(router, /localInstallCommand:\s*EXTENSION_STORE_COMMANDS\.localInstall/);
  assert.match(registry, /settings:\s*'extensions\.store\.settings'/);
  assert.match(registry, /sources:\s*'extensions\.store\.sources'/);
  assert.match(registry, /localInstall:\s*'extensions\.store\.local-install'/);
  assert.match(navBar, /v-if="showSettingsButton"/);
  assert.match(navBar, /invokePageAction\('settingsCommand'\)/);
  assert.match(navBar, /fa-solid fa-gear/);
  assert.match(navBar, /v-if="showSourcesButton"[\s\S]*invokePageAction\('sourcesCommand'\)[\s\S]*fa-solid fa-link/);
  assert.match(navBar, /v-if="showLocalInstallButton"[\s\S]*invokePageAction\('localInstallCommand'\)[\s\S]*fa-solid fa-folder-open/);
});

test('discovery keeps every catalog entry visible and labels installed extensions as added', async () => {
  const source = await readSource('src/views/extensions/ExtensionStore.vue');
  const template = source.slice(0, source.indexOf('<script setup'));

  assert.match(template, /v-else class="extension-discover-page"/);
  assert.match(template, /v-for="card in discoverCards"/);
  assert.match(template, /discoverCardActionLabel\(card\)/);
  assert.doesNotMatch(template, /class="extension-discover-shortcuts"/);
  assert.match(source, /const discoverCards = computed\(/);
  assert.match(source, /allCards\.value\.filter\(card => cardMatchesSearch\(card/);
  assert.match(source, /listSearchStore\.normalizedQuery/);
  assert.match(source, /return isInstalledCard\(card\) \? labels\.value\.added/);
});

test('persists lightweight extension display and discovery preferences', async () => {
  const [view, preferences] = await Promise.all([
    readSource('src/views/extensions/ExtensionStore.vue'),
    readSource('src/store/extensionPreferences.ts'),
  ]);
  const template = view.slice(0, view.indexOf('<script setup'));

  assert.match(preferences, /sub-store-extension-store-preferences/);
  assert.match(preferences, /showUpdateBadges:\s*true/);
  assert.match(preferences, /showRuntimeStatus:\s*true/);
  assert.match(preferences, /autoRefresh:\s*true/);
  assert.match(preferences, /prioritizeUpdates:\s*true/);
  assert.match(preferences, /localStorage\.setItem/);
  assert.match(template, /v-model:visible="settingsVisible"/);
  assert.match(template, /extensionPreferences\.showUpdateBadges/);
  assert.match(template, /extensionPreferences\.showRuntimeStatus/);
  assert.match(template, /extensionPreferences\.autoRefresh/);
  assert.match(template, /extensionPreferences\.prioritizeUpdates/);
  assert.match(view, /EXTENSION_STORE_COMMANDS\.settings/);
  assert.match(view, /EXTENSION_STORE_COMMANDS\.sources/);
  assert.match(view, /EXTENSION_STORE_COMMANDS\.localInstall/);
});
