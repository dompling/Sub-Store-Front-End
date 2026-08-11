import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const readSource = path => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('extension contracts expose installed, available, and rollback versions', () => {
  const contracts = readSource('src/extensions/contracts.ts');
  assert.match(contracts, /installedVersion\?: string/);
  assert.match(contracts, /availableVersion\?: string/);
  assert.match(contracts, /rollbackAvailable\?: boolean/);
  assert.match(contracts, /rollbackVersions\?: string\[\]/);
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

test('frontend package identity changes when a signed version changes', () => {
  const catalog = readSource('src/extensions/frontend-catalog.ts');
  assert.match(catalog, /version: availability\.receipt\?\.version/);
  assert.match(catalog, /packageDigest: availability\.receipt\?\.packageDigest/);
  assert.match(catalog, /await disposeFrontendExtension\(availability\.extensionId\)/);
  assert.match(catalog, /definitionIdentities\.set\(availability\.extensionId, identity\)/);
});
