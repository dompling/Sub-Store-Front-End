import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const readSource = path => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('extension contracts keep remote releases distinct from local rollback versions', () => {
  const contracts = readSource('src/extensions/contracts.ts');
  assert.match(contracts, /installedVersion\?: string/);
  assert.match(contracts, /availableVersion\?: string/);
  assert.match(contracts, /rollbackAvailable\?: boolean/);
  assert.match(contracts, /rollbackVersions\?: string\[\]/);
  assert.match(contracts, /interface ExtensionCatalogRelease/);
  assert.match(contracts, /releasedAt\?: string \| number/);
  assert.match(contracts, /gitTag\?: string/);
  assert.match(contracts, /gitCommit\?: string/);
  assert.match(contracts, /installable\?: boolean/);
  assert.match(contracts, /releases\?: ExtensionCatalogRelease\[\]/);
});

test('version controls send only the selected catalog version', () => {
  const api = readSource('src/api/extensions/index.ts');
  assert.match(api, /options\?\.version\?\.trim\(\)/);
  assert.match(api, /version: options\.version\.trim\(\)/);
});

test('runtime installed manifest wins over a newer catalog manifest until update completes', () => {
  const store = readSource('src/store/extensions.ts');
  assert.match(
    store,
    /mergeManifest\(\s*mergeManifest\(frontendManifest, catalogEntry[\s\S]*?entry\?\.manifest,\s*\)/,
  );
  assert.match(
    store,
    /mergeManifest\(\s*mergeManifest\(frontendManifest, entry[\s\S]*?runtimeEntry\?\.manifest,\s*\)/,
  );
  assert.match(store, /async update\(extensionId: string/);
  assert.match(store, /async rollback\(extensionId: string/);
});

test('retained install snapshots never replace an available catalog entry', () => {
  const store = readSource('src/store/extensions.ts');
  assert.match(
    store,
    /const catalogEntryIds = new Set\(this\.catalog\.map\(entry => entry\.id\)\)/,
  );
  assert.match(
    store,
    /if \(catalogEntryIds\.has\(receipt\.extensionId\)\) return null/,
  );
  assert.match(
    store,
    /this\.catalog = this\.mergeCatalog\(\[\.\.\.this\.catalog, \.\.\.installedSnapshots\]\)/,
  );
});

test('extension details present update and rollback without replacing lifecycle controls', () => {
  const view = readSource('src/views/extensions/ExtensionStore.vue');
  assert.match(view, /versionSummary\(selectedCard\)/);
  assert.match(view, /canUpdate\(selectedCard\)/);
  assert.match(view, /performVersionAction\(selectedCard, 'update'\)/);
  assert.match(view, /canRollback\(selectedCard\)/);
  assert.match(view, /performVersionAction\(selectedCard, 'rollback'\)/);
  assert.match(view, /card\.updateAvailable === true/);
  assert.match(view, /card\.availability\.receipt\?\.rollbackAvailable === true/);
});

test('extension details expose remote history and explicit version switching', () => {
  const [store, view] = [
    readSource('src/store/extensions.ts'),
    readSource('src/views/extensions/ExtensionStore.vue'),
  ];
  assert.match(store, /normalizeCatalogReleases/);
  assert.match(store, /async installVersion\(extensionId: string, version: string/);
  assert.match(store, /async switchVersion\(extensionId: string, version: string/);
  assert.match(view, /remoteReleases\(selectedCard\)/);
  assert.match(view, /<details[\s\S]*?v-if="remoteReleases\(selectedCard\)\.length"/);
  assert.match(view, /labels\.remoteVersions/);
  assert.match(view, /release\.gitTag/);
  assert.match(view, /shortCommit\(release\.gitCommit\)/);
  assert.match(view, /releaseRevisionLabel\(release\)/);
  assert.match(view, /visibleReleaseActionLabel\(selectedCard, release\)/);
  assert.match(view, /release\.installable === false \|\| release\.yanked === true/);
  assert.match(view, /confirmVersionSwitch\(selectedCard, release\)/);
});

test('remote downgrade confirmation and local rollback remain separate actions', () => {
  const view = readSource('src/views/extensions/ExtensionStore.vue');
  assert.match(view, /releaseActionKind\(card, release\) !== 'downgrade'/);
  assert.match(view, /title: labels\.value\.downgradeTitle/);
  assert.match(view, /await extensionStore\.switchVersion\(card\.id, release\.version\)/);
  assert.match(view, /hasInstalledPackage\(card\) && !needsPackageRestore\(card\)/);
  assert.match(view, /await extensionStore\.rollback\(card\.id\)/);
  assert.match(view, /releaseActionKind\(card, release\) === 'current'/);
  assert.match(view, /isInstalledCard\(card\) \? card\.availability\.manifest\?\.version : ''/);
  assert.match(view, /versionHistoryOpen\.value = false/);
});

test('frontend package identity changes when a signed version changes', () => {
  const catalog = readSource('src/extensions/frontend-catalog.ts');
  assert.match(catalog, /version: availability\.receipt\?\.version/);
  assert.match(catalog, /packageDigest: availability\.receipt\?\.packageDigest/);
  assert.match(catalog, /await disposeFrontendExtension\(availability\.extensionId\)/);
  assert.match(catalog, /definitionIdentities\.set\(availability\.extensionId, identity\)/);
});
