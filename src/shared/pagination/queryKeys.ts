/**
 * FSCM Web Portal – React Query Pagination Keys & Invalidation Conventions
 * Phase 0: Foundation
 *
 * Provides a standardized query key convention to prevent:
 * 1. Cache collisions across different filters, page sizes, or cursor positions.
 * 2. Cross-user/cross-tenant data leakage by including user/actor scope in keys.
 * 3. Race conditions and stale response overwrites.
 * 4. Blanket invalidation: provides targeted helpers to invalidate only the relevant
 *    domain/scope without refetching the entire application.
 */

import type { QueryClient } from '@tanstack/react-query';

export interface ScopeOptions {
  warehouseId?: string;
  warehouseIds?: string[];
  userId?: string;
  role?: string;
  [key: string]: unknown;
}

export interface RestQueryKeyParams {
  page: number;
  size: number;
  search?: string;
  sort?: string;
  filters?: Record<string, unknown>;
}

export interface CursorQueryKeyParams {
  size: number;
  after?: string;
  before?: string;
  search?: string;
  sort?: string;
  filters?: Record<string, unknown>;
}

/**
 * Normalizes an object into a sorted-key JSON string or object to ensure
 * deterministic query key hashing in React Query.
 */
function normalizeScope(scope?: ScopeOptions | string): string {
  if (!scope) return 'global';
  if (typeof scope === 'string') return scope;
  const sorted = Object.keys(scope)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      const val = scope[key];
      if (val !== undefined && val !== null && val !== '') {
        acc[key] = Array.isArray(val) ? [...val].sort() : val;
      }
      return acc;
    }, {});
  return JSON.stringify(sorted);
}

function normalizeFilters(filters?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!filters) return undefined;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '' && value !== 'Tất cả') {
      cleaned[key] = value;
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

/**
 * Standard Query Key Factory for FSCM Paginated Resources.
 */
export const paginationQueryKeys = {
  /** Root key for a domain and actor scope: e.g. ['picking-lists', '{"warehouseIds":["w1"]}'] */
  root: (domain: string, scope?: ScopeOptions | string) => [domain, normalizeScope(scope)] as const,

  /** All list queries within a domain & scope */
  allLists: (domain: string, scope?: ScopeOptions | string) =>
    [domain, normalizeScope(scope), 'list'] as const,

  /** A specific REST paginated page */
  restPage: (domain: string, params: RestQueryKeyParams, scope?: ScopeOptions | string) =>
    [
      domain,
      normalizeScope(scope),
      'rest-page',
      {
        page: params.page,
        size: params.size,
        search: params.search?.trim() || undefined,
        sort: params.sort || undefined,
        filters: normalizeFilters(params.filters),
      },
    ] as const,

  /** A specific GraphQL Cursor paginated page */
  cursorPage: (domain: string, params: CursorQueryKeyParams, scope?: ScopeOptions | string) =>
    [
      domain,
      normalizeScope(scope),
      'cursor-page',
      {
        size: params.size,
        after: params.after || undefined,
        before: params.before || undefined,
        search: params.search?.trim() || undefined,
        sort: params.sort || undefined,
        filters: normalizeFilters(params.filters),
      },
    ] as const,

  /** Detail record key within a domain */
  detail: (domain: string, id: string, scope?: ScopeOptions | string) =>
    [domain, normalizeScope(scope), 'detail', id] as const,
};

/**
 * Cache Freshness Guidelines by Domain Lifecycle:
 * - Master Data (SKUs, Categories, Warehouses): 60,000ms (1 min).
 * - Standard Transactional Entities (Orders, Picking, Receipts, Debts): 15,000ms.
 * - Real-time Operational Tracking (Readiness, Vehicle Allocation): 5,000ms.
 */
export const STALE_TIMES = {
  MASTER_DATA: 60_000,
  TRANSACTIONAL: 15_000,
  OPERATIONAL: 5_000,
} as const;

/**
 * Targeted query invalidation helper.
 * Invalidates only the list/cursor queries for a specific domain and scope,
 * preventing blanket cache clearing across the entire portal.
 */
export async function invalidateDomainLists(
  queryClient: QueryClient,
  domain: string,
  scope?: ScopeOptions | string,
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: paginationQueryKeys.allLists(domain, scope),
  });
  await queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey;
      return (
        Array.isArray(key) &&
        key[0] === domain &&
        key[1] === normalizeScope(scope) &&
        (key[2] === 'rest-page' || key[2] === 'cursor-page')
      );
    },
  });
}

