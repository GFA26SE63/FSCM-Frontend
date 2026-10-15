import { useState, type ReactNode } from 'react';
import { Button, ConfirmDialog } from '@/shared/ui';
import { useApproveOrder } from '../hooks';
import type { OrderStatus } from '../types';
import { DispatchDialog, ReasonDialog } from './OrderDialogs';

interface Props {
  /** Render prop: receives the action buttons for an order and the dialogs element to mount once. */
  children: (api: { buttons: (code: string, status: OrderStatus, size?: 'sm' | 'md') => ReactNode; dialogs: ReactNode }) => ReactNode;
}

/**
 * Shared order actions (list rows + detail header): Duyệt / Từ chối (Pending), Hủy đơn (Approved/Picking, before dispatch),
 * Cập nhật Đang giao (Shipped). Owns the dialogs so both pages behave identically.
 */
export function OrderActions({ children }: Props) {
  const approve = useApproveOrder();
  const [approveCode, setApproveCode] = useState<string | null>(null);
  const [reason, setReason] = useState<{ code: string; mode: 'reject' | 'cancel' } | null>(null);
  const [dispatchCode, setDispatchCode] = useState<string | null>(null);

  const buttons = (code: string, status: OrderStatus, size: 'sm' | 'md' = 'sm') => (
    <>
      {status === 'Pending' && (
        <>
          <Button size={size} variant="primary" onClick={() => setApproveCode(code)}>Duyệt</Button>
          <Button size={size} variant="danger" onClick={() => setReason({ code, mode: 'reject' })}>Từ chối</Button>
        </>
      )}
      {(status === 'Approved' || status === 'Picking') && (
        <Button size={size} variant="danger" onClick={() => setReason({ code, mode: 'cancel' })}>Hủy đơn</Button>
      )}
      {status === 'Shipped' && (
        <Button size={size} variant="primary" onClick={() => setDispatchCode(code)}>Cập nhật Đang giao</Button>
      )}
    </>
  );

  const dialogs = (
    <>
      <ConfirmDialog
        open={!!approveCode}
        title={`Duyệt đơn ${approveCode ?? ''}`}
        message="Hàng đang tạm giữ chuyển sang Reserved, hệ thống sinh picking list theo từng kho và gửi thông báo cho Sales, retailer, Warehouse Keeper."
        confirmLabel="Duyệt đơn"
        onClose={() => setApproveCode(null)}
        onConfirm={async () => {
          await approve.mutateAsync(approveCode!);
          setApproveCode(null);
        }}
      />
      <ReasonDialog code={reason?.code ?? null} mode={reason?.mode ?? 'reject'} onClose={() => setReason(null)} />
      <DispatchDialog code={dispatchCode} onClose={() => setDispatchCode(null)} />
    </>
  );
  return <>{children({ buttons, dialogs })}</>;
}
