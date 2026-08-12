import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(
  new URL('../../src/store/extensions.ts', import.meta.url),
  'utf8',
);

test('reconciles source state after both successful and failed refreshes', () => {
  const block = source.match(/async refreshSource\(sourceId: string\)[\s\S]*?async removeSource/)?.[0] || '';
  assert.match(block, /finally/);
  assert.match(block, /await this\.refresh\(\{ silent: true, force: true \}\)/);
});

test('uses a runtime-only revision fence before full extension refresh', () => {
  const block = source.match(/async refreshOnRevisionFence\(\)[\s\S]*?startRevisionSync/)?.[0] || '';
  assert.match(block, /api\.getRuntime\(this\.runtime\?\.etag\)/);
  assert.match(block, /response\?\.status === 304/);
  assert.match(block, /return this\.refresh\(\{ silent: true, force: true \}\)/);
});
