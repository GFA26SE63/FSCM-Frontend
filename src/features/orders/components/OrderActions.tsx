import {
  useState,
  type ReactNode,
} from 'react';

import {
  useAuth,
} from '@/shared/auth/AuthContext';
import {
  Button,
} from '@/shared/ui';
import {
  canWithdrawOrder,
} from '../orderAccess';
import type {
  OrderStatus,
} from '../types';
import {
  WithdrawOrderDialog,
} from './OrderDialogs';
import { useApiMutation } from '@/shared/hooks/useApiMutation';
import { orderApi } from '../api';

export interface OrderActionTarget {
  id: string;
  orderCode: string;
  status: OrderStatus;
  version: number;
}

interface Props {
  children: (api: {
    buttons: (
      order: OrderActionTarget,
      size?: 'sm' | 'md',
    ) => ReactNode;

    dialogs: ReactNode;
  }) => ReactNode;
}

export function OrderActions({
  children,
}: Props) {
  const { user } = useAuth();
  const retry = useApiMutation(orderApi.retryAllocation, { success: 'Đã thử phân bổ lại đơn.' });

  const [
    selectedOrder,
    setSelectedOrder,
  ] = useState<
    OrderActionTarget | null
  >(null);

  const buttons = (
    order: OrderActionTarget,
    size: 'sm' | 'md' = 'sm',
  ) => {
    if (user && ['Admin', 'Operator', 'Sales', 'Retailer'].includes(user.role) &&
      ['AllocationFailed', 'AllocationConflict'].includes(order.status)) {
      return <Button size={size} loading={retry.isPending} onClick={() => retry.mutate(order)}>Thử phân bổ lại</Button>;
    }
    if (
      !canWithdrawOrder(
        user,
        order,
      )
    ) {
      return null;
    }

    return (
      <Button
        size={size}
        variant="danger"
        onClick={() =>
          setSelectedOrder(order)
        }
      >
        Rút yêu cầu
      </Button>
    );
  };

  const dialogs = (
    <WithdrawOrderDialog
      order={selectedOrder}
      onClose={() =>
        setSelectedOrder(null)
      }
    />
  );

  return (
    <>
      {children({
        buttons,
        dialogs,
      })}
    </>
  );
}
