/**
 * Loyalty redemptions via GraphQL `entities.rewardRedemptions` (HotChocolate cursor pagination).
 *
 * Parity with REST `GET /loyalty/redemptions` (admin/operator branch, RedemptionStore.ListForAdminAsync):
 *   entity fields   id, retailerId, loyaltyRewardId, redeemedPoints, quantity, status, createdAt, updatedAt
 *   rewardCode/Name loyaltyRewards (shared master data)            — batched by id, one request per page
 *   retailerCode/Name, regionId   retailers                        — same request
 *   balanceAfter / heldPoints     retailerLoyalties.currentPoints / heldPoints (display only; REST
 *                                 also reports the retailer's CURRENT balance here)
 *   salesGroupIds   active retailerSalesAssignments (isActive, unassignedAt null) — same request
 *   quantity        REST sends Quantity ?? estimate and flags quantityIsEstimated = Quantity == null; the
 *                   screen already shows "—" for estimated rows, so the raw nullable `quantity` is the same.
 * Admin and Operator are unscoped for all of these entities (EntityQueryService.cs); the /redeem route is
 * limited to those two roles. Nothing about points, balances or the lifecycle is computed here — all
 * values are displayed exactly as the Backend stores them. Approve/deliver/complete/reject stay REST.
 *
 * Search/filter across entities is resolved with bounded id lookups, then pushed into the `where`:
 *   - search: exact redemption id, OR retailer code/name match, OR reward code/name match
 *   - regionId: retailers in region; salesGroupId: active assignments of the group
 *   - aged (dashboard link): status in Pending/Approved/Delivered and updatedAt older than 3 days
 *
 * HC0047: first/last must be literals. HC0078: invalid cursor.
 */
import { graphql } from '@/shared/api/graphql';
import { ApiError } from '@/shared/api/errors';
import type { PageInfo } from '@/shared/pagination/types';
import type { RedemptionApi } from './types';

export const REDEEM_PAGE_SIZES = [10, 20, 50] as const;
export type RedeemPageSize = (typeof REDEEM_PAGE_SIZES)[number];

/** Keys are DataTable column keys; values are RewardRedemption scalar fields. */
export const REDEEM_SORT_MAP = {
  code: 'id',
  quantity: 'quantity',
  points: 'redeemedPoints',
  at: 'createdAt',
} as const;
export type RedeemSortField = keyof typeof REDEEM_SORT_MAP;
export const REDEEM_SORTABLE_FIELDS = Object.keys(REDEEM_SORT_MAP) as readonly RedeemSortField[];

/** The screen's status words → the server's stored words. */
export const SERVER_STATUS_OF: Record<string, string> = {
  Requested: 'Pending',
  Approved: 'Approved',
  Delivered: 'Delivered',
  Done: 'Completed',
  Rejected: 'Rejected',
};
const AGED_STATUSES = ['Pending', 'Approved', 'Delivered'];
export const AGED_AFTER_MS = 3 * 86_400_000;
const NO_MATCH_ID = '00000000-0000-0000-0000-000000000000';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

export interface RedeemPageQuery {
  size: RedeemPageSize;
  after?: string;
  before?: string;
  /** Screen status (Requested/Approved/Delivered/Done/Rejected). */
  status?: string;
  /** Resolved retailer id restriction (region / sales group / search); empty array = no match. */
  retailerIdIn?: string[];
  /** Resolved retailer id match for search (code/name). */
  searchRetailerIds?: string[];
  /** Resolved reward id match for search. */
  rewardIdIn?: string[];
  /** Exact redemption id from the search box, when it is a UUID. */
  searchId?: string;
  /** True when a text search is active (decides whether an empty resolution means "no rows"). */
  searching?: boolean;
  agedBeforeIso?: string;
  sort?: { field: RedeemSortField; direction: 'asc' | 'desc' };
}

