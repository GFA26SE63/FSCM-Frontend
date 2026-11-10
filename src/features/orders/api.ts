import {
  get,
  post,
} from '@/shared/api/http';
import type {
  OrderDetail,
  OrderSummary,
} from './types';

interface OrderPage {
  items: OrderSummary[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface WithdrawOrderRequest {
  orderId: string;
  expectedVersion: number;
  reason: string;
}

/**
 * The server loads every order of a page one by one (about a second each against the remote DB), so
 * one request for 100 orders takes ~25 s and trips the 20 s client timeout. Small pages keep each
 * request short, and every page after the first is requested in parallel.
 */
const LIST_PAGE_SIZE = 10;

async function listOrders():
  Promise<OrderSummary[]> {
  const first =
    await get<OrderPage>(
      '/orders',
      {
        page: 1,
        pageSize: LIST_PAGE_SIZE,
      },
    );
  const rest = await Promise.all(
    Array.from(
      { length: Math.max(0, first.totalPages - 1) },
      (_, index) =>
        get<OrderPage>(
          '/orders',
          {
            page: index + 2,
            pageSize: LIST_PAGE_SIZE,
          },
        ),
    ),
  );
  return [first, ...rest].flatMap(
    (page) => page.items,
  );
}

export const orderApi = {
  list: listOrders,

  get: (
    orderId: string,
  ): Promise<OrderDetail> =>
    get<OrderDetail>(
      `/orders/${orderId}`,
    ),

  // Backend giữ tên endpoint /cancel,
  // nhưng operation hiện tại là Withdraw SO.
  withdraw: (
    input: WithdrawOrderRequest,
  ): Promise<OrderDetail> =>
    post<OrderDetail>(
      `/orders/${input.orderId}/cancel`,
      {
        expectedVersion:
          input.expectedVersion,
        reason: input.reason,
      },
    ),
};