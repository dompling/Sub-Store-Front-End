import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { transformWithEsbuild } from 'vite';

let buildExtensionDirectoryProjection;

before(async () => {
  const moduleUrl = new URL('../../src/extensions/localDirectory.ts', import.meta.url);
  const source = await readFile(moduleUrl, 'utf8');
  const transformed = await transformWithEsbuild(source, fileURLToPath(moduleUrl), {
    format: 'esm',
    loader: 'ts',
    target: 'es2020',
  });
  const executableUrl = `data:text/javascript;base64,${Buffer.from(transformed.code).toString('base64')}`;
  ({ buildExtensionDirectoryProjection } = await import(executableUrl));
});

const file = (path, content = '{}', size = new TextEncoder().encode(content).byteLength) => ({
  name: path.split('/').at(-1),
  size,
  webkitRelativePath: path,
  arrayBuffer: async () => new TextEncoder().encode(content).buffer,
});

const metadataFiles = (root = 'sample') => [
  file(`${root}/manifest.json`, '{"id":"demo"}'),
  file(`${root}/receipt.json`, '{"schemaVersion":1}'),
  file(`${root}/package.json`, '{"format":"substore-extension-package-v1"}'),
];

const rejectCode = async (files, code) => {
  await assert.rejects(
    () => buildExtensionDirectoryProjection(files),
    error => error?.code === code,
  );
};

test('builds a deterministic text-only directory projection with the common root removed', async () => {
  const projection = await buildExtensionDirectoryProjection([
    ...metadataFiles(),
    file('sample/content/rules.json', '{"ok":true}'),
  ]);

  assert.deepEqual(projection, {
    schemaVersion: 1,
    format: 'substore-extension-directory-v1',
    rootName: 'sample',
    files: {
      'content/rules.json': '{"ok":true}',
      'manifest.json': '{"id":"demo"}',
      'package.json': '{"format":"substore-extension-package-v1"}',
      'receipt.json': '{"schemaVersion":1}',
    },
  });
});

test('rejects multiple roots, unsafe paths and duplicate relative names', async () => {
  await rejectCode([
    file('one/manifest.json'),
    file('two/content.json'),
  ], 'EXTENSION_DIRECTORY_MULTIPLE_ROOTS');
  await rejectCode([
    file('sample/manifest.json'),
    file('sample/../escape.json'),
  ], 'EXTENSION_DIRECTORY_PATH_INVALID');
  await rejectCode([
    file('sample/manifest.json'),
    file('sample/content.json'),
    file('sample/content.json'),
  ], 'EXTENSION_DIRECTORY_DUPLICATE_PATH');
  await rejectCode([
    file('sample/manifest.json'),
    file('sample\\escape.json'),
  ], 'EXTENSION_DIRECTORY_PATH_INVALID');
  await rejectCode([
    file('sample/manifest.json'),
    file('sample/__proto__/payload.json'),
  ], 'EXTENSION_DIRECTORY_PATH_INVALID');
  await rejectCode([
    file('sample/manifest.json'),
    file('sample/control\u0001.json'),
  ], 'EXTENSION_DIRECTORY_PATH_INVALID');
});

test('rejects case-insensitive and Unicode-normalized path collisions', async () => {
  await rejectCode([
    file('sample/manifest.json'),
    file('sample/backend/Index.cjs'),
    file('sample/backend/index.cjs'),
  ], 'EXTENSION_DIRECTORY_PATH_COLLISION');

  await rejectCode([
    file('sample/manifest.json'),
    file('sample/content/café.json'),
    file('sample/content/cafe\u0301.json'),
  ], 'EXTENSION_DIRECTORY_PATH_COLLISION');
});

test('enforces package file-count and byte limits', async () => {
  const maximumPackage = metadataFiles();
  for (let index = 0; index < 128; index += 1) {
    maximumPackage.push(file(`sample/content/${index}.json`));
  }

  const projection = await buildExtensionDirectoryProjection(maximumPackage);
  assert.equal(Object.keys(projection.files).length, 131);

  const tooMany = [
    ...maximumPackage,
    file('sample/content/128.json'),
  ];
  await rejectCode(tooMany, 'EXTENSION_DIRECTORY_FILE_COUNT_EXCEEDED');

  await rejectCode([
    ...metadataFiles(),
    file('sample/large.txt', '', 2 * 1024 * 1024 + 1),
  ], 'EXTENSION_DIRECTORY_FILE_TOO_LARGE');

  await rejectCode([
    ...metadataFiles(),
    file('sample/a.txt', '', 2 * 1024 * 1024),
    file('sample/b.txt', '', 2 * 1024 * 1024),
    file('sample/c.txt', '', 2 * 1024 * 1024),
    file('sample/d.txt', '', 2 * 1024 * 1024),
    file('sample/e.txt', '', 1),
  ], 'EXTENSION_DIRECTORY_TOO_LARGE');
});

test('requires a root manifest and valid UTF-8 text', async () => {
  await rejectCode([
    file('sample/receipt.json'),
    file('sample/package.json'),
    file('sample/content.json'),
  ], 'EXTENSION_DIRECTORY_MANIFEST_MISSING');

  await rejectCode([
    file('sample/manifest.json'),
    file('sample/package.json'),
  ], 'EXTENSION_DIRECTORY_METADATA_MISSING');

  await rejectCode([
    ...metadataFiles(),
    {
      name: 'binary.dat',
      size: 2,
      webkitRelativePath: 'sample/binary.dat',
      arrayBuffer: async () => Uint8Array.from([0xc3, 0x28]).buffer,
    },
  ], 'EXTENSION_DIRECTORY_TEXT_INVALID');
});
