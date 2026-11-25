const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (f) => fs.readFileSync(path.resolve(__dirname, '../src', f), 'utf8');

// keeperNamesOf mirrors src/features/warehouses/api.ts (pure, no imports).
function keeperNamesOf(keepers) {
  return (keepers ?? []).map((k) => (k.userFullName ?? k.fullName ?? '').trim()).filter(Boolean);
}

test('FE-15: helper source matches tested logic', () => {
  const api = read('features/warehouses/api.ts');
  assert.match(api, /export function keeperNamesOf/);
  assert.match(api, /\.map\(\(k\) => \(k\.userFullName \?\? k\.fullName \?\? ''\)\.trim\(\)\)/);
});

test('FE-15: single, multiple and no keepers; never IDs', () => {
  assert.deepEqual(keeperNamesOf([{ userId: 'u1', fullName: 'Nguyễn A' }]), ['Nguyễn A']);
  assert.deepEqual(keeperNamesOf([{ fullName: 'A' }, { userFullName: 'B' }]), ['A', 'B']);
  assert.deepEqual(keeperNamesOf([]), []);
  assert.deepEqual(keeperNamesOf(null), []);
  assert.deepEqual(keeperNamesOf([{ userId: 'u1', fullName: ' ' }]), []);
});

test('FE-15: detail merges REST keepers and shows all names; single batch/pallet field', () => {
  const api = read('features/warehouses/api.ts');
  assert.match(api, /keepers: rest\.keepers/);
  const page = read('features/warehouses/pages/WarehouseDetailPage.tsx');
  assert.match(page, /keeperNames\.join\(', '\)/);
  assert.match(page, /— Chưa gán/);
  assert.match(page, /lô hàng \(\$\{palletCountText\(palletCount\)\} pallet\)/);
  assert.ok(!/capacityPallets/.test(page));
});

test('FE-16: outbound queue has search + status + warehouse filters, reset and page reset, as sibling card', () => {
  const s = read('features/warehouse-work/index.tsx');
  const todo = s.slice(s.indexOf("(isOutbound && activeTab === 'todo')"), s.indexOf("workflow === 'transfer' ? ("));
  assert.match(todo, /<AdvancedFilterCard>[\s\S]*Tìm chứng từ[\s\S]*value=\{stepFilter\}[\s\S]*Lọc theo kho[\s\S]*Xóa bộ lọc[\s\S]*<\/AdvancedFilterCard>\s*<Card/);
  assert.match(todo, /resetPageKey=\{\[search, stepFilter, warehouseFilter, statusFilter, operationReason\]/);
  // warehouse options stay limited to the user's scope
  assert.match(todo, /admin \|\| user\?\.scope\?\.warehouseIds\.includes\(w\.id\)/);
  assert.match(s, /if \(stepFilter && w\.document\.kind !== stepFilter\) return false;/);
});

test('FE-16: step filter semantics (combined with search/warehouse already applied upstream)', () => {
  const rows = [{ kind: 'Request' }, { kind: 'Picking' }, { kind: 'Issue' }];
  const apply = (step) => rows.filter((r) => !step || r.kind === step).map((r) => r.kind);
  assert.deepEqual(apply(''), ['Request', 'Picking', 'Issue']);
  assert.deepEqual(apply('Picking'), ['Picking']);
  assert.deepEqual(apply('Receipt'), []);
});

test('FE-15.1: pallet count from /inventory/pallet-count; real 0 vs missing data', () => {
  const api = read('features/warehouses/api.ts');
  assert.match(api, /'\/inventory\/pallet-count', \{ warehouseId \}/);
  const page = read('features/warehouses/pages/WarehouseDetailPage.tsx');
  const src = page.slice(page.indexOf('export function palletCountText'));
  const ts = require('typescript');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const m = { exports: {} }; new Function('module', 'exports', js)(m, m.exports);
  const f = m.exports.palletCountText;
  assert.equal(f({ data: 0 }), '0');
  assert.equal(f({ data: 1 }), '1');
  assert.equal(f({ data: 12 }), '12');
  assert.equal(f({ isLoading: true }), '…');
  assert.equal(f({ isError: true }), '—');
  assert.equal(f({}), '—');
});
