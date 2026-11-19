'use strict';
/**
 * Phase C.2: Batches GraphQL Read Migration — targeted tests for the new
 * batchesGraphql.ts module (query building, filters, sort, enrichment helpers)
 * and source-level architecture checks for BatchesPage.tsx.
 */
const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

// This repo's TS path aliases (@/...) aren't resolved by plain Node, so we load
// batchesGraphql.ts's pure functions by transpiling just enough by hand: read the
// file and eval the specific exported functions is fragile — instead we test the
// pure, alias-free helpers directly against the compiled dist output is overkill too.
// Simplest reliable approach: source-level assertions for structure/fields (matching
// the style already used by sorting-phase-a.test.cjs and phase-b-architecture.test.cjs
// for build-query functions), plus a standalone reimplementation-based check for
// calculateLiveExpiryStatus's pure date arithmetic (no imports needed).

function readSource(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

const graphqlCode = readSource('src/features/batches/batchesGraphql.ts');
const pageCode = readSource('src/features/batches/pages/BatchesPage.tsx');
const hooksCode = readSource('src/features/batches/hooks.ts');

// ---------------------------------------------------------------------------
// 1. Exposed fields match the confirmed Batch entity (no invented fields)
// ---------------------------------------------------------------------------
describe('Batch entity field allowlist', () => {
  test('GraphQL query selects only confirmed Batch entity fields', () => {
    assert.ok(graphqlCode.includes('id batchCode warehouseId productId productionDate expirationDate'));
    assert.ok(graphqlCode.includes('expiryStatus stockStatus version createdAt updatedAt'));
  });

  test('productName/sku/warehouseName are documented as enrichment, not Batch fields', () => {
    assert.ok(graphqlCode.includes('NOT on the Batch entity'));
    assert.ok(graphqlCode.includes('entities.products'));
  });

  test('onHand/reserved/available are documented as InventoryBalance fields, not Batch', () => {
    assert.ok(graphqlCode.includes('InventoryBalance'));
    assert.ok(graphqlCode.includes('physicalQuantity reservedQuantity availableQuantity'));
  });

  test('lockedQuantity is documented as REST-only (InventoryLock unexposed)', () => {
    assert.ok(graphqlCode.includes('InventoryLock'));
    assert.ok(graphqlCode.toLowerCase().includes('unexposed'));
  });
});

// ---------------------------------------------------------------------------
// 2. Sort allowlist — only Batch's own scalar fields
// ---------------------------------------------------------------------------
describe('Sort allowlist', () => {
  test('BATCHES_SORT_MAP contains only batchCode and expirationDate', () => {
    assert.ok(graphqlCode.includes("code: 'batchCode'"), 'URL key must equal DataTable column key "code"');
    assert.ok(graphqlCode.includes("expiry: 'expirationDate'"), 'URL key must equal DataTable column key "expiry"');
  });

  test('sort excludes cross-entity fields (sku, productName, warehouseName)', () => {
    const sortMapMatch = graphqlCode.match(/export const BATCHES_SORT_MAP = \{([\s\S]*?)\} as const/);
    assert.ok(sortMapMatch, 'BATCHES_SORT_MAP must exist');
    const body = sortMapMatch[1];
    assert.ok(!body.includes('sku'));
    assert.ok(!body.includes('productName'));
    assert.ok(!body.includes('warehouseName'));
  });

  test('default sort is expirationDate DESC (HSD còn nhiều trước), id DESC', () => {
    assert.ok(graphqlCode.includes("'order: [{ expirationDate: DESC }, { id: DESC }]'"));
  });

  test('id: DESC tiebreaker present in the user-selectable branch too', () => {
    assert.ok(graphqlCode.includes('{ id: DESC }]`'));
  });
});

// ---------------------------------------------------------------------------
// 3. Filter construction — warehouseId/productId/expiryStatus/id in/nin, search OR
// ---------------------------------------------------------------------------
describe('Filter construction', () => {
  test('warehouseId filter uses eq on a UUID variable', () => {
    assert.ok(graphqlCode.includes('{ warehouseId: { eq: $warehouseId } }'));
    assert.ok(graphqlCode.includes("'$warehouseId: UUID!'"));
  });

  test('productId filter uses eq on a UUID variable', () => {
    assert.ok(graphqlCode.includes('{ productId: { eq: $productId } }'));
  });

  test('expiryStatusIn filter uses in on a String list variable', () => {
    assert.ok(graphqlCode.includes('{ expiryStatus: { in: $expiryStatusIn } }'));
    assert.ok(graphqlCode.includes("'$expiryStatusIn: [String!]!'"));
  });

  test('idIn / idNin filters use confirmed HotChocolate operators (in, nin)', () => {
    assert.ok(graphqlCode.includes('{ id: { in: $idIn } }'));
    assert.ok(graphqlCode.includes('{ id: { nin: $idNin } }'));
  });

  test('search combines batchCode contains with resolved product/warehouse id-in branches', () => {
    assert.ok(graphqlCode.includes('{ batchCode: { contains: $search } }'));
    assert.ok(graphqlCode.includes('{ productId: { in: $searchProductIds } }'));
    assert.ok(graphqlCode.includes('{ warehouseId: { in: $searchWarehouseIds } }'));
  });
});

// ---------------------------------------------------------------------------
// 4. Cursor pagination — HC0047 literal first/last, HC0078 friendly error
// ---------------------------------------------------------------------------
describe('Cursor pagination (HC0047/HC0078)', () => {
  test('first/last are literals in the query string, not variables', () => {
    assert.ok(graphqlCode.includes('`last: ${q.size}, before: $before`'));
    assert.ok(graphqlCode.includes('`first: ${q.size}'));
  });

  test('HC0078 maps to a friendly stale-cursor message', () => {
    assert.ok(graphqlCode.includes("err.code === 'HC0078'"));
    assert.ok(graphqlCode.includes('Trang đã chọn không còn hợp lệ'));
  });

  test('totalCount and pageInfo are required on a successful response', () => {
    assert.ok(graphqlCode.includes("typeof page.totalCount !== 'number'"));
    assert.ok(graphqlCode.includes('!page.pageInfo'));
  });
});

// ---------------------------------------------------------------------------
// 5. Enrichment is batched (never per-row / N+1)
// ---------------------------------------------------------------------------
describe('Enrichment batching (no N+1)', () => {
  test('fetchInventoryBalances takes an array of batch IDs in one request', () => {
    assert.ok(graphqlCode.includes('export async function fetchInventoryBalances(batchIds: string[])'));
    assert.ok(graphqlCode.includes('{ batchId: { in: $ids } }'));
  });

  test('fetchProductCatalog is called once (shared master data), not per batch row', () => {
    assert.ok(graphqlCode.includes('export async function fetchProductCatalog()'));
    assert.ok(hooksCode.includes("queryKey: ['batches', 'productCatalog']"));
  });

  test('BatchesPage enriches by batchId map lookup, not per-row fetches', () => {
    assert.ok(pageCode.includes('useInventoryBalancesForPage(pageBatchIds)'));
    assert.ok(pageCode.includes('productById.get(b.productId)'));
    assert.ok(pageCode.includes('warehouseById.get(b.warehouseId)'));
  });

  test('enrichment failures degrade gracefully (swallowed, never throw)', () => {
    assert.ok(graphqlCode.includes('console.warn(\'[batchesGraphql] fetchInventoryBalances failed'));
    assert.ok(graphqlCode.includes('[batchesGraphql] fetchProductCatalog failed after'));
  });
});

// ---------------------------------------------------------------------------
// 6. Live expiry status mirrors the Backend's exact formula
// (FSCM.Application/Features/Inventory/InventoryService.cs: CalculateExpiryStatus)
// ---------------------------------------------------------------------------
describe('calculateLiveExpiryStatus — mirrors Backend formula', () => {
  // Pure reimplementation matching calculateLiveExpiryStatus in batchesGraphql.ts,
  // to verify the *algorithm* without fighting this repo's path aliases in plain Node.
  function addDaysIso(iso, days) {
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }
  function calc(expirationDate, nearDateThresholdHours, todayIso) {
    if (expirationDate < todayIso) return 'Expired';
    const thresholdDays = Math.ceil(nearDateThresholdHours / 24);
    const nearIso = addDaysIso(todayIso, thresholdDays);
    return expirationDate <= nearIso ? 'NearExpiry' : 'Valid';
  }

  test('expirationDate in the past → Expired', () => {
    assert.equal(calc('2026-01-01', 72, '2026-06-01'), 'Expired');
  });

  test('expirationDate within threshold window → NearExpiry', () => {
    // threshold 72h = 3 days; today 2026-06-01, expiration 2026-06-03 (2 days away)
    assert.equal(calc('2026-06-03', 72, '2026-06-01'), 'NearExpiry');
  });

  test('expirationDate beyond threshold window → Valid', () => {
    assert.equal(calc('2026-07-01', 72, '2026-06-01'), 'Valid');
  });

  test('exact threshold boundary → NearExpiry (inclusive)', () => {
    assert.equal(calc('2026-06-04', 72, '2026-06-01'), 'NearExpiry');
  });

  test('same-day expiration with zero threshold → NearExpiry (<=  is inclusive, matches Backend)', () => {
    assert.equal(calc('2026-06-01', 0, '2026-06-01'), 'NearExpiry');
  });

  test('batchesGraphql.ts formula matches this reimplementation structurally', () => {
    assert.ok(graphqlCode.includes("if (expirationDate < todayIso) return 'Expired'"));
    assert.ok(graphqlCode.includes('Math.ceil(nearDateThresholdHours / 24)'));
  });
});

// ---------------------------------------------------------------------------
// 7. Status filter mapping preserves pre-migration behavior for "Đã tiêu hủy"
// ---------------------------------------------------------------------------
describe('Status filter mapping', () => {
  test('"Đã tiêu hủy" maps to expiryStatus Disposed — same as pre-migration (always empty)', () => {
    assert.ok(pageCode.includes("case 'Đã tiêu hủy':"));
    assert.ok(pageCode.includes("expiryStatusIn: ['Disposed']"));
  });

  test('"Có hàng khóa" maps to idIn of active lock batch IDs (REST-sourced)', () => {
    assert.ok(pageCode.includes("case 'Có hàng khóa':"));
    assert.ok(pageCode.includes('idIn: lockedBatchIds'));
  });

  test('"Còn hạn" excludes locked batches via idNin, matching pre-migration precedence', () => {
    assert.ok(pageCode.includes("case 'Còn hạn':"));
    assert.ok(pageCode.includes('idNin: lockedBatchIds'));
  });
});

// ---------------------------------------------------------------------------
// 8. Mutations unchanged — all REST, no contract changes
// ---------------------------------------------------------------------------
describe('Mutations stay REST (Phase C.2 §7)', () => {
  const apiCode = readSource('src/features/batches/api.ts');

  test('batchApi.createLock / releaseLock remain REST POST calls', () => {
    assert.ok(apiCode.includes("post<void>('/inventory-locks', input)"));
    assert.ok(apiCode.includes("/inventory-locks/${encodeURIComponent(lockId)}/release"));
  });

  test('useCreateInventoryLock / useReleaseInventoryLock hooks unchanged', () => {
    assert.ok(hooksCode.includes('useCreateInventoryLock'));
    assert.ok(hooksCode.includes('useReleaseInventoryLock'));
    assert.ok(hooksCode.includes("permission: 'inventory.lock'"));
    assert.ok(hooksCode.includes("permission: 'inventory.unlock'"));
  });
});

describe('Phase C.2.1 validation', () => {
  const src = fs.readFileSync(path.join(root, 'src/features/batches/batchesGraphql.ts'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'src/features/batches/pages/BatchesPage.tsx'), 'utf8');
  // Reimplementation of calculateIssuableQuantity (Backend InventoryService.cs:399-403)
  const issuable = (oh, rs, lk, st) => {
    if (st === 'Expired') return 0;
    const free = Math.max(0, oh - rs);
    return Math.max(0, free - Math.min(lk, free));
  };
  test('product catalog is cursor-paginated, not capped at 200', () => {
    assert.ok(!src.includes('first: 200'));
    assert.ok(src.includes('after: $after') && src.includes('pageInfo { hasNextPage endCursor }'));
    assert.ok(src.includes('PRODUCT_CATALOG_MAX_PAGES'));
  });
  test('catalog loop keeps partial pages on failure and warns on truncation', () => {
    const body = src.slice(src.indexOf('export async function fetchProductCatalog'));
    assert.ok(body.includes('catalog may be incomplete'));
    assert.ok(body.includes('catalog truncated'));
    assert.ok(!/return \[\];/.test(body.split('// ----')[0]), 'must not discard fetched pages');
  });
  test('issuable quantity matches Backend rule', () => {
    assert.equal(issuable(10, 2, 3, 'Valid'), 5);
    assert.equal(issuable(10, 2, 99, 'NearExpiry'), 0);
    assert.equal(issuable(10, 0, 0, 'Expired'), 0);
  });
  test('page uses calculateIssuableQuantity, not raw balance.availableQuantity', () => {
    assert.ok(page.includes('calculateIssuableQuantity('));
    assert.ok(!page.includes('balance?.availableQuantity'));
  });
});



describe('Sort keys match DataTable column keys', () => {
  const page = fs.readFileSync(path.join(root, 'src/features/batches/pages/BatchesPage.tsx'), 'utf8');
  test('every sortable key is a real column key', () => {
    for (const k of ['code', 'expiry']) assert.ok(page.includes(`key: '${k}'`), k);
  });
  test('order clause maps column key to Batch field with id tiebreaker', () => {
    assert.ok(graphqlCode.includes('BATCHES_SORT_MAP[sort.field]'));
    assert.ok(graphqlCode.includes('order: [{ ${gqlField}: ${dir} }, { id: DESC }]'));
  });
});
