import type {
  CurrentUser,
} from '@/shared/auth/authApi';
import {
  assertPermission,
  can,
} from '@/shared/auth/permissions';
import {
  ApiError,
} from '@/shared/api/errors';
import type {
  OrderStatus,
} from './types';

export interface WithdrawableOrder {
  status: OrderStatus;
}

export function canWithdrawOrder(
  user: CurrentUser | null,
  order: WithdrawableOrder,
): boolean {
  return (
    can(user, 'orders.withdraw') &&
    order.status === 'Allocating'
  );
}

export function assertCanWithdrawOrder(
  user: CurrentUser | null,
  order: WithdrawableOrder,
): void {
  assertPermission(
    user,
    'orders.withdraw',
  );

  if (order.status !== 'Allocating') {
    throw new ApiError(
      409,
      'Không thể rút yêu cầu',
      'Chỉ được rút SO khi còn đang phân bổ. Sau khi có báo giá, Retailer thực hiện từ chối báo giá.',
    );
  }
}