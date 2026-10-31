import { useState, type ReactNode } from 'react';
import { Button, ConfirmDialog } from '@/shared/ui';
import { useApproveOrder } from '../hooks';
import type { OrderStatus } from '../types';
import { ReasonDialog } from './OrderDialogs';

export interface OrderActionTarget {
  id: string;
  orderCode: string;
  status: OrderStatus;
  version: number;
}

interface Props {
  children: (api: { buttons: (order: OrderActionTarget, size?: 'sm' | 'md') => ReactNode; dialogs: ReactNode }) => ReactNode;
}

/** Pre-cutoff review commands use the immutable order GUID and optimistic version. */
export function OrderActions({ children }: Props) {
  const approve = useApproveOrder();
  const [approveOrder, setApproveOrder] = useState<OrderActionTarget | null>(null);
  const [reason, setReason] = useState<{ order: OrderActionTarget; mode: 'reject' | 'cancel' } | null>(null);

  const buttons = (order: OrderActionTarget, size: 'sm' | 'md' = 'sm') => (
    <>
      {order.status === 'PendingApproval' && (
        <>
          <Button size={size} variant="primary" onClick={() => setApproveOrder(order)}>Duyệt trước đợt</Button>
          <Button size={size} variant="danger" onClick={() => setReason({ order, mode: 'reject' })}>Từ chối</Button>
        </>
      )}
      {(['PendingAllocation', 'Approved', 'Picking'] as OrderStatus[]).includes(order.status) && (
        <Button size={size} variant="danger" onClick={() => setReason({ order, mode: 'cancel' })}>Hủy đơn</Button>
      )}
    </>
  );

  const dialogs = (
    <>
      <ConfirmDialog
        open={approveOrder != null}
        title={`Duyệt đơn ${approveOrder?.orderCode ?? ''}`}
        message="Duyệt trước cutoff chỉ đưa đơn vào đợt phân bổ kế tiếp; chưa chọn batch, chưa reserve tồn và chưa chốt giá HSD."
        confirmLabel="Duyệt đơn"
        onClose={() => setApproveOrder(null)}
        onConfirm={async () => {
          if (!approveOrder) return;
          await approve.mutateAsync({ orderId: approveOrder.id, expectedVersion: approveOrder.version });
          setApproveOrder(null);
        }}
      />
      <ReasonDialog order={reason?.order ?? null} mode={reason?.mode ?? 'reject'} onClose={() => setReason(null)} />
    </>
  );

  return <>{children({ buttons, dialogs })}</>;
}
