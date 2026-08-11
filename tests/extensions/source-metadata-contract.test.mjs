import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const rootUrl = new URL('../../', import.meta.url);
const readSource = (relativePath) => readFile(new URL(relativePath, rootUrl), 'utf8');

test('keeps catalog publisher metadata explicit, nullable, and URL-independent', async () => {
  const [contracts, store] = await Promise.all([
    readSource('src/extensions/contracts.ts'),
    readSource('src/store/extensions.ts'),
  ]);

  const sourceContract = contracts.slice(
    contracts.indexOf('export interface ExtensionSource {'),
    contracts.indexOf('export interface ExtensionArtifactSourceItem'),
  );
  assert.match(sourceContract, /publisher:\s*Pick<ExtensionPublisher,\s*["']id["']\s*\|\s*["']name["']>\s*\|\s*null;/);

  const catalogContract = contracts.slice(
    contracts.indexOf('export interface ExtensionCatalogEntry'),
    contracts.indexOf('export interface ExtensionInstallTask'),
  );
  assert.match(catalogContract, /sourceUrl\?:\s*string;/);
  assert.match(catalogContract, /sourceName\?:\s*string;/);

  const publisherNormalizer = store.slice(
    store.indexOf('const normalizeSourcePublisher'),
    store.indexOf('const normalizeSource ='),
  );
  assert.match(publisherNormalizer, /!isRecord\(value\)/);
  assert.match(publisherNormalizer, /Array\.isArray\(value\)/);
  assert.match(publisherNormalizer, /value\.id\.trim\(\)/);
  assert.match(publisherNormalizer, /value\.name\.trim\(\)/);
  assert.match(publisherNormalizer, /return id && name \? \{ id, name \} : null/);
  assert.doesNotMatch(publisherNormalizer, /sourceUrl|item\.url|new URL|github|hostname/i);

  const sourceNormalizer = store.slice(
    store.indexOf('const normalizeSource ='),
    store.indexOf('const unwrapSources ='),
  );
  assert.match(sourceNormalizer, /publisher:\s*normalizeSourcePublisher\(item\.publisher\)/);

  const catalogNormalizer = store.slice(
    store.indexOf('const normalizeCatalogEntry ='),
    store.indexOf('const normalizeRuntimeEntry ='),
  );
  assert.match(catalogNormalizer, /typeof item\.sourceUrl === ["']string["']/);
  assert.match(catalogNormalizer, /typeof item\.source === ["']string["']/);
  assert.match(catalogNormalizer, /sourceName:\s*item\.sourceName\.trim\(\)/);
});
