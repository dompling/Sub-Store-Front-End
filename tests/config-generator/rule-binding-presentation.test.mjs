import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { transformWithEsbuild } from 'vite';

let getRemoteRuleBindingName;
let setRemoteRuleBindingName;
let getRemoteRuleActionTitle;

before(async () => {
  const moduleUrl = new URL(
    '../../src/views/extensions/editor/ruleBindingPresentation.ts',
    import.meta.url,
  );
  const source = await readFile(moduleUrl, 'utf8');
  const transformed = await transformWithEsbuild(
    source,
    fileURLToPath(moduleUrl),
    {
      format: 'esm',
      loader: 'ts',
      target: 'es2020',
    },
  );
  const executableUrl = `data:text/javascript;base64,${Buffer.from(transformed.code).toString('base64')}`;
  ({
    getRemoteRuleBindingName,
    setRemoteRuleBindingName,
    getRemoteRuleActionTitle,
  } = await import(executableUrl));
});

test('keeps a cleared RULE-SET name absent instead of restoring the internal rule-set id', () => {
  const rule = {
    kind: 'remote',
    name: 'Advertising',
    ruleSet: 'internal-rule-set-id',
    policy: 'REJECT',
  };

  setRemoteRuleBindingName(rule, '   ');

  assert.equal(Object.hasOwn(rule, 'name'), false);
  assert.equal(getRemoteRuleBindingName(rule), '');
  assert.equal(getRemoteRuleActionTitle(rule), 'RULE-SET');
  assert.equal(rule.ruleSet, 'internal-rule-set-id');

  const restoredRule = JSON.parse(JSON.stringify(rule));
  assert.equal(Object.hasOwn(restoredRule, 'name'), false);
  assert.equal(getRemoteRuleBindingName(restoredRule), '');
  assert.equal(getRemoteRuleActionTitle(restoredRule), 'RULE-SET');
});

test('shows only an explicitly entered RULE-SET name in the collapsed title', () => {
  const unnamedRule = {
    kind: 'remote',
    ruleSet: 'rule-set-1720000000000',
    policy: 'DIRECT',
  };
  const namedRule = {
    ...unnamedRule,
    name: '  Advertising  ',
  };

  assert.equal(getRemoteRuleActionTitle(unnamedRule), 'RULE-SET');
  assert.equal(getRemoteRuleActionTitle(namedRule), 'RULE-SET · Advertising');
});

test('preserves a user-entered RULE-SET name until the user clears it', () => {
  const rule = {
    kind: 'remote',
    ruleSet: 'internal-rule-set-id',
    policy: 'REJECT',
  };

  setRemoteRuleBindingName(rule, '  Custom Ads  ');
  assert.equal(rule.name, 'Custom Ads');
  assert.equal(getRemoteRuleBindingName(rule), 'Custom Ads');

  setRemoteRuleBindingName(rule, '');
  assert.deepEqual(rule, {
    kind: 'remote',
    ruleSet: 'internal-rule-set-id',
    policy: 'REJECT',
  });
});
