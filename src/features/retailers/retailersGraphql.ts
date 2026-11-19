/**
 * Retailers via GraphQL `entities.retailers` (HotChocolate cursor pagination).
 *
 * Fields confirmed safe from the Retailer domain entity (FSCM-Backend
 * src/FSCM.Domain/Entities/Retailer.cs — generic entities.retailers resolver,
 * src/FSCM.API/GraphQL/EntityQuery.cs):
 *   id, code, name, address, status, retailerType, creditTermDays, creditLimit,
 *   forecastRevenue, potentialStatus, regionId, createdAt, updatedAt
 *
 * NOT available via GraphQL (confirmed "Unexposed (REST Only)" in
 * FSCM_Backend_GraphQL_Entity_Capability_Audit.md, entity #71 RetailerDeclarationContact):
 *   contactName, phone, email — these live in RetailerDeclarationContact, which has
 *   no entities.* resolver. The List screen's former "Liên hệ" column cannot be
 *   reproduced via GraphQL without a backend change (out of scope — backend is
 *   READ-ONLY for this phase). Full contact info remains available on the REST-backed
 *   Detail page (retailerApi.get → RetailerService.ToDetails, which does the join).
 *
 * Sales group enrichment (salesGroupCode) — two-step batch, same N+1-avoidance
 * pattern as products' price enrichment (see productsGraphql.ts):
 *   1. entities.retailerSalesAssignments(where: { retailerId: in, isActive: eq true })
 *   2. entities.salesGroups(where: { id: in })
 *   Both RetailerSalesAssignment and SalesGroup are confirmed GraphQL-exposed entities.
 *
 * HC0047: first/last must be literals in the query string, not variables.
 * HC0078: invalid/expired cursor returns code HC0078.
 */

import { graphql } from '@/shared/api/graphql';
import { ApiError } from '@/shared/api/errors';
import type { PageInfo } from '@/shared/pagination/types';

export const RETAILERS_PAGE_SIZES = [10, 20, 50] as const;
export type RetailersPageSize = (typeof RETAILERS_PAGE_SIZES)[number];

/**
 * Sortable columns for the Retailers list.
 * Keys match DataTable column keys; values are GraphQL field names on the Retailer entity.
 * Kept to identity-like text fields, matching the Products/Orders pattern.
 */
export const RETAILERS_SORT_MAP = {
  code: 'code',
  name: 'name',
} as const;
export type RetailerSortField = keyof typeof RETAILERS_SORT_MAP;
export const RETAILERS_SORTABLE_FIELDS = Object.keys(RETAILERS_SORT_MAP) as readonly RetailerSortField[];

export interface RetailersPageQuery {
  size: RetailersPageSize;
  after?: string;
  before?: string;
  status?: string;
  search?: string;
  /** User-selected sort. Default when absent: createdAt DESC, id DESC. */
  sort?: { field: RetailerSortField; direction: 'asc' | 'desc' };
}

/** List-screen row — intentionally narrower than the full `Retailer` detail DTO (see file header). */
export interface RetailerListRow {
  id: string;
  code: string;
  name: string;
  address: string | null;
  status: string;
  retailerType: string;
  creditTermDays: number;
  creditLimit: number;
  forecastRevenue: number | null;
  potentialStatus: string | null;
  regionId: string;
  createdAt: string;
  updatedAt: string;
  /** Filled in by a separate batch enrichment query — null until resolved. */
  salesGroupCode: string | null;
}

interface RawRetailerNode {
  id: string;
  code: string;
  name: string;
  address: string | null;
  status: string;
  retailerType: string;
  creditTermDays: number;
  creditLimit: number;
  forecastRevenue: number | null;
  potentialStatus: string | null;
  regionId: string;
  createdAt: string;
  updatedAt: string;
}

interface RetailersConnection {
  totalCount?: number;
  pageInfo?: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
  nodes?: RawRetailerNode[] | null;
}

function mapNode(n: RawRetailerNode): RetailerListRow {
  return {
    id: n.id,
    code: n.code,
    name: n.name,
    address: n.address,
    status: n.status,
    retailerType: n.retailerType,
    creditTermDays: n.creditTermDays,
    creditLimit: n.creditLimit,
    forecastRevenue: n.forecastRevenue,
    potentialStatus: n.potentialStatus,
    regionId: n.regionId,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    salesGroupCode: null,
  };
}

function buildOrderClause(sort?: RetailersPageQuery['sort']): string {
  if (sort && RETAILERS_SORT_MAP[sort.field]) {
    const gqlField = RETAILERS_SORT_MAP[sort.field];
    const dir = sort.direction === 'asc' ? 'ASC' : 'DESC';
    return `order: [{ ${gqlField}: ${dir} }, { id: DESC }]`;
  }
  return 'order: [{ createdAt: DESC }, { id: DESC }]';
}

