import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Callout, Chip, Input, PageHeader, QueryState, Select, SimpleTable, Stat } from '@/shared/ui';
import { Pagination } from '@/shared/pagination';
import { usePickingLists } from '@/features/runpicking/hooks';
import { shipmentsApi } from '../api';
import { useOrdersReadiness } from '../hooks';
import { ExportOrderDetailModal, PART_STATUS } from '../components/ExportOrderCard';
import { exportStatus, sortExportOrders, type ExportOrderSort, type ShipmentSort } from '../exportList';
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
    <PageHeader title="Điều phối giao hàng"
      subtitle="Theo dõi mức sẵn sàng xuất hàng, điều phối xe và tài xế cho các đơn bán hàng đã được soạn tại kho." />
    <QueryState query={lists}>{data => data.length === 0
      ? <Callout tone="info">Chưa có đơn thực hiện nào phát hành phiếu soạn để kiểm tra xuất kho.</Callout>
      : <QueryState query={orders}>{items => <ExportOrders orders={items} pickingCount={data.length} />}</QueryState>}
    </QueryState>
  </>;
}

function ExportOrders({ orders, pickingCount }: { orders: ExportOrder[]; pickingCount: number }) {
  const [sort, setSort] = useState<ExportOrderSort>('newest');
  const [shipmentSort, setShipmentSort] = useState<ShipmentSort>('asc');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'held' | 'ready' | 'left'>('all');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const sorted = useMemo(() => sortExportOrders(orders, sort), [orders, sort]);
  const readiness = useOrdersReadiness(orders.map(order => order.id));
  const byId = new Map(readiness.data.map(item => [item.salesOrderId, item]));
  const warehouses = [...new Set(readiness.data.flatMap(item => item.parts.map(part => part.warehouseCode)))].sort((a, b) => a.localeCompare(b, 'vi'));
  const term = search.trim().toLocaleLowerCase('vi');
  const matchesStatus = (order: ExportOrder) => {
    const current = byId.get(order.id);
    if (!current || statusFilter === 'all') return true;
    const status = exportStatus(current).label;
    return statusFilter === 'held' ? ['Đang bị giữ', 'Ngoại lệ'].includes(status)
      : statusFilter === 'ready' ? status === 'Được xuất'
        : status === 'Đã rời kho';
  };
  const filtered = sorted.filter(order => {
    const current = byId.get(order.id);
    const values = [order.orderCode, ...(current?.parts.flatMap(part => [part.warehouseCode, part.shipmentCode ?? '']) ?? [])];
    return (!term || values.join(' ').toLocaleLowerCase('vi').includes(term))
      && (!warehouseFilter || current?.parts.some(part => part.warehouseCode === warehouseFilter))
      && matchesStatus(order);
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const countsKnown = !readiness.loading && !readiness.error;
  const count = (label: string) => readiness.data.filter(item => exportStatus(item).label === label).length;
  const partsOf = (order: ExportOrder) => [...(byId.get(order.id)?.parts ?? [])].sort((a, b) => {
    if (!a.shipmentCode !== !b.shipmentCode) return a.shipmentCode ? -1 : 1;
    return (shipmentSort === 'asc' ? 1 : -1) * (a.shipmentCode ?? a.warehouseCode).localeCompare(b.shipmentCode ?? b.warehouseCode, 'vi', { numeric: true });
  });
  const selectedOrder = selectedOrderId ? orders.find(order => order.id === selectedOrderId) : undefined;

  return <div className="stack">
    <div className="stats-grid delivery-summary-grid">
      <Stat label="Tổng đơn điều phối" value={String(orders.length)} />
      <Stat label="Phiếu soạn" value={String(pickingCount)} />
      <Stat label="Cần xử lý" value={countsKnown ? String(count('Đang bị giữ') + count('Ngoại lệ')) : '—'} />
      <Stat label="Sẵn sàng xuất" value={countsKnown ? String(count('Được xuất')) : '—'} />
      <Stat label="Đã rời kho" value={countsKnown ? String(count('Đã rời kho')) : '—'} />
    </div>
    <section className="card filter-card delivery-filter-card" aria-label="Bộ lọc nâng cao điều phối giao hàng">
      <div className="row"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14655B" strokeWidth="2" aria-hidden><path d="M3 5h18l-7 8v6l-4 2v-8z" /></svg><h2 className="sec">Bộ lọc nâng cao</h2></div>
      <div className="filter-grid">
        <label className="lbl">Tìm kiếm
          <Input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Mã đơn, kho hoặc phiếu giao hàng" />
        </label>
        <label className="lbl">Trạng thái điều phối
          <Select value={statusFilter} onChange={event => { setStatusFilter(event.target.value as typeof statusFilter); setPage(1); }} options={[
            { value: 'all', label: 'Tất cả trạng thái' }, { value: 'held', label: 'Cần xử lý' },
            { value: 'ready', label: 'Sẵn sàng xuất' }, { value: 'left', label: 'Đã rời kho' },
          ]} />
        </label>
        <label className="lbl">Kho
          <Select value={warehouseFilter} onChange={event => { setWarehouseFilter(event.target.value); setPage(1); }} options={[
            { value: '', label: 'Tất cả kho' }, ...warehouses.map(warehouse => ({ value: warehouse, label: warehouse })),
          ]} />
        </label>
        <label className="lbl">Sắp xếp đơn
          <Select value={sort} onChange={event => { setSort(event.target.value as ExportOrderSort); setPage(1); }}
          options={[
            { value: 'newest', label: 'Mới nhất trước' }, { value: 'oldest', label: 'Cũ nhất trước' },
            { value: 'codeAsc', label: 'Mã đơn tăng dần' }, { value: 'codeDesc', label: 'Mã đơn giảm dần' },
          ]} />
        </label>
        <label className="lbl">Sắp xếp phiếu giao
          <Select value={shipmentSort} onChange={event => setShipmentSort(event.target.value as ShipmentSort)}
          options={[{ value: 'asc', label: 'Mã phiếu giao hàng tăng dần' }, { value: 'desc', label: 'Mã phiếu giao hàng giảm dần' }]} />
        </label>
        <div className="delivery-filter-action"><Button loading={readiness.loading} onClick={() => { void readiness.refetch(); }}>Tải lại trạng thái</Button></div>
      </div>
    </section>
    {readiness.error && <Callout tone="danger">Có đơn chưa tải được trạng thái. Chưa thể kết luận điều kiện xuất kho cho các đơn đó.</Callout>}
    <SimpleTable paginate={false} rows={visible} onRowClick={order => setSelectedOrderId(order.id)} empty="Không có đơn phù hợp với bộ lọc." columns={[
      { header: 'Mã đơn', width: '150px', cell: order => <b>{order.orderCode}</b> },
      { header: 'Kho xuất', width: '170px', cell: order => {
        const parts = partsOf(order);
        return <div className="delivery-table-stack">{parts.length ? parts.map(part => <span className="delivery-warehouse-code" key={part.warehouseId}>{part.warehouseCode}</span>) : <span className="muted">—</span>}</div>;
      } },
      { header: 'Trạng thái tại kho', width: '200px', cell: order => {
        const parts = partsOf(order);
        return <div className="delivery-table-stack delivery-warehouse-status">{parts.length ? parts.map(part => <Chip key={part.warehouseId} tone={PART_STATUS[part.status]?.tone ?? 'neutral'}>{PART_STATUS[part.status]?.label ?? part.status}</Chip>) : <span className="muted">Đang tải</span>}</div>;
      } },
      { header: 'Phiếu giao hàng', width: '180px', cell: order => {
        const parts = partsOf(order);
        return <div className="delivery-table-stack">{parts.length ? parts.map(part => <span className="delivery-shipment-code" key={part.warehouseId}>{part.shipmentCode ?? <span className="muted">Chưa có phiếu</span>}</span>) : <span className="muted">—</span>}</div>;
      } },
      { header: 'Trạng thái điều phối', width: '170px', cell: order => {
        const current = byId.get(order.id);
        const status = current ? exportStatus(current) : { tone: readiness.failedIds.includes(order.id) ? 'danger' as const : 'info' as const, label: readiness.failedIds.includes(order.id) ? 'Chưa tải được trạng thái' : 'Đang kiểm tra' };
        return <Chip tone={status.tone}>{status.label}</Chip>;
      } },
    ]} />
    {selectedOrder && <ExportOrderDetailModal order={selectedOrder} readiness={byId.get(selectedOrder.id)}
      loading={readiness.loading && !byId.has(selectedOrder.id)} failed={readiness.failedIds.includes(selectedOrder.id)}
      sort={shipmentSort} retry={() => { void readiness.refetch(); }} open onClose={() => setSelectedOrderId(null)} />}
    {/* Common Pagination Foundation — client-side (server-side is a BACKEND DEPENDENCY:
        GET /api/v1/picking-lists does not support page/pageSize params). */}
    <Pagination
      currentPage={currentPage}
      totalPages={totalPages}
      totalCount={filtered.length}
      pageSize={pageSize}
      pageSizeOptions={[10, 20, 50]}
      hasPrev={currentPage > 1}
      hasNext={currentPage < totalPages}
      onPage={setPage}
      onPrev={() => setPage(currentPage - 1)}
      onNext={() => setPage(currentPage + 1)}
      onPageSizeChange={size => { setPageSize(size); setPage(1); }}
    />
  </div>;
}
