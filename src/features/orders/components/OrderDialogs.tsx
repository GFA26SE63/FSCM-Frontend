import { env } from '@/shared/lib';
import { FormDialog, QueryState, Modal } from '@/shared/ui';
import { useOrderShipments, useOrder, useCancelOrder, useDispatchOrder, useDispatchOptions, useRejectOrder } from '../hooks';

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

/** "Gán xe / người giao": choose vehicle + driver from the master-data dropdowns (snapshot stored on the order). */
export function DispatchDialog({ code, onClose }: { code: string | null; onClose: () => void }) {
  const order = useOrder(code ?? '');
  const { vehicles, drivers } = useDispatchOptions(!!code);
  const dispatch = useDispatchOrder();
  const shipments = useOrderShipments(!env.useMock ? order.data?.id : undefined);
  const ready = !!code && order.data && vehicles.data && drivers.data && (env.useMock || shipments.data);
  if (!code) return null;
  if (!ready)
    return (
      <Modal open title={`Gán xe / người giao · ${code}`} onClose={onClose} width={640}>
        <QueryState query={order}>{() => null}</QueryState>
        <QueryState query={vehicles}>{() => null}</QueryState>
        <QueryState query={drivers}>{() => null}</QueryState>
        {!env.useMock && <QueryState query={shipments}>{() => null}</QueryState>}
      </Modal>
    );
  const o = order.data!;
  const parts = (shipments.data ?? []).filter(p => ['Ready', 'Issued', 'Delivering'].includes(p.status));
  if (!env.useMock && parts.length === 0) return (
    <Modal open title="Chưa có phần giao sẵn sàng" onClose={onClose} width={640}>
      <p>Hoàn tất phiếu nhặt tại kho trước khi phân công xe và người giao. Sau đó mở lại màn hình này.</p>
    </Modal>
  );
  const warehouseName = (id?: string) => parts.find(p => p.warehouseId === id)?.warehouseName ?? '';
  const vs = vehicles.data!.filter((v) => v.status === 'Active');
  const ds = drivers.data!.filter((d) => d.status === 'Active');
  return (
    <FormDialog
      open
      width={680}
      title={`Gán xe / người giao · ${code}`}
      subtitle="Đơn hàng · Giao hàng"
      submitLabel="Lưu phân công"
      initial={{ shipmentId: parts[0]?.id ?? '', plate: vs[0]?.plate ?? '', driverCode: ds[0]?.code ?? '' }}
      fields={[
        ...(!env.useMock ? [{ key: 'shipmentId', type: 'select' as const, required: true, label: 'Phần giao theo kho', options: parts.map(p => ({ value: p.id, label: `${p.shipmentCode} · ${p.warehouseName} · ${p.status}` })) }] : []),
        { key: 'order', type: 'info', label: 'Đơn hàng', info: () => `${o.code} · ${o.retailerName}` },
        { key: 'addr', type: 'info', label: 'Địa chỉ giao', info: () => o.retailerAddress },
        {
          key: 'plate', type: 'select', required: true, label: 'Xe giao', options: vs.map((v) => ({ value: v.plate, label: `${v.plate} · ${v.type} · ${warehouseName(v.warehouseId)}` })),
          validate: (val, values) => {
            const vehicle = vs.find(x => x.plate === val);
            const part = parts.find(p => p.id === values.shipmentId);
            if (!env.useMock && part && vehicle?.warehouseId !== part.warehouseId) return 'Chọn xe thuộc kho của phần giao.';
            const quantity = env.useMock ? o.totalQty : part?.totalQuantity;
            return vehicle && quantity != null && quantity > vehicle.capacity ? 'Xe không đủ tải cho phần giao.' : undefined;
          },
        },
        { key: 'driverCode', type: 'select', required: true, label: 'Người giao', options: ds.map((d) => ({ value: d.code, label: `${d.code} · ${d.name} · ${warehouseName(d.warehouseId)}` })), validate: (value, values) => { const part = parts.find(p => p.id === values.shipmentId); return !env.useMock && part && ds.find(d => d.code === value)?.warehouseId !== part.warehouseId ? 'Chọn người giao thuộc kho của phần giao.' : undefined; } },
        { key: 'phone', type: 'info', label: 'SĐT người giao', info: (v) => ds.find((d) => d.code === v.driverCode)?.phone ?? '—' },
        { key: 'cap', type: 'info', label: 'Tải trọng xe / phần giao', info: (v) => `${vs.find((x) => x.plate === v.plate)?.capacity ?? '—'} thùng / ${env.useMock ? o.totalQty : parts.find(p => p.id === v.shipmentId)?.totalQuantity ?? '—'} thùng` },
      ]}
      note='Phân công từng phần giao theo kho. Kho xác nhận xuất hàng riêng sau khi đủ điều kiện. Xe và người giao chọn từ danh mục "Xe & người giao" (chỉ hiện mục đang hoạt động). Đơn lưu snapshot biển số, tên, SĐT tại thời điểm giao; sửa danh mục sau đó không đổi đơn cũ. Không gom chuyến, không tối ưu tuyến.'
      onClose={onClose}
      onSubmit={async (v) => {
        await dispatch.mutateAsync({ code, plate: v.plate, driverCode: v.driverCode, shipmentId: v.shipmentId });
        onClose();
      }}
    />
  );
}