function buildFilter(q: RetailersPageQuery): {
  conditions: string[];
  declarations: string[];
  variables: Record<string, unknown>;
} {
  const conditions: string[] = [];
  const declarations: string[] = [];
  const variables: Record<string, unknown> = {};

  if (q.status) {
    conditions.push('{ status: { eq: $status } }');
    declarations.push('$status: String!');
    variables.status = q.status;
  }

  if (q.search) {
    conditions.push(
      '{ or: [{ code: { contains: $search } }, { name: { contains: $search } }, { address: { contains: $search } }] }',
    );
    declarations.push('$search: String!');
    variables.search = q.search;
  }

  return { conditions, declarations, variables };
}

const whereOf = (conditions: string[]) =>
  conditions.length ? `where: { and: [${conditions.join(', ')}] }` : '';

export function buildRetailersPageQuery(q: RetailersPageQuery): {
  query: string;
  variables: Record<string, unknown>;
} {
  if (!RETAILERS_PAGE_SIZES.includes(q.size)) throw new Error('invalid page size');

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

  const query = `query RetailersPage${decl} {
  entities {
    page: retailers(${[paging, whereOf(conditions), order].filter(Boolean).join(', ')}) {
      totalCount
      pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
      nodes {
        id code name address status retailerType
        creditTermDays creditLimit forecastRevenue potentialStatus
        regionId createdAt updatedAt
      }
    }
  }
}`;

  return { query, variables };
}

export interface RetailersPage {
  rows: RetailerListRow[];
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
      'Không tải được danh sách điểm bán. Vui lòng thử lại.',
      err.code,
    );
  }
  return err;
}

export async function fetchRetailersPage(q: RetailersPageQuery): Promise<RetailersPage> {
  try {
    const { query, variables } = buildRetailersPageQuery(q);
    const data = await graphql<{ entities: { page: RetailersConnection } }>(query, variables);
    const page = data.entities?.page;
    if (
      !page ||
      typeof page.totalCount !== 'number' ||
      !page.pageInfo ||
      !Array.isArray(page.nodes)
    ) {
      throw new ApiError(502, 'Không tải được dữ liệu', 'Phản hồi điểm bán thiếu thông tin phân trang.');
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
// Sales group enrichment — entities.retailerSalesAssignments + entities.salesGroups
// ---------------------------------------------------------------------------

interface RawAssignmentNode {
  retailerId: string;
  salesGroupId: string;
}

interface RawSalesGroupNode {
  id: string;
  code: string;
}

/**
 * Fetch active sales-group codes for a set of retailer IDs in two batched GraphQL
 * requests (never per-row — avoids N+1). Returns a Map<retailerId, salesGroupCode>.
 * Errors are swallowed — enrichment failure must not break the retailer list.
 */
export async function fetchRetailerSalesGroups(retailerIds: string[]): Promise<Map<string, string>> {
  if (retailerIds.length === 0) return new Map();
  try {
    const assignmentsQuery = `query RetailerSalesAssignmentsForPage($ids: [UUID!]!) {
  entities {
    retailerSalesAssignments(first: 100, where: { and: [{ retailerId: { in: $ids } }, { isActive: { eq: true } }] }) {
      nodes { retailerId salesGroupId }
    }
  }
}`;
    const assignmentsData = await graphql<{ entities: { retailerSalesAssignments: { nodes: RawAssignmentNode[] | null } } }>(
      assignmentsQuery,
      { ids: retailerIds },
    );
    const assignments = assignmentsData?.entities?.retailerSalesAssignments?.nodes;
    if (!Array.isArray(assignments) || assignments.length === 0) return new Map();

    const groupIds = [...new Set(assignments.map((a) => a.salesGroupId))];
    const groupsQuery = `query SalesGroupsForPage($ids: [UUID!]!) {
  entities {
    salesGroups(first: 100, where: { id: { in: $ids } }) {
      nodes { id code }
    }
  }
}`;
    const groupsData = await graphql<{ entities: { salesGroups: { nodes: RawSalesGroupNode[] | null } } }>(
      groupsQuery,
      { ids: groupIds },
    );
    const groups = groupsData?.entities?.salesGroups?.nodes;
    if (!Array.isArray(groups)) return new Map();

    const codeByGroupId = new Map(groups.map((g) => [g.id, g.code]));
    const map = new Map<string, string>();
    for (const a of assignments) {
      const code = codeByGroupId.get(a.salesGroupId);
      if (code) map.set(a.retailerId, code);
    }
    return map;
  } catch (err) {
    console.warn('[retailersGraphql] fetchRetailerSalesGroups failed — sales group will show as empty:', err);
    return new Map();
  }
}
