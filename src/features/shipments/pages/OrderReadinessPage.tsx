import { hasOperation } from '@/shared/auth/permissions';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Callout, Card, Chip, ConfirmDialog, DataTable, Input, Modal, PageHeader, QueryState, Select, SimpleTable, Stat, Tabs } from '@/shared/ui';
import { Pagination } from '@/shared/pagination';
import { graphql } from '@/shared/api/graphql';
import { errorMessage } from '@/shared/api/errors';
import { formatInstantDateTime } from '@/shared/lib/dates';
import { useEnumParam } from '@/shared/router/listState';
import { useRegions, useWarehouses } from '@/features/warehouses/hooks';
import { shipmentsApi } from '../api';
import { useOrdersReadiness } from '../hooks';
import { ExportOrderDetailModal, PART_STATUS } from '../components/ExportOrderCard';
import { exportStatus, isDispatchInTab, sortExportOrders, type ExportOrderSort } from '../exportList';
import { type ExportOrder } from '../types';
import { useAuth } from '@/shared/auth/AuthContext';

export function OrderReadinessPage() {
  const { user } = useAuth();
  const keeper = user?.role === 'WarehouseKeeper' || !hasOperation(user, 'api:InternalTransfers.List');
  const [transport, setTransport] = useEnumParam('transport', ['delivery', 'transfer'] as const, 'delivery', { resets: ['transportTab'] });
  const [tab, setTab] = useEnumParam('transportTab', ['requests', 'history'] as const, 'requests');
  const operation = keeper || transport === 'delivery' ? 'giao hàng' : 'luân chuyển';
  return <>
    <PageHeader title="Điều phối vận tải"
      subtitle={keeper ? 'Bắt đầu giao các chuyến đã được gán xe và tài xế tại kho được phân công.' : 'Điều phối xe và tài xế cho đơn giao hàng và các lệnh luân chuyển giữa kho.'} />
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
      {!keeper && <Tabs items={[{ key: 'delivery', label: 'Điều phối giao hàng' }, { key: 'transfer', label: 'Điều phối luân chuyển' }]}
        value={transport} onChange={setTransport} />
      }
      <Tabs variant="pills" items={[
        { key: 'requests', label: `Yêu cầu Điều phối ${operation}` },
        { key: 'history', label: `Lịch sử Điều phối ${operation}` },
      ]} value={tab} onChange={setTab} />
    </div>
    {keeper || transport === 'delivery' ? <DeliveryDispatchPanel tab={tab} /> : <TransferDispatchPanel tab={tab} />}
  </>;
}

interface DispatchPickingRead {
  id: string; orderId: string; warehouseId: string;
  items: { sku: string; productName: string; requestedQuantity: number }[];
}

function DeliveryDispatchPanel({ tab }: { tab: 'requests' | 'history' }) {
  const lists = useQuery({
    queryKey: ['shipments', 'delivery-picking-orders'],
    queryFn: async () => {
      const data = await graphql<{ entities: { deliveryPickingReads: DispatchPickingRead[] } }>(`
        query DeliveryPickingOrders { entities { deliveryPickingReads { id orderId warehouseId items { sku productName requestedQuantity } } } }
      `);
      return data.entities.deliveryPickingReads;
    },
  });
  const orderIds = useMemo(() => [...new Set((lists.data ?? []).map(list => list.orderId))].sort(), [lists.data]);
  const orders = useQuery({
    queryKey: ['shipments', 'export-orders', orderIds],
    queryFn: () => shipmentsApi.exportOrders(orderIds),
    enabled: lists.isSuccess && orderIds.length > 0,
  });
  return <>
    <QueryState query={lists}>{data => data.length === 0
      ? <Callout tone="info">Chưa có đơn thực hiện nào phát hành phiếu soạn để kiểm tra xuất kho.</Callout>
      : <QueryState query={orders}>{items => <ExportOrders orders={items} pickingCount={data.length} pickingReads={data} tab={tab} />}</QueryState>}
    </QueryState>
  </>;
}

