import { useState } from 'react';
import { FormDialog, QueryState, Modal, Button, Callout } from '@/shared/ui';
import { useOrder, useCancelOrder, useDispatchOrder, useDispatchOptions, useRejectOrder } from '../hooks';

interface ReasonDialogProps {
  code: string | null;
  mode: 'reject' | 'cancel';
  onClose: () => void;
}

const REJECT_REASONS = [
  'Retailer không đồng ý giá sau khi khuyến mãi thay đổi',
  'Tồn kho không đủ để đáp ứng đơn',
  'Đơn vượt hạn mức công nợ',
  'Retailer đang nợ quá hạn',
  'Sản phẩm không còn phân phối tại khu vực này',
  'Đơn trùng lặp',
  'Thông tin đơn không hợp lệ',
  'Khác (nhập tay)',
];

const CANCEL_REASONS = [
  'Retailer yêu cầu hủy qua điện thoại',
  'Retailer yêu cầu hủy qua Sales',
  'Đặt nhầm sản phẩm / số lượng',
  'Đổi sang đặt tuần sau',
  'Retailer tạm ngừng kinh doanh',
  'Điểm giao không tiếp cận được',
  'Đơn trùng lặp',
  'Khác (nhập tay)',
];

/** Reason (required) for "Từ chối" or "Hủy đơn" with predefined dropdowns & attachments matching prototype. */
export function ReasonDialog({ code, mode, onClose }: ReasonDialogProps) {
  const reject = useRejectOrder();
  const cancel = useCancelOrder();
  const isReject = mode === 'reject';
  const options = isReject ? REJECT_REASONS : CANCEL_REASONS;

  const [selectedReason, setSelectedReason] = useState(options[0]);
  const [customReason, setCustomReason] = useState('');
  const [busy, setBusy] = useState(false);

  if (!code) return null;

  const effectiveReason = selectedReason === 'Khác (nhập tay)' ? customReason.trim() : selectedReason;
  const isValid = Boolean(effectiveReason);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || busy) return;
    setBusy(true);
    try {
      await (isReject ? reject : cancel).mutateAsync({ code, reason: effectiveReason });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={Boolean(code)}
      title={isReject ? `Từ chối đơn ${code}` : `Hủy đơn ${code}`}
      onClose={onClose}
      width={480}
      footer={
        <>
          <Button type="button" onClick={onClose} disabled={busy}>
            Đóng
          </Button>
          <Button
            type="submit"
            form="reason-form"
            variant="danger-solid"
            disabled={!isValid || busy}
            loading={busy}
          >
            {isReject ? 'Từ chối đơn' : 'Xác nhận hủy đơn'}
          </Button>
        </>
      }
    >
      <form id="reason-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!isReject && (
          <>
            <span className="small muted">
              Hủy đơn theo yêu cầu của retailer hoặc Sales (đơn chưa có phần xuất kho).
            </span>
            <Callout tone="warn">
              <strong>Tác động:</strong> Hàng tạm giữ / Reserved được trả lại quỹ tồn khả dụng; phiếu soạn hàng (nếu có) bị hủy; Sales và retailer nhận thông báo.
            </Callout>
          </>
        )}

        <label className="lbl">
          {isReject ? 'Lý do từ chối (bắt buộc)' : 'Lý do hủy (bắt buộc)'}
          <select
            className="inp"
            value={selectedReason}
            onChange={(e) => setSelectedReason(e.target.value)}
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>

        {selectedReason === 'Khác (nhập tay)' && (
          <label className="lbl">
            Lý do cụ thể *
            <textarea
              className="inp"
              style={{ height: 72 }}
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Nhập lý do cụ thể…"
              required
            />
          </label>
        )}

        <div className="lbl">
          Minh chứng đính kèm (tùy chọn)
          <label className="btn btn-sm" style={{ cursor: 'pointer', alignSelf: 'flex-start', marginTop: 4 }}>
            + Đính kèm ảnh / file
            <input type="file" multiple accept="image/*,.pdf,.doc,.docx" style={{ display: 'none' }} />
          </label>
          <span className="muted small">
            Tối đa 5 file, mỗi file ≤ 10 MB.
          </span>
        </div>
      </form>
    </Modal>
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
