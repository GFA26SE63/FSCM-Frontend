import { useState, type ReactNode } from 'react';
import { Button } from '@/shared/ui';
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
  const [reason, setReason] = useState<{ order: OrderActionTarget; mode: 'cancel' } | null>(null);

  const buttons = (order: OrderActionTarget, size: 'sm' | 'md' = 'sm') => (
    <>
      {(['Allocating', 'Quoted', 'PaymentPending'] as OrderStatus[]).includes(order.status) && (
        <Button size={size} variant="danger" onClick={() => setReason({ order, mode: 'cancel' })}>Hủy đơn</Button>
      )}
    </>
  );

  const dialogs = (
    <>
      <ReasonDialog order={reason?.order ?? null} mode="cancel" onClose={() => setReason(null)} />
    </>
  );

  return <>{children({ buttons, dialogs })}</>;
}