interface RawRedemption {
  id: string;
  retailerId: string;
  loyaltyRewardId: string;
  redeemedPoints: number;
  quantity: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface RedeemPage {
  rows: RedemptionApi[];
  totalCount: number;
  pageInfo: PageInfo;
}

export function buildRedeemPageQuery(q: RedeemPageQuery): { query: string; variables: Record<string, unknown> } {
  if (!REDEEM_PAGE_SIZES.includes(q.size)) throw new Error('invalid page size');
  const conditions: string[] = [];
  const declarations: string[] = [];
  const variables: Record<string, unknown> = {};

  if (q.status) {
    const server = SERVER_STATUS_OF[q.status] ?? q.status;
    conditions.push('{ status: { eq: $status } }');
    declarations.push('$status: String!');
    variables.status = server;
  }
  if (q.agedBeforeIso) {
    if (!ISO_INSTANT.test(q.agedBeforeIso)) throw new Error('invalid agedBeforeIso');
    conditions.push(`{ status: { in: [${AGED_STATUSES.map((s) => `"${s}"`).join(', ')}] } }`);
    conditions.push(`{ updatedAt: { lt: "${q.agedBeforeIso}" } }`);
  }
  if (q.retailerIdIn) {
    conditions.push('{ retailerId: { in: $scopeRetailerIds } }');
    declarations.push('$scopeRetailerIds: [UUID!]!');
    variables.scopeRetailerIds = q.retailerIdIn.length ? q.retailerIdIn : [NO_MATCH_ID];
  }
  if (q.searching) {
    const or: string[] = [];
    if (q.searchId) {
      or.push('{ id: { eq: $searchId } }');
      declarations.push('$searchId: UUID!');
      variables.searchId = q.searchId;
    }
    if (q.rewardIdIn?.length) {
      or.push('{ loyaltyRewardId: { in: $searchRewardIds } }');
      declarations.push('$searchRewardIds: [UUID!]!');
      variables.searchRewardIds = q.rewardIdIn;
    }
    if (q.searchRetailerIds?.length) {
      or.push('{ retailerId: { in: $searchRetailerIds } }');
      declarations.push('$searchRetailerIds: [UUID!]!');
      variables.searchRetailerIds = q.searchRetailerIds;
    }
    // Nothing matched anywhere → no rows (never "show everything").
    if (!or.length) {
      or.push('{ id: { eq: $searchId } }');
      declarations.push('$searchId: UUID!');
      variables.searchId = NO_MATCH_ID;
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

  const field = q.sort && REDEEM_SORT_MAP[q.sort.field];
  const order = field
    ? `order: [{ ${field}: ${q.sort!.direction === 'asc' ? 'ASC' : 'DESC'} }, { id: DESC }]`
    : 'order: [{ createdAt: DESC }, { id: DESC }]';
  const where = conditions.length ? `where: { and: [${conditions.join(', ')}] }` : '';
  const decl = declarations.length ? `(${declarations.join(', ')})` : '';

  const query = `query RedeemPage${decl} {
  entities {
    page: rewardRedemptions(${[paging, where, order].filter(Boolean).join(', ')}) {
      totalCount
      pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
      nodes { id retailerId loyaltyRewardId redeemedPoints quantity status createdAt updatedAt }
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
    return new ApiError(400, 'Không tải được dữ liệu', 'Không tải được danh sách yêu cầu đổi quà. Vui lòng thử lại.', err.code);
  }
  return err;
}

// ---------------------------------------------------------------------------
// Bounded id lookups (used to turn cross-entity search / filters into `in` lists)
// ---------------------------------------------------------------------------

/** shortcut: each lookup is capped at 20 pages × 100 ids (2,000); raise if a region/group is ever larger. */
const LOOKUP_MAX_PAGES = 20;

async function collectIds(
  query: string,
  variables: Record<string, unknown>,
  connection: 'retailers' | 'loyaltyRewards' | 'retailerSalesAssignments',
  pick: (node: Record<string, string>) => string,
): Promise<string[]> {
  const ids = new Set<string>();
  let after: string | null = null;
  for (let i = 0; i < LOOKUP_MAX_PAGES; i++) {
    const data: {
      entities: Record<string, { pageInfo?: { hasNextPage: boolean; endCursor: string | null }; nodes: Record<string, string>[] | null }>;
    } = await graphql(query, { ...variables, after });
    const conn = data.entities?.[connection];
    if (!conn || !Array.isArray(conn.nodes)) throw new ApiError(502, 'Không tải được dữ liệu', 'Phản hồi tra cứu không hợp lệ.');
    conn.nodes.forEach((n) => ids.add(pick(n)));
    const next = conn.pageInfo?.hasNextPage ? conn.pageInfo.endCursor : null;
    if (!next || next === after) break;
    after = next;
  }
  return [...ids];
}

export const isUuid = (s: string) => UUID.test(s);

/** Retailer ids whose code/name contains the term and/or that belong to a region. */
export function lookupRetailerIds(opts: { search?: string; regionId?: string }): Promise<string[]> {
  const conds: string[] = [];
  const decls: string[] = ['$after: String'];
  const vars: Record<string, unknown> = {};
  if (opts.regionId) {
    conds.push('{ regionId: { eq: $regionId } }');
    decls.push('$regionId: UUID!');
    vars.regionId = opts.regionId;
  }
  if (opts.search) {
    conds.push('{ or: [{ code: { contains: $search } }, { name: { contains: $search } }] }');
    decls.push('$search: String!');
    vars.search = opts.search;
  }
  const where = conds.length ? `where: { and: [${conds.join(', ')}] }, ` : '';
  return collectIds(
    `query RedeemRetailerLookup(${decls.join(', ')}) {
  entities { retailers(first: 100, after: $after, ${where}order: [{ id: ASC }]) { pageInfo { hasNextPage endCursor } nodes { id } } }
}`,
    vars,
    'retailers',
    (n) => n.id,
  );
}

/** Retailer ids actively assigned to a sales group. */
export function lookupRetailerIdsBySalesGroup(salesGroupId: string): Promise<string[]> {
  return collectIds(
    `query RedeemGroupLookup($salesGroupId: UUID!, $after: String) {
  entities {
    retailerSalesAssignments(first: 100, after: $after,
      where: { and: [{ salesGroupId: { eq: $salesGroupId } }, { isActive: { eq: true } }, { unassignedAt: { eq: null } }] },
      order: [{ id: ASC }]) { pageInfo { hasNextPage endCursor } nodes { retailerId } }
  }
}`,
    { salesGroupId },
    'retailerSalesAssignments',
    (n) => n.retailerId,
  );
}

/** Reward ids whose code/name contains the term. */
export function lookupRewardIds(search: string): Promise<string[]> {
  return collectIds(
    `query RedeemRewardLookup($search: String!, $after: String) {
  entities {
    loyaltyRewards(first: 100, after: $after,
      where: { or: [{ code: { contains: $search } }, { name: { contains: $search } }] },
      order: [{ id: ASC }]) { pageInfo { hasNextPage endCursor } nodes { id } }
  }
}`,
    { search },
    'loyaltyRewards',
    (n) => n.id,
  );
}

// ---------------------------------------------------------------------------
// Page enrichment — ONE request for the whole page (no per-row calls)
// ---------------------------------------------------------------------------

interface EnrichData {
  entities: {
    retailers?: { nodes: { id: string; code: string; name: string; regionId: string | null }[] | null };
    rewards?: { nodes: { id: string; code: string; name: string }[] | null };
    loyalties?: { nodes: { retailerId: string; currentPoints: number; heldPoints: number }[] | null };
    groups?: { nodes: { retailerId: string; salesGroupId: string }[] | null };
  };
}

/** Joins retailer, reward, loyalty balance and sales-group data onto raw redemptions. */
async function enrich(raw: RawRedemption[]): Promise<RedemptionApi[]> {
  if (raw.length === 0) return [];
  const retailerIds = [...new Set(raw.map((r) => r.retailerId))];
  const rewardIds = [...new Set(raw.map((r) => r.loyaltyRewardId))];
  const data = await graphql<EnrichData>(
    `query RedeemEnrich($retailerIds: [UUID!]!, $rewardIds: [UUID!]!) {
  entities {
    retailers(first: 100, where: { id: { in: $retailerIds } }) { nodes { id code name regionId } }
    rewards: loyaltyRewards(first: 100, where: { id: { in: $rewardIds } }) { nodes { id code name } }
    loyalties: retailerLoyalties(first: 100, where: { retailerId: { in: $retailerIds } }) { nodes { retailerId currentPoints heldPoints } }
    groups: retailerSalesAssignments(first: 1000, where: { and: [{ retailerId: { in: $retailerIds } }, { isActive: { eq: true } }, { unassignedAt: { eq: null } }] }) { nodes { retailerId salesGroupId } }
  }
}`,
    { retailerIds, rewardIds },
  );
  const e = data.entities;
  if (!e || !Array.isArray(e.retailers?.nodes) || !Array.isArray(e.rewards?.nodes)) {
    throw new ApiError(502, 'Không tải được dữ liệu', 'Phản hồi thông tin đổi quà không hợp lệ.');
  }
  const retailers = new Map(e.retailers!.nodes!.map((n) => [n.id, n]));
  const rewards = new Map(e.rewards!.nodes!.map((n) => [n.id, n]));
  const loyalty = new Map((e.loyalties?.nodes ?? []).map((n) => [n.retailerId, n]));
  const groups = new Map<string, string[]>();
  for (const g of e.groups?.nodes ?? []) groups.set(g.retailerId, [...(groups.get(g.retailerId) ?? []), g.salesGroupId]);

  return raw.map((r) => {
    const retailer = retailers.get(r.retailerId);
    const reward = rewards.get(r.loyaltyRewardId);
    const bal = loyalty.get(r.retailerId);
    return {
      id: r.id,
      retailerId: r.retailerId,
      rewardId: r.loyaltyRewardId,
      rewardCode: reward?.code ?? '—',
      rewardName: reward?.name ?? '—',
      quantity: r.quantity ?? 0,
      quantityIsEstimated: r.quantity == null,
      heldPoints: bal ? bal.heldPoints : null,
      regionId: retailer?.regionId ?? null,
      salesGroupIds: groups.get(r.retailerId) ?? [],
      redeemedPoints: r.redeemedPoints,
      status: r.status,
      // REST reports the retailer's current balance in this field (0 when no loyalty row).
      balanceAfter: bal?.currentPoints ?? 0,
      clientRequestId: '',
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      retailerCode: retailer?.code ?? null,
      retailerName: retailer?.name ?? null,
    };
  });
}

export async function fetchRedeemPage(q: RedeemPageQuery): Promise<RedeemPage> {
  try {
    const { query, variables } = buildRedeemPageQuery(q);
    const data = await graphql<{
      entities: { page: { totalCount?: number; pageInfo?: PageInfo; nodes?: RawRedemption[] | null } };
    }>(query, variables);
    const page = data.entities?.page;
    if (!page || typeof page.totalCount !== 'number' || !page.pageInfo || !Array.isArray(page.nodes)) {
      throw new ApiError(502, 'Không tải được dữ liệu', 'Phản hồi yêu cầu đổi quà thiếu thông tin phân trang.');
    }
    return { rows: await enrich(page.nodes), totalCount: page.totalCount, pageInfo: page.pageInfo };
  } catch (err) {
    throw friendlyError(err);
  }
}

/** One redemption by id (REST has no by-id read and previously downloaded the whole list). */
export async function fetchRedemptionById(id: string): Promise<RedemptionApi> {
  if (!UUID.test(id)) throw new Error(`Không tìm thấy yêu cầu đổi quà ${id}.`);
  const data = await graphql<{ entities: { rewardRedemptions: { nodes: RawRedemption[] | null } } }>(
    `query RedeemById($id: UUID!) {
  entities { rewardRedemptions(first: 1, where: { id: { eq: $id } }) {
    nodes { id retailerId loyaltyRewardId redeemedPoints quantity status createdAt updatedAt } } }
}`,
    { id },
  );
  const node = data.entities?.rewardRedemptions?.nodes?.[0];
  if (!node) throw new Error(`Không tìm thấy yêu cầu đổi quà ${id}.`);
  return (await enrich([node]))[0];
}
