import { graphql } from '@/shared/api/graphql';
import { ApiError } from '@/shared/api/errors';
import type { PageInfo } from '@/shared/pagination/types';
import type { OrderStatus, OrderSummary, PaymentMethod } from './types';

/**
 * Sales Orders via GraphQL `entities.salesOrders` (Backend cursor pagination).
 *
 * GraphQL exposes the raw SalesOrder domain entity (FSCM.Domain.Entities.SalesOrder) via
 * DomainEntityObjectType<SalesOrder> with UseProjection + UseFiltering + UseSorting.
 * Fields available = properties on the domain entity, minus those containing "Hash" or
 * ending in "OperationKey" (stripped by DomainEntityObjectType).
 *
 * Confirmed available fields (from FSCM.Domain.Entities.SalesOrder):
 *   id, orderCode, retailerId, retailerCodeSnapshot, retailerNameSnapshot,
 *   salesGroupId, createdByUserId, reviewedByUserId, source, status, paymentMethod,
 *   deliveryAddress, requestedDeliveryDate, note, creditTermDays,
 *   subtotalAmount, discountAmount, finalAmount, finalPricePendingAllocation,
 *   offlineEstimatedAmount, hasOfflineDifference, serverReceivedAt, acceptedAt,
 *   reviewedAt, rejectionReason, version, createdAt, updatedAt
 *
 * NOT available (computed by REST service layer — not in domain entity):
 *   indicativeAmount  → derived: always equals finalAmount
 *   officialAmount    → derived: finalPricePendingAllocation ? null : finalAmount
 *   allocationState   → BACKEND DEPENDENCY (see BLOCKER-07)
 *   allocationResult  → BACKEND DEPENDENCY (see BLOCKER-07)
 *   allocationRunId   → BACKEND DEPENDENCY (see BLOCKER-07)
 *   shipmentCount     → BACKEND DEPENDENCY (see BLOCKER-07)
 *   totalCartons      → BACKEND DEPENDENCY (see BLOCKER-07)
 *   lineCount         → BACKEND DEPENDENCY (see BLOCKER-07)
 *
 * Actor scope: EntityQueryService.ScopedOrders() applies role-based scoping server-side:
 *   Admin/Operator → all orders
 *   Sales          → own orders (createdByUserId) + salesGroup orders
 *   SalesManager   → salesGroup orders
 *   Retailer       → their retailer's orders
 *   WarehouseKeeper→ orders with picking/allocation in their warehouses
 *
 * HC0047: first/last must be literals in the query string, not variables.
 * HC0078: invalid/expired cursor returns code HC0078.
 */

export const ORDER_PAGE_SIZES = [10, 20, 50] as const;
export type OrderPageSize = (typeof ORDER_PAGE_SIZES)[number];

/**
 * Sortable columns for the Orders list.
 * Keys match DataTable column keys; values are the GraphQL field names on SalesOrderEntity.
 * Only fields confirmed on FSCM.Domain.Entities.SalesOrder with [UseSorting] are listed.
 * Use an explicit allowlist — never interpolate arbitrary user-supplied field names.
 */
export const ORDER_SORT_MAP = {
  createdAt: 'createdAt',
  orderCode: 'orderCode',
  amount: 'finalAmount',
} as const;
export type OrderSortField = keyof typeof ORDER_SORT_MAP;
export const ORDER_SORTABLE_FIELDS = Object.keys(ORDER_SORT_MAP) as readonly OrderSortField[];

export interface OrdersPageQuery {
  size: OrderPageSize;
  after?: string;
  before?: string;
  status?: string;
  source?: string;
  search?: string;
  /** Vietnam local date yyyy-MM-dd — backend receives as ISO DateTime (Vietnam midnight UTC+7). */
  from?: string;
  /** Vietnam local date yyyy-MM-dd — inclusive through the final millisecond of the day. */
  to?: string;
  /** User-selected sort. Default when absent: createdAt DESC, id DESC. */
  sort?: { field: OrderSortField; direction: 'asc' | 'desc' };
}

interface OrdersConnection {
  totalCount?: number;
  pageInfo?: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
  nodes?: SalesOrderNode[] | null;
}

/**
 * GraphQL field names for the SalesOrder domain entity node.
 * Only fields confirmed present on FSCM.Domain.Entities.SalesOrder are listed here.
 * REST-computed fields (indicativeAmount, officialAmount, allocation*, shipment/line counts)
 * are intentionally absent and derived or defaulted in mapNode().
 */
interface SalesOrderNode {
  id: string;
  orderCode: string;
  retailerId: string;
  retailerCodeSnapshot: string;
  retailerNameSnapshot: string;
  salesGroupId: string;
  createdByUserId: string;
  status: string;
  paymentMethod?: string | null;
  finalAmount: number;
  finalPricePendingAllocation: boolean;
  source: string;
  version: number;
  createdAt: string;
}

/**
 * Map a GraphQL SalesOrder domain entity node to the OrderSummary view model.
 *
 * Financial derivation (from OrderContracts.cs):
 *   IndicativeAmount => FinalAmount          (always equals FinalAmount)
 *   OfficialAmount   => FinalPricePendingAllocation ? null : FinalAmount
 *
 * Allocation and aggregate count fields (allocationState, allocationResult, allocationRunId,
 * shipmentCount, totalCartons, lineCount) are not on the domain entity. They default to
 * empty string / null / 0 and are documented as BACKEND DEPENDENCY (BLOCKER-07).
 */
