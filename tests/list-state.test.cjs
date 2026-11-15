const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function source(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const module = { exports: {} };
  const imports = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('.') || name.startsWith('@/')) {
      throw new Error('Missing boundary mock: ' + name + ' in ' + file);
    }
    return require(name);
  };
  new Function('require', 'module', 'exports', code)(imports, module, module.exports);
  return module.exports;
}

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

const listState = source('shared/router/listState.ts', {
  react: { useCallback: (fn) => fn, useMemo: (fn) => fn() },
  'react-router-dom': { useHistory: () => ({}), useLocation: () => ({ pathname: '/', search: '' }) },
});

beforeEach(() => {
  globalThis.sessionStorage = new MemoryStorage();
});

test('paramName namespaces table params only when a namespace is given', () => {
  assert.equal(listState.paramName(undefined, 'q'), 'q');
  assert.equal(listState.paramName('drivers', 'page'), 'drivers.page');
});

test('parsePage rejects invalid, negative, zero and huge values', () => {
  assert.equal(listState.parsePage(null), 1);
  assert.equal(listState.parsePage('3'), 3);
  assert.equal(listState.parsePage('0'), 1);
  assert.equal(listState.parsePage('-2'), 1);
  assert.equal(listState.parsePage('abc'), 1);
  assert.equal(listState.parsePage('2.5'), 1);
  assert.equal(listState.parsePage('9999999'), 1);
});

test('isIsoDate accepts only real yyyy-MM-dd dates', () => {
  assert.equal(listState.isIsoDate('2026-02-28'), true);
  assert.equal(listState.isIsoDate('2026-02-30'), false);
  assert.equal(listState.isIsoDate('2026-2-3'), false);
  assert.equal(listState.isIsoDate('<script>'), false);
  assert.equal(listState.isIsoDate(''), false);
});

test('listHref returns the last remembered list URL and falls back to the plain route', () => {
  assert.equal(listState.listHref('/orders'), '/orders');
  listState.rememberLocation('/orders', '?trangthai=Moi&page=3');
  assert.equal(listState.listHref('/orders'), '/orders?trangthai=Moi&page=3');
  // Other modules keep their own namespace.
  assert.equal(listState.listHref('/retailers'), '/retailers');
  // Explicit query string wins over memory.
  assert.equal(listState.listHref('/orders?x=1'), '/orders?x=1');
});

test('clearing filters on a list is remembered as the plain route', () => {
  listState.rememberLocation('/orders', '?q=abc');
  listState.rememberLocation('/orders', '');
  assert.equal(listState.listHref('/orders'), '/orders');
});

test('memory survives corrupted storage and is cleared on logout', () => {
  sessionStorage.setItem('fscm.listLocations.v1', '{not json');
  assert.equal(listState.listHref('/orders'), '/orders');
  sessionStorage.setItem('fscm.listLocations.v1', JSON.stringify({ '/orders': 'javascript:alert(1)', '/skus': '?q=a' }));
  assert.equal(listState.listHref('/orders'), '/orders');
  assert.equal(listState.listHref('/skus'), '/skus?q=a');
  listState.clearRememberedLocations();
  assert.equal(listState.listHref('/skus'), '/skus');
});

test('memory is bounded', () => {
  for (let i = 0; i < 100; i += 1) listState.rememberLocation(`/p${i}`, `?page=${i + 2}`);
  const stored = JSON.parse(sessionStorage.getItem('fscm.listLocations.v1'));
  assert.ok(Object.keys(stored).length <= 60);
  assert.equal(listState.listHref('/p99'), '/p99?page=101');
});

test('return-to-list marker is recognised only for the dedicated state', () => {
  assert.equal(listState.isReturnToListState(listState.RETURN_TO_LIST_STATE), true);
  assert.equal(listState.isReturnToListState(undefined), false);
  assert.equal(listState.isReturnToListState({ other: true }), false);
});
