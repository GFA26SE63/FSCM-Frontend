const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'exports', 'module', code)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), mod.exports, mod);
  return mod.exports;
}
const dates = load('shared/lib/dates.ts');
const validation = load('features/config/validation.ts');

test('effective-date minimum changes at Vietnam midnight, including year boundaries', () => {
  assert.equal(dates.minimumVersionDate(undefined, new Date('2026-12-31T16:59:59Z')), '2027-01-01');
  assert.equal(dates.minimumVersionDate(undefined, new Date('2026-12-31T17:00:00Z')), '2027-01-02');
  assert.equal(dates.minimumVersionDate('2027-01-04T17:00:00Z', new Date('2026-12-31T17:00:00Z')), '2027-01-06');
  assert.equal(dates.vietnamDate('2026-10-24T17:00:00Z'), '2026-10-25');
});

test('allocation weights accept exact decimal sums and reject misleading rounded sums or blanks', () => {
  for (const values of [['.1', '.2', '.7'], ['0', '.5', '.5'], ['1', '0', '0'], ['1e-3', '.999', '0']])
    assert.equal(validation.validAllocationWeights(values), true);
  for (const values of [['.3333', '.3333', '.3333'], ['.3334', '.3334', '.3333'], ['', '.5', '.5'], ['Infinity', '0', '0'], ['-.1', '.5', '.6']])
    assert.equal(validation.validAllocationWeights(values), false);
});

test('minutes reject blank, fractional, negative and overflowing input', () => {
  for (const value of ['', ' ', '-1', '1.5', 'Infinity', '2147483648']) assert.equal(validation.validMinutes(value), false);
  for (const value of ['0', '120', '2147483647']) assert.equal(validation.validMinutes(value), true);
});

test('transit editor rejects today and fractional minutes before submitting to API', () => {
  const { validateTransitTable } = load('features/config/components/TransitTableSection.tsx', {
    '@/shared/hooks': { useCurrentTime: () => Date.now() }, '@/shared/ui': {}, '@/shared/lib': dates, '../validation': validation, '../hooks': {},
  });
  const row = { minKm: '0', maxKm: '20', handlingMinutes: '60', transitMinutes: '120', cost: '0' };
  const today = dates.vietnamDate();
  assert.ok(validateTransitTable([row], '20', today, today).length);
  const next = dates.minimumVersionDate(`${today}T00:00:00+07:00`);
  assert.deepEqual(validateTransitTable([row], '20', next, `${today}T00:00:00+07:00`), []);
  assert.ok(validateTransitTable([{ ...row, handlingMinutes: '1.5' }], '20', next, `${today}T00:00:00+07:00`).length);
});

test('ETA handler blocks duplicate slots and blank minutes even when invoked directly', () => {
  for (const state of [['', '0', '06:00'], ['60', '0', '06:00, 06:00']]) {
    let i = 0, writes = 0;
    const Button = () => null;
    const { RunScheduleSection } = load('features/config/components/RunScheduleSection.tsx', {
      react: { useState: () => [state[i++], () => {}], useEffect() {} },
      '@/shared/ui': { Button, Callout: 'div', FormField: 'label', Input: 'input' },
      '../validation': validation,
      '../hooks': { usePublishRunSchedule: () => ({ mutate: () => writes++ }) },
    });
    const tree = RunScheduleSection({ current: { preparationMinutes: 60, bufferMinutes: 0, dispatchSlotsLocalTime: ['06:00'], timeZone: 'Asia/Ho_Chi_Minh' } });
    const find = node => !node || typeof node !== 'object' ? undefined : node.type === Button ? node : [node.props?.children].flat(Infinity).map(find).find(Boolean);
    const button = find(tree);
    assert.equal(button.props.disabled, true);
    button.props.onClick();
    assert.equal(writes, 0);
  }
});

