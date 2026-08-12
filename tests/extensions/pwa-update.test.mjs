import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const readSource = path => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('prompts for waiting PWA updates and bounds runtime caches', () => {
  const [main, update, vite] = [
    readSource('src/main.ts'),
    readSource('src/utils/registerPwaUpdate.ts'),
    readSource('vite.config.ts'),
  ];
  assert.match(main, /registerPwaUpdate\(\)/);
  assert.match(update, /registerSW/);
  assert.match(update, /onNeedRefresh/);
  assert.match(update, /updateServiceWorker\(true\)/);
  assert.match(vite, /cacheName: "js-cache"[\s\S]*maxAgeSeconds/);
  assert.match(vite, /cacheName: "asset-cache"[\s\S]*maxEntries/);
});
