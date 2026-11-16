import {
  useQuery,
} from '@tanstack/react-query';

import {
  useApiMutation,
} from '@/shared/hooks';
import {
  useAuth,
} from '@/shared/auth/AuthContext';
import {
  orderApi,
  type WithdrawOrderRequest,
} from './api';
import {
  assertCanWithdrawOrder,
} from './orderAccess';
import type {
  OrderStatus,
} from './types';
import { fetchOrdersPage, type OrdersPageQuery } from './ordersGraphql';

export const orderKeys = {
  all: ['orders'] as const,

  list: [
    'orders',
    'list',
  ] as const,

  page: (q: OrdersPageQuery) =>
    ['orders', 'cursor-page', q] as const,

  detail: (orderId: string) =>
    [
      'orders',
      'detail',
      orderId,
    ] as const,
};

export const useOrders = () =>
  useQuery({
    queryKey: orderKeys.list,
    queryFn: orderApi.list,
  });

/** Server-side cursor-paginated orders via GraphQL entities.salesOrders. */
export const useOrdersPage = (q: OrdersPageQuery) =>
  useQuery({
    queryKey: orderKeys.page(q),
    queryFn: () => fetchOrdersPage(q),
    placeholderData: (prev) => prev,
    retry: false,
    staleTime: 15_000,
  });

export const useOrder = (
  orderId: string,
) =>
  useQuery({
    queryKey:
      orderKeys.detail(orderId),
    queryFn: () =>
      orderApi.get(orderId),
    enabled: Boolean(orderId),
  });

interface WithdrawOrderVariables
  extends WithdrawOrderRequest {
  status: OrderStatus;
}

export function useWithdrawOrder() {
  const { user } = useAuth();

  return useApiMutation(
    async (
      input: WithdrawOrderVariables,
    ) => {
      assertCanWithdrawOrder(
        user,
        input,
      );

      return orderApi.withdraw({
        orderId: input.orderId,
        expectedVersion:
          input.expectedVersion,
        reason: input.reason,
      });
    },
    {
      permission: 'orders.withdraw',

      success: (order) =>
        `Đã rút yêu cầu ${order.orderCode}.`,
    },
  );
}