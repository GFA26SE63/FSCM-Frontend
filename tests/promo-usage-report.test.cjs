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

test('promoApi.usage queries /reports/promotions with exactProgramCode and valid 366-day window', async () => {
  const calls = [];
  const { promoApi } = load('features/promos/api.ts', {
    '@/shared/api/http': {
      get: async (url, params) => {
        calls.push({ url, params });
        return {
          items: {
            totalCount: 1,
            items: [{
              id: '1', acceptedAt: '2026-11-10T00:00:00Z', retailerCode: 'RT01', retailerName: 'Cửa hàng 1',
              orderId: 'ord-1', orderCode: 'SO-001', sku: 'SKU-1', productName: 'Sữa', quantity: 5,
              totalDiscountAmount: 50000, orderStatus: 'Completed',
            }],
          },
        };
      },
      post: async () => {},
    },
  });

  const res = await promoApi.usage('KM-SUMMER');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/reports/promotions');
  assert.equal(calls[0].params.exactProgramCode, 'KM-SUMMER');
  const rangeDays = (Date.parse(calls[0].params.toDate) - Date.parse(calls[0].params.fromDate)) / 86400000;
  assert.ok(rangeDays <= 366, 'Promo usage window must respect backend 367-day limit');
  assert.equal(res.items.length, 1);
  assert.equal(res.items[0].orderCode, 'SO-001');
  assert.equal(res.items[0].discountAmount, 50000);
});

test('PromotionsReportView contains promotion-grouping tabs and program summary columns', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/features/reports/PromotionsReportView.tsx'), 'utf8');
  assert.ok(source.includes('byProgram'));
  assert.ok(source.includes('Tổng hợp theo khuyến mãi'));
  assert.ok(source.includes('Chi tiết các đơn hàng áp dụng'));
  assert.ok(source.includes('Hiệu quả từng chương trình khuyến mãi'));
  assert.ok(source.includes('Tổng giảm (% Gross)'));
  assert.ok(source.includes('Xem đơn'));
});

test('PromoDetailPage embeds promotion usage and order list card', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/features/promos/pages/PromoDetailPage.tsx'), 'utf8');
  assert.ok(source.includes('usePromoUsage'));
  assert.ok(source.includes('Đơn hàng đã sử dụng & Hiệu quả khuyến mãi'));
});
