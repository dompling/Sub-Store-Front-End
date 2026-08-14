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
  artifactSourceContributionId,
  artifactSourcePlatforms,
  artifactSourceRepresentations,
  findArtifactSourceByRef,
  findArtifactSourceDescriptor,
  findArtifactSourceItem,
  resourceRefFromArtifactSource,
  resolveArtifactSourcePlatform,
  resolveArtifactSourceRepresentation,
} = await import(executableUrl);

const preciseSource = {
  id: 'org.example.config-projects',
  sourceId: 'org.example.config-projects',
  ownerExtensionId: 'org.example.generator',
  type: 'config-project',
  contract: 'substore.config-project@1',
  status: 'enabled',
  platforms: ['Surge', 'QX', 'Clash', 'Loon'],
  representations: ['surge-config', 'qx-config', 'clash-config', 'loon-config'],
  items: [
    {
      name: 'demo',
      displayName: 'Demo',
      ref: {
        schema: 'substore.resource-ref@1',
        providerId: 'org.example.generator',
        providerContributionId: 'org.example.config-projects',
        type: 'config-project',
        id: 'demo',
        contract: 'substore.config-project@1',
      },
      representations: ['surge-config', 'qx-config', 'clash-config', 'loon-config'],
    },
  ],
};

test('uses exact contribution identity when providers share a type', () => {
  const sources = [
    { ...preciseSource, id: 'org.example.first', sourceId: 'org.example.first' },
    preciseSource,
  ];
  assert.equal(
    findArtifactSourceDescriptor(sources, 'org.example.config-projects'),
    preciseSource,
  );
  assert.equal(findArtifactSourceDescriptor(sources, 'config-project'), undefined);
});

test('constructs and round-trips a full ResourceRef from a strict descriptor', () => {
  const item = findArtifactSourceItem(preciseSource, 'demo');
  const ref = resourceRefFromArtifactSource(preciseSource, item);

  assert.deepEqual(ref, preciseSource.items[0].ref);
  assert.equal(findArtifactSourceByRef([preciseSource], ref), preciseSource);
  assert.equal(artifactSourceContributionId(preciseSource), 'org.example.config-projects');
});

test('keeps persisted representations stable and maps them to their platform', () => {
  assert.equal(
    resolveArtifactSourceRepresentation({
      source: preciseSource,
      item: preciseSource.items[0],
      representation: 'clash-config',
      platform: 'Surge',
    }),
    'clash-config',
  );
  assert.equal(
    resolveArtifactSourcePlatform({
      source: preciseSource,
      item: preciseSource.items[0],
      representation: 'clash-config',
      platform: 'Surge',
    }),
    'Clash',
  );
});

test('does not guess between multiple representations for one platform', () => {
  const ruleSource = {
    ...preciseSource,
    type: 'rule-set',
    contract: 'substore.rule-set@1',
    platforms: ['Surge', 'QX', 'Clash', 'Loon'],
    representations: [
      'surge-rule-list',
      'qx-filter',
      'clash-classical-yaml',
      'clash-classical-text',
      'clash-domain-yaml',
      'clash-ipcidr-yaml',
      'loon-rule-list',
    ],
  };
  assert.equal(
    resolveArtifactSourceRepresentation({ source: ruleSource, platform: 'Clash' }),
    '',
  );
  assert.equal(
    resolveArtifactSourceRepresentation({
      source: { ...ruleSource, representations: ['clash-domain-yaml'] },
      platform: 'Clash',
    }),
    'clash-domain-yaml',
  );
});

test('keeps built-in artifact platforms unchanged without a descriptor', () => {
  assert.equal(
    resolveArtifactSourcePlatform({ platform: 'Stash' }),
    'Stash',
  );
});

test('normalizes duplicate declarations and item-level representations', () => {
  assert.deepEqual(
    artifactSourcePlatforms({ platforms: ['Surge', '', 'QX', 'Surge', null] }),
    ['Surge', 'QX'],
  );
  assert.deepEqual(
    artifactSourceRepresentations(
      { representations: ['surge-config'] },
      { name: 'demo', representations: ['qx-config', '', 'qx-config'] },
    ),
    ['qx-config'],
  );
});
