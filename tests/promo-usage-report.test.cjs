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
  new Function('require', 'module', 'exports', code)(name => Object.hasOwn(mocks, name)
    ? mocks[name]
    : name === '@/shared/api/graphql' ? { graphql: async () => ({ entities: { promotionReads: [] } }) } : require(name), module, module.exports);
  return module.exports;
}

test('promoApi.usage requests operations report filtered by program code', async () => {
  const calls = [];
  const { promoApi } = load('features/promos/api.ts', {
    '@/shared/api/http': {
      get: async (url, params) => {
        calls.push({ url, params });
        return { totalCount: 1, items: [{ id: '1', orderCode: 'SO-001', discountAmount: 50000 }] };
      },
      post: async () => {},
    },
  });

  const res = await promoApi.usage('KM-SUMMER');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/reports/operations/promotions');
  assert.equal(calls[0].params.program, 'KM-SUMMER');
  assert.equal(res.items.length, 1);
  assert.equal(res.items[0].orderCode, 'SO-001');
});

test('OperationsReportsPage contains promotion-grouping tabs and program summary columns', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/features/reports/OperationsReportsPage.tsx'), 'utf8');
  assert.ok(source.includes('byProgram'), 'OperationsReportsPage must define byProgram in Result');
  assert.ok(source.includes('Tổng hợp theo khuyến mãi'), 'OperationsReportsPage must have view switch for promotions');
  assert.ok(source.includes('Chi tiết các đơn hàng áp dụng'), 'OperationsReportsPage must have order detail tab');
  assert.ok(source.includes('Tổng hợp giá trị sử dụng theo chương trình khuyến mãi'), 'OperationsReportsPage must render summary card');
  assert.ok(source.includes('Tổng tiền giảm KM (VND)'), 'OperationsReportsPage must show total discount column');
  assert.ok(source.includes('Xem đơn hàng'), 'OperationsReportsPage must have button to drill into orders of that promo');
});

test('PromoDetailPage embeds promotion usage and order list card', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/features/promos/pages/PromoDetailPage.tsx'), 'utf8');
  assert.ok(source.includes('usePromoUsage'), 'PromoDetailPage must use usePromoUsage hook');
  assert.ok(source.includes('Đơn hàng đã sử dụng & Hiệu quả khuyến mãi'), 'PromoDetailPage must display usage card');
  assert.ok(source.includes('Tổng giá trị khuyến mãi đã dùng'), 'PromoDetailPage must display total discount used');
  assert.ok(source.includes('Số đơn hàng áp dụng'), 'PromoDetailPage must display applied order count');
});
