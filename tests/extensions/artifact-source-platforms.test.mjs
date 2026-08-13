import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { transformWithEsbuild } from 'vite';

const moduleUrl = new URL('../../src/utils/artifactSourcePlatforms.ts', import.meta.url);
const source = await readFile(moduleUrl, 'utf8');
const transformed = await transformWithEsbuild(source, fileURLToPath(moduleUrl), {
  format: 'esm',
  loader: 'ts',
  target: 'es2020',
});
const executableUrl = `data:text/javascript;base64,${Buffer.from(transformed.code).toString('base64')}`;
const {
  artifactSourcePlatforms,
  resolveArtifactSourcePlatform,
} = await import(executableUrl);

const sources = [
  {
    type: 'config-project',
    platforms: ['Surge', 'QX', 'Clash', 'Loon'],
  },
];

test('uses an extension artifact source first platform instead of the built-in Stash default', () => {
  assert.equal(
    resolveArtifactSourcePlatform({
      sources,
      type: 'config-project',
      platform: 'Stash',
    }),
    'Surge',
  );
});

test('preserves a supported extension artifact platform', () => {
  assert.equal(
    resolveArtifactSourcePlatform({
      sources,
      type: 'config-project',
      platform: 'QX',
    }),
    'QX',
  );
});

test('keeps built-in artifact platforms unchanged', () => {
  assert.equal(
    resolveArtifactSourcePlatform({
      sources,
      type: 'subscription',
      platform: 'Stash',
    }),
    'Stash',
  );
});

test('normalizes duplicate and empty platform declarations for the editor', () => {
  assert.deepEqual(
    artifactSourcePlatforms({
      platforms: ['Surge', '', 'QX', 'Surge', null],
    }),
    ['Surge', 'QX'],
  );
});
