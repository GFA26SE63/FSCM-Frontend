/**
 * Batches via GraphQL `entities.batches` (HotChocolate cursor pagination).
 *
 * Fields confirmed safe from the Batch domain entity (FSCM-Backend
 * src/FSCM.Domain/Entities/Batch.cs — generic entities.batches resolver,
 * src/FSCM.API/GraphQL/EntityQuery.cs:147-148, aliased `InventoryBatchEntity`):
 *   id, batchCode, warehouseId, productId, productionDate, expirationDate,
 *   expiryStatus, stockStatus, createdAt, updatedAt
 *
 * NOT on the Batch entity (confirmed: "Domain Entities with Navigation Properties: 0"
 * in FSCM_Backend_GraphQL_Entity_Capability_Audit.md — zero nested GraphQL graphs):
 *   - productName, sku — live on Product, not Batch. Enriched via entities.products
 *     (see fetchProductCatalog below).
 *   - warehouseName, warehouseCode — live on Warehouse, not Batch. Enriched via the
 *     existing REST `useWarehouses()` hook already used by BatchesPage (unchanged;
 *     Warehouses module is out of this phase's scope).
 *   - onHandQuantity, reservedQuantity, availableQuantity — NOT on Batch at all.
 *     Confirmed (FSCM.Application/Features/Inventory/InventoryContracts.cs:18-22,
 *     InventoryService.cs:181-182/357) these map 1:1 to InventoryBalance's
 *     PhysicalQuantity/ReservedQuantity/AvailableQuantity. InventoryBalance IS
 *     GraphQL-exposed (entities.inventoryBalances) — enriched via fetchInventoryBalances.
 *   - lockedQuantity, hasLockRequiringResolution — computed server-side from
 *     InventoryLock, which is confirmed "Unexposed (REST Only)" in the Backend audit
 *     (entity #31). Stays on REST — BatchesPage already fetches all active locks in
 *     one batched REST call (`useBatchLocks({ status: 'Active' })`); this phase does
 *     not change that call, only how lock data is joined to the (now GraphQL) rows.
 *
 * Search: Batch's own `batchCode` is searchable server-side via `contains`. Matching
 * by SKU/product name or warehouse name requires joining through Product/Warehouse —
 * the Backend audit documents this as a known gap ("Cross-Entity Filtering: Cannot
 * filter batches by category code directly... without complex sub-queries"). Resolved
 * here WITHOUT an extra round trip: the product catalog (fetched once for the SKU
 * filter dropdown, see fetchProductCatalog) and the warehouse list (already loaded via
 * REST for the warehouse filter dropdown) are matched against the search term
 * client-side to resolve candidate productId/warehouseId sets, which are then pushed
 * into the GraphQL `where` as `{ productId: { in } }` / `{ warehouseId: { in } }` OR
 * branches alongside `{ batchCode: { contains } }`. No full-dataset fetch either way.
 *
 * HC0047: first/last must be literals in the query string, not variables.
 * HC0078: invalid/expired cursor returns code HC0078.
 */

import { graphql } from '@/shared/api/graphql';
import { ApiError } from '@/shared/api/errors';
import { addDays } from '@/shared/lib/dates';
import type { PageInfo } from '@/shared/pagination/types';

export const BATCHES_PAGE_SIZES = [10, 20, 50] as const;
export type BatchesPageSize = (typeof BATCHES_PAGE_SIZES)[number];

/**
 * Sortable columns for the Batches list. Kept to Batch's own scalar fields —
 * Product/Warehouse are separate entities with no GraphQL navigation, so sorting
 * by product name or warehouse name is not possible server-side (would require a
 * cross-entity sort the schema does not support) and is intentionally excluded.
 */
export const BATCHES_SORT_MAP = {
  code: 'batchCode',
  expiry: 'expirationDate',
} as const;
export type BatchSortField = keyof typeof BATCHES_SORT_MAP;
export const BATCHES_SORTABLE_FIELDS = Object.keys(BATCHES_SORT_MAP) as readonly BatchSortField[];

export interface BatchesPageQuery {
  size: BatchesPageSize;
  after?: string;
  before?: string;
  warehouseId?: string;
  productId?: string;
  /** Raw Batch.expiryStatus values to match (e.g. ['Expired'], ['NearExpiry', 'Near-date']). */
  expiryStatusIn?: string[];
  /** Batch IDs to restrict to (used for the "Có hàng khóa" filter — resolved from REST lock data). */
  idIn?: string[];
  /** Batch IDs to exclude (used for the "Còn hạn" filter to exclude locked batches). */
  idNin?: string[];
  search?: string;
  /** Product IDs matching `search` against the product catalog — resolved client-side, no extra round trip. */
  searchProductIds?: string[];
  /** Warehouse IDs matching `search` against the loaded warehouse list — resolved client-side. */
  searchWarehouseIds?: string[];
  sort?: { field: BatchSortField; direction: 'asc' | 'desc' };
}

