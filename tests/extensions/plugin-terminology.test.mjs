import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const readSource = relativePath => readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');

test('uses plugin terminology in navigation for every supported locale', async () => {
  const [zh, en, ru] = await Promise.all([
    readSource('src/locales/zh.ts'),
    readSource('src/locales/en.ts'),
    readSource('src/locales/ru.ts'),
  ]);

  assert.match(zh, /add:\s*['"]添加插件['"]/);
  assert.match(zh, /settings:\s*['"]插件设置['"]/);
  assert.match(zh, /sources:\s*['"]插件订阅源['"]/);
  assert.match(zh, /refresh:\s*['"]刷新插件['"]/);
  assert.match(zh, /extensions:\s*['"]插件['"]/);
  assert.match(zh, /extensionDiscover:\s*['"]发现插件['"]/);

  assert.match(en, /add:\s*['"]Add plugin['"]/);
  assert.match(en, /settings:\s*['"]Plugin settings['"]/);
  assert.match(en, /sources:\s*['"]Plugin sources['"]/);
  assert.match(en, /refresh:\s*['"]Refresh plugins['"]/);
  assert.match(en, /extensions:\s*['"]Plugins['"]/);
  assert.match(en, /extensionDiscover:\s*['"]Discover Plugins['"]/);

  assert.match(ru, /"add":\s*"Добавить плагин"/);
  assert.match(ru, /"settings":\s*"Настройки плагинов"/);
  assert.match(ru, /"sources":\s*"Источники плагинов"/);
  assert.match(ru, /"refresh":\s*"Обновить плагины"/);
  assert.match(ru, /"extensions":\s*"Плагины"/);
  assert.match(ru, /"extensionDiscover":\s*"Каталог плагинов"/);
});

test('uses plugin terminology on the store and plugin state surfaces', async () => {
  const [store, outlet] = await Promise.all([
    readSource('src/views/extensions/ExtensionStore.vue'),
    readSource('src/components/ExtensionRouteOutlet.vue'),
  ]);

  assert.doesNotMatch(store, /扩展/);
  assert.doesNotMatch(outlet, /扩展商店|\|\| '扩展'/);
  assert.match(store, /title:\s*'插件'/);
  assert.match(store, /title:\s*'Plugins'/);
  assert.match(outlet, /store:\s*'打开插件'/);
  assert.match(outlet, /store:\s*'Open plugins'/);
});

test('keeps the published extension protocol identifiers unchanged', async () => {
  const [router, contracts, api] = await Promise.all([
    readSource('src/router/index.ts'),
    readSource('src/extensions/contracts.ts'),
    readSource('src/api/extensions/index.ts'),
  ]);

  assert.match(router, /path:\s*['"]\/extensions['"]/);
  assert.match(router, /path:\s*['"]\/extensions\/:extensionSlug/);
  assert.match(contracts, /extensionId/);
  assert.match(api, /\/api\/extensions/);
});

test('uses plugin terminology in local package validation messages', async () => {
  const localDirectory = await readSource('src/extensions/localDirectory.ts');

  assert.doesNotMatch(localDirectory, /['"`]Extension (?:director|file|payload|package)/);
  assert.match(localDirectory, /Select a directory that contains a plugin package/);
  assert.match(localDirectory, /Plugin directories may contain at most/);
  assert.match(localDirectory, /Plugin directory files must be valid UTF-8 text/);
});
