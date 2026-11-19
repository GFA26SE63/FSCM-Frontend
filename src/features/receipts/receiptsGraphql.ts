/**
 * Receipts list via GraphQL `entities.goodsReceipts` (HotChocolate cursor pagination).
 *
 * Verified from FSCM-Backend (read-only): GoodsReceipt entity fields
 *   id, receiptCode, warehouseId, createdByUserId, approvedByUserId, status,
 *   receivedAt, approvedAt, version, createdAt, updatedAt
 * Scoped server-side by warehouse (EntityQueryService.cs: warehouseIds.Contains(WarehouseId)).
 * No navigation properties: warehouse name/code come from the existing REST warehouse list;
 * line count / total quantity come from ONE batched `goodsReceiptLines` query per page.
 * Receipt Detail stays on REST (lines need product sku/name + batch codes — not on the entity).
 *
 * HC0047: first/last must be literals. HC0078: invalid cursor.
 */
import { graphql } from '@/shared/api/graphql';
import { ApiError } from '@/shared/api/errors';
import type { PageInfo } from '@/shared/pagination/types';
import type { ReceiptDetail } from './types';

export const RECEIPTS_PAGE_SIZES = [10, 20, 50] as const;
export type ReceiptsPageSize = (typeof RECEIPTS_PAGE_SIZES)[number];

/** Keys are DataTable column keys; values are GoodsReceipt scalar fields. */
export const RECEIPTS_SORT_MAP = {
  receiptCode: 'receiptCode',
  createdAt: 'createdAt',
  receivedAt: 'receivedAt',
} as const;
export type ReceiptSortField = keyof typeof RECEIPTS_SORT_MAP;
export const RECEIPTS_SORTABLE_FIELDS = Object.keys(RECEIPTS_SORT_MAP) as readonly ReceiptSortField[];

export async function fetchReceiptReads(warehouseId?: string): Promise<ReceiptDetail[]> {
  const data = await graphql<{ entities: { goodsReceiptReads: ReceiptDetail[] } }>(
    `query GoodsReceiptReads($warehouseId: UUID) {
      entities {
        goodsReceiptReads(warehouseId: $warehouseId) {
          id receiptCode warehouseId warehouseCode warehouseName createdByUserId approvedByUserId
          status receivedAt approvedAt createdAt version
          lines { id productId sku productName sourceLotCode receivedQuantity productionDate expirationDate batchId batchCode }
        }
      }
    }`,
    { warehouseId },
  );
  return data.entities.goodsReceiptReads;
}

export interface ReceiptsPageQuery {
  size: ReceiptsPageSize;
  after?: string;
  before?: string;
  status?: string;
  warehouseId?: string;
  search?: string;
  /** Warehouse IDs whose name/code match `search` — resolved client-side from the warehouse list. */
  searchWarehouseIds?: string[];
  sort?: { field: ReceiptSortField; direction: 'asc' | 'desc' };
}

export interface ReceiptListRow {
  id: string;
  receiptCode: string;
  warehouseId: string;
  createdByUserId: string;
  approvedByUserId: string | null;
  status: string;
  receivedAt: string | null;
  approvedAt: string | null;
  version: number;
  createdAt: string;
}

export interface ReceiptsPage {
  rows: ReceiptListRow[];
  totalCount: number;
  pageInfo: PageInfo;
}

export function buildReceiptsPageQuery(q: ReceiptsPageQuery): { query: string; variables: Record<string, unknown> } {
  if (!RECEIPTS_PAGE_SIZES.includes(q.size)) throw new Error('invalid page size');
  const conditions: string[] = [];
  const declarations: string[] = [];
  const variables: Record<string, unknown> = {};

  if (q.status) {
    conditions.push('{ status: { eq: $status } }');
    declarations.push('$status: String!');
    variables.status = q.status;
  }
  if (q.warehouseId) {
    conditions.push('{ warehouseId: { eq: $warehouseId } }');
    declarations.push('$warehouseId: UUID!');
    variables.warehouseId = q.warehouseId;
  }
  if (q.search) {
    const or = ['{ receiptCode: { contains: $search } }'];
    declarations.push('$search: String!');
    variables.search = q.search;
    if (q.searchWarehouseIds?.length) {
      or.push('{ warehouseId: { in: $searchWarehouseIds } }');
      declarations.push('$searchWarehouseIds: [UUID!]!');
      variables.searchWarehouseIds = q.searchWarehouseIds;
    }
    conditions.push(`{ or: [${or.join(', ')}] }`);
  }

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

  const field = q.sort && RECEIPTS_SORT_MAP[q.sort.field];
  const order = field
    ? `order: [{ ${field}: ${q.sort!.direction === 'asc' ? 'ASC' : 'DESC'} }, { id: DESC }]`
    : 'order: [{ createdAt: DESC }, { id: DESC }]';
  const where = conditions.length ? `where: { and: [${conditions.join(', ')}] }` : '';
  const decl = declarations.length ? `(${declarations.join(', ')})` : '';

  const query = `query ReceiptsPage${decl} {
  entities {
    page: goodsReceipts(${[paging, where, order].filter(Boolean).join(', ')}) {
      totalCount
      pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
      nodes {
        id receiptCode warehouseId createdByUserId approvedByUserId status
        receivedAt approvedAt version createdAt
      }
    }
  }
}`;
  return { query, variables };
}

