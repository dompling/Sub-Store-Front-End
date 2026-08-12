import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('describes executable third-party extensions without overstating digest verification', async () => {
  const view = await readFile(path.join(root, 'src/views/extensions/ExtensionStore.vue'), 'utf8');

  assert.match(view, /Node 可执行扩展会在后端进程中运行，请只添加你信任的来源/);
  assert.match(view, /Executable Node extensions run inside the backend process, so add only sources you trust/);
  assert.doesNotMatch(view, /第三方来源仅安装不执行代码/);
  assert.doesNotMatch(view, /content-only extensions that execute no code/);
});

test('local install copy names the complete generated package metadata', async () => {
  const view = await readFile(path.join(root, 'src/views/extensions/ExtensionStore.vue'), 'utf8');

  assert.match(view, /manifest\.json、receipt\.json 和 package\.json/);
  assert.match(view, /manifest\.json, receipt\.json, and package\.json/);
});