function mapNode(n: SalesOrderNode): OrderSummary {
  return {
    id: n.id,
    orderCode: n.orderCode,
    retailerId: n.retailerId,
    retailerCode: n.retailerCodeSnapshot,
    retailerName: n.retailerNameSnapshot,
    salesGroupId: n.salesGroupId,
    createdByUserId: n.createdByUserId,
    status: n.status as OrderStatus,
    paymentMethod: (n.paymentMethod ?? null) as PaymentMethod | null,
    // Derived from domain entity (confirmed in OrderContracts.cs OrderSummaryResult):
    finalAmount: n.finalAmount,
    finalPricePendingAllocation: n.finalPricePendingAllocation,
    indicativeAmount: n.finalAmount,
    officialAmount: n.finalPricePendingAllocation ? null : n.finalAmount,
    // BACKEND DEPENDENCY (BLOCKER-07): not on domain entity — requires Backend to add
    // computed projections or a dedicated REST hydration call.
    allocationState: '',
    allocationResult: null,
    allocationRunId: null,
    allocationProposalStatus: null,
    shipmentCount: 0,
    totalCartons: 0,
    lineCount: 0,
    source: (n.source === 'Offline' ? 'Offline' : 'Assisted') as 'Assisted' | 'Offline',
    version: n.version,
    createdAt: n.createdAt,
  };
}

/**
 * Build the GraphQL order clause as a safe literal string.
 * Only fields in ORDER_SORT_MAP are ever injected — user-supplied field names
 * never reach the query string directly.
 */
function buildOrderClause(sort?: OrdersPageQuery['sort']): string {
  if (sort && ORDER_SORT_MAP[sort.field]) {
    const gqlField = ORDER_SORT_MAP[sort.field];
    const dir = sort.direction === 'asc' ? 'ASC' : 'DESC';
    return `order: [{ ${gqlField}: ${dir} }, { id: DESC }]`;
  }
  return 'order: [{ createdAt: DESC }, { id: DESC }]';
}

/** Build the filter conditions and variable declarations. */
function buildFilter(q: OrdersPageQuery) {
  const conditions: string[] = [];
  const declarations: string[] = [];
  const variables: Record<string, unknown> = {};

  if (q.status) {
    // status is stored as string in SalesOrder domain entity — String! filter type is correct.
    conditions.push('{ status: { eq: $st } }');
    declarations.push('$st: String!');
    variables.st = q.status;
  }
  if (q.from) {
    // createdAt is DateTimeOffset on the domain entity; HotChocolate maps it to DateTime scalar.
    // Backend stores in UTC; Vietnam midnight (00:00:00+07:00) = UTC 17:00 previous day.
    conditions.push('{ createdAt: { gte: $from } }');
    declarations.push('$from: DateTime!');
    variables.from = `${q.from}T00:00:00+07:00`;
  }
  if (q.to) {
    conditions.push('{ createdAt: { lte: $to } }');
    declarations.push('$to: DateTime!');
    variables.to = `${q.to}T23:59:59.999+07:00`;
  }
  if (q.source) {
    conditions.push('{ source: { eq: $source } }');
    declarations.push('$source: String!');
    variables.source = q.source === 'Online' ? 'Assisted' : q.source;
  }
  if (q.search?.trim()) {
    conditions.push('{ or: [{ orderCode: { contains: $search } }, { retailerCodeSnapshot: { contains: $search } }, { retailerNameSnapshot: { contains: $search } }] }');
    declarations.push('$search: String!');
    variables.search = q.search.trim();
  }

  return { conditions, declarations, variables };
}

const whereOf = (conditions: string[]) =>
  conditions.length ? `where: { and: [${conditions.join(', ')}] }` : '';

export function buildOrdersPageQuery(q: OrdersPageQuery): { query: string; variables: Record<string, unknown> } {
  if (!ORDER_PAGE_SIZES.includes(q.size)) throw new Error('invalid page size');
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

  // Only request fields confirmed on FSCM.Domain.Entities.SalesOrder.
  // Computed REST fields (indicativeAmount, officialAmount, allocation*, counts) are absent.
  const query = `query OrdersPage${decl} {
  entities {
    page: salesOrders(${[paging, whereOf(conditions), order].filter(Boolean).join(', ')}) {
      totalCount
      pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
      nodes {
        id orderCode retailerId retailerCodeSnapshot retailerNameSnapshot
        salesGroupId createdByUserId status paymentMethod
        finalAmount finalPricePendingAllocation
        source version createdAt
      }
    }
  }
}`;

  return { query, variables };
}

function friendlyError(err: unknown, q: OrdersPageQuery): unknown {
  if (!(err instanceof ApiError)) return err;
  if (err.status === 401 || err.status === 403) return err;
  if (err.status === 400 && (q.after || q.before) && err.code === 'HC0078') {
    return new ApiError(400, 'Trang không hợp lệ', 'Trang đã chọn không còn hợp lệ. Hãy quay về trang đầu.', err.code);
  }
  if (err.status === 400) {
    return new ApiError(400, 'Không tải được dữ liệu', 'Không tải được danh sách đơn hàng. Vui lòng thử lại.', err.code);
  }
  return err;
}

export interface OrdersPage {
  rows: OrderSummary[];
  totalCount: number;
  pageInfo: PageInfo;
}

export async function fetchOrdersPage(q: OrdersPageQuery): Promise<OrdersPage> {
  try {
    const { query, variables } = buildOrdersPageQuery(q);
    const data = await graphql<{ entities: { page: OrdersConnection } }>(query, variables);
    const page = data.entities?.page;
    if (!page || typeof page.totalCount !== 'number' || !page.pageInfo || !Array.isArray(page.nodes)) {
      throw new ApiError(502, 'Không tải được dữ liệu', 'Phản hồi đơn hàng thiếu thông tin phân trang.');
    }
    return {
      rows: page.nodes.map(mapNode),
      totalCount: page.totalCount,
      pageInfo: page.pageInfo as PageInfo,
    };
  } catch (err) {
    throw friendlyError(err, q);
  }
}
