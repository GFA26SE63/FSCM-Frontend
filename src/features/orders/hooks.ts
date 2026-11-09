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

export const orderKeys = {
  all: ['orders'] as const,

  list: [
    'orders',
    'list',
  ] as const,

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