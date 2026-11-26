import { PalletReceiving } from "./PalletReceiving";
import { PalletCamera } from './PalletCamera';
import { FactoryPending, type FactoryInboundDispatch } from './FactoryPending';
import { FactoryReceiptHistory } from './FactoryReceiptHistory';
import { groupHistoryRows, type FactoryReceiptGroup } from './receiptHistoryModel';
import './warehouse-work.css';
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/shared/auth/AuthContext';
import { get, http } from '@/shared/api/http';
import { errorMessage } from '@/shared/api/errors';
import { graphql } from '@/shared/api/graphql';
import { AdvancedFilterCard, Button, Card, Fields, Input, Modal, PageHeader, Pagination, QueryState, Select, SimpleTable } from '@/shared/ui';
import { downloadExcel } from '@/shared/lib/excel';
import { receiptApi } from '@/features/receipts/api';
import { pickingApi } from '@/features/runpicking/api';
import type { BatchInventoryItem } from '@/features/batches/types';
import { Link, Redirect, useHistory, useLocation, useParams } from 'react-router-dom';
import { TraceLookup } from '@/features/factory-traceability';
import { formatDate, formatInstantDateTime } from '@/shared/lib/dates';
import { belongsToWorkflow, warehouseDocumentPath, warehouseScreens, type WarehouseWorkflow } from './workflow';
import { useStringParam } from '@/shared/router/listState';
import { WarehouseOutboundTabs } from './WarehouseOutboundTabs';
import { WarehouseInboundTabs } from './WarehouseInboundTabs';

interface Document { id: string; code: string; kind: 'Request' | 'Picking' | 'Issue' | 'Receipt'; reason: 'Transfer' | 'Order' | 'Factory'; warehouseId: string; destinationWarehouseId: string | null; sourceDocumentId: string | null; status: string; version: number; note: string | null; createdAt: string }
interface Line { id: string; sku: string; productName: string; batchCode: string | null; sourceLotCode: string | null; orderCode: string | null; quantity: number; expirationDate: string }
interface Carton { id: string; cartonId: string; lineId: string; scannedAt: string | null }
interface Work { document: Document; lines: Line[]; cartons: Carton[]; transportStatus?: string | null; pallets?: { palletCode: string; cartonCode: string; unitsPerCarton: number }[] }
interface TransferTransport { sourceIssueDocumentId: string; driverNameSnapshot: string | null; plateNumberSnapshot: string | null; dispatchedAt: string | null }
const kinds = { Request: 'Yêu cầu kho', Picking: 'Phiếu soạn hàng', Issue: 'Phiếu xuất kho', Receipt: 'Phiếu nhập kho' };
const reasons = { Transfer: 'Luân chuyển kho', Order: 'Xuất cho đơn hàng', Factory: 'Nhận từ nhà máy' };
const statuses: Record<string, string> = { Open: 'Chờ thực hiện', Prepared: 'Đã soạn đủ · chờ xuất', Posted: 'Đã ghi sổ', Fulfilled: 'Đã thực hiện', Cancelled: 'Đã hủy' };
const inboundStatuses: Record<string, string> = { Open: 'Chờ thực hiện', Posted: 'Đã ghi sổ', Cancelled: 'Đã hủy' };
const receiptsStatuses: Record<string, string> = { Posted: 'Đã ghi sổ', Cancelled: 'Đã hủy' };
const issuesStatuses: Record<string, string> = { Posted: 'Đã ghi sổ', Cancelled: 'Đã hủy' };
const outboundStatuses: Record<string, string> = { Open: 'Chờ thực hiện', Prepared: 'Đã soạn đủ · chờ xuất', Posted: 'Đã ghi sổ', Fulfilled: 'Đã thực hiện', Cancelled: 'Đã hủy' };

/** Outbound work-queue step shown in the "Trạng thái" column, keyed by document kind. */
export const outboundSteps: Record<string, string> = { Request: 'Chờ soạn hàng', Picking: 'Đang soạn hàng', Issue: 'Đã soạn xong - Chờ xuất' };

function getWorkflowStatuses(workflow: WarehouseWorkflow): Record<string, string> {
  if (workflow === 'receipts') return receiptsStatuses;
  if (workflow === 'issues') return issuesStatuses;
  if (workflow === 'inbound') return inboundStatuses;
  if (workflow === 'outbound') return outboundStatuses;
  return statuses;
}
export function documentTypeLabel(kind: string, reason: string): string {
  if (kind === 'Request' && reason === 'Transfer') return 'Lệnh điều chuyển kho';
  if (kind === 'Issue' && reason === 'Transfer') return 'Phiếu xuất luân chuyển (Kho gửi)';
  if (kind === 'Receipt' && reason === 'Transfer') return 'Phiếu nhập luân chuyển (Kho nhận)';
  if (kind === 'Request' && reason === 'Order') return 'Lệnh xuất bán hàng';
  if (kind === 'Issue' && reason === 'Order') return 'Phiếu xuất bán hàng (Kho)';
  if (kind === 'Receipt' && reason === 'Factory') return 'Phiếu nhập từ nhà máy';
  if (kind === 'Request') return 'Lệnh xuất / điều chuyển';
  if (kind === 'Issue') return 'Phiếu xuất kho';
  if (kind === 'Receipt') return 'Phiếu nhập kho';
  if (kind === 'Picking') return 'Phiếu soạn hàng';
  return kinds[kind as keyof typeof kinds] ?? kind;
}
const base = '/warehouse-documents';

export function WarehouseWorkPage() {
  const location = useLocation();
  return <Redirect to={{ pathname: warehouseScreens.inbound.path, search: location.search }} />;
}

export function WarehouseInboundPage() { const location = useLocation(); return location.pathname.endsWith('/new') ? <Redirect to="/warehouse-inbound" /> : <WarehouseOperationsPage key="inbound" workflow="inbound" />; }
export function WarehouseFactoryRequestsPage() { return <WarehouseOperationsPage key="factory-requests" workflow="inbound" factoryRequests />; }
export function WarehouseReceiptsPage() { const location = useLocation(); return location.pathname.endsWith('/new') ? <Redirect to="/warehouse-receipts" /> : <WarehouseOperationsPage key="receipts" workflow="receipts" />; }
export function WarehouseInboundCreatePage() { return <Redirect to="/warehouse-inbound" />; }
export function WarehouseOutboundPage() { return <WarehouseOperationsPage key="outbound" workflow="outbound" />; }
export function WarehouseIssuesPage() { const location = useLocation(); return location.pathname.endsWith('/new') ? <Redirect to="/warehouse-issues" /> : <WarehouseOperationsPage key="issues" workflow="issues" />; }
export function WarehouseTransferPage() { return <WarehouseOperationsPage key="transfer" workflow="transfer" />; }
export function WarehouseTracePage() { return <WarehouseOperationsPage key="trace" workflow="trace" />; }

interface QrStock {
  cartonCode: string; palletCode: string; productionBatchCode: string;
  stockBatchId: string; stockBatchCode: string;
  warehouseId: string; warehouseCode: string; warehouseName: string;
  sku: string; productName: string; status: string;
  productionDate: string; expirationDate: string; unitsPerCarton: number;
  receiptCode: string | null; receivedAt: string | null;
  syncedAt: string | null; hasAcknowledgement: boolean; syncAttempts: number; syncError: string | null;
}
interface QrPage { items: QrStock[]; totalCount: number; page: number; pageSize: number }
interface QrEvent { occurredAt: string; warehouseCode: string; eventType: string; fromStatus: string; toStatus: string; referenceCode?: string }
interface QrDetail { label: { sku: string; warehouseCode: string; status: string }; events: QrEvent[] }

const qrStatusLabels: Record<string, string> = {
  Available: 'Sẵn sàng',
  Picked: 'Đã soạn',
  InTransit: 'Đang vận chuyển',
  Delivered: 'Đã giao',
  Invalidated: 'Đã hủy',
  Split: 'Đã tách',
};

