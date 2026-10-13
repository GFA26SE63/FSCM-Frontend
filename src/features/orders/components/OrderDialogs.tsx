import { FormDialog, QueryState, Modal } from '@/shared/ui';
import { useOrder, useCancelOrder, useDispatchOrder, useDispatchOptions, useRejectOrder } from '../hooks';

interface ReasonDialogProps {
  code: string | null;
  mode: 'reject' | 'cancel';
  onClose: () => void;
}

/** Reason (required) for "Từ chối" (system / reviewer) or "Hủy đơn" (on request, before dispatch). */
export function ReasonDialog({ code, mode, onClose }: ReasonDialogProps) {
  const reject = useRejectOrder();
  const cancel = useCancelOrder();
  const isReject = mode === 'reject';
  return (
    <FormDialog
      open={!!code}
      width={520}
      columns={1}
      danger
      title={`${isReject ? 'Từ chối đơn' : 'Hủy đơn'} ${code ?? ''}`}
      submitLabel={isReject ? 'Từ chối đơn' : 'Xác nhận hủy đơn'}
      initial={{ reason: '' }}
      fields={[
        {
          key: 'reason', type: 'textarea', required: true,
          label: isReject ? 'Lý do từ chối (bắt buộc)' : 'Lý do hủy (bắt buộc)',
          placeholder: isReject ? 'Ví dụ: Retailer không đồng ý giá sau khi khuyến mãi thay đổi' : 'Ví dụ: Retailer gọi điện yêu cầu hủy, đổi sang đặt tuần sau',
        },
      ]}
      note={isReject ? 'Hàng đang tạm giữ sẽ được trả lại; Sales và retailer nhận thông báo kèm lý do.' : 'Operator hủy đơn khi retailer hoặc Sales yêu cầu (đơn chưa xuất kho). Hàng tạm giữ / Reserved được trả lại tồn khả dụng; picking list (nếu có) bị hủy; Sales và retailer nhận thông báo.'}
      onClose={onClose}
      onSubmit={async (v) => {
        await (isReject ? reject : cancel).mutateAsync({ code: code!, reason: v.reason });
        onClose();
      }}
    />
  );
}

/** "Cập nhật Đang giao": choose vehicle + driver from the master-data dropdowns (snapshot stored on the order). */
export function DispatchDialog({ code, onClose }: { code: string | null; onClose: () => void }) {
  const order = useOrder(code ?? '');
  const { vehicles, drivers } = useDispatchOptions(!!code);
  const dispatch = useDispatchOrder();
  const ready = !!code && order.data && vehicles.data && drivers.data;
  if (!code) return null;
  if (!ready)
    return (
      <Modal open title={`Cập nhật Đang giao · ${code}`} onClose={onClose} width={640}>
        <QueryState query={order}>{() => null}</QueryState>
      </Modal>
    );
  const o = order.data!;
  const vs = vehicles.data!.filter((v) => v.status === 'Active');
  const ds = drivers.data!.filter((d) => d.status === 'Active');
  return (
    <FormDialog
      open
      width={680}
      title={`Cập nhật Đang giao · ${code}`}
      subtitle="Đơn hàng · Giao hàng"
      submitLabel="Xác nhận Đang giao"
      initial={{ plate: vs[0]?.plate ?? '', driverCode: ds[0]?.code ?? '' }}
      fields={[
        { key: 'order', type: 'info', label: 'Đơn hàng', info: () => `${o.code} · ${o.retailerName}` },
        { key: 'addr', type: 'info', label: 'Địa chỉ giao', info: () => o.retailerAddress },
        {
          key: 'plate', type: 'select', required: true, label: 'Xe giao', options: vs.map((v) => ({ value: v.plate, label: `${v.plate} · ${v.type}` })),
          validate: (val) => {
            const v = vs.find((x) => x.plate === val);
            return v && o.totalQty > v.capacity ? `Xe ${v.plate} chỉ chở ${v.capacity} thùng – đơn ${o.totalQty} thùng. Chọn xe khác.` : undefined;
          },
        },
        { key: 'driverCode', type: 'select', required: true, label: 'Người giao', options: ds.map((d) => ({ value: d.code, label: `${d.code} · ${d.name}` })) },
        { key: 'phone', type: 'info', label: 'SĐT người giao', info: (v) => ds.find((d) => d.code === v.driverCode)?.phone ?? '—' },
        { key: 'cap', type: 'info', label: 'Tải trọng xe / đơn hàng', info: (v) => `${vs.find((x) => x.plate === v.plate)?.capacity ?? '—'} thùng / ${o.totalQty} thùng` },
      ]}
      note='Xe và người giao chọn từ danh mục "Xe & người giao" (chỉ hiện mục đang hoạt động). Đơn lưu snapshot biển số, tên, SĐT tại thời điểm giao; sửa danh mục sau đó không đổi đơn cũ. Không gom chuyến, không tối ưu tuyến.'
      onClose={onClose}
      onSubmit={async (v) => {
        await dispatch.mutateAsync({ code, plate: v.plate, driverCode: v.driverCode });
        onClose();
      }}
    />
  );
}
