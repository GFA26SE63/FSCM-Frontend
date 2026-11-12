const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), module, module.exports);
  return module.exports;
}
function hooks() {
  const state = []; let index = 0;
  return { reset: () => { index = 0; }, useRef: () => ({ current: null }),
    useState(initial) {
      const key = index++;
      if (!(key in state)) state[key] = typeof initial === 'function' ? initial() : initial;
      return [state[key], next => { state[key] = typeof next === 'function' ? next(state[key]) : next; }];
    },
  };
}
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...[node.props?.children, node.props?.actions, node.props?.footer].flat(Infinity).flatMap(child => nodes(child, predicate))];
}
const ui = Object.fromEntries(['Button', 'Callout', 'Card', 'DataTable', 'FormField', 'Input', 'Modal', 'PageHeader', 'Select'].map(key => [key, key]));

test('selection is staged across renders, Cancel does not apply, and Apply commits deduplicated IDs', () => {
  const react = hooks(); let applied; let cancelled = 0;
  const { PromoSelectionModal } = load('features/promos/components/PromoSelectionModal.tsx', { react, '@/shared/ui': ui });
  const props = { title: 'Chọn', rows: [{ id: 'a' }, { id: 'b' }], columns: [], selectedIds: ['a', 'a'],
    rowLabel: r => r.id, onApply: ids => { applied = ids; }, onCancel: () => { cancelled++; } };
  const render = () => { react.reset(); return PromoSelectionModal(props); };
  let tree = render();
  const toggle = (id, checked) => {
    const table = nodes(tree, n => n.type === 'DataTable')[0];
    table.props.columns[0].render({ id }).props.children.props.onChange({ target: { checked } });
    tree = render();
  };
  toggle('b', true); toggle('b', true);
  assert.equal(applied, undefined);
  assert.deepEqual(props.selectedIds, ['a', 'a']);
  nodes(tree.props.footer, n => n.type === 'Button' && n.props.children === 'Cancel')[0].props.onClick();
  assert.equal(cancelled, 1); assert.equal(applied, undefined);
  tree.props.onClose(); // Escape/backdrop use this same cancellation handler.
  assert.equal(cancelled, 2); assert.equal(applied, undefined);
  nodes(tree.props.footer, n => n.type === 'Button' && n.props.children === 'Apply')[0].props.onClick();
  assert.deepEqual(applied, ['a', 'b']);
  toggle('a', false);
  nodes(tree.props.footer, n => n.type === 'Button' && n.props.children === 'Apply')[0].props.onClick();
  assert.deepEqual(applied, ['b']);
});

test('Apply is unavailable while loading, after a lookup error, or without loaded options', () => {
  const { PromoSelectionModal } = load('features/promos/components/PromoSelectionModal.tsx', { react: hooks(), '@/shared/ui': ui });
  for (const options of [{ loading: true }, { error: new Error('offline') }, { rows: undefined }]) {
    const tree = PromoSelectionModal({ title: 'Chọn', rows: [], columns: [], selectedIds: [], rowLabel: r => r.id, ...options });
    const apply = nodes(tree.props.footer, n => n.type === 'Button' && n.props.children === 'Apply')[0];
    assert.equal(apply.props.disabled, true);
  }
});

test('promotion form has two selected tables, preserves SKU rules when adding, and submits applied customers', async () => {
  const react = hooks(); const writes = [];
  const products = ['a', 'b'].map(id => ({ id, sku: 'SKU-' + id, name: 'Sản phẩm ' + id, status: 'Published' }));
  const retailers = [{ id: 'r1', code: 'RT1', name: 'Shop', status: 'Active' }];
  const dates = load('shared/lib/dates.ts');
  const { PromoFormPage } = load('features/promos/pages/PromoFormPage.tsx', {
    react, '@/shared/ui': ui, '@/shared/router/compat': { useNavigate: () => () => {} },
    '@/shared/lib': dates, '@/shared/api/errors': { errorMessage: String },
    '../components/PromoSelectionModal': { PromoSelectionModal: 'Picker' },
    '../hooks': { usePromoLookups: () => ({ products: { data: products }, retailers: { data: retailers } }),
      useCreatePromo: () => ({ mutateAsync: async input => { writes.push(input); return { id: 'saved' }; } }) },
  });
  const render = () => { react.reset(); return PromoFormPage(); };
  let tree = render();
  const button = label => nodes(tree, n => n.type === 'Button' && (n.props['aria-label'] === label || n.props.children === label))[0];
  assert.equal(nodes(tree, n => n.type === 'DataTable').length, 2);
  nodes(tree, n => n.type === 'Input' && n.props.maxLength === 200)[0].props.onChange({ target: { value: 'Campaign demo' } });
  tree = render();
  await button('Lưu nháp').props.onClick(); assert.equal(writes.length, 0); // An empty SKU list is invalid.
  button('Add sản phẩm').props.onClick(); tree = render();
  nodes(tree, n => n.type === 'Picker')[0].props.onApply(['a']); tree = render();
  let table = nodes(tree, n => n.type === 'DataTable')[0];
  for (const [key, value] of [['minimumQuantity', '10'], ['discountPercent', '5']])
    table.props.columns.find(c => c.key === key).render(products[0]).props.onChange({ target: { value } });
  tree = render(); button('Add sản phẩm').props.onClick(); tree = render();
  nodes(tree, n => n.type === 'Picker')[0].props.onApply(['a', 'b']); tree = render();
  table = nodes(tree, n => n.type === 'DataTable')[0];
  assert.equal(table.props.columns.find(c => c.key === 'minimumQuantity').render(products[0]).props.value, '10');
  assert.equal(table.props.columns.find(c => c.key === 'discountPercent').render(products[0]).props.value, '5');
  for (const [key, value] of [['minimumQuantity', '20'], ['discountPercent', '7']])
    table.props.columns.find(c => c.key === key).render(products[1]).props.onChange({ target: { value } });
  tree = render(); button('Add khách hàng').props.onClick(); tree = render();
  let picker = nodes(tree, n => n.type === 'Picker')[0];
  assert.deepEqual(picker.props.selectedIds, []);
  picker.props.onCancel(); tree = render();
  assert.deepEqual(nodes(tree, n => n.type === 'DataTable')[1].props.rows, []);
  button('Add khách hàng').props.onClick(); tree = render();
  picker = nodes(tree, n => n.type === 'Picker')[0]; picker.props.onApply(['r1']); tree = render();
  await button('Lưu nháp').props.onClick();
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].productIds, ['a', 'b']);
  assert.deepEqual(writes[0].retailerIds, ['r1']);
  assert.deepEqual(writes[0].productRules.map(r => r.discountPercent), [5, 7]);
  const modeSelect = nodes(tree, n => n.type === 'Select')[0];
  modeSelect.props.onChange({ target: { value: 'ProductGroup' } }); tree = render();
  button('Add sản phẩm').props.onClick(); tree = render();
  nodes(tree, n => n.type === 'Picker')[0].props.onApply(['b']); tree = render();
  for (const [label, value] of [['Tổng số lượng tối thiểu của nhóm', '30'], ['% giảm chung', '8']])
    nodes(tree, n => n.type === 'FormField' && n.props.label === label)[0].props.children.props.onChange({ target: { value } });
  tree = render();
  await button('Lưu nháp').props.onClick();
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[1].productIds, ['b']);
  assert.deepEqual(writes[1].productRules, []);
  assert.equal(writes[1].minimumQuantity, 30);
  assert.equal(writes[1].discountPercent, 8);
});
