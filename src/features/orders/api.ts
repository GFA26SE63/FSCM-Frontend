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

async function listOrders():
  Promise<OrderSummary[]> {
  const result: OrderSummary[] = [];
  let page = 1;

  while (true) {
    const response =
      await get<OrderPage>(
        '/orders',
        {
          page,
          pageSize: 100,
        },
      );

    result.push(...response.items);

    if (
      response.items.length === 0 ||
      page >= response.totalPages
    ) {
      break;
    }

    page += 1;
  }

  return result;
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