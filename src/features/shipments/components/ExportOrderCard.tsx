import { useQuery } from '@tanstack/react-query';
import { graphql } from '@/shared/api/graphql';
import { Callout, Chip, Modal, SimpleTable, type Tone } from '@/shared/ui';
import { HAS_LEFT, type ExportOrder, type OrderShipmentReadiness, type ShipmentPartStatus } from '../types';
import { exportStatus, type ShipmentSort } from '../exportList';
import { ShipmentOperations } from './ShipmentOperations';
import { OrderCartonTable, useOrderCartons } from '@/features/orders/components/OrderCartons';

export const PART_STATUS: Record<ShipmentPartStatus, { tone: Tone; label: string }> = {
  WaitingToPick: { tone: 'info', label: 'Chưa soạn xong' },
  Ready: { tone: 'success', label: 'Sẵn sàng' },
  Issued: { tone: 'warn', label: 'Chờ điều phối' },
  Delivering: { tone: 'warn', label: 'Đang giao hàng' },
  Received: { tone: 'success', label: 'Đã nhận' },
  Exception: { tone: 'danger', label: 'Ngoại lệ' },
};

export function ExportOrderDetailModal({ order, pickingReads = [], readiness, loading, failed, sort, retry, open, onClose }: {
  order: ExportOrder;
  pickingReads?: { warehouseId: string; items: { sku: string; productName: string; requestedQuantity: number }[] }[];
  readiness?: OrderShipmentReadiness;
  loading: boolean;
  failed: boolean;
  sort: ShipmentSort;
  retry: () => void;
  open: boolean;
  onClose: () => void;
}) {
  const cartons = useOrderCartons(order.id, open);
  const goods = useQuery({
    queryKey: ['dispatch-warehouse-goods', order.id], enabled: open,
    queryFn: async () => {
      async function pages<T>(field: string, selection: string, where: string): Promise<T[]> {
        const rows: T[] = []; let after: string | null = null;
        const seen = new Set<string>();
        for (;;) {
          const result: { entities: Record<string, { nodes: T[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }> } = await graphql(`query DispatchGoods($after: String) { entities { ${field}(first: 100, after: $after, where: ${where}, order: [{ id: ASC }]) { nodes { ${selection} } pageInfo { hasNextPage endCursor } } } }`, { after });
          const page = result.entities[field];
          if (!Array.isArray(page?.nodes) || !page.pageInfo) throw new Error('Không tải được hàng hóa theo kho.');
          rows.push(...page.nodes);
          if (!page.pageInfo.hasNextPage) return rows;
          const next = page.pageInfo.endCursor;
          if (!next || seen.has(next)) throw new Error('Phân trang hàng hóa không hợp lệ.');
          seen.add(next); after = next;
        }
      }
      const lines = await pages<{ id: string; skuSnapshot: string; productNameSnapshot: string }>('salesOrderLines', 'id skuSnapshot productNameSnapshot', `{ salesOrderId: { eq: ${JSON.stringify(order.id)} } }`);
      if (!lines.length) return [];
      const allocations = await pages<{ salesOrderLineId: string; warehouseId: string; allocatedQuantity: number }>('allocations', 'id salesOrderLineId warehouseId allocatedQuantity', `{ salesOrderLineId: { in: ${JSON.stringify(lines.map(line => line.id))} } }`);
      return allocations.map(allocation => {
        const line = lines.find(item => item.id === allocation.salesOrderLineId)!;
        return { warehouseId: allocation.warehouseId, sku: line.skuSnapshot, productName: line.productNameSnapshot, requestedQuantity: allocation.allocatedQuantity };
      });
    },
  });
  const warehouseGoods = (warehouseId: string) => {
    const items = goods.data?.filter(item => item.warehouseId === warehouseId) ?? pickingReads.filter(read => read.warehouseId === warehouseId).flatMap(read => read.items);
    const grouped = new Map<string, { sku: string; productName: string; quantity: number }>();
    for (const item of items) {
      const current = grouped.get(item.sku);
      if (current) current.quantity += item.requestedQuantity;
      else grouped.set(item.sku, { sku: item.sku, productName: item.productName, quantity: item.requestedQuantity });
    }
    return <>{goods.isLoading && <p>Đang tải hàng hóa…</p>}{goods.isError && <Callout tone="danger">Không tải được hàng hóa. <button onClick={() => void goods.refetch()}>Thử lại</button></Callout>}<SimpleTable paginate={false} rows={[...grouped.values()]} empty="Chưa có hàng hóa phân bổ cho kho này." columns={[
      { header: 'Mã SKU', cell: item => item.sku },
      { header: 'Tên hàng', cell: item => item.productName },
      { header: 'Số lượng (thùng)', cell: item => item.quantity.toLocaleString('vi-VN') },
      { header: 'Danh sách thùng', cell: item => <details>
        <summary style={{ cursor: 'pointer' }}>Xem danh sách thùng</summary>
        {cartons.isPending ? <p role="status">Đang tải danh sách thùng…</p>
          : cartons.isError ? <Callout tone="danger">Không tải được danh sách thùng. <button type="button" onClick={() => void cartons.refetch()}>Thử lại</button></Callout>
            : <OrderCartonTable cartons={cartons.data.filter(carton => carton.warehouseId === warehouseId && carton.sku === item.sku)} />}
      </details> },
    ]} /></>;
  };
  const status = readiness ? exportStatus(readiness) : {
    tone: failed ? 'danger' as const : 'info' as const,
    label: failed ? 'Chưa tải được trạng thái' : 'Đang kiểm tra',
  };
  const parts = readiness ? [...readiness.parts].sort((a, b) => {
    if (!a.shipmentCode !== !b.shipmentCode) return a.shipmentCode ? -1 : 1;
    return (sort === 'asc' ? 1 : -1) * (a.shipmentCode ?? a.warehouseCode)
      .localeCompare(b.shipmentCode ?? b.warehouseCode, 'vi', { numeric: true });
  }) : [];


  return <Modal open={open} width={1100} title={`Chi tiết điều phối · ${order.orderCode}`} onClose={onClose}>
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
        <div className="dispatch-warehouse-list">
          {parts.length === 0 && <p className="muted">Đơn này chưa có phần hàng theo kho nào.</p>}
          {parts.map(part => <section className="dispatch-warehouse-card" key={part.warehouseId}>
            <header className="dispatch-warehouse-header">
              <div className="dispatch-warehouse-identity"><span className="dispatch-warehouse-caption">Kho xuất</span><strong>{part.warehouseCode}</strong></div>
              <Chip tone={PART_STATUS[part.status]?.tone ?? 'neutral'}>{PART_STATUS[part.status]?.label ?? part.status}</Chip>
              <div className="dispatch-warehouse-shipment"><span className="dispatch-warehouse-caption">Phiếu giao hàng</span>{part.shipmentCode ? <strong>{part.shipmentCode}</strong> : <span className="muted small">chưa có — kho chưa đóng phiếu soạn</span>}</div>
            </header>
            <div className="dispatch-warehouse-items">{warehouseGoods(part.warehouseId)}</div>
            <div className="dispatch-warehouse-transport"><h4>Xe và tài xế</h4><ShipmentOperations orderId={order.id} sort={sort} warehouseId={part.warehouseId} /></div>
            {part.exceptionReason && <div className="dispatch-warehouse-note"><b>Ghi chú:</b> {part.exceptionReason}</div>}
          </section>)}
        </div>
        <p className="muted small">
          {readiness.parts.some(part => HAS_LEFT.includes(part.status))
            ? 'Đã có phần hàng rời kho, nên không còn hủy được — phát sinh phải đi theo luồng khiếu nại.'
            : 'Chưa có phần nào rời kho, nên vẫn hủy được theo quyền; thao tác hủy kèm tác động tới tồn giữ và tiền đã thu nằm ở màn Hủy đơn.'}
        </p>
      </>}
    </Modal>;
}
