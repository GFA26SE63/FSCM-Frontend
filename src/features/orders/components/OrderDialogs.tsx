import {
  FormDialog,
} from '@/shared/ui';
import {
  useWithdrawOrder,
} from '../hooks';
import type {
  OrderStatus,
} from '../types';

interface WithdrawTarget {
  id: string;
  orderCode: string;
  status: OrderStatus;
  version: number;
}

interface Props {
  order: WithdrawTarget | null;
  onClose: () => void;
}

export function WithdrawOrderDialog({
  order,
  onClose,
}: Props) {
  const withdraw =
    useWithdrawOrder();

  return (
    <FormDialog
      open={order !== null}
      width={520}
      columns={1}
      danger
      title={
        `Rút yêu cầu ${order?.orderCode ?? ''}`
      }
      submitLabel="Xác nhận rút yêu cầu"
      initial={{
        reason: '',
      }}
      fields={[
        {
          key: 'reason',
          type: 'textarea',
          required: true,
          label: 'Lý do rút yêu cầu',
          validate: (value) =>
            String(value).trim()
              ? undefined
              : 'Vui lòng nhập lý do.',
        },
      ]}
      note="Chỉ áp dụng khi SO còn đang phân bổ. Nếu hệ thống đã chốt báo giá trong lúc thao tác, backend sẽ từ chối yêu cầu này."
      onClose={onClose}
      onSubmit={async (values) => {
        if (!order) return;

        await withdraw.mutateAsync({
          orderId: order.id,
          status: order.status,
          expectedVersion:
            order.version,
          reason:
            String(
              values.reason,
            ).trim(),
        });

        onClose();
      }}
    />
  );
}