/** List-screen row — Batch's own fields only. Product/warehouse names and quantities are enriched separately. */
export interface BatchListRow {
  id: string;
  batchCode: string;
  warehouseId: string;
  productId: string;
  productionDate: string;
  expirationDate: string;
  expiryStatus: string;
  stockStatus: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface RawBatchNode {
  id: string;
  batchCode: string;
  warehouseId: string;
  productId: string;
  productionDate: string;
  expirationDate: string;
  expiryStatus: string;
  stockStatus: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface BatchesConnection {
  totalCount?: number;
  pageInfo?: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
  nodes?: RawBatchNode[] | null;
}

function mapNode(n: RawBatchNode): BatchListRow {
  return {
    id: n.id,
    batchCode: n.batchCode,
    warehouseId: n.warehouseId,
    productId: n.productId,
    productionDate: n.productionDate,
    expirationDate: n.expirationDate,
    expiryStatus: n.expiryStatus,
    stockStatus: n.stockStatus,
    version: n.version,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  };
}

function buildOrderClause(sort?: BatchesPageQuery['sort']): string {
  if (sort && BATCHES_SORT_MAP[sort.field]) {
    const gqlField = BATCHES_SORT_MAP[sort.field];
    const dir = sort.direction === 'asc' ? 'ASC' : 'DESC';
    return `order: [{ ${gqlField}: ${dir} }, { id: DESC }]`;
  }
  return 'order: [{ expirationDate: DESC }, { id: DESC }]';
}

function buildFilter(q: BatchesPageQuery): {
  conditions: string[];
  declarations: string[];
  variables: Record<string, unknown>;
} {
  const conditions: string[] = [];
  const declarations: string[] = [];
  const variables: Record<string, unknown> = {};

  if (q.warehouseId) {
    conditions.push('{ warehouseId: { eq: $warehouseId } }');
    declarations.push('$warehouseId: UUID!');
    variables.warehouseId = q.warehouseId;
  }

  if (q.productId) {
    conditions.push('{ productId: { eq: $productId } }');
    declarations.push('$productId: UUID!');
    variables.productId = q.productId;
  }

  if (q.expiryStatusIn && q.expiryStatusIn.length > 0) {
    conditions.push('{ expiryStatus: { in: $expiryStatusIn } }');
    declarations.push('$expiryStatusIn: [String!]!');
    variables.expiryStatusIn = q.expiryStatusIn;
  }

  if (q.idIn && q.idIn.length > 0) {
    conditions.push('{ id: { in: $idIn } }');
    declarations.push('$idIn: [UUID!]!');
    variables.idIn = q.idIn;
  }

  if (q.idNin && q.idNin.length > 0) {
    conditions.push('{ id: { nin: $idNin } }');
    declarations.push('$idNin: [UUID!]!');
    variables.idNin = q.idNin;
  }

  if (q.search) {
    const orBranches = ['{ batchCode: { contains: $search } }'];
    declarations.push('$search: String!');
    variables.search = q.search;

    if (q.searchProductIds && q.searchProductIds.length > 0) {
      orBranches.push('{ productId: { in: $searchProductIds } }');
      declarations.push('$searchProductIds: [UUID!]!');
      variables.searchProductIds = q.searchProductIds;
    }
    if (q.searchWarehouseIds && q.searchWarehouseIds.length > 0) {
      orBranches.push('{ warehouseId: { in: $searchWarehouseIds } }');
      declarations.push('$searchWarehouseIds: [UUID!]!');
      variables.searchWarehouseIds = q.searchWarehouseIds;
    }
    conditions.push(`{ or: [${orBranches.join(', ')}] }`);
  }

  return { conditions, declarations, variables };
}

const whereOf = (conditions: string[]) =>
  conditions.length ? `where: { and: [${conditions.join(', ')}] }` : '';

export function buildBatchesPageQuery(q: BatchesPageQuery): {
  query: string;
  variables: Record<string, unknown>;
} {
  if (!BATCHES_PAGE_SIZES.includes(q.size)) throw new Error('invalid page size');

  const { conditions, declarations, variables } = buildFilter(q);
  const backward = !!q.before;
  const paging = backward
    ? `last: ${q.size}, before: $before`
    : `first: ${q.size}${q.after ? ', after: $after' : ''}`;

  if (backward) {
    declarations.push('$before: String!');
    variables.before = q.before;
  } else if (q.after) {
    declarations.push('$after: String!');
    variables.after = q.after;
  }

  const order = buildOrderClause(q.sort);
  const decl = declarations.length ? `(${declarations.join(', ')})` : '';

  const query = `query BatchesPage${decl} {
  entities {
    page: batches(${[paging, whereOf(conditions), order].filter(Boolean).join(', ')}) {
      totalCount
      pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
      nodes {
        id batchCode warehouseId productId productionDate expirationDate
        expiryStatus stockStatus version createdAt updatedAt
      }
    }
  }
}`;

  return { query, variables };
}

export interface BatchesPage {
  rows: BatchListRow[];
  totalCount: number;
  pageInfo: PageInfo;
}

function friendlyError(err: unknown): unknown {
  if (!(err instanceof ApiError)) return err;
  if (err.status === 401 || err.status === 403) return err;
  if (err.status === 400 && err.code === 'HC0078') {
    return new ApiError(
      400,
      'Trang không hợp lệ',
      'Trang đã chọn không còn hợp lệ. Hãy quay về trang đầu.',
      err.code,
    );
  }
  if (err.status === 400) {
    return new ApiError(
      400,
      'Không tải được dữ liệu',
      'Không tải được danh sách lô hàng. Vui lòng thử lại.',
      err.code,
    );
  }
  return err;
}

export async function fetchBatchesPage(q: BatchesPageQuery): Promise<BatchesPage> {
  try {
    const { query, variables } = buildBatchesPageQuery(q);
    const data = await graphql<{ entities: { page: BatchesConnection } }>(query, variables);
    const page = data.entities?.page;
    if (
      !page ||
      typeof page.totalCount !== 'number' ||
      !page.pageInfo ||
      !Array.isArray(page.nodes)
    ) {
      throw new ApiError(502, 'Không tải được dữ liệu', 'Phản hồi lô hàng thiếu thông tin phân trang.');
    }
    return {
      rows: page.nodes.map(mapNode),
      totalCount: page.totalCount,
      pageInfo: page.pageInfo as PageInfo,
    };
  } catch (err) {
    throw friendlyError(err);
  }
}

// ---------------------------------------------------------------------------
// Inventory balance enrichment — entities.inventoryBalances (batched, per page)
// ---------------------------------------------------------------------------

export interface BatchBalance {
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
}

interface RawBalanceNode {
  batchId: string;
  physicalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
}

/**
 * Fetch on-hand/reserved/available quantities for a set of batch IDs in one batched
 * GraphQL request (never per-row — avoids N+1). Returns Map<batchId, BatchBalance>.
 * Errors are swallowed — enrichment failure must not break the batch list.
 */
export async function fetchInventoryBalances(batchIds: string[]): Promise<Map<string, BatchBalance>> {
  if (batchIds.length === 0) return new Map();
  try {
    const query = `query InventoryBalancesForPage($ids: [UUID!]!) {
  entities {
    inventoryBalances(first: 100, where: { batchId: { in: $ids } }) {
      nodes { batchId physicalQuantity reservedQuantity availableQuantity }
    }
  }
}`;
    const data = await graphql<{ entities: { inventoryBalances: { nodes: RawBalanceNode[] | null } } }>(
      query,
      { ids: batchIds },
    );
    const nodes = data?.entities?.inventoryBalances?.nodes;
    if (!Array.isArray(nodes)) return new Map();
    const map = new Map<string, BatchBalance>();
    for (const n of nodes) {
      map.set(n.batchId, {
        onHandQuantity: n.physicalQuantity,
        reservedQuantity: n.reservedQuantity,
        availableQuantity: n.availableQuantity,
      });
    }
    return map;
  } catch (err) {
    console.warn('[batchesGraphql] fetchInventoryBalances failed — quantities will show as 0:', err);
    return new Map();
  }
}

// ---------------------------------------------------------------------------
// Product catalog — entities.products (shared master data, fetched once)
// Serves three purposes without extra round trips: the SKU filter dropdown,
// per-row sku/productName enrichment, and client-side search-term → productId
// resolution (see file header).
// ---------------------------------------------------------------------------

export interface ProductCatalogEntry {
  id: string;
  sku: string;
  name: string;
  /** Hours before expiration a batch of this product is flagged near-date — used to
   *  compute a live expiry status client-side (see calculateLiveExpiryStatus below). */
  nearDateThresholdHours: number;
}

interface RawProductCatalogNode {
  id: string;
  sku: string;
  name: string;
  nearDateThresholdHours: number;
}

export const PRODUCT_CATALOG_PAGE_SIZE = 100;
/** shortcut: bounded at 5,000 products — raise if the catalog ever outgrows it. */
export const PRODUCT_CATALOG_MAX_PAGES = 50;

/**
 * Fetch the product catalog (id, sku, name, nearDateThresholdHours) by walking the
 * cursor in pages of PRODUCT_CATALOG_PAGE_SIZE, bounded by PRODUCT_CATALOG_MAX_PAGES.
 * Errors never throw: pages already fetched are kept (a partial catalog is better than
 * none), and callers degrade to a blank sku/name and to the GraphQL-persisted
 * expiryStatus for any product that is missing. Truncation and failure are logged.
 */
export async function fetchProductCatalog(): Promise<ProductCatalogEntry[]> {
  const query = `query ProductCatalogForBatches($after: String) {
  entities {
    products(first: ${PRODUCT_CATALOG_PAGE_SIZE}, after: $after, order: [{ id: ASC }]) {
      pageInfo { hasNextPage endCursor }
      nodes { id sku name nearDateThresholdHours }
    }
  }
}`;
  type Conn = { nodes: RawProductCatalogNode[] | null; pageInfo?: { hasNextPage: boolean; endCursor: string | null } };
  const all: ProductCatalogEntry[] = [];
  let after: string | null = null;
  try {
    for (let i = 0; i < PRODUCT_CATALOG_MAX_PAGES; i++) {
      const data: { entities: { products: Conn } } = await graphql(query, { after });
      const conn = data?.entities?.products;
      if (!conn || !Array.isArray(conn.nodes)) return all;
      all.push(...conn.nodes);
      const next = conn.pageInfo?.hasNextPage ? conn.pageInfo.endCursor : null;
      if (!next || next === after) return all;
      after = next;
    }
    console.warn(`[batchesGraphql] product catalog truncated at ${all.length} products (PRODUCT_CATALOG_MAX_PAGES reached) — some SKUs may be missing from filters/search.`);
    return all;
  } catch (err) {
    console.warn(`[batchesGraphql] fetchProductCatalog failed after ${all.length} products — catalog may be incomplete:`, err);
    return all;
  }
}

// ---------------------------------------------------------------------------
// Live expiry status — mirrors Backend's exact formula
// (FSCM.Application/Features/Inventory/InventoryService.cs:365-369, CalculateExpiryStatus)
//
// entities.batches.expiryStatus is the Batch.ExpiryStatus COLUMN, updated once a day
// by the nightly InventoryExpirySweepService — it can be stale by up to ~24h. REST
// `/inventory` never reads that column for display; it recomputes expiry status live
// from expirationDate + the product's nearDateThresholdHours + today's date on every
// request. This reproduces that same computation client-side (same three raw inputs,
// same formula) so the status BADGE shown to the user is always live, not a stale
// snapshot — while GraphQL `where` filtering (which must run server-side, before
// pagination) necessarily still filters on the persisted column. This asymmetry is
// a documented, unavoidable limitation — see the Phase C.2 report §12.
// ---------------------------------------------------------------------------

/**
 * Mirrors Backend ToInventoryResult (InventoryService.cs:395-403, F41): issuable stock =
 * on-hand − reserved − active-locked (lock capped at the free, unreserved stock), and
 * zero once expired. The raw InventoryBalance.availableQuantity ignores locks/expiry.
 */
export function calculateIssuableQuantity(
  onHand: number,
  reserved: number,
  lockedQuantity: number,
  expiryStatus: string,
): number {
  if (expiryStatus === 'Expired') return 0;
  const free = Math.max(0, onHand - reserved);
  return Math.max(0, free - Math.min(lockedQuantity, free));
}

export type LiveExpiryStatus ='Valid' | 'NearExpiry' | 'Expired';

export function calculateLiveExpiryStatus(
  expirationDate: string,
  nearDateThresholdHours: number,
  todayIso: string,
): LiveExpiryStatus {
  if (expirationDate < todayIso) return 'Expired';
  const thresholdDays = Math.ceil(nearDateThresholdHours / 24);
  const nearIso = addDays(todayIso, thresholdDays);
  return expirationDate <= nearIso ? 'NearExpiry' : 'Valid';
}
