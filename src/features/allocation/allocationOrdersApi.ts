import { get } from '@/shared/api/http';
import type { OrderSummary } from '@/features/orders/types';

export interface AllocationOrdersPageQuery {
  page: number;
  pageSize: number;
  search?: string;
  /** Filter by OrderStatus value. Empty string means no filter. */
  status?: string;
}

export interface AllocationOrdersPage {
  items: OrderSummary[];
  totalCount: number;
  totalPages: number;
}

interface RestOrderPage {
  items: OrderSummary[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/**
 * Fetch a single page of orders from the REST endpoint, specifically for the
 * Allocation Run monitoring view.
 *
 * Uses REST `GET /api/v1/orders` with server-side page/pageSize pagination.
 *
 * Supported server-side filters: status, search.
 *
 * BACKEND DEPENDENCY — date filter (from/to) is NOT supported by the REST
 * endpoint (no `from`/`to` query params in apiv1.0.3.json). When Backend adds
 * date range support, add `from` and `to` params here and restore the UI controls
 * in AllocationRunPage.
 */
export async function fetchAllocationOrdersPage(
  q: AllocationOrdersPageQuery,
): Promise<AllocationOrdersPage> {
  const data = await get<RestOrderPage>('/orders', {
    page: q.page,
    pageSize: q.pageSize,
    search: q.search || undefined,
    status: q.status || undefined,
  });
  return {
    items: data.items ?? [],
    totalCount: data.totalCount,
    totalPages: data.totalPages,
  };
}
