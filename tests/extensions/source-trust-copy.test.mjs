import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('describes executable third-party plugins without overstating digest verification', async () => {
  const view = await readFile(path.join(root, 'src/views/extensions/ExtensionStore.vue'), 'utf8');

  assert.match(view, /Node 可执行插件会在后端进程中运行，请只添加你信任的来源/);
  assert.match(view, /Executable Node plugins run inside the backend process, so add only sources you trust/);
  assert.match(view, /摘要校验用于发现内容漂移，不代表作者身份认证或沙箱隔离/);
  assert.match(view, /Digest checks detect content drift; they do not authenticate the publisher or provide sandbox isolation/);
  assert.match(view, /本地插件将与 Sub-Store 共享运行环境/);
  assert.doesNotMatch(view, /第三方来源仅安装不执行代码/);
  assert.doesNotMatch(view, /content-only extensions that execute no code/);
});

test('local install copy names the complete generated package metadata', async () => {
  const view = await readFile(path.join(root, 'src/views/extensions/ExtensionStore.vue'), 'utf8');

  assert.match(view, /manifest\.json、receipt\.json 和 package\.json/);
  assert.match(view, /manifest\.json, receipt\.json, and package\.json/);
});
