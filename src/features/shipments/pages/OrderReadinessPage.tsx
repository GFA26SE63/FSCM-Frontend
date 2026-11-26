import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Callout, Chip, Input, PageHeader, QueryState, Select, SimpleTable, Stat, Tabs } from '@/shared/ui';
import { Pagination } from '@/shared/pagination';
import { graphql } from '@/shared/api/graphql';
import { formatInstantDateTime } from '@/shared/lib/dates';
import { useEnumParam } from '@/shared/router/listState';
import { usePickingLists } from '@/features/runpicking/hooks';
import { useRegions, useWarehouses } from '@/features/warehouses/hooks';
import { shipmentsApi } from '../api';
import { useOrdersReadiness } from '../hooks';
import { ExportOrderDetailModal, PART_STATUS } from '../components/ExportOrderCard';
import { exportStatus, sortExportOrders, type ExportOrderSort } from '../exportList';
import { HAS_LEFT, type ExportOrder } from '../types';

export function OrderReadinessPage() {
  const [transport, setTransport] = useEnumParam('transport', ['delivery', 'transfer'] as const, 'delivery', { resets: ['transportTab'] });
  const [tab, setTab] = useEnumParam('transportTab', ['requests', 'history'] as const, 'requests');
  const operation = transport === 'delivery' ? 'giao hàng' : 'luân chuyển';
  return <>
    <PageHeader title="Điều phối vận tải"
      subtitle="Điều phối xe và tài xế cho đơn giao hàng và các lệnh luân chuyển giữa kho." />
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
      <Tabs items={[{ key: 'delivery', label: 'Điều phối giao hàng' }, { key: 'transfer', label: 'Điều phối luân chuyển' }]}
        value={transport} onChange={setTransport} />
      <Tabs variant="pills" items={[
        { key: 'requests', label: `Yêu cầu Điều phối ${operation}` },
        { key: 'history', label: `Lịch sử Điều phối ${operation}` },
      ]} value={tab} onChange={setTab} />
    </div>
    {transport === 'delivery' ? <DeliveryDispatchPanel tab={tab} /> : <TransferDispatchPanel tab={tab} />}
  </>;
}

function DeliveryDispatchPanel({ tab }: { tab: 'requests' | 'history' }) {
  const lists = usePickingLists();
  const orderIds = useMemo(() => [...new Set((lists.data ?? []).map(list => list.orderId))].sort(), [lists.data]);
  const orders = useQuery({
    queryKey: ['shipments', 'export-orders', orderIds],
    queryFn: () => shipmentsApi.exportOrders(orderIds),
    enabled: lists.isSuccess && orderIds.length > 0,
  });
  return <>
    <QueryState query={lists}>{data => data.length === 0
      ? <Callout tone="info">Chưa có đơn thực hiện nào phát hành phiếu soạn để kiểm tra xuất kho.</Callout>
      : <QueryState query={orders}>{items => <ExportOrders orders={items} pickingCount={data.length} tab={tab} />}</QueryState>}
    </QueryState>
  </>;
}

