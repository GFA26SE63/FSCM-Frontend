import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Callout, Chip, Modal, SimpleTable, type Tone } from '@/shared/ui';
import { HAS_LEFT, type ExportOrder, type OrderShipmentReadiness, type ShipmentPartStatus, type ShipmentReadinessPart } from '../types';
import { exportStatus, type ShipmentSort } from '../exportList';
import { ShipmentOperations } from './ShipmentOperations';

const PART_STATUS: Record<ShipmentPartStatus, { tone: Tone; label: string }> = {
  WaitingToPick: { tone: 'info', label: 'Chưa soạn xong' },
  Ready: { tone: 'success', label: 'Sẵn sàng' },
  Issued: { tone: 'success', label: 'Đã xuất' },
  Delivering: { tone: 'warn', label: 'Đang giao' },
  Received: { tone: 'success', label: 'Đã nhận' },
  Exception: { tone: 'danger', label: 'Ngoại lệ' },
};

export function ExportOrderCard({ order, readiness, loading, failed, sort, retry }: {
  order: ExportOrder;
  readiness?: OrderShipmentReadiness;
  loading: boolean;
  failed: boolean;
  sort: ShipmentSort;
  retry: () => void;
}) {
  const [open, setOpen] = useState(false);
  const status = readiness ? exportStatus(readiness) : {
    tone: failed ? 'danger' as const : 'info' as const,
    label: failed ? 'Chưa tải được trạng thái' : 'Đang kiểm tra',
  };
  const parts = readiness ? [...readiness.parts].sort((a, b) => {
    if (!a.shipmentCode !== !b.shipmentCode) return a.shipmentCode ? -1 : 1;
    return (sort === 'asc' ? 1 : -1) * (a.shipmentCode ?? a.warehouseCode)
      .localeCompare(b.shipmentCode ?? b.warehouseCode, 'vi', { numeric: true });
  }) : [];
  const columns = [
    { header: 'Kho', cell: (row: ShipmentReadinessPart) => <strong>{row.warehouseCode}</strong> },
    { header: 'Trạng thái', cell: (row: ShipmentReadinessPart) =>
      <Chip tone={PART_STATUS[row.status]?.tone ?? 'neutral'}>{PART_STATUS[row.status]?.label ?? row.status}</Chip> },
    { header: 'Phiếu giao', cell: (row: ShipmentReadinessPart) => row.shipmentCode ??
      <span className="muted small">chưa có — kho chưa đóng phiếu soạn</span> },
    { header: 'Ghi chú', cell: (row: ShipmentReadinessPart) => row.exceptionReason ?? '—' },
  ];

  return <section className="card export-order">
    <button type="button" className="export-order-toggle" aria-haspopup="dialog"
      aria-label={`Xem chi tiết xuất kho ${order.orderCode}`} onClick={() => setOpen(true)}>
      <strong className="spacer">{order.orderCode}</strong>
      <Chip tone={status.tone}>{status.label}</Chip>
      <ChevronRight size={20} aria-hidden />
    </button>
    {open && <Modal open width={1100} title={`Chi tiết xuất kho · ${order.orderCode}`} onClose={() => setOpen(false)}>
      <div><Chip tone={status.tone}>{status.label}</Chip></div>
      {failed && <Callout tone="danger">Không tải được trạng thái đơn. <button type="button" onClick={retry}>Thử lại</button></Callout>}
      {loading && <p className="muted">Đang kiểm tra điều kiện xuất kho…</p>}
      {readiness && <>
        {readiness.blockingReasons.length > 0 && <Callout tone={readiness.hasException ? 'danger' : 'warn'}>
          <ul>{readiness.blockingReasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
        </Callout>}
        {!readiness.paymentSettled && <Callout tone="warn">
          Đơn trả trước chưa thanh toán đủ. Đơn công nợ hợp lệ không bị chặn ở cửa kho.
        </Callout>}
        <SimpleTable columns={columns} rows={parts} empty="Đơn này chưa có phần hàng theo kho nào." />
        <ShipmentOperations orderId={order.id} sort={sort} />
        <p className="muted small">
          {readiness.parts.some(part => HAS_LEFT.includes(part.status))
            ? 'Đã có phần hàng rời kho, nên không còn hủy được — phát sinh phải đi theo luồng khiếu nại.'
            : 'Chưa có phần nào rời kho, nên vẫn hủy được theo quyền; thao tác hủy kèm tác động tới tồn giữ và tiền đã thu nằm ở màn Hủy đơn.'}
        </p>
      </>}
    </Modal>}
  </section>;
}
