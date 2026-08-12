import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const readSource = relativePath => readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');

const routeSegment = (source, path, nextPath) => {
  const start = source.indexOf(`path: '${path}'`);
  const end = source.indexOf(`path: '${nextPath}'`, start + 1);

  assert.notEqual(start, -1, `route ${path} should remain registered`);
  assert.notEqual(end, -1, `route after ${path} should remain registered`);
  return source.slice(start, end);
};

test('keeps config extensions out of system-level navigation', async () => {
  const [sideBar, tabBar, myPage, registry] = await Promise.all([
    readSource('src/components/SideBar.vue'),
    readSource('src/components/TabBar.vue'),
    readSource('src/views/My.vue'),
    readSource('src/extensions/registry.ts'),
  ]);

  assert.doesNotMatch(sideBar, /router\.push\('\/sync'\)/);
  assert.doesNotMatch(sideBar, /router\.push\('\/extensions\/config-generator'\)/);
  assert.match(sideBar, /router\.push\('\/extensions'\)/);

  assert.doesNotMatch(tabBar, /to="\/sync"/);
  assert.match(tabBar, /to="\/extensions"/);

  assert.doesNotMatch(myPage, /router\.push\('\/extensions\/config-generator'\)/);
  assert.match(myPage, /router\.push\('\/extensions'\)/);

  assert.doesNotMatch(registry, /CONFIG_GENERATOR:\s*'org\.substore\.config-generator\.navigation'/);
  assert.doesNotMatch(registry, /CONFIG_HOSTING:\s*'org\.substore\.config-hosting\.navigation'/);
  assert.doesNotMatch(registry, /navigationId:/);
  assert.doesNotMatch(registry, /^\s+navigation:\s*\[/m);
});

test('keeps one store entry for each config extension', async () => {
  const [extensionStore, frontendCatalog] = await Promise.all([
    readSource('src/views/extensions/ExtensionStore.vue'),
    readSource('src/extensions/frontend-catalog.ts'),
  ]);

  assert.match(extensionStore, /resolveExtensionOpenPath/);
  assert.match(extensionStore, /const extensionOpenPath = \(id: string\) => resolveExtensionOpenPath\([\s\S]*extensionStore\.manifest\(id\)/);
  assert.doesNotMatch(extensionStore, /return '\/extensions\/config-generator'/);
  assert.doesNotMatch(extensionStore, /return '\/sync'/);
  assert.doesNotMatch(frontendCatalog, /configGeneratorFrontendExtension/);
  assert.match(frontendCatalog, /configHostingFrontendExtension/);
});

test('keeps destructive confirmations above extension detail sheets', async () => {
  const extensionStore = await readSource('src/views/extensions/ExtensionStore.vue');

  assert.match(extensionStore, /z-index="12000"/);
  assert.match(extensionStore, /overlayClass:\s*'extension-store-confirm-overlay'/);
  assert.match(extensionStore, /popClass:\s*'auto-dialog extension-store-confirm-dialog'/);
  assert.match(extensionStore, /:global\(\.extension-store-confirm-overlay\)[\s\S]*z-index:\s*13000\s*!important/);
  assert.match(extensionStore, /:global\(\.extension-store-confirm-dialog\)[\s\S]*z-index:\s*13001\s*!important/);
});

test('keeps built-in routes and delegates installed extension routes to the dynamic outlet', async () => {
  const [router, hostingRoutes, outlet] = await Promise.all([
    readSource('src/router/index.ts'),
    readSource('src/extensions/config-hosting/routes.ts'),
    readSource('src/components/ExtensionRouteOutlet.vue'),
  ]);
  const syncRoute = routeSegment(hostingRoutes, '/sync', '/edit/sync/:id');

  assert.match(router, /frontendExtensionRouteContributions/);
  assert.match(router, /component:\s*ExtensionRouteOutlet/);
  assert.match(router, /path:\s*'\/extensions\/:extensionSlug\/:extensionPath\(\.\*\)\*'/);
  assert.match(router, /dynamicExtensionRoute:\s*true/);
  assert.match(syncRoute, /needTabBar:\s*false/);
  assert.match(syncRoute, /needNavBack:\s*true/);
  assert.match(syncRoute, /backPath:\s*'\/extensions'/);
  assert.match(outlet, /ensureFrontendExtensionDefinition/);
  assert.match(outlet, /registerFrontendExtensionRoutes/);
  assert.match(outlet, /route\.meta\.dynamicExtensionRoute && routesAdded/);
  assert.match(outlet, /router\.replace\(route\.fullPath\)/);
});

test('places plugin list actions after the back button hit area', async () => {
  const navBar = await readSource('src/components/NavBar.vue');
  const layoutStart = navBar.indexOf('const navLeftButtonLeft');
  const layoutEnd = navBar.indexOf('\nwatch(', layoutStart);
  const layout = navBar.slice(layoutStart, layoutEnd);

  assert.match(layout, /if \(isNeedBack\.value\)/);
  assert.match(layout, /if \(showAddButton\.value\) \{\s*buttons\.push\("add"\)/);
  assert.match(layout, /if \(showSettingsButton\.value\) \{\s*buttons\.push\("settings"\)/);
  assert.match(layout, /if \(showSourcesButton\.value\) \{\s*buttons\.push\("sources"\)/);
  assert.match(layout, /if \(showLocalInstallButton\.value\) \{\s*buttons\.push\("localInstall"\)/);
  assert.match(layout, /if \(showImportButton\.value\) \{\s*buttons\.push\("import"\)/);
  assert.match(layout, /if \(showSearchButton\.value\) \{\s*buttons\.push\("search"\)/);
  assert.match(layout, /acc\[key\] = `\$\{42 \+ index \* 30\}px`/);
});