function friendlyError(err: unknown): unknown {
  if (!(err instanceof ApiError)) return err;
  if (err.status === 400 && err.code === 'HC0078') {
    return new ApiError(400, 'Trang không hợp lệ', 'Trang đã chọn không còn hợp lệ. Hãy quay về trang đầu.', err.code);
  }
  if (err.status === 400) {
    return new ApiError(400, 'Không tải được dữ liệu', 'Không tải được danh sách phiếu nhập. Vui lòng thử lại.', err.code);
  }
  return err;
}

export async function fetchReceiptsPage(q: ReceiptsPageQuery): Promise<ReceiptsPage> {
  try {
    const { query, variables } = buildReceiptsPageQuery(q);
    const data = await graphql<{
      entities: {
        page: {
          totalCount?: number;
          pageInfo?: PageInfo;
          nodes?: ReceiptListRow[] | null;
        };
      };
    }>(query, variables);
    const page = data.entities?.page;
    if (!page || typeof page.totalCount !== 'number' || !page.pageInfo || !Array.isArray(page.nodes)) {
      throw new ApiError(502, 'Không tải được dữ liệu', 'Phản hồi phiếu nhập thiếu thông tin phân trang.');
    }
    return { rows: page.nodes, totalCount: page.totalCount, pageInfo: page.pageInfo };
  } catch (err) {
    throw friendlyError(err);
  }
}

export interface ReceiptLineTotals {
  batchCount: number;
  totalQty: number;
}

/**
 * Line count + total received quantity per receipt for the current page, in batched
 * `goodsReceiptLines` requests (cursor loop — a page of 50 receipts can exceed 100 lines).
 * Matches the old REST-derived values (lines.length, sum of receivedQuantity).
 * Errors are swallowed: the list still renders, counts show 0.
 */
export async function fetchReceiptLineTotals(receiptIds: string[]): Promise<Map<string, ReceiptLineTotals>> {
  const totals = new Map<string, ReceiptLineTotals>();
  if (receiptIds.length === 0) return totals;
  const query = `query ReceiptLineTotals($ids: [UUID!]!, $after: String) {
  entities {
    goodsReceiptLines(first: 100, after: $after, where: { goodsReceiptId: { in: $ids } }, order: [{ id: ASC }]) {
      pageInfo { hasNextPage endCursor }
      nodes { goodsReceiptId receivedQuantity }
    }
  }
}`;
  try {
    let after: string | null = null;
    // shortcut: bounded at 100 pages (10,000 lines per receipts page), raise if ever hit
    for (let i = 0; i < 100; i++) {
      const data: {
        entities: {
          goodsReceiptLines: {
            pageInfo?: { hasNextPage: boolean; endCursor: string | null };
            nodes: { goodsReceiptId: string; receivedQuantity: number }[] | null;
          };
        };
      } = await graphql(query, { ids: receiptIds, after });
      const conn = data?.entities?.goodsReceiptLines;
      if (!conn || !Array.isArray(conn.nodes)) return new Map();
      for (const n of conn.nodes) {
        const t = totals.get(n.goodsReceiptId) ?? { batchCount: 0, totalQty: 0 };
        t.batchCount += 1;
        t.totalQty += n.receivedQuantity || 0;
        totals.set(n.goodsReceiptId, t);
      }
      const next = conn.pageInfo?.hasNextPage ? conn.pageInfo.endCursor : null;
      if (!next || next === after) break;
      after = next;
    }
    return totals;
  } catch (err) {
    console.warn('[receiptsGraphql] fetchReceiptLineTotals failed — line count/qty will show as 0:', err);
    return new Map();
  }
}

/** Resolve a receipt code to its id with one bounded lookup (exact, case-insensitive match). */
export async function findReceiptIdByCode(code: string): Promise<string | null> {
  const data = await graphql<{ entities: { goodsReceipts: { nodes: { id: string; receiptCode: string }[] | null } } }>(
    `query ReceiptIdByCode($code: String!) {
  entities { goodsReceipts(first: 5, where: { receiptCode: { contains: $code } }) { nodes { id receiptCode } } }
}`,
    { code },
  );
  const hit = data.entities?.goodsReceipts?.nodes?.find((n) => n.receiptCode?.toLowerCase() === code.toLowerCase());
  return hit?.id ?? null;
}
