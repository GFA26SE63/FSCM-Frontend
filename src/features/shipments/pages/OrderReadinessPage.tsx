import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Callout, PageHeader, QueryState, Select, Stat } from '@/shared/ui';
import { usePickingLists } from '@/features/runpicking/hooks';
import { shipmentsApi } from '../api';
import { useOrdersReadiness } from '../hooks';
import { ExportOrderCard } from '../components/ExportOrderCard';
import { EXPORT_PAGE_SIZE, exportStatus, sortExportOrders, type ExportOrderSort, type ShipmentSort } from '../exportList';
import type { ExportOrder } from '../types';

export function OrderReadinessPage() {
  const lists = usePickingLists();
  const orderIds = useMemo(() => [...new Set((lists.data ?? []).map(list => list.orderId))].sort(), [lists.data]);
  const orders = useQuery({
    queryKey: ['shipments', 'export-orders', orderIds],
    queryFn: () => shipmentsApi.exportOrders(orderIds),
    enabled: lists.isSuccess && orderIds.length > 0,
  });
  return <>
    <PageHeader title="Xuất kho"
      subtitle="Cả đơn phải soạn đủ ở mọi kho và đạt điều kiện thanh toán thì mới được xuất. Mở từng đơn để xem kho, shipment và thao tác vận hành." />
    <QueryState query={lists}>{data => data.length === 0
      ? <Callout tone="info">Chưa có PO nào phát hành phiếu soạn để kiểm tra xuất kho.</Callout>
      : <QueryState query={orders}>{items => <ExportOrders orders={items} pickingCount={data.length} />}</QueryState>}
    </QueryState>
  </>;
}

function ExportOrders({ orders, pickingCount }: { orders: ExportOrder[]; pickingCount: number }) {
  const [sort, setSort] = useState<ExportOrderSort>('newest');
  const [shipmentSort, setShipmentSort] = useState<ShipmentSort>('asc');
  const [page, setPage] = useState(1);
  const sorted = useMemo(() => sortExportOrders(orders, sort), [orders, sort]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / EXPORT_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = sorted.slice((currentPage - 1) * EXPORT_PAGE_SIZE, currentPage * EXPORT_PAGE_SIZE);
  const readiness = useOrdersReadiness(visible.map(order => order.id));
  const byId = new Map(readiness.data.map(item => [item.salesOrderId, item]));
  const countsKnown = !readiness.loading && !readiness.error;
  const count = (label: string) => readiness.data.filter(item => exportStatus(item).label === label).length;

  return <div className="stack">
    <div className="row-wrap" style={{ gap: 12 }}>
      <Stat label="Phiếu soạn" value={String(pickingCount)} />
      <Stat label="Tổng đơn" value={String(orders.length)} />
      <Stat label="Cần xử lý (trang này)" value={countsKnown ? String(count('Đang bị giữ') + count('Ngoại lệ')) : '—'} />
      <Stat label="Được xuất (trang này)" value={countsKnown ? String(count('Được xuất')) : '—'} />
      <Stat label="Đã rời kho (trang này)" value={countsKnown ? String(count('Đã rời kho')) : '—'} />
    </div>
    <div className="row-wrap" style={{ gap: 16 }}>
      <label className="lbl">Sắp xếp đơn
        <Select value={sort} onChange={event => { setSort(event.target.value as ExportOrderSort); setPage(1); }}
          options={[
            { value: 'newest', label: 'Mới nhất trước' }, { value: 'oldest', label: 'Cũ nhất trước' },
            { value: 'codeAsc', label: 'Mã đơn tăng dần' }, { value: 'codeDesc', label: 'Mã đơn giảm dần' },
          ]} />
      </label>
      <label className="lbl">Shipment trong từng đơn
        <Select value={shipmentSort} onChange={event => setShipmentSort(event.target.value as ShipmentSort)}
          options={[{ value: 'asc', label: 'Mã shipment tăng dần' }, { value: 'desc', label: 'Mã shipment giảm dần' }]} />
      </label>
      <Button onClick={() => { void readiness.refetch(); }}>Tải lại trạng thái</Button>
    </div>
    {readiness.error && <Callout tone="danger">Có đơn chưa tải được trạng thái. Chưa thể kết luận điều kiện xuất kho cho các đơn đó.</Callout>}
    {visible.map(order => <ExportOrderCard key={order.id} order={order} readiness={byId.get(order.id)}
      loading={readiness.loading && !byId.has(order.id)} failed={readiness.failedIds.includes(order.id)}
      sort={shipmentSort} retry={() => { void readiness.refetch(); }} />)}
    <nav aria-label="Phân trang xuất kho" className="row-wrap" style={{ gap: 12, justifyContent: 'flex-end' }}>
      <span>{orders.length ? (currentPage - 1) * EXPORT_PAGE_SIZE + 1 : 0}–{Math.min(currentPage * EXPORT_PAGE_SIZE, orders.length)} / {orders.length} đơn · 10 đơn/trang</span>
      <Button disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Trước</Button>
      <span>Trang {currentPage}/{totalPages}</span>
      <Button disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Sau</Button>
    </nav>
  </div>;
}