function ExportOrders({ orders, pickingCount, tab }: { orders: ExportOrder[]; pickingCount: number; tab: 'requests' | 'history' }) {
  const [sort, setSort] = useState<ExportOrderSort>('newest');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'held' | 'ready' | 'left'>('all');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const { data: warehouseList = [] } = useWarehouses();
  const { data: regionList = [] } = useRegions();
  // Region names come from the Regions API; the ID is only the filter value.
  const regionNameById = new Map(regionList.map(r => [r.id, r.name]));
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const sorted = useMemo(() => sortExportOrders(orders, sort), [orders, sort]);
  const readiness = useOrdersReadiness(orders.map(order => order.id));
  const byId = new Map(readiness.data.map(item => [item.salesOrderId, item]));
  // Region of a part = region of its supplying warehouse (from the warehouse list; no order-level region exists).
  const regionOfCode = new Map(warehouseList.map(w => [w.code, { id: w.regionId ?? '', name: w.regionName ?? '' }]));
  const usedCodes = [...new Set(readiness.data.flatMap(item => item.parts.map(part => part.warehouseCode)))];
  const regions = [...new Map(usedCodes.flatMap(code => { const r = regionOfCode.get(code); return r?.id ? [[r.id, regionNameById.get(r.id) || r.name || 'Khu vực (chưa rõ tên)'] as const] : []; })).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'vi'));
  const warehouses = usedCodes.filter(code => !regionFilter || regionOfCode.get(code)?.id === regionFilter).sort((a, b) => a.localeCompare(b, 'vi'));
  const hasFilters = !!(sort !== 'newest' || search || warehouseFilter || regionFilter || statusFilter !== 'all');
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
      && (!regionFilter || current?.parts.some(part => regionOfCode.get(part.warehouseCode)?.id === regionFilter))
      && matchesStatus(order)
      // A request stays in the active queue until a warehouse part has left.
      // The server remains authoritative for all part statuses.
      && (!current || (tab === 'history'
        ? current.parts.some(part => HAS_LEFT.includes(part.status))
        : !current.parts.some(part => HAS_LEFT.includes(part.status))));
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const countsKnown = !readiness.loading && !readiness.error;
  const count = (label: string) => readiness.data.filter(item => exportStatus(item).label === label).length;
  const partsOf = (order: ExportOrder) => [...(byId.get(order.id)?.parts ?? [])].sort((a, b) => {
    if (!a.shipmentCode !== !b.shipmentCode) return a.shipmentCode ? -1 : 1;
    return (a.shipmentCode ?? a.warehouseCode).localeCompare(b.shipmentCode ?? b.warehouseCode, 'vi', { numeric: true });
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
        <label className="lbl">Khu vực
          <Select value={regionFilter} onChange={event => { setRegionFilter(event.target.value); setWarehouseFilter(''); setPage(1); }} options={[
            { value: '', label: 'Tất cả khu vực' }, ...regions.map(([id, name]) => ({ value: id, label: name })),
          ]} />
        </label>
        <label className="lbl">Kho
          <Select value={warehouseFilter} onChange={event => { setWarehouseFilter(event.target.value); setPage(1); }} options={[
            { value: '', label: 'Tất cả kho' }, ...warehouses.map(warehouse => ({ value: warehouse, label: warehouse })),
          ]} />
        </label>
        <label className="lbl">Sắp xếp
          <Select value={sort} onChange={event => { setSort(event.target.value as ExportOrderSort); setPage(1); }}
          options={[{ value: 'newest', label: 'Mới nhất' }, { value: 'oldest', label: 'Cũ nhất' }]} />
        </label>
        <div className="delivery-filter-action">{hasFilters && <Button onClick={() => { setSearch(''); setStatusFilter('all'); setRegionFilter(''); setWarehouseFilter(''); setSort('newest'); setPage(1); }}>Xóa lọc</Button>}<Button loading={readiness.loading} onClick={() => { void readiness.refetch(); }}>Tải lại trạng thái</Button></div>
      </div>
    </section>
    {readiness.error && <Callout tone="danger">Có đơn chưa tải được trạng thái. Chưa thể kết luận điều kiện xuất kho cho các đơn đó.</Callout>}
    <SimpleTable paginate={false} rows={visible} onRowClick={order => setSelectedOrderId(order.id)} empty={tab === 'history' ? 'Chưa có điều phối giao hàng trong lịch sử.' : 'Không có yêu cầu điều phối giao hàng phù hợp với bộ lọc.'} columns={[
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
      sort="asc" retry={() => { void readiness.refetch(); }} open onClose={() => setSelectedOrderId(null)} />}
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

interface TransferDispatchRow {
  id: string;
  transferCode: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  status: string;
  requestedAt: string;
  assignedAt: string | null;
  dispatchedAt: string | null;
  receivedAt: string | null;
  driverNameSnapshot: string | null;
  plateNumberSnapshot: string | null;
}

async function loadTransferDispatches(): Promise<TransferDispatchRow[]> {
  const data = await graphql<{ entities: { warehouseTransfers: { nodes: TransferDispatchRow[] | null } } }>(`
    query TransportDispatchTransfers {
      entities {
        warehouseTransfers(first: 500, order: [{ requestedAt: DESC }, { id: DESC }]) {
          nodes {
            id transferCode sourceWarehouseId destinationWarehouseId status requestedAt
            assignedAt dispatchedAt receivedAt driverNameSnapshot plateNumberSnapshot
          }
        }
      }
    }
  `);
  const rows = data.entities?.warehouseTransfers?.nodes;
  if (!Array.isArray(rows)) throw new Error('Không tải được yêu cầu điều phối luân chuyển.');
  return rows;
}

function transferStatusLabel(status: string) {
  return ({ Requested: 'Chờ duyệt', Approved: 'Chờ điều phối', InTransit: 'Đang luân chuyển', Received: 'Đã nhận', Rejected: 'Từ chối' } as Record<string, string>)[status] ?? status;
}

function TransferDispatchPanel({ tab }: { tab: 'requests' | 'history' }) {
  const transfers = useQuery({ queryKey: ['transport-dispatch', 'transfers'], queryFn: loadTransferDispatches });
  return <QueryState query={transfers}>{rows => {
    const visible = rows.filter(row => tab === 'history' ? ['Received', 'Rejected'].includes(row.status) : !['Received', 'Rejected'].includes(row.status));
    return <SimpleTable paginate rows={visible} empty={tab === 'history' ? 'Chưa có điều phối luân chuyển trong lịch sử.' : 'Không có yêu cầu điều phối luân chuyển.'} columns={[
      { header: 'Mã lệnh', width: '180px', cell: row => <b>{row.transferCode}</b> },
      { header: 'Thời điểm yêu cầu', width: '190px', cell: row => formatInstantDateTime(row.requestedAt) },
      { header: 'Tài xế / phương tiện', cell: row => row.driverNameSnapshot || row.plateNumberSnapshot ? `${row.driverNameSnapshot ?? 'Chưa phân công'} · ${row.plateNumberSnapshot ?? 'Chưa phân xe'}` : <span className="muted">Chưa phân công</span> },
      { header: 'Trạng thái điều phối', width: '180px', cell: row => <Chip tone={row.status === 'Rejected' ? 'danger' : row.status === 'Received' ? 'success' : row.status === 'InTransit' ? 'info' : 'warn'}>{transferStatusLabel(row.status)}</Chip> },
      { header: tab === 'history' ? 'Hoàn tất lúc' : 'Điều phối lúc', width: '190px', cell: row => formatInstantDateTime(tab === 'history' ? row.receivedAt : row.assignedAt) },
    ]} />;
  }}</QueryState>;
}