function WarehouseTraceCenter({ warehouses: initialWarehouses }: {
  warehouses: { id: string; name: string; code?: string }[];
  docs?: unknown;
  setSelected?: (id: string) => void;
}) {
  const { user } = useAuth();
  const [filters, setFilters] = useState({ warehouseId: '', status: '', syncStatus: '', search: '', page: 1, pageSize: 10 });
  const [search, setSearch] = useState('');
  const [selectedCode, setSelectedCode] = useState('');
  const [selectedRow, setSelectedRow] = useState<QrStock | null>(null);
  const warehouses = useQuery({ queryKey: ['qr-inventory', 'warehouses'], queryFn: receiptApi.warehouses });
  const inventory = useQuery({
    queryKey: ['qr-inventory', filters],
    queryFn: () => get<QrPage>('/inventory/qr-codes', filters),
    refetchInterval: 15000,
  });
  const detail = useQuery({
    queryKey: ['qr-inventory', 'detail', selectedCode],
    queryFn: () => get<QrDetail>(`/qr-labels/${encodeURIComponent(selectedCode)}`),
    enabled: !!selectedCode,
  });
  const changeFilter = (name: 'warehouseId' | 'status' | 'syncStatus', value: string) =>
    setFilters(current => ({ ...current, [name]: value, page: 1 }));
  const openCarton = (row: QrStock) => { setSelectedRow(row); setSelectedCode(row.cartonCode); };

  return <div className="warehouse-trace-center stack">
    <AdvancedFilterCard as="form" onSubmit={e => { e.preventDefault(); setFilters(current => ({ ...current, search: search.trim(), page: 1 })); }}>
      <label className="lbl warehouse-trace-search">Tìm CID / PID / BID / SKU <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Quét hoặc nhập mã để tra cứu" /></label>
      <label className="lbl">Kho <Select value={filters.warehouseId} onChange={e => changeFilter('warehouseId', e.target.value)} options={[{ value: '', label: 'Tất cả kho được phép' }, ...((warehouses.data ?? initialWarehouses)?.filter(w => user?.role !== 'WarehouseKeeper' || user.scope?.warehouseIds.includes(w.id)).map(w => ({ value: w.id, label: w.name })) ?? [])]} /></label>
      <label className="lbl">Trạng thái QR <Select value={filters.status} onChange={e => changeFilter('status', e.target.value)} options={[{ value: '', label: 'Tất cả trạng thái' }, ...Object.entries(qrStatusLabels).map(([value, label]) => ({ value, label }))]} /></label>
      <label className="lbl">Xác nhận về nhà máy <Select value={filters.syncStatus} onChange={e => changeFilter('syncStatus', e.target.value)} options={[{ value: '', label: 'Tất cả' }, { value: 'Pending', label: 'Chờ gửi / đang thử lại' }, { value: 'Synced', label: 'Đã xác nhận' }, { value: 'Legacy', label: 'Dữ liệu cũ chưa có xác nhận' }]} /></label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <button className="btn btn-primary" type="submit">Tìm kiếm</button>
        <button className="btn" type="button" disabled={inventory.isFetching} onClick={() => { void inventory.refetch(); if (selectedCode) void detail.refetch(); }}>Làm mới</button>
      </div>
    </AdvancedFilterCard>
    <Card title="Danh sách thùng carton trong kho (Pallet · Carton · SKU · Nhà máy)">
      <p className="muted">Tra cứu toàn diện từng thùng carton đã nhận vào hệ thống FSCM. Tìm kiếm nhanh theo mã Thùng (CID), mã Pallet (PID), mã Lô sản xuất (BID), SKU hoặc HSD.</p>

      <QueryState query={inventory}>{data => <>
        <SimpleTable paginate={false} rows={data.items} onRowClick={openCarton} columns={[
          { header: 'Thùng carton (CID)', width: '220px', cell: r => <div><b className="warehouse-pallet-code">{r.cartonCode}</b><div className="muted">{r.receivedAt ? `Nhận ${formatInstantDateTime(r.receivedAt)}` : 'Chưa có thời điểm nhận'}</div></div> },
          { header: 'SKU & Sản phẩm', width: '220px', cell: r => <>{r.sku} · {r.productName}<div className="muted">{r.unitsPerCarton} sản phẩm/thùng</div></> },
          { header: 'Hạn sử dụng', cell: r => formatDate(r.expirationDate) },
          { header: 'Kho hiện tại', cell: r => <>{r.warehouseCode} · {r.warehouseName}</> },
          { header: 'Trạng thái QR', width: '130px', cell: r => <span className="chip">{qrStatusLabels[r.status] ?? r.status}</span> },
        ]} empty="Chưa có thùng carton nào khớp với bộ lọc." />

        <Pagination currentPage={data.page} totalPages={Math.max(1, Math.ceil(data.totalCount / data.pageSize))}
          totalCount={data.totalCount} pageSize={data.pageSize} itemCount={data.items.length} loading={inventory.isFetching}
          hasPrev={data.page > 1} hasNext={data.page * data.pageSize < data.totalCount}
          onPage={page => setFilters(current => ({ ...current, page }))}
          onPrev={() => setFilters(current => ({ ...current, page: data.page - 1 }))}
          onNext={() => setFilters(current => ({ ...current, page: data.page + 1 }))}
          onPageSizeChange={pageSize => setFilters(current => ({ ...current, pageSize, page: 1 }))} />
      </>}</QueryState>
    </Card>

    <details style={{ marginTop: 16 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600, padding: '8px 0' }}>Tra cứu nguồn gốc theo mã bất kỳ (BID / PID / CID / UID)</summary>
      <div style={{ marginTop: 12 }}>
        <TraceLookup />
      </div>
    </details>

    {selectedCode && <Modal open width={980} title={`Chi tiết thùng · ${selectedCode}`} onClose={() => setSelectedCode('')}>
      {selectedRow && <Fields cols={2} items={[
        { label: 'Pallet gốc (PID)', value: selectedRow.palletCode },
        { label: 'Lô sản xuất nhà máy (BID)', value: selectedRow.productionBatchCode },
        { label: 'Lô kho', value: <Link to={`/batches/${encodeURIComponent(selectedRow.stockBatchId)}`}>{selectedRow.stockBatchCode}</Link> },
        { label: 'Ngày sản xuất', value: formatDate(selectedRow.productionDate) },
        { label: 'Phiếu nhập', value: selectedRow.receiptCode ? <Link to={`/warehouse-inbound/${encodeURIComponent(selectedRow.receiptCode)}`}>{selectedRow.receiptCode}</Link> : 'Dữ liệu cũ' },
        { label: 'Xác nhận về nhà máy', value: selectedRow.syncedAt ? formatInstantDateTime(selectedRow.syncedAt) : selectedRow.hasAcknowledgement ? 'Chờ gửi xác nhận' : 'Chưa có xác nhận' },
        { label: 'Số lần gửi xác nhận', value: selectedRow.syncAttempts },
        { label: 'Lỗi đồng bộ gần nhất', value: selectedRow.syncError || '—' },
      ]} />}
      <div style={{ marginBottom: 12, marginTop: 16 }}>
        <strong>Lịch sử & Vòng đời QR</strong>
      </div>
      <QueryState query={detail}>{data => <>
        <SimpleTable rows={data.events} columns={[
          { header: 'Thời gian', cell: e => formatInstantDateTime(e.occurredAt) },
          { header: 'Kho / sự kiện', cell: e => `${e.warehouseCode} · ${e.eventType}` },
          { header: 'Trạng thái', cell: e => `${qrStatusLabels[e.fromStatus] ?? e.fromStatus} → ${qrStatusLabels[e.toStatus] ?? e.toStatus}` },
          { header: 'Chứng từ', cell: e => e.referenceCode ? (e.referenceCode.startsWith('PNK-') || e.referenceCode.startsWith('WH-REC-') ? <Link to={`/warehouse-inbound/${encodeURIComponent(e.referenceCode)}`}>{e.referenceCode}</Link> : e.referenceCode) : '—' },
        ]} />
      </>}</QueryState>
      <TraceLookup key={selectedCode} initialCode={selectedCode} />
    </Modal>}
  </div>;
}

