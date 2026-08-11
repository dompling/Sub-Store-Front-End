import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const readSource = (relativePath) => readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');

test('uses the extension directory media type and dedicated local install endpoints', async () => {
  const api = await readSource('src/api/extensions/index.ts');

  assert.match(api, /application\/vnd\.substore\.extension-directory\+json/);
  assert.match(api, /url: '\/api\/admin\/extensions\/packages\/inspect'/);
  assert.match(api, /url: `\/api\/admin\/extensions\/\$\{encodeURIComponent\(id\)\}\/install-local`/);
  assert.match(api, /inspectLocalPackage:[\s\S]*?data: projection/);
  assert.match(api, /installLocal:[\s\S]*?data: projection/);
});

test('keeps management credentials and concurrency fences in request headers', async () => {
  const api = await readSource('src/api/extensions/index.ts');
  const inspectStart = api.indexOf('inspectLocalPackage:');
  const normalInstallStart = api.indexOf('install: (id:', inspectStart);
  const localMethods = api.slice(inspectStart, normalInstallStart);

  assert.match(localMethods, /controlHeaders\(options\)/);
  assert.doesNotMatch(localMethods, /adminToken\s*:/);
  assert.doesNotMatch(localMethods, /expectedRevision\s*:/);
  assert.doesNotMatch(localMethods, /idempotencyKey\s*:/);
  assert.match(api.slice(normalInstallStart), /data: controlBody\(options\)/);
});

test('clears an invalid in-memory admin token after local inspect or install authentication fails', async () => {
  const store = await readSource('src/store/extensions.ts');
  const inspectStart = store.indexOf('async inspectLocalPackage');
  const enableStart = store.indexOf('async enable', inspectStart);
  const localActions = store.slice(inspectStart, enableStart);

  assert.match(localActions, /isAdminAuthFailure\(error\).*clearAdminToken\(\)/s);
  assert.match(localActions, /api\.installLocal/);
});

test('fails closed when the current runtime manifest cannot be refreshed', async () => {
  const [store, outlet] = await Promise.all([
    readSource('src/store/extensions.ts'),
    readSource('src/components/ExtensionRouteOutlet.vue'),
  ]);
  const failedGuard = store.indexOf("if (['unknown', 'failed'].includes(this.discoveryStatus))");
  const staleRuntimeBranch = store.indexOf('if (entry || receipt || this.backendManifestAvailable)', failedGuard);

  assert.notEqual(failedGuard, -1);
  assert.notEqual(staleRuntimeBranch, -1);
  assert.ok(failedGuard < staleRuntimeBranch, 'failed discovery must win over a stale enabled runtime entry');
  assert.match(store.slice(failedGuard, staleRuntimeBranch), /status: 'unknown'/);
  assert.match(
    outlet,
    /surfaceReady = computed\(\(\) => \['enabled', 'bundled'\]\.includes\(availability\.value\.status\)\)/,
  );
});

test('exposes local executable package installation only on a capable Node Host', async () => {
  const [store, extensionStore] = await Promise.all([
    readSource('src/store/extensions.ts'),
    readSource('src/views/extensions/ExtensionStore.vue'),
  ]);

  assert.match(store, /supportsLocalPackageInstall:[\s\S]*?state\.runtime\?\.runtime === ["']node["']/);
  assert.match(store, /capabilities\?\.supportsTrustedOfficialPackage === true/);
  assert.match(extensionStore, /v-if=["']extensionStore\.supportsLocalPackageInstall["']/);
  assert.match(extensionStore, /if \(!extensionStore\.supportsLocalPackageInstall\) return;/);
});

test('treats an open Node control plane as directly manageable without a token', async () => {
  const [contracts, store] = await Promise.all([
    readSource('src/extensions/contracts.ts'),
    readSource('src/store/extensions.ts'),
  ]);

  assert.match(contracts, /managementMode\?:\s*'open'\s*\|\s*'token'\s*\|\s*'read-only'/);
  assert.match(store, /state\.runtime\?\.managementMode === 'open'/);
  assert.match(
    store,
    /this\.runtime\.managementMode === 'open'[\s\S]*this\.runtime\.managementMode === 'token'/,
  );
});
