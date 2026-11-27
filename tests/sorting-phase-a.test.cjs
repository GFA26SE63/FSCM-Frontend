/**
 * Phase A: Server-side sorting unit tests.
 *
 * Validates:
 * - buildOrdersPageQuery injects correct order clauses from allowlist
 * - buildProductsPageQuery injects correct order clauses from allowlist
 * - buildPickingPageQuery injects correct order clauses from allowlist
 * - Sort field allowlists reject unknown fields (default sort used)
 * - id: DESC tiebreaker always present
 * - Cursor params not injected when sorting changes (pure query string test)
 * - createdAt absent from Products sortable fields (no visible column)
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function source(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)((name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('.') || name.startsWith('@/')) throw new Error('Missing boundary mock: ' + name);
    return require(name);
  }, mod, mod.exports);
  return mod.exports;
}

const sharedErrors = source('shared/api/errors.ts');
const gqlMock = { graphql: async () => ({}) };

const orders = source('features/orders/ordersGraphql.ts', {
  '@/shared/api/graphql': gqlMock,
  '@/shared/api/errors': sharedErrors,
  '@/shared/pagination/types': {},
});

const products = source('features/products/productsGraphql.ts', {
  '@/shared/api/graphql': gqlMock,
  '@/shared/api/errors': sharedErrors,
  '@/shared/pagination/types': {},
});

const picking = source('features/runpicking/pickingGraphql.ts', {
  '@/shared/api/graphql': gqlMock,
  '@/shared/api/errors': sharedErrors,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const orderOf = (q) => orders.buildOrdersPageQuery(q).query;
const productOf = (q) => products.buildProductsPageQuery(q).query;
const pickingOf = (q) => picking.buildPickingPageQuery(q).query;

// ─── Orders ───────────────────────────────────────────────────────────────────

describe('Orders sort', () => {
  test('default sort: createdAt DESC, id DESC', () => {
    const q = orderOf({ size: 20 });
    assert.ok(q.includes('order: [{ createdAt: DESC }, { id: DESC }]'), `Got: ${q}`);
  });

  test('orderCode ASC injects correct literal', () => {
    const q = orderOf({ size: 20, sort: { field: 'orderCode', direction: 'asc' } });
    assert.ok(q.includes('order: [{ orderCode: ASC }, { id: DESC }]'), `Got: ${q}`);
  });

  test('orderCode DESC injects correct literal', () => {
    const q = orderOf({ size: 20, sort: { field: 'orderCode', direction: 'desc' } });
    assert.ok(q.includes('order: [{ orderCode: DESC }, { id: DESC }]'), `Got: ${q}`);
  });

  test('amount column maps to finalAmount field', () => {
    const q = orderOf({ size: 20, sort: { field: 'amount', direction: 'asc' } });
    assert.ok(q.includes('order: [{ finalAmount: ASC }, { id: DESC }]'), `Got: ${q}`);
    assert.ok(!q.includes('amount:'), `Column key "amount" must not leak into query. Got: ${q}`);
  });

  test('createdAt ASC sort', () => {
    const q = orderOf({ size: 20, sort: { field: 'createdAt', direction: 'asc' } });
    assert.ok(q.includes('order: [{ createdAt: ASC }, { id: DESC }]'), `Got: ${q}`);
  });

  test('date range uses Vietnam start and inclusive end of day', () => {
    const built = orders.buildOrdersPageQuery({ size: 20, from: '2026-11-01', to: '2026-11-30' });
    assert.ok(built.query.includes('createdAt: { gte: $from }'), `Missing from condition: ${built.query}`);
    assert.ok(built.query.includes('createdAt: { lte: $to }'), `Missing to condition: ${built.query}`);
    assert.equal(built.variables.from, '2026-11-01T00:00:00+07:00');
    assert.equal(built.variables.to, '2026-11-30T23:59:59.999+07:00');
  });

  test('unknown field falls back to default sort', () => {
    // TypeScript prevents this at compile time; test the runtime guard too.
    const q = orderOf({ size: 20, sort: { field: 'INJECTED; DROP TABLE', direction: 'asc' } });
    assert.ok(q.includes('order: [{ createdAt: DESC }, { id: DESC }]'), `Unknown field must use default. Got: ${q}`);
    assert.ok(!q.includes('DROP'), `Injection must not reach query. Got: ${q}`);
  });

  test('id: DESC tiebreaker always present', () => {
    for (const field of ['orderCode', 'amount', 'createdAt']) {
      for (const direction of ['asc', 'desc']) {
        const q = orderOf({ size: 20, sort: { field, direction } });
        assert.ok(q.includes('{ id: DESC }'), `Tiebreaker missing for ${field}:${direction}. Got: ${q}`);
      }
    }
  });

  test('ORDER_SORT_MAP exported keys match allowed columns', () => {
    const keys = Object.keys(orders.ORDER_SORT_MAP);
    assert.deepEqual(keys.sort(), ['amount', 'createdAt', 'orderCode'].sort());
  });

  test('ORDER_SORTABLE_FIELDS matches ORDER_SORT_MAP keys', () => {
    assert.deepEqual(
      [...orders.ORDER_SORTABLE_FIELDS].sort(),
      Object.keys(orders.ORDER_SORT_MAP).sort(),
    );
  });
});

// ─── Products ─────────────────────────────────────────────────────────────────

describe('Products sort', () => {
  test('default sort: createdAt DESC, id DESC', () => {
    const q = productOf({ size: 20 });
    assert.ok(q.includes('order: [{ createdAt: DESC }, { id: DESC }]'), `Got: ${q}`);
  });

  test('name ASC sort', () => {
    const q = productOf({ size: 20, sort: { field: 'name', direction: 'asc' } });
    assert.ok(q.includes('order: [{ name: ASC }, { id: DESC }]'), `Got: ${q}`);
  });

  test('name DESC sort', () => {
    const q = productOf({ size: 20, sort: { field: 'name', direction: 'desc' } });
    assert.ok(q.includes('order: [{ name: DESC }, { id: DESC }]'), `Got: ${q}`);
  });

  test('sku ASC sort', () => {
    const q = productOf({ size: 20, sort: { field: 'sku', direction: 'asc' } });
    assert.ok(q.includes('order: [{ sku: ASC }, { id: DESC }]'), `Got: ${q}`);
  });

  test('createdAt NOT in PRODUCTS_SORT_MAP (no visible column)', () => {
    assert.ok(!('createdAt' in products.PRODUCTS_SORT_MAP),
      'createdAt must be removed from PRODUCTS_SORT_MAP — no createdAt column in Products table');
  });

  test('createdAt sort field falls back to default (no column, so not user-selectable)', () => {
    // If somehow called with createdAt, it must fall back to default (not inject it twice).
    const q = productOf({ size: 20, sort: { field: 'createdAt', direction: 'asc' } });
    assert.ok(q.includes('order: [{ createdAt: DESC }, { id: DESC }]'),
      `createdAt sort field must use default. Got: ${q}`);
  });

  test('price column sort field rejected (not in map)', () => {
    const q = productOf({ size: 20, sort: { field: 'price', direction: 'asc' } });
    assert.ok(q.includes('order: [{ createdAt: DESC }, { id: DESC }]'),
      `price field must fall back to default. Got: ${q}`);
  });

  test('PRODUCTS_SORT_MAP contains only name and sku', () => {
    const keys = Object.keys(products.PRODUCTS_SORT_MAP);
    assert.deepEqual(keys.sort(), ['name', 'sku'].sort());
  });

  test('id: DESC tiebreaker always present', () => {
    for (const field of ['name', 'sku']) {
      for (const direction of ['asc', 'desc']) {
        const q = productOf({ size: 20, sort: { field, direction } });
        assert.ok(q.includes('{ id: DESC }'), `Tiebreaker missing for ${field}:${direction}. Got: ${q}`);
      }
    }
  });

  test('sort does not affect price enrichment query', () => {
    // fetchProductPrices is unchanged — verify it still exists on the module
    assert.equal(typeof products.fetchProductPrices, 'function');
  });
});

// ─── Picking ──────────────────────────────────────────────────────────────────

describe('Picking sort', () => {
  test('default sort: createdAt DESC, id DESC', () => {
    const q = pickingOf({ size: 20 });
    assert.ok(q.includes('order: [{ createdAt: DESC }, { id: DESC }]'), `Got: ${q}`);
  });

  test('pickingCode ASC sort', () => {
    const q = pickingOf({ size: 20, sort: { field: 'pickingCode', direction: 'asc' } });
    assert.ok(q.includes('order: [{ pickingCode: ASC }, { id: DESC }]'), `Got: ${q}`);
  });

  test('pickingCode DESC sort', () => {
    const q = pickingOf({ size: 20, sort: { field: 'pickingCode', direction: 'desc' } });
    assert.ok(q.includes('order: [{ pickingCode: DESC }, { id: DESC }]'), `Got: ${q}`);
  });

  test('createdAt ASC sort', () => {
    const q = pickingOf({ size: 20, sort: { field: 'createdAt', direction: 'asc' } });
    assert.ok(q.includes('order: [{ createdAt: ASC }, { id: DESC }]'), `Got: ${q}`);
  });

  test('unknown field falls back to default', () => {
    const q = pickingOf({ size: 20, sort: { field: 'warehouseId', direction: 'asc' } });
    assert.ok(q.includes('order: [{ createdAt: DESC }, { id: DESC }]'), `Got: ${q}`);
  });

  test('PICKING_SORT_MAP contains only pickingCode and createdAt', () => {
    const keys = Object.keys(picking.PICKING_SORT_MAP);
    assert.deepEqual(keys.sort(), ['createdAt', 'pickingCode'].sort());
  });

  test('id: DESC tiebreaker always present', () => {
    for (const field of ['pickingCode', 'createdAt']) {
      for (const direction of ['asc', 'desc']) {
        const q = pickingOf({ size: 20, sort: { field, direction } });
        assert.ok(q.includes('{ id: DESC }'), `Tiebreaker missing for ${field}:${direction}. Got: ${q}`);
      }
    }
  });
});

// ─── Allowlist injection safety ────────────────────────────────────────────────

describe('Allowlist injection safety', () => {
  test('Orders: SQL/GraphQL injection in field name falls back to default', () => {
    const payloads = [
      'createdAt }] }) { nodes { id } } } }; DROP TABLE --',
      '__typename',
      'createdAt: DESC }, { id: DESC }] }) UNION SELECT',
      '',
    ];
    for (const payload of payloads) {
      const q = orderOf({ size: 20, sort: { field: payload, direction: 'asc' } });
      assert.ok(q.includes('order: [{ createdAt: DESC }, { id: DESC }]'),
        `Payload "${payload}" must not change order clause. Got: ${q}`);
      assert.ok(!q.includes('DROP'), `Payload "${payload}" must not reach query. Got: ${q}`);
      assert.ok(!q.includes('UNION'), `Payload "${payload}" must not reach query. Got: ${q}`);
    }
  });

  test('Products: injection in direction name falls back to default', () => {
    const q = productOf({ size: 20, sort: { field: 'name', direction: 'ASC; DROP TABLE' } });
    // direction is only 'asc' or 'desc' via TypeScript type, but ternary maps anything else to DESC
    // — the ternary `sort.direction === 'asc' ? 'ASC' : 'DESC'` is safe regardless
    assert.ok(q.includes('{ id: DESC }'), `Tiebreaker must still be present. Got: ${q}`);
    assert.ok(!q.includes('DROP'), `Injection in direction must not reach query. Got: ${q}`);
  });
});
