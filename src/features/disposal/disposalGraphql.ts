/**
 * Disposal list via GraphQL `entities.writeOffs` (HotChocolate cursor pagination).
 *
 * "Phiếu hủy" == Backend WriteOff (DisposalService creates WriteOff + WriteOffItem rows, Status
 * "Disposed" immediately — there is no approval step in the actual contract). Verified fields
 * (FSCM.Domain/Entities/WriteOff.cs): id, writeOffCode, warehouseId, createdByUserId, status,
 * reason, createdAt, updatedAt. Warehouse-scoped server-side (EntityQueryService.cs).
 * No navigation: warehouse name/code come from the REST warehouse list, creator name from the
 * existing user-name resolver, line count / total quantity from ONE batched `writeOffItems` query.
 * `reason` holds JSON metadata ({"Method": ...}) — parsed here exactly like Backend ReadMetadata.
 * Detail, candidates and create stay REST (detail needs sku/product/batch code/expiry).
 *
 * HC0047: first/last must be literals. HC0078: invalid cursor.
 */
import { graphql } from '@/shared/api/graphql';
import { ApiError } from '@/shared/api/errors';
import type { PageInfo } from '@/shared/pagination/types';

export const DISPOSALS_PAGE_SIZES = [10, 20, 50] as const;
export type DisposalsPageSize = (typeof DISPOSALS_PAGE_SIZES)[number];

/** Keys are DataTable column keys; values are WriteOff scalar fields. */
export const DISPOSALS_SORT_MAP = {
  code: 'writeOffCode',
  at: 'createdAt',
} as const;
export type DisposalSortField = keyof typeof DISPOSALS_SORT_MAP;
export const DISPOSALS_SORTABLE_FIELDS = Object.keys(DISPOSALS_SORT_MAP) as readonly DisposalSortField[];

export interface DisposalsPageQuery {
  size: DisposalsPageSize;
  after?: string;
  before?: string;
  warehouseId?: string;
  search?: string;
  /** Warehouse IDs whose name/code match `search` — resolved client-side from the warehouse list. */
  searchWarehouseIds?: string[];
  sort?: { field: DisposalSortField; direction: 'asc' | 'desc' };
}

export interface DisposalListRow {
  id: string;
  writeOffCode: string;
  warehouseId: string;
  createdByUserId: string;
  status: string;
  reason: string | null;
  createdAt: string;
}

export interface DisposalsPage {
  rows: DisposalListRow[];
  totalCount: number;
  pageInfo: PageInfo;
}

export const DEFAULT_DISPOSAL_METHOD = 'Tiêu hủy tại kho';

/** Mirrors Backend ReadMetadata: Method from the JSON in Reason, default "Tiêu hủy tại kho". */
export function disposalMethodOf(reason: string | null | undefined): string {
  if (!reason) return DEFAULT_DISPOSAL_METHOD;
  try {
    const m = (JSON.parse(reason) as { Method?: unknown } | null)?.Method;
    return typeof m === 'string' && m ? m : DEFAULT_DISPOSAL_METHOD;
  } catch {
    return DEFAULT_DISPOSAL_METHOD;
  }
}

export function buildDisposalsPageQuery(q: DisposalsPageQuery): { query: string; variables: Record<string, unknown> } {
  if (!DISPOSALS_PAGE_SIZES.includes(q.size)) throw new Error('invalid page size');
  const conditions: string[] = [];
  const declarations: string[] = [];
  const variables: Record<string, unknown> = {};

  if (q.warehouseId) {
    conditions.push('{ warehouseId: { eq: $warehouseId } }');
    declarations.push('$warehouseId: UUID!');
    variables.warehouseId = q.warehouseId;
  }
  if (q.search) {
    const or = ['{ writeOffCode: { contains: $search } }'];
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

  const field = q.sort && DISPOSALS_SORT_MAP[q.sort.field];
  const order = field
    ? `order: [{ ${field}: ${q.sort!.direction === 'asc' ? 'ASC' : 'DESC'} }, { id: DESC }]`
    : 'order: [{ createdAt: DESC }, { id: DESC }]';
  const where = conditions.length ? `where: { and: [${conditions.join(', ')}] }` : '';
  const decl = declarations.length ? `(${declarations.join(', ')})` : '';

  const query = `query DisposalsPage${decl} {
  entities {
    page: writeOffs(${[paging, where, order].filter(Boolean).join(', ')}) {
      totalCount
      pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
      nodes { id writeOffCode warehouseId createdByUserId status reason createdAt }
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
    return new ApiError(400, 'Không tải được dữ liệu', 'Không tải được danh sách phiếu hủy. Vui lòng thử lại.', err.code);
  }
  return err;
}

export async function fetchDisposalsPage(q: DisposalsPageQuery): Promise<DisposalsPage> {
  try {
    const { query, variables } = buildDisposalsPageQuery(q);
    const data = await graphql<{
      entities: { page: { totalCount?: number; pageInfo?: PageInfo; nodes?: DisposalListRow[] | null } };
    }>(query, variables);
    const page = data.entities?.page;
    if (!page || typeof page.totalCount !== 'number' || !page.pageInfo || !Array.isArray(page.nodes)) {
      throw new ApiError(502, 'Không tải được dữ liệu', 'Phản hồi phiếu hủy thiếu thông tin phân trang.');
    }
    return { rows: page.nodes, totalCount: page.totalCount, pageInfo: page.pageInfo };
  } catch (err) {
    throw friendlyError(err);
  }
}

export interface DisposalLineTotals {
  batchCount: number;
  totalQty: number;
}

/**
 * Line count + total quantity per write-off for the current page, batched with a cursor loop.
 * Matches the REST DisposalResult (BatchCount = items.Length, TotalQty = sum of quantities).
 * Errors are swallowed: the list still renders, counts show 0.
 */
export async function fetchDisposalLineTotals(ids: string[]): Promise<Map<string, DisposalLineTotals>> {
  const totals = new Map<string, DisposalLineTotals>();
  if (ids.length === 0) return totals;
  const query = `query DisposalLineTotals($ids: [UUID!]!, $after: String) {
  entities {
    writeOffItems(first: 100, after: $after, where: { writeOffId: { in: $ids } }, order: [{ id: ASC }]) {
      pageInfo { hasNextPage endCursor }
      nodes { writeOffId quantity }
    }
  }
}`;
  try {
    let after: string | null = null;
    // shortcut: bounded at 100 pages (10,000 items per list page), raise if ever hit
    for (let i = 0; i < 100; i++) {
      const data: {
        entities: {
          writeOffItems: {
            pageInfo?: { hasNextPage: boolean; endCursor: string | null };
            nodes: { writeOffId: string; quantity: number }[] | null;
          };
        };
      } = await graphql(query, { ids, after });
      const conn = data?.entities?.writeOffItems;
      if (!conn || !Array.isArray(conn.nodes)) return new Map();
      for (const n of conn.nodes) {
        const t = totals.get(n.writeOffId) ?? { batchCount: 0, totalQty: 0 };
        t.batchCount += 1;
        t.totalQty += n.quantity || 0;
        totals.set(n.writeOffId, t);
      }
      const next = conn.pageInfo?.hasNextPage ? conn.pageInfo.endCursor : null;
      if (!next || next === after) break;
      after = next;
    }
    return totals;
  } catch (err) {
    console.warn('[disposalGraphql] fetchDisposalLineTotals failed — line count/qty will show as 0:', err);
    return new Map();
  }
}