test('shelf-life handler rejects overlapping tiers and today before sending a request', async () => {
  const tier = { scope: 'Sku', productId: 'sku', minRemainingPercent: 0, maxRemainingPercent: 20, discountType: 'Percent', discountValue: 10 };
  for (const [tiers, date] of [[[tier], dates.vietnamDate()], [[tier, { ...tier, minRemainingPercent: 10 }], dates.minimumVersionDate()]]) {
    const state = [tiers, date, '', ''];
    let i = 0, writes = 0, message = '';
    const { ShelfLifeDialog } = load('features/batchpromo/components/ShelfLifeDialog.tsx', {
      react: { useState: () => { const index = i++; return [state[index], value => { if (index === 3) message = value; }]; } },
      '@/shared/ui': { Button: 'button', Callout: 'div', FormField: 'label', Input: 'input', Modal: 'dialog', SearchSelect: 'select', Select: 'select' },
      '@/shared/lib': dates, '@/shared/api/errors': { errorMessage: String },
      '@/features/promos/hooks': { usePromoLookups: () => ({ products: { data: [] }, categories: { data: [] } }) },
      '../hooks': { usePublishShelfLife: () => ({ mutateAsync: async () => writes++ }) },
    });
    const tree = ShelfLifeDialog({ initial: [tier], onClose() {} });
    const publish = tree.props.footer.props.children[1];
    await publish.props.onClick();
    assert.equal(writes, 0);
    assert.ok(message);
  }
});

test('campaign API sends every SKU rule and activation flag in one group request', async () => {
  const calls = [];
  const { promoApi } = load('features/promos/api.ts', { '@/shared/api/http': {
    post: async (url, body) => { calls.push({ url, body }); return [{ id: 'first' }, { id: 'second' }]; },
  } });
  const input = { requestId: 'request', campaignMode: 'PerSku', activateOnSave: true,
    productRules: [{ productId: 'a', minimumQuantity: 10, discountPercent: 5 }, { productId: 'b', minimumQuantity: 30, discountPercent: 7 }] };
  assert.equal((await promoApi.create(input)).id, 'first');
  assert.deepEqual(calls, [{ url: '/promotions/campaigns', body: input }]);
});

test('campaign form reuses its request ID after a lost response and changes it for edited input', async () => {
  const today = dates.vietnamDate();
  const state = ['Campaign retry', today, dates.addDays(today, 2), 'PerSku',
    [{ productId: 'a', minimumQuantity: '10', discountPercent: '5' }, { productId: 'b', minimumQuantity: '30', discountPercent: '7' }],
    '', '', [], [], '', false];
  const ref = { current: null };
  const calls = [];
  let index = 0;
  const { PromoFormPage } = load('features/promos/pages/PromoFormPage.tsx', {
    '../components/PromoSelectionModal': { PromoSelectionModal: 'PromoSelectionModal' },
    react: { useState: () => [state[index++], () => {}], useRef: () => ref },
    '@/shared/router/compat': { useNavigate: () => () => {} },
    '@/shared/lib': dates, '@/shared/api/errors': { errorMessage: String },
    '@/shared/ui': Object.fromEntries(['Button', 'Callout', 'Card', 'Checkbox', 'DataTable', 'FormField', 'Input', 'PageHeader', 'SearchSelect', 'Select'].map(key => [key, key])),
    '../hooks': { usePromoLookups: () => ({ products: { data: [] }, retailers: { data: [] } }),
      useCreatePromo: () => ({ mutateAsync: async input => { calls.push(input); throw new Error('Response lost'); } }) },
  });
  const find = node => !node || typeof node !== 'object' ? undefined : node.type === 'Button' && node.props.children === 'Lưu và kích hoạt' ? node : [node.props?.children].flat(Infinity).map(find).find(Boolean);
  const button = find(PromoFormPage());
  await button.props.onClick(); await button.props.onClick();
  assert.equal(calls.length, 2);
  assert.match(calls[0].requestId, /^[a-f0-9-]{36}$/);
  assert.equal(calls[0].requestId, calls[1].requestId);
  assert.deepEqual(calls[0].productRules.map(rule => rule.discountPercent), [5, 7]);
  state[0] = 'Edited campaign'; index = 0;
  await find(PromoFormPage()).props.onClick();
  assert.notEqual(calls[0].requestId, calls[2].requestId);
});
