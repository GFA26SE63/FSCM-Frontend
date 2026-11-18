import { graphql } from '@/shared/api/graphql';
import type { OrderSummary } from '@/features/orders/types';

export interface AllocationOrdersPageQuery {
  page: number;
  pageSize: number;
  search?: string;
  /** Filter by OrderStatus value. Empty string means no filter. */
  status?: string;
  sort?: 'asc' | 'desc';
}

export interface AllocationOrdersPage {
  items: OrderSummary[];
  totalCount: number;
  totalPages: number;
}

interface GraphqlOrderPage {
  items: OrderSummary[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/**
 * Lossless allocation monitoring read model via GraphQL `orderReads`.
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
  const result = await graphql<{ entities: { orderReads: GraphqlOrderPage } }>(`query AllocationOrderReads($status: String, $search: String, $page: Int!, $pageSize: Int!, $sort: String!) { entities { orderReads(status: $status, search: $search, page: $page, pageSize: $pageSize, sort: $sort) { items { id orderCode retailerId retailerCode retailerName salesGroupId createdByUserId status paymentMethod finalAmount finalPricePendingAllocation indicativeAmount officialAmount allocationState allocationRunId allocationResult shipmentCount totalCartons lineCount source version createdAt } page pageSize totalCount totalPages } } }`, { status: q.status, search: q.search, page: q.page, pageSize: q.pageSize, sort: q.sort ?? 'desc' });
  const data = result.entities.orderReads;
  return {
    items: data.items ?? [],
    totalCount: data.totalCount,
    totalPages: data.totalPages,
  };
}
