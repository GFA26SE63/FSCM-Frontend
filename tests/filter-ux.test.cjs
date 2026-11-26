const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const read = (f) => fs.readFileSync(path.resolve(__dirname, '../src', f), 'utf8');

function load(file, mocks = {}) {
  const code = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((n) => (n in mocks ? mocks[n] : require(n)), module, module.exports);
  return module.exports;
}

test('dispatch sort: newest/oldest by Sales Order createdAt, stable ties', () => {
  const { sortExportOrders } = load('features/shipments/exportList.ts', { '@/shared/api/errors': {}, './types': {} });
  const o = (id, code, createdAt) => ({ id, orderCode: code, createdAt });
  const rows = [o('3', 'SO-2', '2026-01-02T00:00:00Z'), o('1', 'SO-1', '2026-01-01T00:00:00Z'), o('2', 'SO-3', '2026-01-02T00:00:00Z')];
  assert.deepEqual(sortExportOrders(rows, 'newest').map((r) => r.id), ['3', '2', '1']);
  assert.deepEqual(sortExportOrders(rows, 'oldest').map((r) => r.id), ['1', '3', '2']);
});

test('dispatch page: two order-sort options, no shipment sort, region names from Regions API', () => {
  const s = read('features/shipments/pages/OrderReadinessPage.tsx');
  assert.ok(!/shipmentSort|Sắp xếp phiếu giao/.test(s));
  assert.match(s, /label: 'Mới nhất'[\s\S]*label: 'Cũ nhất'/);
  assert.ok(!/codeAsc|codeDesc/.test(s));
  assert.match(s, /useRegions\(\)/);
  assert.match(s, /regionNameById\.get\(r\.id\)/);
  assert.match(s, /setWarehouseFilter\(''\)/); // region change resets warehouse
  assert.match(s, /regionOfCode\.get\(part\.warehouseCode\)\?\.id === regionFilter/); // filter by ID
});

test('batches page: single advanced filter card, exactly two HSD sorts, title as page title', () => {
  const b = read('features/batches/pages/BatchesPage.tsx');
  const css = read('shared/ui/styles.css');
  const d = read('shared/ui/DataTable.tsx');
  assert.match(b, /titleAboveFilters/);
  assert.match(b, /filterClassName="batches-filter-card"/);
  assert.match(css, /\.batches-filter-card \.filter-grid \{ grid-template-columns: minmax\(280px, 1\.35fr\) repeat\(4, minmax\(170px, 1fr\)\) auto; \}/);
  assert.equal((b.match(/HSD (tăng|giảm) dần/g) || []).length, 2);
  assert.ok(!/Mặc định|Mới nhất|Cũ nhất/.test(b));
  assert.ok(!/Xóa bộ lọc/.test(b)); // single reset lives in the shared card
  assert.match(b, /sortSlot=/);
  assert.match(d, /!sortSlot && <label/); // standalone "Sắp xếp danh sách" suppressed
  assert.match(d, /titleAboveFilters \? 'page-title'/);
  // title/sort slot are rendered in the filter card, before the table
  assert.ok(d.indexOf('{sortSlot}') < d.indexOf('</section>'));
  assert.match(read('shared/ui/styles.css'), /\.page-title \{[^}]*font-size: 22px/);
});

test('warehouse pages: every filter block uses the shared Bộ lọc nâng cao card', () => {
  const w = read('features/warehouse-work/index.tsx');
  const f = read('features/warehouse-work/FactoryPending.tsx');
  assert.equal((w.match(/<AdvancedFilterCard/g) || []).length, 4); // trace + 2 outbound + transfer
  assert.ok(!/<div className="warehouse-work-filters">/.test(w));
  assert.match(f, /<AdvancedFilterCard>/);
  assert.ok(!/factory-pending-filters/.test(f));
  const c = read('shared/ui/AdvancedFilterCard.tsx');
  assert.match(c, /className="card filter-card"/);
  assert.match(c, /Bộ lọc nâng cao/);
});

// Structural (AST) check: AdvancedFilterCard must never be a descendant of a Card.
function jsxName(n) { return n.tagName ? n.tagName.getText() : (n.openingElement && n.openingElement.tagName.getText()); }
function analyze(file) {
  const sf = ts.createSourceFile(file, read(file), ts.ScriptTarget.ES2020, true, ts.ScriptKind.TSX);
  const found = [];
  (function walk(n) {
    if ((ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) && jsxName(n) === 'AdvancedFilterCard') {
      let anc = n.parent, insideCard = false;
      while (anc) { if (ts.isJsxElement(anc) && jsxName(anc) === 'Card') insideCard = true; anc = anc.parent; }
      // siblings: the Card that follows within the same parent element/fragment
      const par = n.parent;
      const sibs = (par.children || []).filter((c) => ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c));
      found.push({ insideCard, siblingCard: sibs.some((c) => jsxName(c) === 'Card') });
    }
    ts.forEachChild(n, walk);
  })(sf);
  return found;
}

test('AdvancedFilterCard is a sibling of the business Card, never nested in it (AST)', () => {
  const w = analyze('features/warehouse-work/index.tsx');
  const f = analyze('features/warehouse-work/FactoryPending.tsx');
  assert.equal(w.length, 4);
  assert.equal(f.length, 1);
  for (const x of [...w, ...f]) {
    assert.equal(x.insideCard, false, 'filter card nested inside a Card');
    assert.equal(x.siblingCard, true, 'filter card has no sibling Card');
  }
});