function ExportOrders({ orders, pickingCount, pickingReads, tab }: { orders: ExportOrder[]; pickingCount: number; pickingReads: DispatchPickingRead[]; tab: 'requests' | 'history' }) {
  const { user } = useAuth();
  const [sort, setSort] = useState<ExportOrderSort>('newest');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'held' | 'ready' | 'left'>('all');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const { data: warehouseList = [] } = useWarehouses();
  const { data: regionList = [] } = useRegions(true, hasOperation(user, 'api:Regions.List'));
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
        : ['Chờ vận tải', 'Đang giao hàng', 'Đã giao'].includes(status);
  };
  const filtered = sorted.filter(order => {
    const current = byId.get(order.id);
    const values = [order.orderCode, ...(current?.parts.flatMap(part => [part.warehouseCode, part.shipmentCode ?? '']) ?? [])];
    return (!term || values.join(' ').toLocaleLowerCase('vi').includes(term))
      && (!warehouseFilter || current?.parts.some(part => part.warehouseCode === warehouseFilter))
      && (!regionFilter || current?.parts.some(part => regionOfCode.get(part.warehouseCode)?.id === regionFilter))
      && matchesStatus(order)
      // The server closes a dispatch only after all expected warehouse trips are received.
      && isDispatchInTab(current, tab);
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
      <Stat label="Đang giao hàng" value={countsKnown ? String(count('Đang giao hàng')) : '—'} />
      <Stat label="Đã giao" value={countsKnown ? String(count('Đã giao')) : '—'} />
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
            { value: 'ready', label: 'Sẵn sàng xuất' }, { value: 'left', label: 'Vận tải / đã giao' },
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
    <Card><SimpleTable paginate={false} rows={visible} onRowClick={order => setSelectedOrderId(order.id)} empty={tab === 'history' ? 'Chưa có điều phối giao hàng trong lịch sử.' : 'Không có yêu cầu điều phối giao hàng phù hợp với bộ lọc.'} columns={[
      { header: 'Mã đơn', width: '150px', cell: order => <b>{order.orderCode}</b> },
      { header: 'Kho xuất', width: '170px', cell: order => {
        const parts = partsOf(order);
        return <div className="delivery-table-stack">{parts.length ? parts.map(part => <span className="delivery-warehouse-code" key={part.warehouseId}>{part.warehouseCode}</span>) : <span className="muted">—</span>}</div>;
      } },
      { header: 'Phiếu giao hàng', width: '180px', cell: order => {
        const parts = partsOf(order);
        return <div className="delivery-table-stack">{parts.length ? parts.map(part => <span className="delivery-shipment-code" key={part.warehouseId}>{part.shipmentCode ?? <span className="muted">Chưa có phiếu</span>}</span>) : <span className="muted">—</span>}</div>;
      } },
      { header: 'Trạng thái điều phối', width: '170px', cell: order => {
        const parts = partsOf(order);
        return <div className="delivery-table-stack">{parts.length ? parts.map(part => <Chip key={part.warehouseId} tone={PART_STATUS[part.status]?.tone ?? 'neutral'}>{PART_STATUS[part.status]?.label ?? part.status}</Chip>) : <span className="muted">{readiness.failedIds.includes(order.id) ? 'Chưa tải được trạng thái' : 'Đang kiểm tra'}</span>}</div>;
      } },
      { header: 'Thời gian điều phối', width: '190px', cell: order => {
        const parts = partsOf(order);
        return <div className="delivery-table-stack">{parts.length ? parts.map(part => <span key={part.warehouseId}>{order.assignmentTimes?.[part.shipmentId ?? ''] ? formatInstantDateTime(order.assignmentTimes[part.shipmentId!]) : <span className="muted">Chưa điều phối</span>}</span>) : <span className="muted">—</span>}</div>;
      } },
    ]} />
    </Card>
    {selectedOrder && <ExportOrderDetailModal order={selectedOrder} pickingReads={pickingReads.filter(read => read.orderId === selectedOrder.id)} readiness={byId.get(selectedOrder.id)}
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
  version: number;
  requestedAt: string;
  assignedAt: string | null;
  dispatchedAt: string | null;
  receivedAt: string | null;
  driverNameSnapshot: string | null;
  plateNumberSnapshot: string | null;
}

async function loadTransferDispatches(): Promise<TransferDispatchRow[]> {
  const rows: TransferDispatchRow[] = [];
  let after: string | null = null;
  const cursors = new Set<string>();
  for (;;) {
    const data: { entities: { warehouseTransfers: { nodes: TransferDispatchRow[] | null; pageInfo: { hasNextPage: boolean; endCursor: string | null } } } } = await graphql(`
      query TransportDispatchTransfers($after: String) {
        entities {
          warehouseTransfers(first: 100, after: $after, order: [{ requestedAt: DESC }, { id: DESC }]) {
            nodes {
              id transferCode sourceWarehouseId destinationWarehouseId status version requestedAt
              assignedAt dispatchedAt receivedAt driverNameSnapshot plateNumberSnapshot
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    `, { after });
    const page = data.entities?.warehouseTransfers;
    if (!Array.isArray(page?.nodes) || !page.pageInfo) throw new Error('Không tải được yêu cầu điều phối luân chuyển.');
    rows.push(...page.nodes);
    if (!page.pageInfo.hasNextPage) return rows;
    const next = page.pageInfo.endCursor;
    if (!next || cursors.has(next)) throw new Error('Phân trang điều phối luân chuyển không hợp lệ.');
    cursors.add(next);
    after = next;
  }
}

function transferStatusLabel(status: string) {
  return ({ Requested: 'Chờ duyệt', Approved: 'Chờ điều phối', InTransit: 'Đang luân chuyển', Received: 'Đã nhận', Rejected: 'Từ chối' } as Record<string, string>)[status] ?? status;
}

function TransferDispatchPanel({ tab }: { tab: 'requests' | 'history' }) {
  const { user } = useAuth();
  const mayAssign = hasOperation(user, 'api:TransportDispatches.AssignTransfer');
  const client = useQueryClient();
  const transfers = useQuery({ queryKey: ['transport-dispatch', 'transfers'], queryFn: loadTransferDispatches });
  const drivers = useQuery({ queryKey: ['transport-dispatch', 'drivers'], queryFn: shipmentsApi.drivers, enabled: mayAssign });
  const vehicles = useQuery({ queryKey: ['transport-dispatch', 'vehicles'], queryFn: shipmentsApi.vehicles, enabled: mayAssign });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [driverId, setDriverId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [pendingAssignment, setPendingAssignment] = useState<{
    input: Parameters<typeof shipmentsApi.assignTransfer>[0];
    transferCode: string; driverName: string; plateNumber: string;
  } | null>(null);
  const { data: warehouses = [] } = useWarehouses();
  const assign = useMutation({ mutationFn: shipmentsApi.assignTransfer, onSuccess: async () => {
    await client.invalidateQueries({ queryKey: ['transport-dispatch'] });
    await client.invalidateQueries({ queryKey: ['warehouse-documents'] });
    setSelectedId(null);
    setPendingAssignment(null);
  } });
  return <QueryState query={transfers}>{rows => {
    const visible = rows.filter(row => tab === 'history' ? ['Received', 'Rejected'].includes(row.status) : !['Received', 'Rejected'].includes(row.status));
    const selected = rows.find(row => row.id === selectedId);
    const warehouseName = (id: string) => warehouses.find(warehouse => warehouse.id === id)?.name ?? 'Chưa rõ kho';
    const close = () => { if (!assign.isPending) setSelectedId(null); };
    return <>
      <div className="stats-grid delivery-summary-grid" style={{ marginBottom: 16 }}>
        <Stat label="Tổng lệnh điều phối" value={String(rows.length)} />
        <Stat label="Chờ duyệt" value={String(rows.filter(row => row.status === 'Requested').length)} />
        <Stat label="Chờ điều phối" value={String(rows.filter(row => row.status === 'Approved' && !row.assignedAt).length)} />
        <Stat label="Đã phân công" value={String(rows.filter(row => row.status === 'Approved' && !!row.assignedAt).length)} />
        <Stat label="Đang luân chuyển" value={String(rows.filter(row => row.status === 'InTransit').length)} />
        <Stat label="Đã nhận" value={String(rows.filter(row => row.status === 'Received').length)} />
        <Stat label="Từ chối" value={String(rows.filter(row => row.status === 'Rejected').length)} />
      </div>
      <DataTable title={tab === 'history' ? 'Lịch sử điều phối luân chuyển' : 'Yêu cầu điều phối luân chuyển'}
        rows={visible} rowKey={row => row.id} stateKey={`transfer-dispatch-${tab}`}
        searchPlaceholder="Tìm mã điều phối, kho hoặc tài xế"
        onRowClick={row => { setSelectedId(row.id); setDriverId(''); setVehicleId(''); assign.reset(); }}
        emptyText={tab === 'history' ? 'Chưa có điều phối luân chuyển trong lịch sử.' : 'Không có yêu cầu điều phối luân chuyển.'}
        columns={[
          { key: 'code', header: 'Mã lệnh', text: row => row.transferCode, render: row => <b>{row.transferCode}</b> },
          { key: 'route', header: 'Kho gửi → kho nhận', text: row => `${warehouseName(row.sourceWarehouseId)} → ${warehouseName(row.destinationWarehouseId)}` },
          { key: 'requested', header: 'Thời điểm yêu cầu', text: row => formatInstantDateTime(row.requestedAt) },
          { key: 'assignment', header: 'Tài xế / phương tiện', text: row => [row.driverNameSnapshot, row.plateNumberSnapshot].filter(Boolean).join(' · ') || 'Chưa phân công' },
          { key: 'status', header: 'Trạng thái điều phối', text: row => transferStatusLabel(row.status), render: row => <Chip tone={row.status === 'Rejected' ? 'danger' : row.status === 'Received' ? 'success' : row.status === 'InTransit' ? 'info' : 'warn'}>{transferStatusLabel(row.status)}</Chip> },
          { key: 'time', header: tab === 'history' ? 'Hoàn tất lúc' : 'Điều phối lúc', text: row => formatInstantDateTime(tab === 'history' ? row.receivedAt : row.assignedAt) },
        ]} />
      {selected && <Modal open title="Chi tiết điều phối luân chuyển" subtitle={selected.transferCode} onClose={close}
        footer={<><Button onClick={close} disabled={assign.isPending}>Đóng</Button>{selected.status === 'Approved' && mayAssign && <Button variant="primary" loading={assign.isPending} disabled={!driverId || !vehicleId || drivers.isLoading || vehicles.isLoading || drivers.isError || vehicles.isError} onClick={() => setPendingAssignment({
          input: { transferId: selected.id, expectedVersion: selected.version, driverId, vehicleId },
          transferCode: selected.transferCode,
          driverName: drivers.data?.find(driver => driver.id === driverId)?.fullName ?? '',
          plateNumber: vehicles.data?.find(vehicle => vehicle.id === vehicleId)?.plateNumber ?? '',
        })}>Gán xe và tài xế</Button>}</>}>
        <div className="stack">
          <p><b>Tuyến:</b> {warehouseName(selected.sourceWarehouseId)} → {warehouseName(selected.destinationWarehouseId)}</p>
          <p><b>Trạng thái:</b> {transferStatusLabel(selected.status)}</p>
          <p><b>Thời điểm yêu cầu:</b> {formatInstantDateTime(selected.requestedAt)}</p>
          {selected.status === 'Approved' && mayAssign ? <>
            {(drivers.isError || vehicles.isError) && <Callout tone="danger">Không tải được danh sách xe hoặc tài xế. Vui lòng thử lại.</Callout>}
            {assign.isError && <Callout tone="danger">{errorMessage(assign.error)}</Callout>}
            <label className="lbl">Tài xế<Select value={driverId} onChange={event => setDriverId(event.target.value)} options={[{ value: '', label: drivers.isLoading ? 'Đang tải tài xế...' : 'Chọn tài xế' }, ...(drivers.data ?? []).filter(item => item.warehouseId === selected.sourceWarehouseId).map(item => ({ value: item.id, label: `${item.code} · ${item.fullName}` }))]} /></label>
            <label className="lbl">Xe<Select value={vehicleId} onChange={event => setVehicleId(event.target.value)} options={[{ value: '', label: vehicles.isLoading ? 'Đang tải xe...' : 'Chọn xe' }, ...(vehicles.data ?? []).filter(item => item.warehouseId === selected.sourceWarehouseId).map(item => ({ value: item.id, label: `${item.plateNumber} · ${item.vehicleType}` }))]} /></label>
          </> : <p><b>Tài xế / xe:</b> {[selected.driverNameSnapshot, selected.plateNumberSnapshot].filter(Boolean).join(' · ') || 'Chưa phân công'}</p>}
        </div>
      </Modal>}
      {pendingAssignment && <ConfirmDialog open title="Xác nhận gán xe và tài xế" confirmLabel="Xác nhận gán"
        onClose={() => { if (!assign.isPending) setPendingAssignment(null); }}
        onConfirm={async () => { try { await assign.mutateAsync(pendingAssignment.input); } catch { /* Displayed in the confirmation dialog. */ } }}
        message={<div className="stack">
          <p>Vui lòng kiểm tra thông tin điều phối trước khi xác nhận.</p>
          <dl className="table-detail-fields">
            <div><dt>Lệnh luân chuyển</dt><dd>{pendingAssignment.transferCode}</dd></div>
            <div><dt>Tài xế</dt><dd>{pendingAssignment.driverName}</dd></div>
            <div><dt>Xe</dt><dd>{pendingAssignment.plateNumber}</dd></div>
          </dl>
          {assign.isError && <Callout tone="danger">{errorMessage(assign.error)}</Callout>}
        </div>} />}
    </>;
  }}</QueryState>;
}
