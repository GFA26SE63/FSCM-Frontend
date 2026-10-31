import { FormDialog } from '@/shared/ui';
import { useCancelOrder, useRejectOrder } from '../hooks';

interface ReasonDialogProps {
  order: { id: string; orderCode: string; version: number } | null;
  mode: 'reject' | 'cancel';
  onClose: () => void;
}

/** Sends the canonical order GUID and optimistic version; the business code is display-only. */
export function ReasonDialog({ order, mode, onClose }: ReasonDialogProps) {
  const reject = useRejectOrder();
  const cancel = useCancelOrder();
  const isReject = mode === 'reject';

  return (
    <FormDialog
      open={order != null}
      width={520}
      columns={1}
      danger
      title={`${isReject ? 'Từ chối đơn' : 'Hủy đơn'} ${order?.orderCode ?? ''}`}
      submitLabel={isReject ? 'Từ chối đơn' : 'Xác nhận hủy đơn'}
      initial={{ reason: '' }}
      fields={[{
        key: 'reason', type: 'textarea', required: true,
        label: isReject ? 'Lý do từ chối (bắt buộc)' : 'Lý do hủy (bắt buộc)',
      }]}
      note={isReject
        ? 'Đơn bị từ chối sẽ không đi vào đợt phân bổ.'
        : 'Việc giải phóng reservation và chặn dispatch cũ do server xử lý nguyên tử.'}
      onClose={onClose}
      onSubmit={async (v) => {
        if (!order) return;
        const command = { orderId: order.id, expectedVersion: order.version, reason: v.reason };
        await (isReject ? reject : cancel).mutateAsync(command);
        onClose();
      }}
    />
  );
}
