import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

const rootUrl = new URL('../../', import.meta.url);
const readSource = relativePath => readFile(new URL(relativePath, rootUrl), 'utf8');

test('loads executable extension surfaces only through the verified dynamic loader', async () => {
  const [router, catalog, contracts, registry, outlet, navBar, syncEditor] = await Promise.all([
    readSource('src/router/index.ts'),
    readSource('src/extensions/frontend-catalog.ts'),
    readSource('src/extensions/contracts.ts'),
    readSource('src/extensions/registry.ts'),
    readSource('src/components/ExtensionRouteOutlet.vue'),
    readSource('src/components/NavBar.vue'),
    readSource('src/views/SyncEditor.vue'),
  ]);

  assert.doesNotMatch(router, /views\/extensions\/ConfigGenerator/);
  assert.match(router, /frontendExtensionRouteContributions/);
  assert.match(router, /component:\s*ExtensionRouteOutlet/);
  for (const [name, source] of [
    ['router', router],
    ['frontend catalog', catalog],
    ['manifest registry', registry],
    ['route outlet', outlet],
  ]) {
    assert.doesNotMatch(
      source,
      /(?:from|import\()\s*['"](?:@\/extensions\/|\.\.?\/)config-generator(?:\/[^'"]*)?['"]\)?/,
      `${name} must not statically import config-generator`,
    );
  }
  assert.doesNotMatch(catalog, /configGeneratorFrontendExtension/);
  assert.doesNotMatch(registry, /configGeneratorManifest/);
  assert.match(catalog, /const builtInDefinitions:[\s\S]*configHostingFrontendExtension/);

  assert.match(contracts, /ExtensionKind = [^;]*'executable'/);
  assert.match(catalog, /assertVerifiedFrontend\(availability, runtime\)/);
  assert.match(catalog, /manifest\?\.kind === 'trusted-official'/);
  assert.match(catalog, /manifest\?\.kind === 'executable'/);
  assert.match(catalog, /runtime === 'node'/);
  assert.match(catalog, /availability\.receipt\?\.installationStatus === 'installed'/);
  assert.match(catalog, /source-integrity/);
  assert.match(catalog, /local-integrity/);
  assert.match(catalog, /crypto\.subtle\.digest\([\s\S]*'SHA-256'/);
  assert.match(catalog, /fetchVerifiedText\(entryAsset\.url, entryAsset\.digest\)/);
  assert.match(catalog, /fetchVerifiedText\(styleAsset\.url, styleAsset\.digest\)/);
  assert.match(catalog, /receiptFileDigests\(availability\)\[asset\.path\] \|\| asset\.digest/);
  assert.match(catalog, /\/api\/extensions\/\$\{encodeURIComponent\(extensionId\)\}\/assets\//);
  assert.match(catalog, /new Blob\(\[source\], \{ type: 'application\/javascript' \}\)/);
  assert.match(catalog, /style\.dataset\.substoreExtension = extensionId/);
  assert.match(catalog, /pendingRegistrations\.add\(availability\.extensionId\)/);
  assert.match(catalog, /frontendDefinitionIdentity\(availability, runtime\)/);
  assert.match(catalog, /definitionIdentities\.get\(availability\.extensionId\) === identity/);
  assert.match(catalog, /await disposeFrontendExtension\(availability\.extensionId\)/);
  assert.match(catalog, /definitionIdentities\.set\(availability\.extensionId, identity\)/);

  assert.match(outlet, /extensionSurfaceId/);
  assert.match(outlet, /ensureFrontendExtensionDefinition/);
  assert.match(outlet, /registerFrontendExtensionRoutes/);
  assert.match(outlet, /loadFrontendExtensionSurface/);
  assert.match(outlet, /route\.meta\.dynamicExtensionRoute && routesAdded/);
  assert.match(outlet, /router\.replace\(route\.fullPath\)/);

  assert.doesNotMatch(navBar, /addConfigGenerator|importConfigGenerator/);
  assert.doesNotMatch(navBar, /route\.path === ["']\/extensions\/config-generator["']/);
  assert.doesNotMatch(syncEditor, /useConfigGeneratorStore|configGeneratorProjects/);
  assert.match(syncEditor, /getArtifactSources/);
});

test('installs immutable Host globals before plugin execution and cleans failed disposal state', async () => {
  const [catalog, frontendSdk] = await Promise.all([
    readSource('src/extensions/frontend-catalog.ts'),
    readSource('src/extensions/frontend-sdk-v1.ts'),
  ]);

  assert.match(frontendSdk, /export \* from 'vue';/);
  assert.doesNotMatch(catalog, /import \* as frontendSdkV1/);
  assert.match(catalog, /type FrontendSdkV1 = typeof import\(['"]@\/extensions\/frontend-sdk-v1['"]\)/);

  const sdkDefinition = catalog.slice(
    catalog.indexOf("const frontendSdkGlobal = '__SUBSTORE_EXTENSION_FRONTEND_SDK_V1__'"),
    catalog.indexOf('export const registerFrontendExtensionDefinition'),
  );
  assert.match(sdkDefinition, /const installFrontendSdkGlobal = async/);
  assert.match(sdkDefinition, /import\(['"]@\/extensions\/frontend-sdk-v1['"]\)/);
  assert.match(sdkDefinition, /Object\.getOwnPropertyDescriptor/);
  assert.match(sdkDefinition, /Object\.defineProperty/);
  assert.match(sdkDefinition, /configurable:\s*false/);
  assert.match(sdkDefinition, /writable:\s*false/);
  assert.match(sdkDefinition, /sdkDescriptor\.configurable !== false/);
  assert.match(sdkDefinition, /sdkDescriptor\.writable !== false/);
  assert.match(sdkDefinition, /FrontendExtensionSdkGlobalInvalid/);

  const ensureDefinition = catalog.slice(
    catalog.indexOf('export const ensureFrontendExtensionDefinition'),
    catalog.indexOf('export const registerFrontendExtensionRoutes'),
  );
  const installIndex = ensureDefinition.indexOf('await installFrontendSdkGlobal()');
  const executeIndex = ensureDefinition.indexOf('await executeTrustedBundle');
  assert.ok(installIndex >= 0, 'the verified loader must install the Host SDK');
  assert.ok(executeIndex > installIndex, 'the Host SDK must be installed before an extension executes');

  const disposeDefinition = catalog.slice(
    catalog.indexOf('export const disposeFrontendExtension'),
    catalog.indexOf('const unwrapComponent'),
  );
  assert.match(disposeDefinition, /try\s*\{[\s\S]*definition\?\.dispose\?\.\(\)/);
  assert.match(disposeDefinition, /finally\s*\{/);
  assert.match(disposeDefinition, /routeRemoversById\.delete\(extensionId\)/);
  assert.match(disposeDefinition, /stylesById\.delete\(extensionId\)/);
  assert.match(disposeDefinition, /definitionsById\.delete\(extensionId\)/);
  assert.match(disposeDefinition, /throw disposalErrors\[0\]/);
  assert.match(disposeDefinition, /FrontendExtensionDisposeFailed/);
});

test('keeps the complete Vue runtime ABI without bundling third-party extension assets', async () => {
  const [sdk, sdkContract] = await Promise.all([
    readSource('src/extensions/frontend-sdk-v1.ts'),
    readSource('src/extensions/frontend-sdk-v1.contract.d.ts'),
  ]);

  assert.match(sdk, /export \* from ['"]vue['"]/);
  assert.match(
    sdkContract,
    /Exclude<[\s\S]*keyof VueRuntimeExports,[\s\S]*keyof FrontendSdkV1Exports/,
  );
  assert.match(
    sdkContract,
    /AssertNoMissingExports<[\s\S]*MissingVueRuntimeExports/,
  );

  await Promise.all([
    assert.rejects(
      access(new URL('../../public/extensions/org.substore.config-generator/1.1.0/frontend/index.js', import.meta.url)),
    ),
    assert.rejects(
      access(new URL('../../public/extensions/org.substore.config-generator/1.1.0/frontend/style.css', import.meta.url)),
    ),
  ]);
});

test('keeps config-generator business messages out of Host locales', async () => {
  const locales = await Promise.all([
    readSource('src/locales/zh.ts'),
    readSource('src/locales/en.ts'),
    readSource('src/locales/ru.ts'),
  ]);

  for (const source of locales) {
    assert.doesNotMatch(source, /["']?configGenerator["']?\s*:/);
  }
});

test('keeps disabled or missing routes fail-closed when frontend disposal reports an error', async () => {
  const outlet = await readSource('src/components/ExtensionRouteOutlet.vue');
  const disabledBranch = outlet.slice(
    outlet.indexOf('if (!surfaceReady.value)'),
    outlet.indexOf("surfaceLoadError.value = 'FRONTEND_EXTENSION_ROUTE_INVALID'"),
  );

  assert.match(outlet, /surfaceReady\.value && surfaceLoadError\.value[\s\S]*'frontend-load-failed'/);
  assert.match(disabledBranch, /try\s*\{[\s\S]*await disposeFrontendExtension\(extensionId\.value\)/);
  assert.match(disabledBranch, /catch \(error: any\)/);
  assert.match(disabledBranch, /surfaceLoadError\.value = error\?\.message \|\| 'FRONTEND_EXTENSION_DISPOSE_FAILED'/);
  assert.match(disabledBranch, /console\.error\('\[extensions\] frontend disposal failed', error\)/);
  assert.doesNotMatch(disabledBranch, /loadFrontendExtensionSurface/);
});