export function WarehouseOperationsPage({ workflow, factoryRequests = false }: { workflow: WarehouseWorkflow; factoryRequests?: boolean }) {
  const history = useHistory();
  const location = useLocation();
  const screen = factoryRequests ? warehouseScreens.factoryRequests : warehouseScreens[workflow];
  const { user } = useAuth();
  const admin = user?.role === 'Admin';
  const client = useQueryClient();
  const { documentId: selected = '' } = useParams<{ documentId?: string }>();
  const creating = location.pathname.endsWith('/new');
  const [wh, setWh] = useState('');
  const [destination, setDestination] = useState('');
  const reason = workflow === 'transfer' ? 'Transfer' : 'Order';
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [transferLines, setTransferLines] = useState<{ batchId: string; quantity: number }[]>([]);
  const [note, setNote] = useState('');
  const [scan, setScan] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useStringParam('q');
  const [statusFilter, setStatusFilter] = useStringParam('status');
  const [warehouseFilter, setWarehouseFilter] = useStringParam('warehouse');
  const [operationSource, setOperationSource] = useStringParam('source');
  const [tab, setTab] = useStringParam('tab');
  const [documentSort, setDocumentSort] = useStringParam('sort');
  const [stepFilter, setStepFilter] = useStringParam('step');
  const isInbound = workflow === 'inbound' || workflow === 'receipts';
  const isOutbound = workflow === 'outbound' || workflow === 'issues';
  const isHistoryWorkflow = workflow === 'receipts' || workflow === 'issues';
  const activeTab = factoryRequests ? 'factory' : (isInbound && tab === 'factory' ? 'todo' : tab ? tab : (isHistoryWorkflow ? 'history' : 'todo'));
  // Keep the source independent of the request/history tab so both sources have a complete workspace.
  const operationReason = factoryRequests ? 'Factory' : isInbound
    ? (operationSource === 'Transfer' ? 'Transfer' : 'Factory')
    : operationSource === 'Transfer' ? 'Transfer' : 'Order';
  const [cartonEdit, setCartonEdit] = useState<{ documentId: string; cartonCode: string; replace: boolean; replacementCode: string; reason: string } | null>(null);
  const scanInput = useRef<HTMLInputElement>(null);
  const operation = useRef<{ fingerprint: string; key: string } | null>(null);
  const inFlight = useRef(false);
  const docs = useQuery({ queryKey: ['warehouse-documents'], queryFn: () => get<Work[]>(base) });
  const transportDetails = useQuery({
    queryKey: ['warehouse-work', 'transfer-transport'],
    enabled: isInbound && operationReason === 'Transfer' && activeTab === 'todo',
    queryFn: async () => {
      const data = await graphql<{ entities: { warehouseTransfers: { nodes: TransferTransport[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } } }>(`
        query TransferArrivalsTransport($after: String) {
          entities { warehouseTransfers(first: 100, after: $after, where: { status: { eq: "InTransit" } }) {
            nodes { sourceIssueDocumentId driverNameSnapshot plateNumberSnapshot dispatchedAt }
            pageInfo { hasNextPage endCursor }
          } }
        }`, {});
      const all = [...data.entities.warehouseTransfers.nodes];
      let page = data.entities.warehouseTransfers.pageInfo;
      while (page.hasNextPage && page.endCursor) {
        const next = await graphql<typeof data>(`
          query TransferArrivalsTransport($after: String) {
            entities { warehouseTransfers(first: 100, after: $after, where: { status: { eq: "InTransit" } }) {
              nodes { sourceIssueDocumentId driverNameSnapshot plateNumberSnapshot dispatchedAt }
              pageInfo { hasNextPage endCursor }
            } }
          }`, { after: page.endCursor });
        all.push(...next.entities.warehouseTransfers.nodes);
        if (next.entities.warehouseTransfers.pageInfo.endCursor === page.endCursor) throw new Error('Không thể tải đầy đủ thông tin vận tải.');
        page = next.entities.warehouseTransfers.pageInfo;
      }
      return all;
    },
  });
  // One row per factory dispatch note (PXN) with all its pallets; the PNK opened from it receives them all.
  const incoming = useQuery({ queryKey: ['factory-pending'], queryFn: () => get<FactoryInboundDispatch[]>(`${base}/factory-pending-dispatches`), enabled: isInbound });
  // PNK history: factory receipts grouped by dispatch note (read-only display grouping).
  const receiptGroups = useQuery({ queryKey: ['warehouse-documents', 'factory-receipt-groups'], queryFn: () => get<FactoryReceiptGroup[]>(`${base}/factory-receipt-groups`), enabled: workflow === 'inbound' || workflow === 'receipts' });
  /** Pallet code for receipts opened from a single pallet (before dispatch notes existed); '' for dispatch-note PNKs. */
  const legacyPalletOf = (documentId: string) => {
    const group = incoming.data?.find(g => g.receiptDocumentId === documentId);
    if (group) return group.dispatchNoteId ? '' : group.pallets[0]?.palletCode ?? '';
    return new URLSearchParams(location.search).get('pallet') ?? '';
  };
  const warehouses = useQuery({ queryKey: ['warehouse-work', 'warehouses'], queryFn: receiptApi.warehouses });
  const requiredPerm = workflow === 'transfer' ? 'warehouse-transfers' : 'warehouse-outbound';
  const hasWorkflowPerm = admin || (user?.permissions && user.permissions.length > 0 ? user.permissions.includes(requiredPerm) : user?.role === 'WarehouseKeeper');
  const canCreate = hasWorkflowPerm && (workflow === 'outbound' && operationReason === 'Order' || workflow === 'transfer');
  const pickings = useQuery({ queryKey: ['warehouse-work', 'picking', wh], queryFn: () => pickingApi.lists(wh), enabled: canCreate && workflow === 'outbound' && creating && !!wh });
  const batches = useQuery({ queryKey: ['warehouse-work', 'batches', wh], queryFn: () => get<BatchInventoryItem[]>('/inventory', { warehouseId: wh }), enabled: canCreate && creating && !!wh && reason === 'Transfer' });
  const active = docs.data?.find(x => (x.document.id === selected || x.document.code === selected) && belongsToWorkflow(x.document, workflow));
  const executionWarehouses = warehouses.data?.filter(w => w.isActive &&
    (admin || user?.scope?.warehouseIds?.includes(w.id) || !user?.scope?.warehouseIds?.length));
  const whName = (id: string | null) => warehouses.data?.find(w => w.id === id)?.name ?? id ?? '—';
  const setSelected = (id: string) => {
    const work = docs.data?.find(w => w.document.id === id);
    if (work) {
      if (workflow === 'receipts') history.push(`/warehouse-receipts/${encodeURIComponent(work.document.id)}`);
      else if (workflow === 'issues') history.push(`/warehouse-issues/${encodeURIComponent(work.document.id)}`);
      else history.push(warehouseDocumentPath(work.document));
    }
  };

  const workflowRows = (docs.data ?? []).filter(w => {
    if (!belongsToWorkflow(w.document, workflow)) return false;
    if (['inbound', 'receipts', 'outbound', 'issues'].includes(workflow) && w.document.reason !== operationReason) return false;
    if (activeTab === 'history') {
      if (isInbound) return w.document.kind === 'Receipt' && w.document.status !== 'Open';
      if (isOutbound) return w.document.kind === 'Issue' && w.document.status !== 'Open';
      return true;
    }
    if (activeTab === 'todo') {
      if (isOutbound && w.document.kind === 'Issue' && w.document.status === 'Posted') return false;
      return true;
    }
    return true;
  });
  const transferArrivals = (docs.data ?? []).filter(w => w.document.reason === 'Transfer' && w.document.kind === 'Issue' && w.document.status === 'Posted' && w.transportStatus === 'InTransit'
    && (admin || user?.scope?.warehouseIds.includes(w.document.destinationWarehouseId ?? ''))
    && !docs.data?.some(r => r.document.kind === 'Receipt' && r.document.sourceDocumentId === w.document.id));
  const visibleRows = workflowRows.filter(w => {
    const text = [w.document.code, w.document.note, ...w.lines.flatMap(l => [l.sku, l.batchCode, l.orderCode])].join(' ').toLocaleLowerCase('vi');
    return (!search.trim() || text.includes(search.trim().toLocaleLowerCase('vi')))
      && (!statusFilter || w.document.status === statusFilter)
      && (!warehouseFilter || [w.document.warehouseId, w.document.destinationWarehouseId].includes(warehouseFilter));
  }).sort((a, b) => documentSort === 'codeAsc'
    ? a.document.code.localeCompare(b.document.code)
    : documentSort === 'codeDesc' ? b.document.code.localeCompare(a.document.code)
      : b.document.createdAt.localeCompare(a.document.createdAt));
  const pendingOutboundRows = visibleRows.filter(w => {
    if (w.document.kind === 'Issue' && w.document.status === 'Posted') return false;
    if (stepFilter && w.document.kind !== stepFilter) return false;
    if (w.document.kind === 'Request' && docs.data?.some(child => child.document.sourceDocumentId === w.document.id)) {
      return false;
    }
    return true;
  });
  const inProgressReceipts = (docs.data ?? []).filter(w => w.document.reason === operationReason && w.document.kind === 'Receipt' && w.document.status === 'Open'
    && (admin || user?.scope?.warehouseIds.includes(w.document.warehouseId)));
  const filterStatuses = getWorkflowStatuses(workflow);
  const exportDocuments = async () => {
    const rows = isOutbound && activeTab === 'todo' ? pendingOutboundRows : visibleRows;
    if (!rows.length) return;
    setExporting(true);
    try {
      await downloadExcel(`chung-tu-kho-${workflow}-${activeTab}-${operationReason.toLowerCase()}.xlsx`, [{
        name: 'Chứng từ kho',
        title: `${screen.title} · ${activeTab === 'history' ? 'Lịch sử' : 'Đang xử lý'}`,
        blocks: [{
          columns: ['Mã chứng từ', 'Loại chứng từ', 'Kho / tuyến', 'Đơn hàng', 'Số thùng', 'Trạng thái', 'Tạo lúc'].map((header) => ({ header })),
          rows: rows.map((work) => [work.document.code, documentTypeLabel(work.document.kind, work.document.reason), `${whName(work.document.warehouseId)}${work.document.destinationWarehouseId && work.document.destinationWarehouseId !== work.document.warehouseId ? ` → ${whName(work.document.destinationWarehouseId)}` : ''}`, [...new Set(work.lines.map((line) => line.orderCode).filter(Boolean))].join(', ') || '—', work.lines.reduce((total, line) => total + line.quantity, 0), filterStatuses[work.document.status] ?? statuses[work.document.status] ?? work.document.status, formatInstantDateTime(work.document.createdAt)]),
        }],
      }]);
    } finally { setExporting(false); }
  };
  const selectable = (pickings.data ?? []).filter(p => p.status === 'Pending' && !docs.data?.some(d => d.document.kind === 'Request' && d.document.status !== 'Cancelled' && d.lines.some(l => l.orderCode === p.orderCode) && d.document.warehouseId === wh));
  async function act(path: string, payload?: unknown, idempotent = false, sourcePallet?: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError(''); setNotice('');
    try {
      const fingerprint = JSON.stringify([path, payload]);
      if (idempotent && operation.current?.fingerprint !== fingerprint) operation.current = { fingerprint, key: crypto.randomUUID() };
      const { data } = await http.post<Work>(path, payload, idempotent ? { headers: { 'Idempotency-Key': operation.current!.key } } : undefined);
      operation.current = null;
      await client.invalidateQueries({ queryKey: ['warehouse-documents'] });
      await client.invalidateQueries({ queryKey: ['factory-pending'] });
      await client.invalidateQueries({ queryKey: ['warehouse-work'] });
      await client.invalidateQueries({ queryKey: ['qr-inventory'] });
      await client.invalidateQueries({ queryKey: ['inventory'] });
      await client.invalidateQueries({ queryKey: ['batches'] });
      await client.invalidateQueries({ queryKey: ['qr-labels'] });
      history.push(warehouseDocumentPath(data.document) + (sourcePallet ? `?pallet=${encodeURIComponent(sourcePallet)}` : '')); setScan(''); setNotice('Đã lưu chứng từ.');
      setCartonEdit(null);
    } catch (e) {
      setError(errorMessage(e));
      // Refresh versions after concurrent changes or a lost response; keep scanner input
      // and the idempotency key so the operator can safely retry the same operation.
      await client.invalidateQueries({ queryKey: ['warehouse-documents'] });
      await client.invalidateQueries({ queryKey: ['factory-pending'] });
      await client.invalidateQueries({ queryKey: ['warehouse-work'] });
      await client.invalidateQueries({ queryKey: ['qr-inventory'] });
      await client.invalidateQueries({ queryKey: ['batches'] });
    }
    finally { inFlight.current = false; setBusy(false); scanInput.current?.focus(); }
  }
  async function printLabels(stock = false, receipt = false, issue = false) {
    if (!active) return;
    const win = window.open('', '_blank');
    if (!win) { setError('Cho phép mở cửa sổ để in nhãn.'); return; }
    try {
      const endpoint = receipt ? 'receipt-print' : issue ? 'issue-print' : stock ? 'stock-labels' : 'labels';
      const { data } = await http.get<string>(`${base}/${active.document.id}/${endpoint}`, { responseType: 'text' });
      win.document.open(); win.document.write(data); win.document.close();
    } catch (e) { win.close(); setError(errorMessage(e)); }
  }
  const d = active?.document;
  const canCreateChild = d && ((d.kind === 'Request' && d.status === 'Open') || (d.kind === 'Issue' && d.reason === 'Transfer' && d.status === 'Posted')) && !docs.data?.some(x => x.document.sourceDocumentId === d.id);
  return <>
    <PageHeader title={selected ? `Chi tiết ${screen.title.toLocaleLowerCase('vi')}` : creating ? screen.create : screen.title} subtitle={screen.description}
      back={selected || creating ? screen.path + (d?.reason === 'Transfer' && workflow !== 'transfer' ? '?source=Transfer' : '') : undefined}
      actions={!selected && !creating ? <div className="row-wrap" style={{ gap: 8 }}><Button loading={exporting} disabled={docs.isLoading || (isOutbound && activeTab === 'todo' ? pendingOutboundRows.length === 0 : visibleRows.length === 0)} onClick={() => void exportDocuments()}>Xuất Excel</Button>{canCreate && <Link className="btn btn-primary" to={`${screen.path}/new`}>{screen.create}</Link>}</div> : undefined} />
    {!selected && !creating && !factoryRequests && isInbound && <WarehouseInboundTabs
      reason={operationReason === 'Transfer' ? 'Transfer' : 'Factory'}
      tab={activeTab}
      onReasonChange={next => { setOperationSource(next === 'Transfer' ? 'Transfer' : ''); setStatusFilter(''); }}
      onTabChange={next => { setTab(next); setStatusFilter(''); }}
    />}

    {!selected && !creating && isOutbound && <WarehouseOutboundTabs
      reason={operationReason === 'Transfer' ? 'Transfer' : 'Order'}
      tab={activeTab}
      onReasonChange={next => { setOperationSource(next === 'Transfer' ? 'Transfer' : ''); setStatusFilter(''); }}
      onTabChange={next => { setTab(next); setStatusFilter(''); }}
    />}
    {workflow === 'trace' && <WarehouseTraceCenter warehouses={warehouses.data ?? []} docs={docs} setSelected={setSelected} />}
    {error && <p role="alert" className="danger">{error}</p>}{notice && <p role="status">{notice}</p>}
    {!selected && !creating && isInbound && !factoryRequests && <section className="card filter-card" aria-label="Bộ lọc nâng cao">
      <div className="row"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14655B" strokeWidth="2" aria-hidden><path d="M3 5h18l-7 8v6l-4 2v-8z" /></svg><h2 className="sec">Bộ lọc nâng cao</h2></div>
      <div className="filter-grid">
        <label className="lbl">Tìm kiếm<input className="inp" value={search} onChange={e => setSearch(e.target.value)} placeholder="Mã phiếu, SKU, lô hàng hoặc đơn hàng" /></label>
        <label className="lbl">Trạng thái<select className="inp" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(filterStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="lbl">Kho<select className="inp" value={warehouseFilter} onChange={e => setWarehouseFilter(e.target.value)}><option value="">Tất cả kho</option>{warehouses.data?.filter(w => admin || user?.scope?.warehouseIds.includes(w.id)).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
        <label className="lbl">Sắp xếp<select className="inp" value={documentSort} onChange={e => setDocumentSort(e.target.value)}><option value="">Mới nhất</option><option value="codeAsc">Mã phiếu A–Z</option><option value="codeDesc">Mã phiếu Z–A</option></select></label>
      </div>
    </section>}
    {!selected && !creating && isInbound && !factoryRequests && operationReason !== 'Transfer' && activeTab === 'todo' && inProgressReceipts.length > 0 && <Card title="Phiếu kiểm đếm đang thực hiện dở dang">
      <p className="muted">Các phiếu nhập kho đã mở nhưng chưa hoàn tất ghi sổ. Chọn phiếu để tiếp tục kiểm đếm.</p>
      <SimpleTable rows={inProgressReceipts} onRowClick={w => { setSelected(w.document.id); setError(''); }} columns={[
        { header: 'Mã phiếu', width: '320px', cell: w => <b className="warehouse-document-code">{w.document.code}</b> },
        { header: 'Kho nhận', width: '220px', cell: w => whName(w.document.warehouseId) },
        { header: 'Số thùng', width: '130px', cell: w => `${w.lines.reduce((s, l) => s + l.quantity, 0)} carton` },
        { header: 'Trạng thái', width: '150px', cell: () => <span className="chip chip-warn">Đang kiểm đếm</span> },
        { header: 'Thao tác', width: '180px', cell: w => <button className="btn btn-sm btn-primary" onClick={() => { setSelected(w.document.id); setError(''); }}>Tiếp tục kiểm đếm</button> },
      ]} />
    </Card>}
    {!selected && !creating && isInbound && (activeTab === 'todo' || activeTab === 'factory') && <div>
      {factoryRequests && operationReason === 'Factory' && <div className="warehouse-guide-steps">
        <div className="warehouse-guide-step">
          <div className="step-badge">Bước 1</div>
          <div>
            <strong>Tiếp nhận phiếu xuất nhà máy</strong>
            <p>Xe nhà máy chở một hoặc nhiều pallet đến kho. Chọn phiếu xuất và bấm Bắt đầu kiểm đếm để mở một PNK cho toàn bộ pallet.</p>
          </div>
        </div>
        <div className="warehouse-guide-step">
          <div className="step-badge">Bước 2</div>
          <div>
            <strong>Kiểm đếm thùng (CID)</strong>
            <p>Quét camera hoặc mã pallet để nạp danh sách thùng carton. Phân loại Đạt, Hỏng (cách ly) hoặc Thiếu.</p>
          </div>
        </div>
        <div className="warehouse-guide-step">
          <div className="step-badge">Bước 3</div>
          <div>
            <strong>Ghi sổ PNK & Map Lô kho</strong>
            <p>Bấm Hoàn tất & Thực hiện nhập kho. Thùng đạt tự động map vào Lô kho FSCM để bán và gửi ACK về nhà máy.</p>
          </div>
        </div>
      </div>}
      {factoryRequests && operationReason === 'Factory' && <QueryState query={warehouses}>{() => <FactoryPending query={incoming} warehouses={executionWarehouses ?? []} admin={admin} busy={busy}
        refresh={() => { void incoming.refetch(); }} onOpen={dispatch => {
          const legacyPallet = dispatch.dispatchNoteId ? undefined : dispatch.pallets[0]?.palletCode;
          if (admin && dispatch.receiptDocumentId) history.push(`/warehouse-inbound/${encodeURIComponent(dispatch.receiptDocumentId)}${legacyPallet ? `?pallet=${encodeURIComponent(legacyPallet)}` : ''}`);
          else if (!admin && dispatch.dispatchNoteId) void act(`${base}/factory-receipts/from-dispatch`, { dispatchNoteId: dispatch.dispatchNoteId });
          else if (!admin && legacyPallet) void act(`${base}/factory-receipts/from-pallet`, { palletCode: legacyPallet }, false, legacyPallet);
        }} />}</QueryState>}
      {operationReason === 'Transfer' && <Card title="Hàng luân chuyển chờ nhận">
        <p>Mỗi dòng là một phiếu xuất luân chuyển. Mở phiếu để kiểm đếm từng thùng; hoàn tất phiếu nhập để ghi tăng tồn kho.</p>
        {transportDetails.isError && <p role="alert">Không tải được thông tin tài xế và xe: {errorMessage(transportDetails.error)}</p>}
        <QueryState query={docs}>{() => <SimpleTable paginate rows={[
          ...transferArrivals.map(issue => ({ issue, receipt: null as Work | null })),
          ...inProgressReceipts.map(receipt => ({ issue: docs.data?.find(w => w.document.id === receipt.document.sourceDocumentId) ?? receipt, receipt })),
        ].filter(({ issue, receipt }) => {
          const term = search.trim().toLocaleLowerCase('vi');
          const info = transportDetails.data?.find(t => t.sourceIssueDocumentId === issue.document.id);
          return (!warehouseFilter || [issue.document.warehouseId, issue.document.destinationWarehouseId, receipt?.document.warehouseId].includes(warehouseFilter))
            && (!statusFilter || (receipt?.document.status ?? 'Open') === statusFilter)
            && [issue.document.code, receipt?.document.code, info?.driverNameSnapshot, info?.plateNumberSnapshot, ...issue.lines.flatMap(line => [line.sku, line.batchCode, line.productName])].join(' ').toLocaleLowerCase('vi').includes(term);
        }).sort((a, b) => documentSort === 'codeAsc' ? a.issue.document.code.localeCompare(b.issue.document.code) : documentSort === 'codeDesc' ? b.issue.document.code.localeCompare(a.issue.document.code) : b.issue.document.createdAt.localeCompare(a.issue.document.createdAt))}
          onRowClick={row => { if (row.receipt) setSelected(row.receipt.document.id); else if (!admin) void act(`${base}/${row.issue.document.id}/create-document`, undefined, true); }} columns={[
            { header: 'Phiếu xuất / ngày xuất', width: '260px', cell: row => <><b className="warehouse-pallet-code">{row.issue.document.code}</b><div className="muted">{formatInstantDateTime(transportDetails.data?.find(t => t.sourceIssueDocumentId === row.issue.document.id)?.dispatchedAt ?? null)}</div></> },
            { header: 'Xe / tài xế', width: '180px', cell: row => { const t = transportDetails.data?.find(x => x.sourceIssueDocumentId === row.issue.document.id); return [t?.plateNumberSnapshot, t?.driverNameSnapshot].filter(Boolean).join(' · ') || (transportDetails.isLoading ? 'Đang tải...' : '—'); } },
            { header: 'Hàng cần nhận', width: '300px', cell: row => <><b>{row.issue.lines.reduce((sum, line) => sum + line.quantity, 0)} thùng</b>{row.issue.lines.map(line => <div key={line.id} className="muted">{line.sku} · {line.productName} · HSD {formatDate(line.expirationDate)}</div>)}</> },
            { header: 'Kho nhận', width: '180px', cell: row => whName(row.receipt?.document.warehouseId ?? row.issue.document.destinationWarehouseId) },
            { header: 'Thao tác', width: '210px', cell: row => row.receipt ? <button className="btn btn-sm btn-primary" onClick={e => { e.stopPropagation(); setSelected(row.receipt!.document.id); }}>Tiếp tục kiểm đếm</button> : admin ? 'Chờ thủ kho kiểm đếm' : <button className="btn btn-sm btn-primary" disabled={busy} onClick={e => { e.stopPropagation(); void act(`${base}/${row.issue.document.id}/create-document`, undefined, true); }}>Bắt đầu kiểm đếm</button> },
          ]} empty="Không có hàng luân chuyển chờ nhận tại kho của bạn." />}</QueryState>
      </Card>}
    </div>}
    {creating && !canCreate && <Card title="Không có quyền tạo chứng từ"><p>{workflow === 'inbound' ? 'Thủ kho tạo và thực hiện phiếu nhập tại kho được phân công.' : 'Tài khoản chưa được phân quyền tạo yêu cầu cho nghiệp vụ này. Vui lòng liên hệ Quản trị viên để cấu hình quyền trong mục Vai trò & Phân quyền.'}</p><Link className="btn" to={screen.path}>Về danh sách</Link></Card>}
    {creating && canCreate && <Card title={screen.create}>
      <p className="muted">{workflow === 'outbound' ? 'Chọn kho và đơn đã có đơn thực hiện để phát hành đợt soạn thùng.' : 'Lập lệnh điều chuyển nội bộ: Chọn kho gửi, kho nhận và số thùng từng lô hàng cần chuyển. Thủ kho gửi sẽ tiếp nhận lệnh để xuất hàng.'}</p>
      <form onSubmit={e => { e.preventDefault(); void act(`${base}/requests`, { warehouseId: wh, destinationWarehouseId: reason === 'Transfer' ? destination : null, reason, orderIds: reason === 'Order' ? orderIds : [], lines: reason === 'Transfer' ? transferLines : [], note }, true); }}>
        <div className="row-wrap" style={{ gap: 12, marginBottom: 12 }}>
          <label>{workflow === 'transfer' ? 'Kho gửi' : 'Kho xuất'} <select required value={wh} onChange={e => { setWh(e.target.value); if (e.target.value === destination) setDestination(''); setOrderIds([]); setTransferLines([]); }}><option value="">Chọn kho</option>{executionWarehouses?.map(w => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></label>
          {reason === 'Transfer' && <label>Kho nhận <select required value={destination} onChange={e => setDestination(e.target.value)}><option value="">Chọn kho nhận</option>{warehouses.data?.filter(w => w.id !== wh && w.isActive).map(w => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></label>}
        </div>
        {reason === 'Order' && <><p>Chọn các đơn có đơn thực hiện tại kho để phát hành một yêu cầu xuất tổng.</p>{pickings.isError && <p role="alert">{errorMessage(pickings.error)}</p>}<SimpleTable paginate rows={selectable} columns={[
          { header: 'Chọn', cell: p => <input type="checkbox" aria-label={`Chọn đơn ${p.orderCode}`} checked={orderIds.includes(p.orderId)} onChange={e => setOrderIds(e.target.checked ? [...orderIds, p.orderId] : orderIds.filter(id => id !== p.orderId))} /> },
          { header: 'Đơn / khách hàng', cell: p => `${p.orderCode} · ${p.retailerName}` },
          { header: 'Lô hàng theo phân bổ', cell: p => p.items.map(i => `${i.sku}: ${i.batchCode} (${i.requestedQuantity} carton)`).join('; ') },
        ]} /></>}
        {reason === 'Transfer' && <>{batches.isError && <p role="alert">{errorMessage(batches.error)}</p>}<SimpleTable paginate rows={(batches.data ?? []).filter(b => b.availableQuantity > 0 && b.expiryStatus !== 'Expired')} columns={[
          { header: 'SKU / lô hàng / HSD', cell: b => `${b.sku} · ${b.batchCode} · ${formatDate(b.expirationDate)}` },
          { header: 'Khả dụng', cell: b => b.availableQuantity },
          { header: 'Thùng chuyển', cell: b => <input aria-label={`Số thùng ${b.batchCode}`} type="number" min={0} max={b.availableQuantity} step={1} value={transferLines.find(l => l.batchId === b.batchId)?.quantity ?? 0} onChange={e => setTransferLines([...transferLines.filter(l => l.batchId !== b.batchId), ...(Number(e.target.value) > 0 ? [{ batchId: b.batchId, quantity: Number(e.target.value) }] : [])])} /> },
        ]} /></>}
        <div className="row-wrap" style={{ gap: 12, marginTop: 12 }}><label>Ghi chú <input value={note} onChange={e => setNote(e.target.value)} /></label><button className="btn btn-primary" disabled={busy || !wh || (reason === 'Order' ? !orderIds.length : !transferLines.length || !destination || destination === wh)}>{screen.create}</button><Link className="btn" to={screen.path}>Hủy</Link></div>
      </form>
    </Card>}
    {workflow !== 'trace' && !selected && !creating && (
      (isInbound && activeTab === 'history') ? (
        <Card title={operationReason === 'Transfer' ? 'Danh sách Phiếu Nhập Luân Chuyển (PNK)' : 'Danh sách Phiếu Nhập Kho (PNK)'}>
          <p className="muted">{visibleRows.length} chứng từ · Danh sách các phiếu nhập kho đã ghi nhận tồn. Chọn mã PNK để xem chi tiết hoặc in phiếu.</p>
          {/* Factory receipts: one row per dispatch note (older per-pallet PNKs of the same note shown together). */}
          {operationReason === 'Factory' ? <QueryState query={docs}>{() => <FactoryReceiptHistory
            rows={groupHistoryRows(visibleRows, workflowRows, receiptGroups.data)}
            whName={whName}
            statusText={s => filterStatuses[s] ?? statuses[s] ?? s}
            onOpen={id => { setSelected(id); setError(''); }} />}</QueryState>
            : <QueryState query={docs}>{() => <SimpleTable paginate rows={visibleRows} onRowClick={w => { setSelected(w.document.id); setError(''); }} columns={[
              { header: 'Phiếu nhập / ngày lập', width: '320px', cell: w => <div><b className="warehouse-pallet-code">{w.document.code}</b><div className="muted">{formatInstantDateTime(w.document.createdAt)}</div></div> },
              { header: 'Loại chứng từ', width: '250px', cell: w => documentTypeLabel(w.document.kind, w.document.reason) },
              { header: 'Kho nhận', width: '220px', cell: w => `${whName(w.document.warehouseId)}${w.document.destinationWarehouseId && w.document.destinationWarehouseId !== w.document.warehouseId ? ' → ' + whName(w.document.destinationWarehouseId) : ''}` },
              // Receipts are not tied to sales orders, so only the carton count is shown.
              { header: 'Số thùng', width: '130px', cell: w => `${w.lines.reduce((s, l) => s + l.quantity, 0)} carton` },
              { header: 'Trạng thái', width: '150px', cell: w => <span className={`chip ${w.document.status === 'Posted' ? 'chip-ok' : ''}`}>{filterStatuses[w.document.status] ?? statuses[w.document.status] ?? w.document.status}</span> },
            ]} empty="Không có chứng từ phù hợp." />}</QueryState>}
        </Card>
      ) : (isOutbound && activeTab === 'history') ? (
        <>
          <AdvancedFilterCard>
            <label className="lbl">Tìm chứng từ<input className="inp" value={search} onChange={e => setSearch(e.target.value)} placeholder="Mã PXK, đơn hàng, SKU hoặc mã lô" /></label>
            <label className="lbl">Trạng thái<select className="inp" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(filterStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="lbl">Lọc theo kho<select className="inp" value={warehouseFilter} onChange={e => setWarehouseFilter(e.target.value)}><option value="">Tất cả kho</option>{warehouses.data?.filter(w => admin || user?.scope?.warehouseIds.includes(w.id)).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
          </AdvancedFilterCard>
          <Card title={operationReason === 'Transfer' ? 'Danh sách Phiếu Xuất Luân Chuyển (PXK)' : 'Danh sách Phiếu Xuất Kho (PXK)'}>
            <p className="muted">{visibleRows.length} chứng từ · Danh sách các phiếu xuất kho đã ghi sổ trừ tồn và bàn giao vận chuyển. Chọn mã PXK để xem chi tiết hoặc in phiếu.</p>
            <QueryState query={docs}>{() => <SimpleTable paginate rows={visibleRows} onRowClick={w => { setSelected(w.document.id); setError(''); }} columns={[
              { header: 'Phiếu xuất / ngày lập', width: '320px', cell: w => <div><b className="warehouse-pallet-code">{w.document.code}</b><div className="muted">{formatInstantDateTime(w.document.createdAt)}</div></div> },
              { header: 'Loại chứng từ', width: '250px', cell: w => documentTypeLabel(w.document.kind, w.document.reason) },
              { header: 'Kho xuất', width: '220px', cell: w => `${whName(w.document.warehouseId)}${w.document.destinationWarehouseId && w.document.destinationWarehouseId !== w.document.warehouseId ? ' → ' + whName(w.document.destinationWarehouseId) : ''}` },
              { header: 'Số thùng', width: '130px', cell: w => `${w.lines.reduce((s, l) => s + l.quantity, 0)} carton` },
              { header: 'Trạng thái', width: '150px', cell: w => <span className={`chip ${w.document.status === 'Posted' ? 'chip-ok' : ''}`}>{filterStatuses[w.document.status] ?? statuses[w.document.status] ?? w.document.status}</span> },
            ]} empty="Không có phiếu xuất kho phù hợp." />}</QueryState>
          </Card>
        </>
      ) : (isOutbound && activeTab === 'todo') ? (
        <>
          <AdvancedFilterCard>
            <label className="lbl">Tìm chứng từ<input className="inp" value={search} onChange={e => setSearch(e.target.value)} placeholder="Mã chứng từ, đơn hàng, SKU hoặc lô hàng" /></label>
            <label className="lbl">Trạng thái<select className="inp" value={stepFilter} onChange={e => setStepFilter(e.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(outboundSteps).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="lbl">Lọc theo kho<select className="inp" value={warehouseFilter} onChange={e => setWarehouseFilter(e.target.value)}><option value="">Tất cả kho</option>{warehouses.data?.filter(w => admin || user?.scope?.warehouseIds.includes(w.id)).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
            {(search || stepFilter || warehouseFilter || statusFilter) && <label className="lbl">&nbsp;<button type="button" className="btn" onClick={() => { setSearch(''); setStepFilter(''); setWarehouseFilter(''); setStatusFilter(''); }}>Xóa bộ lọc</button></label>}
          </AdvancedFilterCard>
          <Card title={operationReason === 'Transfer' ? 'Danh sách Lệnh Xuất Luân Chuyển Cần Soạn' : 'Danh sách Lệnh Xuất & Soạn Hàng'}>
            <p className="muted">{pendingOutboundRows.length} yêu cầu cần xuất · Mỗi dòng đại diện cho 1 lệnh xuất hàng. Bắt đầu hoặc tiếp tục soạn hàng theo thứ tự FEFO.</p>
            <QueryState query={docs}>{() => <SimpleTable paginate resetPageKey={[search, stepFilter, warehouseFilter, statusFilter, operationReason].join('|')} rows={pendingOutboundRows} onRowClick={w => { setSelected(w.document.id); setError(''); }} columns={[
              { header: 'Chứng từ / ngày lập', width: '300px', cell: w => <div><b className="warehouse-pallet-code">{w.document.code}</b><div className="muted">{formatInstantDateTime(w.document.createdAt)}</div></div> },
              { header: 'Loại chứng từ', width: '220px', cell: w => documentTypeLabel(w.document.kind, w.document.reason) },
              { header: 'Kho', width: '200px', cell: w => `${whName(w.document.warehouseId)}${w.document.destinationWarehouseId && w.document.destinationWarehouseId !== w.document.warehouseId ? ' → ' + whName(w.document.destinationWarehouseId) : ''}` },
              { header: 'Số thùng', width: '130px', cell: w => `${w.lines.reduce((s, l) => s + l.quantity, 0)} carton` },
              {
                header: 'Trạng thái', width: '160px', cell: w => {
                  if (w.document.kind === 'Request') return <span className="chip chip-warn">{outboundSteps.Request}</span>;
                  if (w.document.kind === 'Picking') return <span className="chip chip-info">{outboundSteps.Picking}</span>;
                  if (w.document.kind === 'Issue') return <span className="chip chip-warning">{outboundSteps.Issue}</span>;
                  return <span className="chip">{filterStatuses[w.document.status] ?? statuses[w.document.status] ?? w.document.status}</span>;
                }
              },
            ]} empty="Không có chứng từ cần xuất kho." />}</QueryState>
          </Card>
        </>
      ) : workflow === 'transfer' ? (
        <>
          <AdvancedFilterCard>
            <label className="lbl">Tìm lệnh điều chuyển<input className="inp" value={search} onChange={e => setSearch(e.target.value)} placeholder="Mã lệnh, SKU hoặc lô hàng" /></label>
            <label className="lbl">Trạng thái<select className="inp" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(filterStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="lbl">Lọc theo kho<select className="inp" value={warehouseFilter} onChange={e => setWarehouseFilter(e.target.value)}><option value="">Tất cả kho</option>{warehouses.data?.filter(w => admin || user?.scope?.warehouseIds.includes(w.id)).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
          </AdvancedFilterCard>
          <Card title="Danh sách lệnh điều chuyển kho">
            <p className="muted">{visibleRows.length} lệnh điều chuyển · Chọn mã lệnh để xem và xử lý.</p>
            <QueryState query={docs}>{() => <SimpleTable paginate rows={visibleRows} onRowClick={w => { setSelected(w.document.id); setError(''); }} columns={[
              { header: 'Lệnh điều chuyển / ngày lập', width: '320px', cell: w => <div><b className="warehouse-pallet-code">{w.document.code}</b><div className="muted">{formatInstantDateTime(w.document.createdAt)}</div></div> },
              { header: 'Kho', width: '220px', cell: w => `${whName(w.document.warehouseId)}${w.document.destinationWarehouseId && w.document.destinationWarehouseId !== w.document.warehouseId ? ' → ' + whName(w.document.destinationWarehouseId) : ''}` },
              { header: 'Số thùng', width: '130px', cell: w => `${w.lines.reduce((s, l) => s + l.quantity, 0)} carton` },
              { header: 'Trạng thái', width: '150px', cell: w => filterStatuses[w.document.status] ?? statuses[w.document.status] ?? w.document.status },
            ]} empty="Không có chứng từ phù hợp." />}</QueryState>
          </Card>
        </>
      ) : null
    )}
    {selected && <QueryState query={docs}>{() => !active && <Card title="Không tìm thấy chứng từ"><p>Chứng từ không thuộc màn hình này hoặc ngoài phạm vi kho của bạn.</p><Link className="btn" to={screen.path}>Về danh sách</Link></Card>}</QueryState>}
    {active && d && <Card title={`${documentTypeLabel(d.kind, d.reason)} · ${d.code}`}>
      {d.kind === 'Receipt' ? <div className="pnk-summary-header">
        <div className="pnk-title-row">
          <div>
            <span className="badge" style={{ background: '#0284c7', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>Phiếu Nhập Kho (PNK)</span>
            <h2 style={{ margin: '6px 0 0 0' }}>{d.code}</h2>
          </div>
          <button className="btn btn-primary" onClick={() => void printLabels(false, true)}>In / Xuất PDF phiếu nhập kho</button>
        </div>
        <div className="pnk-meta-grid">
          <div className="pnk-meta-item">
            <span className="muted">Nguồn nhập</span>
            <strong>{d.reason === 'Factory' ? 'Nhà máy sản xuất (Factory Dispatch)' : 'Luân chuyển từ kho khác'}</strong>
          </div>
          <div className="pnk-meta-item">
            <span className="muted">Kho tiếp nhận</span>
            <strong>{whName(d.warehouseId)}</strong>
          </div>
          <div className="pnk-meta-item">
            <span className="muted">Trạng thái ghi sổ</span>
            <strong style={{ color: d.status === 'Posted' ? '#166534' : '#b45309' }}>{statuses[d.status] ?? d.status}</strong>
          </div>
          <div className="pnk-meta-item">
            <span className="muted">Thời gian lập phiếu</span>
            <strong>{formatInstantDateTime(d.createdAt)}</strong>
          </div>
        </div>
      </div> : d.kind === 'Issue' ? <div className="pnk-summary-header">
        <div className="pnk-title-row">
          <div>
            <span className="badge" style={{ background: '#059669', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>Phiếu Xuất Kho (PXK)</span>
            <h2 style={{ margin: '6px 0 0 0' }}>{d.code}</h2>
          </div>
          <button className="btn btn-primary" onClick={() => void printLabels(false, false, true)}>In / Xuất PDF phiếu xuất kho</button>
        </div>
        <div className="pnk-meta-grid">
          <div className="pnk-meta-item">
            <span className="muted">Loại xuất kho</span>
            <strong>{d.reason === 'Order' ? 'Xuất bán hàng (Bán lẻ / Đơn hàng)' : 'Xuất luân chuyển sang kho khác'}</strong>
          </div>
          <div className="pnk-meta-item">
            <span className="muted">Kho xuất hàng</span>
            <strong>{whName(d.warehouseId)}</strong>
          </div>
          <div className="pnk-meta-item">
            <span className="muted">Trạng thái ghi sổ</span>
            <strong style={{ color: d.status === 'Posted' ? '#166534' : '#b45309' }}>{statuses[d.status] ?? d.status}</strong>
          </div>
          <div className="pnk-meta-item">
            <span className="muted">Thời gian lập phiếu</span>
            <strong>{formatInstantDateTime(d.createdAt)}</strong>
          </div>
        </div>
      </div> : <p>{reasons[d.reason]} · {whName(d.warehouseId)}{d.destinationWarehouseId && d.destinationWarehouseId !== d.warehouseId ? ` → ${whName(d.destinationWarehouseId)}` : ''} · {statuses[d.status]} · {formatInstantDateTime(d.createdAt)}</p>}
      {d.sourceDocumentId && <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 12px 0' }}>
        <span className="muted" style={{ fontWeight: 600 }}>Chứng từ nguồn (Lệnh gốc):</span>
        <button type="button" className="btn btn-sm warehouse-document-code" onClick={() => setSelected(d.sourceDocumentId!)} title="Bấm để xem chứng từ gốc ban đầu"><span>{docs.data?.find(w => w.document.id === d.sourceDocumentId)?.document.code ?? d.sourceDocumentId}</span></button>
      </div>}
      {d.note && <p className="muted" style={{ fontStyle: 'italic', margin: '4px 0 12px 0' }}>Ghi chú: {d.note}</p>}
      {d.reason === 'Factory' && d.kind === 'Receipt' && <div className="notice-banner" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
        <strong>Liên kết truy xuất nguồn gốc nhập kho:</strong>
        <p style={{ margin: '4px 0 0 0' }}>Lô SX Nhà máy (BID), Pallet đóng gói (PID), Thùng carton (CID), Phiếu Nhập Kho (PNK: <b>{d.code}</b>) và Lô kho FSCM (Batch).</p>
        <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#166534' }}>Thủ kho quét kiểm đếm từng thùng từ Pallet. Khi hoàn tất phiếu nhập, các thùng Đạt tự động được ghi tăng tồn khả dụng và gửi xác nhận (ACK) về hệ thống Traceability nhà máy.</p>
      </div>}
      {d.reason === 'Transfer' && d.kind === 'Request' && <div className="notice-banner" style={{ background: '#fff7ed', border: '1px solid #fed7aa', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
        <strong>Lệnh điều chuyển kho do Quản trị viên lập:</strong>
        <p style={{ margin: '4px 0 0 0' }}>Kho gửi <b>{whName(d.warehouseId)}</b> chịu trách nhiệm xuất hàng đến kho nhận <b>{whName(d.destinationWarehouseId)}</b>. Thủ kho gửi bấm "Bắt đầu xuất luân chuyển & quét" để tạo phiếu xuất và quét từng thùng.</p>
      </div>}
      {d.reason === 'Transfer' && d.kind === 'Issue' && ['Open', 'Prepared'].includes(d.status) && <div className="notice-banner" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
        <strong>Phiếu xuất luân chuyển tại kho gửi:</strong>
        <p style={{ margin: '4px 0 0 0' }}>Thủ kho gửi quét mã thùng thực tế để đối chiếu. Sau khi quét đủ, bấm "Xác nhận xuất và ghi sổ PXK" để trừ tồn kho gửi và chuyển hàng đi.</p>
      </div>}
      {d.reason === 'Transfer' && d.kind === 'Issue' && d.status === 'Posted' && <div className="notice-banner" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
        <strong>Kho gửi đã xuất hàng thành công:</strong>
        <p style={{ margin: '4px 0 0 0' }}>Hàng đang trong quá trình luân chuyển đến kho nhận <b>{whName(d.destinationWarehouseId)}</b>. Thủ kho nhận sẽ mở phiếu nhập để kiểm đếm thực nhận.</p>
      </div>}
      {d.reason === 'Transfer' && d.kind === 'Receipt' && d.status === 'Open' && <div className="notice-banner" style={{ background: '#fdf4ff', border: '1px solid #f5d0fe', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
        <strong>Phiếu nhập luân chuyển tại kho nhận:</strong>
        <p style={{ margin: '4px 0 0 0' }}>Thủ kho nhận quét từng thùng carton thực tế khi hàng đến. Sau khi quét đủ và kiểm đếm, xác nhận nhập kho để ghi tăng tồn kho nhận.</p>
      </div>}
      {d.reason === 'Transfer' && d.kind === 'Receipt' && d.status === 'Posted' && <div className="notice-banner" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
        <strong>Đã hoàn tất nhập kho luân chuyển:</strong>
        <p style={{ margin: '4px 0 0 0' }}>Tồn kho nhận <b>{whName(d.warehouseId)}</b> đã được ghi tăng theo số thùng thực nhận.</p>
      </div>}
      {d.reason !== 'Factory' && d.kind !== 'Receipt' && <><h3 style={{ marginBottom: 10 }}>Tổng hợp lấy hàng theo SKU / batch</h3>
        <SimpleTable rows={Object.values(active.lines.reduce<Record<string, { sku: string; batch: string; expiry: string; required: number; scanned: number }>>((result, line) => {
          const key = `${line.sku}:${line.batchCode ?? line.sourceLotCode}:${line.expirationDate}`;
          const row = result[key] ??= { sku: line.sku, batch: line.batchCode ?? line.sourceLotCode ?? 'Chờ nhập', expiry: line.expirationDate, required: 0, scanned: 0 };
          row.required += line.quantity; row.scanned += active.cartons.filter(c => c.lineId === line.id && c.scannedAt).length;
          return result;
        }, {})).sort((a, b) => a.expiry.localeCompare(b.expiry))} columns={[
          { header: 'SKU', cell: r => r.sku }, { header: 'Lô hàng cần lấy', cell: r => r.batch }, { header: 'HSD', cell: r => formatDate(r.expiry) },
          { header: 'Tổng thùng', cell: r => r.required }, { header: 'Đã quét', cell: r => r.scanned }, { header: 'Còn lấy', cell: r => r.required - r.scanned },
        ]} /></>}
      {canCreate && d.kind === 'Request' && d.status === 'Open' && <button className="btn" disabled={busy} onClick={() => void act(`${base}/${d.id}/cancel`, { expectedVersion: d.version })}>Hủy lệnh chưa lấy hàng</button>}
      {canCreateChild && <button className="btn btn-primary" disabled={busy} onClick={() => void act(`${base}/${d.id}/create-document`, undefined, true)}>{d.kind === 'Request' ? (d.reason === 'Transfer' ? 'Bắt đầu xuất luân chuyển & quét' : 'Bắt đầu xuất kho & quét') : 'Bắt đầu nhập luân chuyển & quét'}</button>}
      {active.lines.length > 0 && !(d.kind === 'Receipt' && d.reason === 'Transfer') && <SimpleTable paginate rows={active.lines} columns={[
        // Receipts are not tied to sales orders: the "Đơn hàng" column only applies to issue documents.
        ...(d.kind === 'Receipt' ? [] : [{ header: 'Đơn hàng', cell: (l: typeof active.lines[number]) => l.orderCode ?? '—' }]),
        { header: 'SKU / sản phẩm', cell: l => `${l.sku} · ${l.productName}` },
        { header: 'Mã tồn / lô hàng nhà máy', cell: l => [l.batchCode, l.sourceLotCode].filter(Boolean).join(' · ') || 'Chờ nhập' }, { header: 'HSD', cell: l => formatDate(l.expirationDate) },
        { header: 'Số thùng', cell: l => l.quantity }, { header: 'Đã quét', cell: l => active.cartons.filter(c => c.lineId === l.id && c.scannedAt).length },
      ]} />}
      {d.kind !== 'Request' && <>
        {d.reason === 'Factory' && <>
          <p>Kho nhận cố định: <b>{whName(d.warehouseId)}</b> · Theo chỉ định của nhà máy.</p>
          <PalletReceiving key={d.id + legacyPalletOf(d.id)}
            initialCode={legacyPalletOf(d.id)}
            documentId={d.id} version={d.version} receivedCount={active.cartons.length} editable={d.status === 'Open'} />
        </>}{d.reason !== 'Factory' && <>{d.kind === 'Receipt' && <><p>Kho nhận cố định: <b>{whName(d.warehouseId)}</b> · Theo phiếu xuất luân chuyển.</p><h3>Kiểm đếm thùng luân chuyển</h3><p>Quét mã thùng thực tế để ghi nhận kiểm đếm. Khi quét đủ, hoàn tất phiếu để ghi tăng tồn kho.</p></>}<p>Tiến độ: {active.cartons.filter(c => c.scannedAt).length} / {active.lines.reduce((s, l) => s + l.quantity, 0)} thùng. Mỗi mã QR đại diện một thùng chứa một SKU.</p></>}
        {(d.kind === 'Picking' || d.kind === 'Issue') && d.status === 'Open' && active.lines.some(l => !l.sourceLotCode?.startsWith('BID-')) && <div className="row-wrap" style={{ gap: 12 }}><button className="btn" disabled={busy} onClick={() => void act(`${base}/${d.id}/prepare-cartons`)}>Chuẩn bị nhãn một thùng cho hàng tồn</button><button className="btn" onClick={() => void printLabels(true)}>Mở nhãn hàng tồn để in</button><span className="muted">Dán nhãn mới lên từng thùng; nhãn gộp cũ sau khi tách sẽ hết hiệu lực.</span></div>}{active.cartons.length > 0 && d.reason !== 'Factory' && d.kind !== 'Receipt' && <button className="btn" style={{ marginBottom: 12 }} onClick={() => void printLabels()}>In nhãn QR thùng</button>}
        {d.reason === 'Transfer' && d.kind === 'Receipt' && d.status === 'Open' && <>
          <PalletCamera target="thùng" disabled={busy} onScan={async code => { await act(`${base}/${d.id}/scans`, { cartonId: code.trim(), expectedVersion: d.version }); }} />
          <div className="pallet-receiving-actions"><button type="button" className="btn btn-primary" disabled={busy || active.cartons.length === 0 || active.cartons.filter(c => c.scannedAt).length !== active.lines.reduce((s, l) => s + l.quantity, 0)} onClick={() => void act(`${base}/${d.id}/post`, { expectedVersion: d.version })}>Hoàn tất &amp; Thực hiện nhập kho</button></div>
        </>}
        {d.reason !== 'Factory' && d.kind !== 'Receipt' && (d.status === 'Open' || d.status === 'Prepared') && <form onSubmit={e => { e.preventDefault(); if (scan.trim()) void act(`${base}/${d.id}/scans`, { cartonId: scan.trim(), expectedVersion: d.version }); }} className="row-wrap" style={{ gap: 12, margin: '14px 0' }}>
          <label>Quét mã thùng <input ref={scanInput} autoComplete="off" value={scan} onChange={e => setScan(e.target.value)} placeholder="Quét QR bằng máy đọc rồi nhấn phím xác nhận" disabled={busy} /></label>
          <button className="btn" disabled={busy || !scan.trim() || d.status !== 'Open'}>Ghi nhận thùng</button>
          <button type="button" className="btn btn-primary" disabled={busy || active.cartons.length === 0 || active.cartons.filter(c => c.scannedAt).length !== active.lines.reduce((s, l) => s + l.quantity, 0)} onClick={() => void act(`${base}/${d.id}/post`, { expectedVersion: d.version })}>Xác nhận xuất và ghi sổ PXK</button>
        </form>}
        {cartonEdit?.documentId === d.id && (d.kind === 'Picking' || d.kind === 'Issue') && ['Open', 'Prepared'].includes(d.status) && <form aria-label="Sửa thùng đang soạn" onSubmit={e => {
          e.preventDefault();
          if (!cartonEdit.reason.trim() || cartonEdit.replace && !cartonEdit.replacementCode.trim()) return;
          void act(`${base}/${d.id}/remove-carton`, {
            cartonCode: cartonEdit.cartonCode, reason: cartonEdit.reason.trim(), expectedVersion: d.version,
            ...(cartonEdit.replace ? { replacementCode: cartonEdit.replacementCode.trim() } : {})
          });
        }}>
          <p>{cartonEdit.replace ? 'Đổi' : 'Bỏ'} thùng: {cartonEdit.cartonCode}</p>
          {cartonEdit.replace && <label>CID thay thế cùng lô hàng <input required disabled={busy} value={cartonEdit.replacementCode} onChange={e => setCartonEdit({ ...cartonEdit, replacementCode: e.target.value })} /></label>}
          <label>Lý do sửa thùng <input required disabled={busy} value={cartonEdit.reason} onChange={e => setCartonEdit({ ...cartonEdit, reason: e.target.value })} /></label>
          <button className="btn" disabled={busy}>Xác nhận sửa thùng</button>
          <button className="btn" type="button" disabled={busy} onClick={() => setCartonEdit(null)}>Hủy sửa thùng</button>
        </form>}
        {(d.reason !== 'Factory' || active.cartons.length > 0) && <><h3 className={d.kind === 'Receipt' ? 'pallet-receiving-history' : undefined} style={{ marginBottom: 10 }}>{d.kind === 'Receipt' ? 'Lịch sử quét thùng trên phiếu' : 'Danh sách thùng'}</h3><SimpleTable paginate rows={d.kind === 'Receipt' ? active.cartons.filter(c => c.scannedAt) : active.cartons} columns={[
          { header: 'Mã thùng / QR', cell: c => c.cartonId },
          ...(d.kind === 'Receipt' ? [] : [{
            header: 'Sửa khi đang soạn', cell: (c: Carton) => (d.kind === 'Picking' || d.kind === 'Issue') && ['Open', 'Prepared'].includes(d.status) ? <div className="row-wrap">
              <button className="btn btn-sm" disabled={busy} onClick={() => setCartonEdit({ documentId: d.id, cartonCode: c.cartonId, replace: false, replacementCode: '', reason: '' })}>Bỏ thùng</button>
              <button className="btn btn-sm" disabled={busy} onClick={() => setCartonEdit({ documentId: d.id, cartonCode: c.cartonId, replace: true, replacementCode: '', reason: '' })}>Đổi thùng</button>
            </div> : 'Đã khóa / không áp dụng'
          }]), { header: 'Pallet gốc / sản phẩm trong thùng', cell: c => { const m = active.pallets?.find(p => p.cartonCode === c.cartonId); return m ? `${m.palletCode} · ${m.unitsPerCarton} sản phẩm` : 'Hàng tồn cũ'; } }, { header: 'SKU', cell: c => active.lines.find(l => l.id === c.lineId)?.sku },
          { header: 'Quét lúc', cell: c => c.scannedAt ? formatInstantDateTime(c.scannedAt) : 'Chờ quét' },
        ]} /></>}
      </>}
    </Card>}
  </>;
}
