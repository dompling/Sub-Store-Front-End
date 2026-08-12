import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const readSource = relativePath => readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');

test('renders extensions on every viewport as an iOS-style app launcher grid', async () => {
  const source = await readSource('src/views/extensions/ExtensionStore.vue');
  const template = source.slice(0, source.indexOf('<script setup'));
  const launcherStart = template.indexOf('<Draggable');
  const launcherTemplate = template.slice(launcherStart);

  assert.notEqual(launcherStart, -1);
  assert.match(source, /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(launcherTemplate, /class="extension-app-launcher"/);
  assert.match(launcherTemplate, /class="extension-app-title"/);
  assert.doesNotMatch(template, /class="extension-grid"/);
  assert.doesNotMatch(launcherTemplate, /extension-description|extension-capabilities|extension-card-footer/);
});

test('opens apps normally and reserves details and uninstall for management mode', async () => {
  const source = await readSource('src/views/extensions/ExtensionStore.vue');

  assert.match(source, /const appManagementMode = computed\(/);
  assert.match(source, /const openMobileExtension = async \(card: ExtensionCard\)/);
  assert.match(source, /if \(canOpenExtension\(card\)\) return openExtension\(card\)/);
  assert.match(source, /const startAppLongPress = \(card: ExtensionCard\)/);
  assert.match(source, /appManagementMode\.value = true/);
  assert.match(source, /v-if="appManagementMode"[\s\S]*class="extension-app-remove"/);
  assert.match(source, /v-if="appManagementMode"[\s\S]*class="extension-app-details"/);
  assert.match(source, /@click="confirmUninstall\(card\)"/);
  assert.match(source, /@click="openDetails\(card\.id\)"/);
});

test('keeps compact management controls while enlarging their touch targets', async () => {
  const source = await readSource('src/views/extensions/ExtensionStore.vue');

  assert.match(source, /\.extension-app-remove::after,[\s\S]*\.extension-app-details::after/);
  assert.match(source, /inset: -8px/);
});

test('marks launcher icons when an installed extension has an available update', async () => {
  const source = await readSource('src/views/extensions/ExtensionStore.vue');
  const template = source.slice(0, source.indexOf('<script setup'));

  assert.match(template, /:aria-label="launcherAriaLabel\(card\)"/);
  assert.match(template, /v-if="extensionPreferences\.showUpdateBadges && canUpdate\(card\)"[\s\S]*class="extension-app-update-badge"/);
  assert.match(template, /v-if="extensionPreferences\.showRuntimeStatus"[\s\S]*class="extension-app-status"/);
  assert.match(source, /updateAvailable:\s*isZh\.value \? '有可用更新' : 'Update available'/);
  assert.match(source, /const launcherAriaLabel = \(card: ExtensionCard\)/);
  assert.match(source, /\.extension-app-update-badge\s*\{/);
  assert.match(source, /\.extension-app-grid\.managing \.extension-app-update-badge/);
});

test('uses the shared navbar for refresh, management and file-style search', async () => {
  const [source, navBar, router] = await Promise.all([
    readSource('src/views/extensions/ExtensionStore.vue'),
    readSource('src/components/NavBar.vue'),
    readSource('src/router/index.ts'),
  ]);
  const template = source.slice(0, source.indexOf('<script setup'));

  assert.match(router, /path:\s*['"]\/extensions['"][\s\S]*supportsListSearch:\s*true/);
  assert.match(router, /addCommand:\s*EXTENSION_STORE_COMMANDS\.add/);
  assert.match(router, /manageCommand:\s*EXTENSION_STORE_COMMANDS\.toggleManagement/);
  assert.match(navBar, /v-if="showManageButton"[\s\S]*invokePageAction\('manageCommand'\)/);
  assert.match(source, /useListSearchStore/);
  assert.match(source, /listSearchStore\.normalizedQuery/);
  assert.doesNotMatch(template, /class="store-search"/);
  assert.doesNotMatch(template, /class="store-refresh-button"/);
  assert.doesNotMatch(template, /class="store-manage-button"/);
});

test('keeps the launcher clean and opens a dedicated extension discovery page', async () => {
  const [source, router] = await Promise.all([
    readSource('src/views/extensions/ExtensionStore.vue'),
    readSource('src/router/index.ts'),
  ]);
  const template = source.slice(0, source.indexOf('<script setup'));

  assert.doesNotMatch(template, /class="store-header"|class="store-toolbar"/);
  assert.match(source, /EXTENSION_STORE_COMMANDS\.add/);
  assert.match(source, /router\.push\('\/extensions\/discover'\)/);
  assert.match(source, /const isInstalledCard = \(card: ExtensionCard\)/);
  assert.match(source, /allCards\.value\.filter\(isInstalledCard\)/);
  assert.match(router, /path:\s*['"]\/extensions\/discover['"]/);
  assert.match(template, /class="extension-discover-page"/);
  assert.doesNotMatch(template, /class="extension-add-popup"/);
});

test('reorders installed extensions with a persistent iOS-style draggable launcher', async () => {
  const source = await readSource('src/views/extensions/ExtensionStore.vue');

  assert.match(source, /import Draggable from ['"]vuedraggable['"]/);
  assert.match(source, /v-model="launcherCards"/);
  assert.match(source, /:disabled="!appManagementMode"/);
  assert.match(source, /:force-fallback="true"/);
  assert.match(source, /:fallback-on-body="true"/);
  assert.match(source, /ghost-class="extension-app-ghost"/);
  assert.match(source, /localStorage\.setItem\(\s*EXTENSION_LAUNCHER_ORDER_KEY/);
  assert.match(source, /const launcherCards = computed\(\{/);
});

test('shows declared extension publishers and catalog provenance without guessing missing authors', async () => {
  const source = await readSource('src/views/extensions/ExtensionStore.vue');
  const template = source.slice(0, source.indexOf('<script setup'));

  assert.match(template, /extensionPublisherLabel\(card\)/);
  assert.match(template, /extensionSourceLabel\(card\)/);
  assert.match(template, /sourcePublisherName\(source\)/);
  assert.match(template, /detail-provenance-section/);
  assert.match(source, /unknownAuthor:\s*isZh\.value \? '未声明'/);
  assert.doesNotMatch(source, /github\.com[\s\S]*split\(|new URL\([^)]*\)[\s\S]*publisher/i);
});
