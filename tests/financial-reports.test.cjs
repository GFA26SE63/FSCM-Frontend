const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const read = (f) => fs.readFileSync(path.resolve(__dirname, '../src', f), 'utf8');
function load(file, mocks = {}) {
  const code = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((n) => (n in mocks ? mocks[n] : require(n)), module, module.exports);
  return module.exports;
}

const layout = load('features/reports/reportLayout.ts');

test('financial report uses server-side endpoint /reports/financial (no browser GraphQL aggregation)', () => {
  const view = read('features/reports/FinancialReportView.tsx');
  assert.ok(view.includes("'/reports/financial'"));
  assert.ok(!view.includes('orderValueTotal'));
  assert.ok(!view.includes('writeOffValueTotal'));
  assert.ok(!fs.existsSync(path.resolve(__dirname, '../src/features/reports/FinancialReportsPage.tsx')));
  assert.ok(!fs.existsSync(path.resolve(__dirname, '../src/features/reports/orderValueTotal.ts')));
  assert.ok(!fs.existsSync(path.resolve(__dirname, '../src/features/reports/writeOffValueTotal.ts')));
});

test('financial report exposes 3 tabs (orders, receipts, refunds), Excel export, and excludes WarehouseKeeper', () => {
  const view = read('features/reports/FinancialReportView.tsx');
  assert.ok(view.includes("setTab('orders')"));
  assert.ok(view.includes("setTab('receipts')"));
  assert.ok(view.includes("setTab('refunds')"));
  assert.ok(view.includes('downloadExcel('));
  assert.equal(layout.canAccessReport('financial', 'Admin'), true);
  assert.equal(layout.canAccessReport('financial', 'Operator'), true);
  assert.equal(layout.canAccessReport('financial', 'SalesManager'), true);
  assert.equal(layout.canAccessReport('financial', 'WarehouseKeeper'), false);
  const routes = read('app/routes.tsx');
  assert.match(routes, /report-financial[^\n]*roles:\s*\[A,\s*OP,\s*SM\]/);
});
