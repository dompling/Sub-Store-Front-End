import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const rootUrl = new URL('../../', import.meta.url);
const readSource = relativePath => readFile(new URL(relativePath, rootUrl), 'utf8');

test('artifact contracts retain legacy metadata and add precise ResourceRef fields', async () => {
  const [contracts, artifacts] = await Promise.all([
    readSource('src/extensions/contracts.ts'),
    readSource('src/types/store/artifacts.d.ts'),
  ]);

  assert.match(contracts, /interface ResourceRefV1[\s\S]*schema:\s*['"]substore\.resource-ref@1['"]/);
  for (const field of ['providerId', 'providerContributionId', 'type', 'id', 'contract']) {
    assert.match(contracts, new RegExp(`${field}:\\s*string`));
  }
  assert.match(contracts, /ExtensionArtifactSourceDescriptor[\s\S]*id\?:\s*string\s*\|\s*null/);
  assert.match(contracts, /representations\?:\s*string\[\]/);
  assert.match(artifacts, /type ArtifactType = KnownArtifactType \| \(string & \{\}\)/);
  assert.match(artifacts, /sourceRef\?:\s*import\(['"]@\/extensions\/contracts['"]\)\.ResourceRefV1/);
  assert.match(artifacts, /representation\?:\s*string/);
});

test('config-hosting picker persists exact provider identity and fails closed', async () => {
  const editor = await readSource('src/views/SyncEditor.vue');

  assert.match(editor, /sourceModel\.value = \[selection\.contributionId, selection\.itemId\]/);
  assert.match(editor, /data\.sourceRef = \{ \.\.\.form\.sourceRef \}/);
  assert.match(editor, /data\.representation = `\$\{form\.representation \|\| ["']{2}\}`\.trim\(\)/);
  assert.match(editor, /selectedRepresentationUnsupported/);
  assert.match(editor, /legacySourceAmbiguous/);
  assert.match(editor, /resourceSourceStatus/);
  assert.match(editor, /Persisted precise records fail closed/);
});
