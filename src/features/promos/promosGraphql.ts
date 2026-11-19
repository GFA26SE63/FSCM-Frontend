/**
 * Promotions list via GraphQL `entities.promotions` (HotChocolate cursor pagination).
 *
 * Verified from FSCM-Backend (read-only): Promotion entity fields
 *   id, code, name, promotionType, minimumQuantity, discountPercent, startAt, endAt,
 *   isActive, createdAt, updatedAt.
 * Shared master data (all roles), same as the REST list. REST `GET /promotions?includeInactive`
 * returns only `promotionType == "Campaign"` rows (batch discounts are excluded), so the same
 * condition is always sent here. Detail, create, pause and activate stay REST.
 *
 * The displayed status is derived (see ../status.ts promoStatus) from isActive + startAt/endAt.
 * It is translated to an equivalent server-side `where` using the current instant, so filtering
 * and pagination stay correct. `now` is passed in (rounded to the minute by the caller).
 *
 * HC0047: first/last must be literals. HC0078: invalid cursor.
 */
import { graphql } from '@/shared/api/graphql';
import { ApiError } from '@/shared/api/errors';
import type { PageInfo } from '@/shared/pagination/types';

export const PROMOS_PAGE_SIZES = [10, 20, 50] as const;
export type PromosPageSize = (typeof PROMOS_PAGE_SIZES)[number];

/** Keys are DataTable column keys; values are Promotion scalar fields. */
export const PROMOS_SORT_MAP = {
  code: 'code',
  name: 'name',
  period: 'startAt',
} as const;
export type PromoSortField = keyof typeof PROMOS_SORT_MAP;
export const PROMOS_SORTABLE_FIELDS = Object.keys(PROMOS_SORT_MAP) as readonly PromoSortField[];

export type PromoStatusFilter = 'Running' | 'Scheduled' | 'Paused' | 'Ended';

export interface PromosPageQuery {
  size: PromosPageSize;
  after?: string;
  before?: string;
  status?: PromoStatusFilter;
  /** ISO instant used to evaluate the derived status; required when `status` is set. */
  nowIso?: string;
  search?: string;
  sort?: { field: PromoSortField; direction: 'asc' | 'desc' };
}

export interface PromoListRow {
  id: string;
  code: string;
  name: string;
  promotionType: string;
  minimumQuantity: number;
  discountPercent: number;
  startAt: string;
  endAt: string;
  isActive: boolean;
}

export interface PromosPage {
  rows: PromoListRow[];
  totalCount: number;
  pageInfo: PageInfo;
}

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** Server-side equivalent of promoStatus(): Ended > Paused > Scheduled > Running. */
function statusCondition(status: PromoStatusFilter, nowIso: string): string {
  if (!ISO_INSTANT.test(nowIso)) throw new Error('invalid nowIso');
  const now = `"${nowIso}"`;
  switch (status) {
    case 'Ended':
      return `{ endAt: { lt: ${now} } }`;
    case 'Paused':
      return `{ and: [{ endAt: { gte: ${now} } }, { isActive: { eq: false } }] }`;
    case 'Scheduled':
      return `{ and: [{ endAt: { gte: ${now} } }, { isActive: { eq: true } }, { startAt: { gt: ${now} } }] }`;
    case 'Running':
      return `{ and: [{ endAt: { gte: ${now} } }, { isActive: { eq: true } }, { startAt: { lte: ${now} } }] }`;
  }
}

export function buildPromosPageQuery(q: PromosPageQuery): { query: string; variables: Record<string, unknown> } {
  if (!PROMOS_PAGE_SIZES.includes(q.size)) throw new Error('invalid page size');
  const conditions: string[] = ['{ promotionType: { eq: "Campaign" } }'];
  const declarations: string[] = [];
  const variables: Record<string, unknown> = {};

  if (q.status) {
    if (!q.nowIso) throw new Error('nowIso is required with a status filter');
    conditions.push(statusCondition(q.status, q.nowIso));
  }
  if (q.search) {
    conditions.push('{ or: [{ code: { contains: $search } }, { name: { contains: $search } }] }');
    declarations.push('$search: String!');
    variables.search = q.search;
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

  const field = q.sort && PROMOS_SORT_MAP[q.sort.field];
  // Default mirrors the REST list order (newest start first); `id` makes it deterministic.
  const order = field
    ? `order: [{ ${field}: ${q.sort!.direction === 'asc' ? 'ASC' : 'DESC'} }, { id: DESC }]`
    : 'order: [{ createdAt: DESC }, { id: DESC }]';
  const where = `where: { and: [${conditions.join(', ')}] }`;
  const decl = declarations.length ? `(${declarations.join(', ')})` : '';

  const query = `query PromosPage${decl} {
  entities {
    page: promotions(${[paging, where, order].join(', ')}) {
      totalCount
      pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
      nodes { id code name promotionType minimumQuantity discountPercent startAt endAt isActive }
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
    return new ApiError(400, 'Không tải được dữ liệu', 'Không tải được danh sách khuyến mãi. Vui lòng thử lại.', err.code);
  }
  return err;
}

export async function fetchPromosPage(q: PromosPageQuery): Promise<PromosPage> {
  try {
    const { query, variables } = buildPromosPageQuery(q);
    const data = await graphql<{
      entities: { page: { totalCount?: number; pageInfo?: PageInfo; nodes?: PromoListRow[] | null } };
    }>(query, variables);
    const page = data.entities?.page;
    if (!page || typeof page.totalCount !== 'number' || !page.pageInfo || !Array.isArray(page.nodes)) {
      throw new ApiError(502, 'Không tải được dữ liệu', 'Phản hồi khuyến mãi thiếu thông tin phân trang.');
    }
    return { rows: page.nodes, totalCount: page.totalCount, pageInfo: page.pageInfo };
  } catch (err) {
    throw friendlyError(err);
  }
}
