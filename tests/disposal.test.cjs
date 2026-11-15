const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function formHarness() {
  const state = [];
  let cursor = 0;
  const calls = [];
  let failNext = true;
  const mutation = { isPending: false, mutateAsync: async input => {
    calls.push(structuredClone(input));
    if (failNext) { failNext = false; throw new Error('response lost'); }
    return { items: [{ code: 'HUY-TEST' }] };
  } };
  const mocks = {
    react: { useState: initial => {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
      return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    } },
    '@/shared/router/compat': { useNavigate: () => () => {} },
    '@/shared/ui': { Button: 'button', Card: 'card', Checkbox: 'checkbox', FormField: 'field',
      PageHeader: 'header', QueryState: 'query', Select: 'select', SimpleTable: 'table', Callout: 'callout' },
    '@/shared/lib': { formatCases: String, formatDate: String, formatMoney: String },
    '../hooks': { useCreateDisposal: () => mutation, useDisposalCandidates: () => ({}) },
  };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname,
    '../src/features/disposal/pages/DisposalFormPage.tsx'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'exports', 'module', code)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), mod.exports, mod);
  const candidate = { batchCode: 'EXPIRED-A' };
  function find(node, type) {
    if (!node || typeof node !== 'object') return undefined;
    if (node.type === type) return node;
    const children = node.type === 'query' ? node.props.children([candidate]) : node.props?.children;
    return [children].flat(Infinity).map(child => find(child, type)).find(Boolean);
  }
  function render() {
    cursor = 0;
    const tree = mod.exports.DisposalFormPage();
    const table = find(tree, 'table');
    const checkbox = table.props.columns[0].cell(candidate);
    const select = find(tree, 'select');
    const buttons = [];
    function collect(node) {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'button') buttons.push(node);
      const children = node.type === 'query' ? node.props.children([candidate]) : node.props?.children;
      [children].flat(Infinity).forEach(collect);
    }
    collect(tree);
    return { checkbox, select, submit: buttons.find(b => b.props.variant === 'primary') };
  }
  return { render, calls, mutation };
}

test('disposal retry after a lost response keeps its operation ID; edited input gets a new ID', async () => {
  const h = formHarness();
  h.render().checkbox.props.onChange(true);
  await assert.rejects(h.render().submit.props.onClick(), /response lost/);
  await h.render().submit.props.onClick();
  assert.equal(h.calls[0].operationId, h.calls[1].operationId);
  assert.deepEqual(h.calls[1].batchCodes, ['EXPIRED-A']);
  h.render().select.props.onChange({ target: { value: 'Trả nhà cung cấp' } });
  await h.render().submit.props.onClick();
  assert.notEqual(h.calls[2].operationId, h.calls[1].operationId);
  assert.equal(h.calls[2].method, 'Trả nhà cung cấp');
});

test('pending disposal cannot change selected batches or method', async () => {
  const h = formHarness();
  h.render().checkbox.props.onChange(true);
  await assert.rejects(h.render().submit.props.onClick());
  h.mutation.isPending = true;
  h.render().checkbox.props.onChange(false);
  h.render().select.props.onChange({ target: { value: 'Trả nhà cung cấp' } });
  h.mutation.isPending = false;
  await h.render().submit.props.onClick();
  assert.deepEqual(h.calls[1], h.calls[0]);
});
