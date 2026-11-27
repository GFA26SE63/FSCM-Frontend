import { graphql } from '@/shared/api/graphql';
import type { PageInfo } from '@/shared/pagination/types';
import type { FinancialFilters } from './financialGraphql';

/**
 * "Giá trị đơn hàng đủ điều kiện" = payment-qualified delivered order value (NOT recognized revenue).
 * Source: Payment ledger (one per order). Eligible = Payment.status "Paid" (Backend derives it: confirmed >= adjusted
 * obligation, re-derived after reversals) AND Payment.deliveredDate (VN date, set once when the whole order is
 * delivered) inside the inclusive range AND the order itself is Delivered/Completed. Amount = Payment.adjustedAmount
 * (obligation after approved adjustments; initialised from SalesOrder.FinalAmount). Period = delivery date only.
 */
export const ELIGIBLE_ORDER_STATUSES = ['Delivered', 'Completed'] as const;

/** Safe bound for browser-side aggregation; above it the total is reported as unavailable, never partial. */
export const ORDER_VALUE_MAX_ORDERS = 2000;
export const ORDER_VALUE_PAGE_SIZE = 200;
const ORDER_CHUNK = 100;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type OrderValueResult =
  | { status: 'ok'; orderCount: number; amountMinor: number }
  | { status: 'too-large'; orderCount: number }
  | { status: 'warehouse-unsupported' }
  | { status: 'incomplete'; reason: string };

type Gql = <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;
interface PayNode { id: string; salesOrderId: string; adjustedAmount: number | null }
interface Page { totalCount: number; pageInfo: PageInfo; nodes: PayNode[] }
interface OrderNode { id: string; retailerId: string; status: string }

/** Dates are inline literals (Date scalar, VN-local DateOnly, inclusive both ends) after a strict format check. */
export function buildPaidDeliveredPaymentsQuery(f: FinancialFilters, after?: string) {
  if (!DATE_RE.test(f.from) || !DATE_RE.test(f.to)) throw new Error('Ngày không hợp lệ.');
  const conditions = [
    `{ deliveredDate: { gte: "${f.from}" } }`,
    `{ deliveredDate: { lte: "${f.to}" } }`,
    '{ status: { eq: "Paid" } }',
  ];
  const variables: Record<string, unknown> = {};
  if (after) variables.after = after;
  const query = `query PaidDeliveredPayments${after ? '($after: String!)' : ''} {
  entities {
    page: payments(first: ${ORDER_VALUE_PAGE_SIZE}${after ? ', after: $after' : ''}, where: { and: [${conditions.join(', ')}] }, order: [{ id: ASC }]) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes { id salesOrderId adjustedAmount }
    }
  }
}`;
  return { query, variables };
}

export const buildOrdersByIdQuery = (ids: string[]) => ({
  query: `query PaymentOrders($ids: [UUID!]!) {
  entities { page: salesOrders(first: ${ORDER_CHUNK}, where: { id: { in: $ids } }) { nodes { id retailerId status } } }
}`,
  variables: { ids },
});

/** Integer minor units (1/100 VND) so that summing is exact; non-finite/missing amounts are rejected. */
export const toMinor = (amount: unknown): number | null =>
  typeof amount === 'number' && Number.isFinite(amount) ? Math.round(amount * 100) : null;

export const formatMinorVnd = (minor: number) => {
  const whole = Math.trunc(minor / 100);
  const frac = Math.abs(minor % 100);
  const grouped = Math.abs(whole).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${minor < 0 ? '-' : ''}${grouped}${frac ? `,${String(frac).padStart(2, '0')}` : ''} VND`;
};

export async function fetchOrderValueTotal(
  f: FinancialFilters,
  run: Gql = graphql,
  maxOrders = ORDER_VALUE_MAX_ORDERS,
): Promise<OrderValueResult> {
  // No persisted per-warehouse order amount is exposed; never duplicate or split the order value.
  if (f.warehouseId) return { status: 'warehouse-unsupported' };

  const payments = new Map<string, number>(); // dedupe by SalesOrderId
  let after: string | undefined;
  let total: number | null = null;
  let loaded = 0;
  let done = false;
  for (let guard = 0; guard < Math.ceil(maxOrders / ORDER_VALUE_PAGE_SIZE) + 2 && !done; guard++) {
    const { query, variables } = buildPaidDeliveredPaymentsQuery(f, after);
    const data = await run<{ entities: { page: Page } }>(query, variables);
    const page = data.entities?.page;
    if (!page || !Array.isArray(page.nodes) || typeof page.totalCount !== 'number' || !page.pageInfo) {
      return { status: 'incomplete', reason: 'Phản hồi thiếu thông tin phân trang.' };
    }
    if (total === null) {
      total = page.totalCount;
      if (total > maxOrders) return { status: 'too-large', orderCount: total };
    } else if (page.totalCount !== total) {
      return { status: 'incomplete', reason: 'Dữ liệu thay đổi trong lúc tải.' };
    }
    for (const node of page.nodes) {
      const minor = toMinor(node.adjustedAmount);
      if (minor === null || !node.salesOrderId) return { status: 'incomplete', reason: 'Có đơn thiếu giá trị.' };
      const prev = payments.get(node.salesOrderId);
      if (prev !== undefined && prev !== minor) return { status: 'incomplete', reason: 'Một đơn có nhiều khoản thanh toán khác nhau.' };
      payments.set(node.salesOrderId, minor);
      loaded++;
    }
    if (!page.pageInfo.hasNextPage) done = true;
    else {
      after = page.pageInfo.endCursor ?? undefined;
      if (!after) return { status: 'incomplete', reason: 'Thiếu con trỏ trang.' };
    }
  }
  if (!done) return { status: 'incomplete', reason: 'Vượt giới hạn số trang.' };
  if (loaded !== total) return { status: 'incomplete', reason: 'Số đơn tải được không khớp tổng số.' };

  // Order check: payment must belong to a delivered/completed order (and to the chosen retailer).
  const ids = [...payments.keys()];
  const allowed = new Set<string>(ELIGIBLE_ORDER_STATUSES);
  let amountMinor = 0;
  let count = 0;
  for (let i = 0; i < ids.length; i += ORDER_CHUNK) {
    const chunk = ids.slice(i, i + ORDER_CHUNK);
    const { query, variables } = buildOrdersByIdQuery(chunk);
    const data = await run<{ entities: { page: { nodes: OrderNode[] } } }>(query, variables);
    const nodes = data.entities?.page?.nodes;
    if (!Array.isArray(nodes)) return { status: 'incomplete', reason: 'Phản hồi đơn hàng thiếu dữ liệu.' };
    const byId = new Map(nodes.map(n => [n.id, n]));
    for (const id of chunk) {
      const o = byId.get(id);
      if (!o) return { status: 'incomplete', reason: 'Không đọc được đơn của khoản thanh toán.' };
      if (!allowed.has(o.status)) continue;
      if (f.retailerId && o.retailerId !== f.retailerId) continue;
      amountMinor += payments.get(id)!;
      count++;
    }
  }
  return { status: 'ok', orderCount: count, amountMinor };
}
