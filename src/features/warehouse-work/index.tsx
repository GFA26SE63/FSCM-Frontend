import { PalletReceiving } from "./PalletReceiving";
import { FactoryPending, type FactoryInboundPallet } from './FactoryPending';
import './warehouse-work.css';
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/shared/auth/AuthContext';
import { get, http } from '@/shared/api/http';
import { errorMessage } from '@/shared/api/errors';
import { Card, PageHeader, QueryState, SimpleTable } from '@/shared/ui';
import { receiptApi } from '@/features/receipts/api';
import { pickingApi } from '@/features/runpicking/api';
import type { BatchInventoryItem } from '@/features/batches/types';
import { Link, Redirect, useHistory, useLocation, useParams } from 'react-router-dom';
import { TraceLookup } from '@/features/factory-traceability';
import { formatDate, formatInstantDateTime } from '@/shared/lib/dates';
import { belongsToWorkflow, warehouseDocumentPath, warehouseScreens, type WarehouseWorkflow } from './workflow';
import { useStringParam } from '@/shared/router/listState';

interface Document { id: string; code: string; kind: 'Request' | 'Picking' | 'Issue' | 'Receipt'; reason: 'Transfer' | 'Order' | 'Factory'; warehouseId: string; destinationWarehouseId: string | null; sourceDocumentId: string | null; status: string; version: number; note: string | null; createdAt: string }
interface Line { id: string; sku: string; productName: string; batchCode: string | null; sourceLotCode: string | null; orderCode: string | null; quantity: number; expirationDate: string }
interface Carton { id: string; cartonId: string; lineId: string; scannedAt: string | null }
interface Work { document: Document; lines: Line[]; cartons: Carton[]; pallets?: { palletCode: string; cartonCode: string; unitsPerCarton: number }[] }
const kinds = { Request: 'Yêu cầu kho', Picking: 'Phiếu soạn hàng', Issue: 'Phiếu xuất kho', Receipt: 'Phiếu nhập kho' };
const reasons = { Transfer: 'Luân chuyển kho', Order: 'Xuất cho đơn hàng', Factory: 'Nhận từ nhà máy' };
const statuses: Record<string, string> = { Open: 'Chờ thực hiện', Prepared: 'Đã soạn đủ · chờ xuất', Posted: 'Đã ghi sổ', Fulfilled: 'Đã thực hiện', Cancelled: 'Đã hủy' };
const inboundStatuses: Record<string, string> = { Open: 'Chờ thực hiện', Posted: 'Đã ghi sổ', Cancelled: 'Đã hủy' };
const receiptsStatuses: Record<string, string> = { Posted: 'Đã ghi sổ', Cancelled: 'Đã hủy' };
const issuesStatuses: Record<string, string> = { Posted: 'Đã ghi sổ', Cancelled: 'Đã hủy' };
const outboundStatuses: Record<string, string> = { Open: 'Chờ thực hiện', Prepared: 'Đã soạn đủ · chờ xuất', Posted: 'Đã ghi sổ', Fulfilled: 'Đã thực hiện', Cancelled: 'Đã hủy' };

function getWorkflowStatuses(workflow: WarehouseWorkflow): Record<string, string> {
  if (workflow === 'receipts') return receiptsStatuses;
  if (workflow === 'issues') return issuesStatuses;
  if (workflow === 'inbound') return inboundStatuses;
  if (workflow === 'outbound') return outboundStatuses;
  return statuses;
}
export function documentTypeLabel(kind: string, reason: string): string {
  if (kind === 'Request' && reason === 'Transfer') return 'Lệnh điều chuyển kho (Admin)';
  if (kind === 'Issue' && reason === 'Transfer') return 'Phiếu xuất luân chuyển (Kho gửi)';
  if (kind === 'Receipt' && reason === 'Transfer') return 'Phiếu nhập luân chuyển (Kho nhận)';
  if (kind === 'Request' && reason === 'Order') return 'Lệnh xuất bán hàng (Admin)';
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
  const [filters, setFilters] = useState({ warehouseId: '', status: '', syncStatus: '', search: '', page: 1 });
  const [search, setSearch] = useState('');
  const [selectedCode, setSelectedCode] = useState('');
  const warehouses = useQuery({ queryKey: ['qr-inventory', 'warehouses'], queryFn: receiptApi.warehouses });
  const inventory = useQuery({
    queryKey: ['qr-inventory', filters],
    queryFn: () => get<QrPage>('/inventory/qr-codes', { ...filters, pageSize: 50 }),
    refetchInterval: 15000,
  });
  const detail = useQuery({
    queryKey: ['qr-inventory', 'detail', selectedCode],
    queryFn: () => get<QrDetail>(`/qr-labels/${encodeURIComponent(selectedCode)}`),
    enabled: !!selectedCode,
  });
  const changeFilter = (name: 'warehouseId' | 'status' | 'syncStatus', value: string) =>
    setFilters(current => ({ ...current, [name]: value, page: 1 }));

  return <div className="warehouse-trace-center">
    <Card title="Danh sách thùng carton trong kho (Pallet · Carton · SKU · Nhà máy)">
      <p className="muted">Tra cứu toàn diện từng thùng carton đã nhận vào hệ thống FSCM. Tìm kiếm nhanh theo mã Thùng (CID), mã Pallet (PID), mã Lô sản xuất (BID), SKU hoặc HSD.</p>
      <form className="warehouse-work-filters" onSubmit={e => { e.preventDefault(); setFilters(current => ({ ...current, search: search.trim(), page: 1 })); }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        <label>Kho <select value={filters.warehouseId} onChange={e => changeFilter('warehouseId', e.target.value)}><option value="">Tất cả kho được phép</option>{(warehouses.data ?? initialWarehouses)?.filter(w => user?.role !== 'WarehouseKeeper' || user.scope?.warehouseIds.includes(w.id)).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
        <label>Trạng thái QR <select value={filters.status} onChange={e => changeFilter('status', e.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(qrStatusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Xác nhận về nhà máy <select value={filters.syncStatus} onChange={e => changeFilter('syncStatus', e.target.value)}><option value="">Tất cả</option><option value="Pending">Chờ gửi / đang thử lại</option><option value="Synced">Đã xác nhận</option><option value="Legacy">Dữ liệu cũ chưa có xác nhận</option></select></label>
        <label>Tìm CID / PID / BID / SKU <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Quét hoặc nhập mã để tra cứu" /></label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <button className="btn btn-primary" type="submit">Tìm kiếm</button>
          <button className="btn" type="button" disabled={inventory.isFetching} onClick={() => { void inventory.refetch(); if (selectedCode) void detail.refetch(); }}>Làm mới</button>
        </div>
      </form>

      <QueryState query={inventory}>{data => <>
        <p className="muted">{data.totalCount} thùng carton khớp bộ lọc · Trang {data.page}</p>
        <SimpleTable rows={data.items} columns={[
          { header: 'Thùng carton (CID)', width: '220px', cell: r => <button className="btn btn-sm inventory-code" aria-label={`Xem chi tiết carton ${r.cartonCode}`} onClick={() => setSelectedCode(r.cartonCode)}><span>{r.cartonCode}</span></button> },
          { header: 'Pallet gốc (PID)', width: '180px', cell: r => <b className="warehouse-pallet-code">{r.palletCode}</b> },
          { header: 'Lô SX nhà máy (BID)', width: '180px', cell: r => <span className="muted">{r.productionBatchCode}</span> },
          { header: 'SKU & Sản phẩm', width: '220px', cell: r => <>{r.sku} · {r.productName}<div className="muted">{r.unitsPerCarton} sản phẩm/thùng</div></> },
          { header: 'NSX / HSD', width: '150px', cell: r => <>{formatDate(r.productionDate)}<br />{formatDate(r.expirationDate)}</> },
          { header: 'Kho hiện tại / Lô kho', width: '220px', cell: r => <>{r.warehouseCode} · {r.warehouseName}<br /><Link to={`/batches/${encodeURIComponent(r.stockBatchId)}`}>{r.stockBatchCode}</Link></> },
          { header: 'Trạng thái QR', width: '130px', cell: r => <span className="chip">{qrStatusLabels[r.status] ?? r.status}</span> },
          { header: 'Phiếu nhập (PNK)', width: '220px', cell: r => r.receiptCode ? <Link to={`/warehouse-inbound/${encodeURIComponent(r.receiptCode)}`} style={{ fontWeight: 600 }}>{r.receiptCode}</Link> : <span className="muted">Dữ liệu cũ</span> },
          { header: 'Đồng bộ Nhà máy', width: '170px', cell: r => r.syncedAt ? <span style={{ color: '#166534' }}>Đã xác nhận</span> : r.hasAcknowledgement ? <span style={{ color: '#b45309' }}>Chờ gửi ACK</span> : <span className="muted">—</span> },
        ]} empty="Chưa có thùng carton nào khớp với bộ lọc." />

        <div className="row-wrap" style={{ gap: 12, marginTop: 16 }}>
          <button className="btn" disabled={inventory.isFetching || data.page <= 1} onClick={() => setFilters(current => ({ ...current, page: current.page - 1 }))}>Trang trước</button>
          <button className="btn" disabled={inventory.isFetching || data.page * data.pageSize >= data.totalCount} onClick={() => setFilters(current => ({ ...current, page: current.page + 1 }))}>Trang sau</button>
        </div>
      </>}</QueryState>
    </Card>

    <details style={{ marginTop: 16 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600, padding: '8px 0' }}>🔍 Tra cứu nguồn gốc theo mã bất kỳ (BID / PID / CID / UID)</summary>
      <div style={{ marginTop: 12 }}>
        <TraceLookup />
      </div>
    </details>

    {selectedCode && <Card title={`Chi tiết truy xuất thùng carton · ${selectedCode}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <strong>Lịch sử & Vòng đời QR</strong>
        <button className="btn btn-sm" onClick={() => setSelectedCode('')}>Đóng chi tiết</button>
      </div>
      <QueryState query={detail}>{data => <>
        <p>{data.label.sku} · Kho: {data.label.warehouseCode} · Trạng thái: {qrStatusLabels[data.label.status] ?? data.label.status}</p>
        <SimpleTable rows={data.events} columns={[
          { header: 'Thời gian', cell: e => formatInstantDateTime(e.occurredAt) },
          { header: 'Kho / sự kiện', cell: e => `${e.warehouseCode} · ${e.eventType}` },
          { header: 'Trạng thái', cell: e => `${qrStatusLabels[e.fromStatus] ?? e.fromStatus} → ${qrStatusLabels[e.toStatus] ?? e.toStatus}` },
          { header: 'Chứng từ', cell: e => e.referenceCode ? (e.referenceCode.startsWith('PNK-') || e.referenceCode.startsWith('WH-REC-') ? <Link to={`/warehouse-inbound/${encodeURIComponent(e.referenceCode)}`}>{e.referenceCode}</Link> : e.referenceCode) : '—' },
        ]} />
      </>}</QueryState>
      <TraceLookup key={selectedCode} initialCode={selectedCode} />
    </Card>}
  </div>;
}

export function WarehouseOperationsPage({ workflow }: { workflow: WarehouseWorkflow }) {
  const history = useHistory();
  const location = useLocation();
  const screen = warehouseScreens[workflow];
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
  const [search, setSearch] = useStringParam('q');
  const [statusFilter, setStatusFilter] = useStringParam('status');
  const [warehouseFilter, setWarehouseFilter] = useStringParam('warehouse');
  const [operationSource, setOperationSource] = useStringParam('source');
  const [tab, setTab] = useStringParam('tab');
  const operationReason = operationSource === 'Transfer' ? 'Transfer' : (workflow === 'inbound' || workflow === 'receipts') ? 'Factory' : 'Order';
  const [cartonEdit, setCartonEdit] = useState<{ documentId: string; cartonCode: string; replace: boolean; replacementCode: string; reason: string } | null>(null);
  const scanInput = useRef<HTMLInputElement>(null);
  const operation = useRef<{ fingerprint: string; key: string } | null>(null);
  const inFlight = useRef(false);
  const docs = useQuery({ queryKey: ['warehouse-documents'], queryFn: () => get<Work[]>(base) });
  const incoming = useQuery({ queryKey: ['factory-pending'], queryFn: () => get<FactoryInboundPallet[]>(`${base}/factory-pending`), enabled: workflow === 'inbound' });
  const warehouses = useQuery({ queryKey: ['warehouse-work', 'warehouses'], queryFn: receiptApi.warehouses });
  const pickings = useQuery({ queryKey: ['warehouse-work', 'picking', wh], queryFn: () => pickingApi.lists(wh), enabled: admin && workflow === 'outbound' && creating && !!wh });
  const batches = useQuery({ queryKey: ['warehouse-work', 'batches', wh], queryFn: () => get<BatchInventoryItem[]>('/inventory', { warehouseId: wh }), enabled: admin && creating && !!wh && reason === 'Transfer' });
  const active = docs.data?.find(x => (x.document.id === selected || x.document.code === selected) && belongsToWorkflow(x.document, workflow));
  const canCreate = admin && (workflow === 'outbound' && operationReason === 'Order' || workflow === 'transfer');
  const executionWarehouses = warehouses.data?.filter(w => w.isActive &&
    (admin || user?.scope?.warehouseIds.includes(w.id)));
  const whName = (id: string | null) => warehouses.data?.find(w => w.id === id)?.name ?? id ?? '—';
  const setSelected = (id: string) => {
    const work = docs.data?.find(w => w.document.id === id);
    if (work) {
      if (workflow === 'receipts') history.push(`/warehouse-receipts/${encodeURIComponent(work.document.id)}`);
      else if (workflow === 'issues') history.push(`/warehouse-issues/${encodeURIComponent(work.document.id)}`);
      else history.push(warehouseDocumentPath(work.document));
    }
  };
  const isInbound = workflow === 'inbound' || workflow === 'receipts';
  const isOutbound = workflow === 'outbound' || workflow === 'issues';
  const isHistoryWorkflow = workflow === 'receipts' || workflow === 'issues';
  const activeTab = tab ? tab : (isHistoryWorkflow ? 'history' : 'todo');

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
  const transferArrivals = (docs.data ?? []).filter(w => w.document.reason === 'Transfer' && w.document.kind === 'Issue' && w.document.status === 'Posted'
    && (admin || user?.scope?.warehouseIds.includes(w.document.destinationWarehouseId ?? ''))
    && !docs.data?.some(r => r.document.kind === 'Receipt' && r.document.sourceDocumentId === w.document.id));
  const visibleRows = workflowRows.filter(w => {
    const text = [w.document.code, w.document.note, ...w.lines.flatMap(l => [l.sku, l.batchCode, l.orderCode])].join(' ').toLocaleLowerCase('vi');
    return (!search.trim() || text.includes(search.trim().toLocaleLowerCase('vi')))
      && (!statusFilter || w.document.status === statusFilter)
      && (!warehouseFilter || [w.document.warehouseId, w.document.destinationWarehouseId].includes(warehouseFilter));
  });
  const pendingOutboundRows = visibleRows.filter(w => {
    if (w.document.kind === 'Issue' && w.document.status === 'Posted') return false;
    if (w.document.kind === 'Request' && docs.data?.some(child => child.document.sourceDocumentId === w.document.id)) {
      return false;
    }
    return true;
  });
  const inProgressReceipts = visibleRows.filter(w => w.document.kind === 'Receipt' && w.document.status !== 'Posted');
  const filterStatuses = getWorkflowStatuses(workflow);
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
  const canCreateChild = d && !admin && ((d.kind === 'Request' && d.status === 'Open') || (d.kind === 'Issue' && d.reason === 'Transfer' && d.status === 'Posted')) && !docs.data?.some(x => x.document.sourceDocumentId === d.id);
  return <>
    <PageHeader title={selected ? `Chi tiết ${screen.title.toLocaleLowerCase('vi')}` : creating ? screen.create : screen.title} subtitle={screen.description}
      back={selected || creating ? screen.path + (d?.reason === 'Transfer' && workflow !== 'transfer' ? '?source=Transfer' : '') : undefined}
      actions={!selected && !creating && canCreate ? <Link className="btn btn-primary" to={`${screen.path}/new`}>{screen.create}</Link> : undefined} />
    {!selected && !creating && (isInbound || isOutbound) && <div className="warehouse-main-tabs" role="tablist" style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '2px solid var(--border, #e2e8f0)', paddingBottom: 12 }}>
      {isInbound ? <>
        <button type="button" role="tab" aria-selected={activeTab === 'todo'} className={`btn ${activeTab === 'todo' ? 'btn-primary' : ''}`} onClick={() => { setTab(''); setStatusFilter(''); }} style={{ fontWeight: 600, padding: '8px 18px', fontSize: 14 }}>📥 Cần tiếp nhận & Kiểm đếm</button>
        <button type="button" role="tab" aria-selected={activeTab === 'history'} className={`btn ${activeTab === 'history' ? 'btn-primary' : ''}`} onClick={() => { setTab('history'); setStatusFilter(''); }} style={{ fontWeight: 600, padding: '8px 18px', fontSize: 14 }}>📋 Lịch sử Phiếu Nhập Kho (PNK)</button>
      </> : <>
        <button type="button" role="tab" aria-selected={activeTab === 'todo'} className={`btn ${activeTab === 'todo' ? 'btn-primary' : ''}`} onClick={() => { setTab(''); setStatusFilter(''); }} style={{ fontWeight: 600, padding: '8px 18px', fontSize: 14 }}>📦 Cần xuất & Soạn hàng</button>
        <button type="button" role="tab" aria-selected={activeTab === 'history'} className={`btn ${activeTab === 'history' ? 'btn-primary' : ''}`} onClick={() => { setTab('history'); setStatusFilter(''); }} style={{ fontWeight: 600, padding: '8px 18px', fontSize: 14 }}>📋 Lịch sử Phiếu Xuất Kho (PXK)</button>
      </>}
    </div>}

    {!selected && !creating && (isInbound || isOutbound) && <div className="row-wrap" role="group" aria-label="Loại nghiệp vụ kho" style={{ gap: 12, marginBottom: 16 }}>
      <button type="button" className={`btn ${operationReason !== 'Transfer' ? 'btn-primary' : ''}`} aria-pressed={operationReason !== 'Transfer'} onClick={() => setOperationSource('')}>{isOutbound ? (activeTab === 'history' ? 'Phiếu xuất bán hàng' : 'Xuất bán hàng') : (activeTab === 'history' ? 'Phiếu nhập từ nhà máy' : 'Nhập từ nhà máy')}</button>
      <button type="button" className={`btn ${operationReason === 'Transfer' ? 'btn-primary' : ''}`} aria-pressed={operationReason === 'Transfer'} onClick={() => setOperationSource('Transfer')}>{isOutbound ? (activeTab === 'history' ? 'Phiếu xuất luân chuyển' : 'Xuất luân chuyển') : (activeTab === 'history' ? 'Phiếu nhập luân chuyển' : 'Nhập luân chuyển')}</button>
    </div>}
    {workflow === 'trace' && <WarehouseTraceCenter warehouses={warehouses.data ?? []} docs={docs} setSelected={setSelected} />}
    {error && <p role="alert" className="danger">{error}</p>}{notice && <p role="status">{notice}</p>}
    {!selected && !creating && isInbound && activeTab === 'todo' && <div>
      {operationReason === 'Factory' && <div className="warehouse-guide-steps">
        <div className="warehouse-guide-step">
          <div className="step-badge">Bước 1</div>
          <div>
            <strong>Tiếp nhận Pallet (PID)</strong>
            <p>Xe nhà máy chở pallet đến kho. Chọn pallet và bấm Bắt đầu kiểm đếm để mở phiếu kiểm đếm.</p>
          </div>
        </div>
        <div className="warehouse-guide-step-arrow">➔</div>
        <div className="warehouse-guide-step">
          <div className="step-badge">Bước 2</div>
          <div>
            <strong>Kiểm đếm thùng (CID)</strong>
            <p>Quét camera hoặc mã pallet để nạp danh sách thùng carton. Phân loại Đạt, Hỏng (cách ly) hoặc Thiếu.</p>
          </div>
        </div>
        <div className="warehouse-guide-step-arrow">➔</div>
        <div className="warehouse-guide-step">
          <div className="step-badge">Bước 3</div>
          <div>
            <strong>Ghi sổ PNK & Map Lô kho</strong>
            <p>Bấm Hoàn tất & Thực hiện nhập kho. Thùng đạt tự động map vào Lô kho FSCM để bán và gửi ACK về nhà máy.</p>
          </div>
        </div>
      </div>}
      {operationReason === 'Factory' && <QueryState query={warehouses}>{() => <FactoryPending query={incoming} warehouses={executionWarehouses ?? []} admin={admin} busy={busy}
        refresh={() => { void incoming.refetch(); }} onOpen={pallet => {
          if (admin && pallet.receiptDocumentId) history.push(`${screen.path}/${encodeURIComponent(pallet.receiptDocumentId)}?pallet=${encodeURIComponent(pallet.palletCode)}`);
          else if (!admin) void act(`${base}/factory-receipts/from-pallet`, { palletCode: pallet.palletCode }, false, pallet.palletCode);
        }} />}</QueryState>}
      {operationReason === 'Factory' && inProgressReceipts.length > 0 && <Card title="Phiếu kiểm đếm đang thực hiện dở dang">
        <p className="muted">Các phiếu kiểm đếm đã mở nhưng chưa bấm hoàn tất ghi sổ. Chọn để tiếp tục kiểm đếm và ghi sổ nhập kho.</p>
        <SimpleTable rows={inProgressReceipts} columns={[
          { header: 'Mã phiếu', width: '320px', cell: w => <button className="btn btn-sm warehouse-document-code" onClick={() => { setSelected(w.document.id); setError(''); }}><span>{w.document.code}</span></button> },
          { header: 'Kho nhận', width: '220px', cell: w => whName(w.document.warehouseId) },
          { header: 'Số thùng', width: '130px', cell: w => `${w.lines.reduce((s, l) => s + l.quantity, 0)} carton` },
          { header: 'Trạng thái', width: '150px', cell: () => <span className="chip chip-warn">Đang kiểm đếm</span> },
          { header: 'Thao tác', width: '180px', cell: w => <button className="btn btn-sm btn-primary" onClick={() => { setSelected(w.document.id); setError(''); }}>Tiếp tục kiểm đếm</button> },
        ]} />
      </Card>}
      {operationReason === 'Transfer' && <Card title="Hàng luân chuyển chờ nhận">
        <p>Kho gửi đã xác nhận xuất kho. Thủ kho nhận mở phiếu nhập tại kho đích, quét từng carton thực nhận và xác nhận nhập kho để cộng tồn.</p>
        <SimpleTable rows={transferArrivals} columns={[
          { header: 'Phiếu xuất', width: '300px', cell: w => w.document.code },
          { header: 'Kho gửi → kho nhận', width: '280px', cell: w => `${whName(w.document.warehouseId)} → ${whName(w.document.destinationWarehouseId)}` },
          { header: 'Thao tác', width: '240px', cell: w => admin ? 'Chờ thủ kho nhận' : <button className="btn btn-primary" disabled={busy} onClick={() => void act(`${base}/${w.document.id}/create-document`, undefined, true)}>Bắt đầu nhập luân chuyển & quét</button> },
        ]} empty="Không có hàng luân chuyển chờ nhận tại kho của bạn." />
      </Card>}
    </div>}
    {creating && !canCreate && <Card title="Không có quyền tạo chứng từ"><p>{workflow === 'inbound' ? 'Thủ kho tạo và thực hiện phiếu nhập tại kho được phân công.' : 'Quản trị viên phát hành yêu cầu. Thủ kho mở chứng từ trong danh sách để thực hiện.'}</p><Link className="btn" to={screen.path}>Về danh sách</Link></Card>}
    {creating && canCreate && <Card title={screen.create}>
      <p className="muted">{workflow === 'outbound' ? 'Chọn kho và đơn đã có đơn thực hiện. Thủ kho sẽ soạn thùng theo yêu cầu này.' : 'Quản trị viên lập lệnh điều chuyển nội bộ: Chọn kho gửi, kho nhận và số thùng từng lô hàng cần chuyển. Thủ kho gửi sẽ tiếp nhận lệnh để xuất hàng.'}</p>
      <form onSubmit={e => { e.preventDefault(); void act(`${base}/requests`, { warehouseId: wh, destinationWarehouseId: reason === 'Transfer' ? destination : null, reason, orderIds: reason === 'Order' ? orderIds : [], lines: reason === 'Transfer' ? transferLines : [], note }, true); }}>
        <div className="row-wrap" style={{ gap: 12, marginBottom: 12 }}>
          <label>{workflow === 'transfer' ? 'Kho gửi' : 'Kho xuất'} <select required value={wh} onChange={e => { setWh(e.target.value); if (e.target.value === destination) setDestination(''); setOrderIds([]); setTransferLines([]); }}><option value="">Chọn kho</option>{executionWarehouses?.map(w => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></label>
          {admin && reason === 'Transfer' && <label>Kho nhận <select required value={destination} onChange={e => setDestination(e.target.value)}><option value="">Chọn kho nhận</option>{warehouses.data?.filter(w => w.id !== wh && w.isActive).map(w => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></label>}
        </div>
        {admin && reason === 'Order' && <><p>Chọn các đơn có đơn thực hiện tại kho để phát hành một yêu cầu xuất tổng.</p>{pickings.isError && <p role="alert">{errorMessage(pickings.error)}</p>}<SimpleTable rows={selectable} columns={[
          { header: 'Chọn', cell: p => <input type="checkbox" aria-label={`Chọn đơn ${p.orderCode}`} checked={orderIds.includes(p.orderId)} onChange={e => setOrderIds(e.target.checked ? [...orderIds, p.orderId] : orderIds.filter(id => id !== p.orderId))} /> },
          { header: 'Đơn / khách hàng', cell: p => `${p.orderCode} · ${p.retailerName}` },
          { header: 'Lô hàng theo phân bổ', cell: p => p.items.map(i => `${i.sku}: ${i.batchCode} (${i.requestedQuantity} carton)`).join('; ') },
        ]} /></>}
        {admin && reason === 'Transfer' && <>{batches.isError && <p role="alert">{errorMessage(batches.error)}</p>}<SimpleTable rows={(batches.data ?? []).filter(b => b.availableQuantity > 0 && b.expiryStatus !== 'Expired')} columns={[
          { header: 'SKU / lô hàng / HSD', cell: b => `${b.sku} · ${b.batchCode} · ${formatDate(b.expirationDate)}` },
          { header: 'Khả dụng', cell: b => b.availableQuantity },
          { header: 'Thùng chuyển', cell: b => <input aria-label={`Số thùng ${b.batchCode}`} type="number" min={0} max={b.availableQuantity} step={1} value={transferLines.find(l => l.batchId === b.batchId)?.quantity ?? 0} onChange={e => setTransferLines([...transferLines.filter(l => l.batchId !== b.batchId), ...(Number(e.target.value) > 0 ? [{ batchId: b.batchId, quantity: Number(e.target.value) }] : [])])} /> },
        ]} /></>}
        {!admin && <p>Chọn kho được phân công và tạo phiếu. Quét pallet để mở kiểm đếm, đánh dấu từng thùng đạt, hỏng hoặc thiếu rồi xác nhận nhận. Chỉ thùng đạt được cộng vào tồn bán được; quét trùng không cộng lại.</p>}
        <div className="row-wrap" style={{ gap: 12, marginTop: 12 }}><label>Ghi chú <input value={note} onChange={e => setNote(e.target.value)} /></label><button className="btn btn-primary" disabled={busy || !wh || admin && (reason === 'Order' ? !orderIds.length : !transferLines.length || !destination || destination === wh)}>{screen.create}</button><Link className="btn" to={screen.path}>Hủy</Link></div>
      </form>
    </Card>}
    {workflow !== 'trace' && !selected && !creating && (
      (isInbound && activeTab === 'history') ? (
        <Card title={operationReason === 'Transfer' ? 'Danh sách Phiếu Nhập Luân Chuyển (PNK)' : 'Danh sách Phiếu Nhập Kho (PNK)'}>
          <div className="warehouse-work-filters">
            <label>Tìm chứng từ<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Mã PNK, mã pallet (PID), SKU hoặc mã lô" /></label>
            <label>Trạng thái<select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(filterStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Lọc theo kho<select value={warehouseFilter} onChange={e => setWarehouseFilter(e.target.value)}><option value="">Tất cả kho</option>{warehouses.data?.filter(w => admin || user?.scope?.warehouseIds.includes(w.id)).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
          </div>
          <p className="muted">{visibleRows.length} chứng từ · Danh sách các phiếu nhập kho đã ghi nhận tồn. Chọn mã PNK để xem chi tiết hoặc in phiếu.</p>
          <QueryState query={docs}>{() => <SimpleTable rows={visibleRows} columns={[
            { header: 'Mã PNK', width: '320px', cell: w => <button className="btn btn-sm warehouse-document-code" onClick={() => { setSelected(w.document.id); setError(''); }}><span>{w.document.code}</span></button> },
            { header: 'Loại chứng từ', width: '250px', cell: w => documentTypeLabel(w.document.kind, w.document.reason) },
            { header: 'Kho nhận', width: '220px', cell: w => `${whName(w.document.warehouseId)}${w.document.destinationWarehouseId && w.document.destinationWarehouseId !== w.document.warehouseId ? ' → ' + whName(w.document.destinationWarehouseId) : ''}` },
            { header: 'Đơn / thùng', width: '130px', cell: w => `${new Set(w.lines.map(l => l.orderCode).filter(Boolean)).size} đơn · ${w.lines.reduce((s, l) => s + l.quantity, 0)} carton` },
            { header: 'Trạng thái', width: '150px', cell: w => <span className={`chip ${w.document.status === 'Posted' ? 'chip-ok' : ''}`}>{filterStatuses[w.document.status] ?? statuses[w.document.status] ?? w.document.status}</span> },
            { header: 'Thao tác', width: '150px', cell: w => <button className="btn btn-sm" onClick={() => { setSelected(w.document.id); setError(''); }}>Xem & in phiếu</button> },
          ]} empty="Không có chứng từ phù hợp." />}</QueryState>
        </Card>
      ) : (isOutbound && activeTab === 'history') ? (
        <Card title={operationReason === 'Transfer' ? 'Danh sách Phiếu Xuất Luân Chuyển (PXK)' : 'Danh sách Phiếu Xuất Kho (PXK)'}>
          <div className="warehouse-work-filters">
            <label>Tìm chứng từ<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Mã PXK, đơn hàng, SKU hoặc mã lô" /></label>
            <label>Trạng thái<select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(filterStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Lọc theo kho<select value={warehouseFilter} onChange={e => setWarehouseFilter(e.target.value)}><option value="">Tất cả kho</option>{warehouses.data?.filter(w => admin || user?.scope?.warehouseIds.includes(w.id)).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
          </div>
          <p className="muted">{visibleRows.length} chứng từ · Danh sách các phiếu xuất kho đã ghi sổ trừ tồn và bàn giao vận chuyển. Chọn mã PXK để xem chi tiết hoặc in phiếu.</p>
          <QueryState query={docs}>{() => <SimpleTable rows={visibleRows} columns={[
            { header: 'Mã PXK', width: '320px', cell: w => <button className="btn btn-sm warehouse-document-code" onClick={() => { setSelected(w.document.id); setError(''); }}><span>{w.document.code}</span></button> },
            { header: 'Loại chứng từ', width: '250px', cell: w => documentTypeLabel(w.document.kind, w.document.reason) },
            { header: 'Kho xuất', width: '220px', cell: w => `${whName(w.document.warehouseId)}${w.document.destinationWarehouseId && w.document.destinationWarehouseId !== w.document.warehouseId ? ' → ' + whName(w.document.destinationWarehouseId) : ''}` },
            { header: 'Đơn / thùng', width: '130px', cell: w => `${new Set(w.lines.map(l => l.orderCode).filter(Boolean)).size} đơn · ${w.lines.reduce((s, l) => s + l.quantity, 0)} carton` },
            { header: 'Trạng thái', width: '150px', cell: w => <span className={`chip ${w.document.status === 'Posted' ? 'chip-ok' : ''}`}>{filterStatuses[w.document.status] ?? statuses[w.document.status] ?? w.document.status}</span> },
            { header: 'Thao tác', width: '150px', cell: w => <button className="btn btn-sm" onClick={() => { setSelected(w.document.id); setError(''); }}>Xem & in phiếu</button> },
          ]} empty="Không có phiếu xuất kho phù hợp." />}</QueryState>
        </Card>
      ) : (isOutbound && activeTab === 'todo') ? (
        <Card title={operationReason === 'Transfer' ? 'Danh sách Lệnh Xuất Luân Chuyển Cần Soạn' : 'Danh sách Lệnh Xuất & Soạn Hàng'}>
          <div className="warehouse-work-filters">
            <label>Tìm chứng từ<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Mã chứng từ, đơn hàng, SKU hoặc lô hàng" /></label>
            <label>Lọc theo kho<select value={warehouseFilter} onChange={e => setWarehouseFilter(e.target.value)}><option value="">Tất cả kho</option>{warehouses.data?.filter(w => admin || user?.scope?.warehouseIds.includes(w.id)).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
          </div>
          <p className="muted">{pendingOutboundRows.length} yêu cầu cần xuất · Mỗi dòng đại diện cho 1 lệnh xuất hàng. Bắt đầu hoặc tiếp tục soạn hàng theo thứ tự FEFO.</p>
          <QueryState query={docs}>{() => <SimpleTable rows={pendingOutboundRows} columns={[
            { header: 'Chứng từ', width: '300px', cell: w => <button className="btn btn-sm warehouse-document-code" onClick={() => { setSelected(w.document.id); setError(''); }}><span>{w.document.code}</span></button> },
            { header: 'Loại chứng từ', width: '220px', cell: w => documentTypeLabel(w.document.kind, w.document.reason) },
            { header: 'Kho', width: '200px', cell: w => `${whName(w.document.warehouseId)}${w.document.destinationWarehouseId && w.document.destinationWarehouseId !== w.document.warehouseId ? ' → ' + whName(w.document.destinationWarehouseId) : ''}` },
            { header: 'Đơn / thùng', width: '130px', cell: w => `${new Set(w.lines.map(l => l.orderCode).filter(Boolean)).size} đơn · ${w.lines.reduce((s, l) => s + l.quantity, 0)} carton` },
            { header: 'Trạng thái', width: '160px', cell: w => {
              if (w.document.kind === 'Request') return <span className="chip chip-warn">Chờ soạn hàng</span>;
              if (w.document.kind === 'Picking') return <span className="chip chip-info">Đang soạn hàng</span>;
              if (w.document.kind === 'Issue') return <span className="chip chip-warning">Đã soạn xong - Chờ xuất</span>;
              return <span className="chip">{filterStatuses[w.document.status] ?? statuses[w.document.status] ?? w.document.status}</span>;
            } },
            { header: 'Thao tác', width: '150px', cell: w => <button className="btn btn-sm btn-primary" onClick={() => { setSelected(w.document.id); setError(''); }}>
              {w.document.kind === 'Request' ? 'Bắt đầu soạn' : w.document.kind === 'Picking' ? 'Tiếp tục soạn' : w.document.kind === 'Issue' ? 'Bàn giao & xuất' : 'Xem chi tiết'}
            </button> },
          ]} empty="Không có chứng từ cần xuất kho." />}</QueryState>
        </Card>
      ) : workflow === 'transfer' ? (
        <Card title={`Danh sách ${screen.title.toLocaleLowerCase('vi')}`}>
          <div className="warehouse-work-filters">
            <label>Tìm chứng từ<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Mã chứng từ, đơn hàng, SKU hoặc lô hàng" /></label>
            <label>Trạng thái<select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(filterStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Lọc theo kho<select value={warehouseFilter} onChange={e => setWarehouseFilter(e.target.value)}><option value="">Tất cả kho</option>{warehouses.data?.filter(w => admin || user?.scope?.warehouseIds.includes(w.id)).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
          </div>
          <p className="muted">{visibleRows.length} chứng từ · Chọn mã chứng từ để xem và xử lý.</p>
          <QueryState query={docs}>{() => <SimpleTable rows={visibleRows} columns={[
            { header: 'Chứng từ', width: '320px', cell: w => <button className="btn btn-sm warehouse-document-code" onClick={() => { setSelected(w.document.id); setError(''); }}><span>{w.document.code}</span></button> },
            { header: 'Loại chứng từ', width: '250px', cell: w => documentTypeLabel(w.document.kind, w.document.reason) },
            { header: 'Kho', width: '220px', cell: w => `${whName(w.document.warehouseId)}${w.document.destinationWarehouseId && w.document.destinationWarehouseId !== w.document.warehouseId ? ' → ' + whName(w.document.destinationWarehouseId) : ''}` },
            { header: 'Đơn / thùng', width: '130px', cell: w => `${new Set(w.lines.map(l => l.orderCode).filter(Boolean)).size} đơn · ${w.lines.reduce((s, l) => s + l.quantity, 0)} carton` },
            { header: 'Trạng thái', width: '150px', cell: w => filterStatuses[w.document.status] ?? statuses[w.document.status] ?? w.document.status },
          ]} empty="Không có chứng từ phù hợp." />}</QueryState>
        </Card>
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
          <button className="btn btn-primary" onClick={() => void printLabels(false, true)}>📄 In / Xuất PDF phiếu nhập kho</button>
        </div>
        <div className="pnk-meta-grid">
          <div className="pnk-meta-item">
            <span className="muted">Nguồn nhập</span>
            <strong>{d.reason === 'Factory' ? '🏭 Nhà máy sản xuất (Factory Dispatch)' : '🔄 Luân chuyển từ kho khác'}</strong>
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
          <button className="btn btn-primary" onClick={() => void printLabels(false, false, true)}>📄 In / Xuất PDF phiếu xuất kho</button>
        </div>
        <div className="pnk-meta-grid">
          <div className="pnk-meta-item">
            <span className="muted">Loại xuất kho</span>
            <strong>{d.reason === 'Order' ? '🛒 Xuất bán hàng (Bán lẻ / Đơn hàng)' : '🔄 Xuất luân chuyển sang kho khác'}</strong>
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
        <p style={{ margin: '4px 0 0 0' }}>Lô SX Nhà máy (BID) ➔ Pallet đóng gói (PID) ➔ Thùng carton (CID) ➔ Phiếu Nhập Kho (PNK: <b>{d.code}</b>) ➔ Lô kho FSCM (Batch)</p>
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
      {d.reason !== 'Factory' && <><h3>Tổng hợp lấy hàng theo SKU / batch</h3>
      <SimpleTable rows={Object.values(active.lines.reduce<Record<string, { sku: string; batch: string; expiry: string; required: number; scanned: number }>>((result, line) => {
        const key = `${line.sku}:${line.batchCode ?? line.sourceLotCode}:${line.expirationDate}`;
        const row = result[key] ??= { sku: line.sku, batch: line.batchCode ?? line.sourceLotCode ?? 'Chờ nhập', expiry: line.expirationDate, required: 0, scanned: 0 };
        row.required += line.quantity; row.scanned += active.cartons.filter(c => c.lineId === line.id && c.scannedAt).length;
        return result;
      }, {})).sort((a, b) => a.expiry.localeCompare(b.expiry))} columns={[
        { header: 'SKU', cell: r => r.sku }, { header: 'Lô hàng cần lấy', cell: r => r.batch }, { header: 'HSD', cell: r => formatDate(r.expiry) },
        { header: 'Tổng thùng', cell: r => r.required }, { header: 'Đã quét', cell: r => r.scanned }, { header: 'Còn lấy', cell: r => r.required - r.scanned },
      ]} /></>}
      {admin && d.kind === 'Request' && d.status === 'Open' && <button className="btn" disabled={busy} onClick={() => void act(`${base}/${d.id}/cancel`, { expectedVersion: d.version })}>Hủy lệnh chưa lấy hàng</button>}
      {canCreateChild && <button className="btn btn-primary" disabled={busy} onClick={() => void act(`${base}/${d.id}/create-document`, undefined, true)}>{d.kind === 'Request' ? (d.reason === 'Transfer' ? 'Bắt đầu xuất luân chuyển & quét' : 'Bắt đầu xuất kho & quét') : 'Bắt đầu nhập luân chuyển & quét'}</button>}
      {active.lines.length > 0 && <SimpleTable rows={active.lines} columns={[
        { header: 'Đơn hàng', cell: l => l.orderCode ?? '—' }, { header: 'SKU / sản phẩm', cell: l => `${l.sku} · ${l.productName}` },
        { header: 'Mã tồn / lô hàng nhà máy', cell: l => [l.batchCode, l.sourceLotCode].filter(Boolean).join(' · ') || 'Chờ nhập' }, { header: 'HSD', cell: l => formatDate(l.expirationDate) },
        { header: 'Số thùng', cell: l => l.quantity }, { header: 'Đã quét', cell: l => active.cartons.filter(c => c.lineId === l.id && c.scannedAt).length },
      ]} />}
      {d.kind !== 'Request' && <>
        {d.reason === 'Factory' && <>
          <p>Kho nhận cố định: <b>{whName(d.warehouseId)}</b> · Theo chỉ định của nhà máy.</p>
          <PalletReceiving key={d.id + (incoming.data?.find(p => p.receiptDocumentId === d.id)?.palletCode ?? new URLSearchParams(location.search).get('pallet') ?? '')}
            initialCode={incoming.data?.find(p => p.receiptDocumentId === d.id)?.palletCode ?? new URLSearchParams(location.search).get('pallet') ?? ''}
            documentId={d.id} version={d.version} receivedCount={active.cartons.length} editable={!admin && d.status === 'Open'} />
        </>}{d.reason !== 'Factory' && <p>Tiến độ: {active.cartons.filter(c => c.scannedAt).length} / {active.lines.reduce((s, l) => s + l.quantity, 0)} thùng. Mỗi mã QR đại diện một thùng chứa một SKU.</p>}
        {!admin && (d.kind === 'Picking' || d.kind === 'Issue') && d.status === 'Open' && active.lines.some(l => !l.sourceLotCode?.startsWith('BID-')) && <div className="row-wrap" style={{ gap: 12 }}><button className="btn" disabled={busy} onClick={() => void act(`${base}/${d.id}/prepare-cartons`)}>Chuẩn bị nhãn một thùng cho hàng tồn</button><button className="btn" onClick={() => void printLabels(true)}>Mở nhãn hàng tồn để in</button><span className="muted">Dán nhãn mới lên từng thùng; nhãn gộp cũ sau khi tách sẽ hết hiệu lực.</span></div>}{active.cartons.length > 0 && d.reason !== 'Factory' && <button className="btn" onClick={() => void printLabels()}>In nhãn QR thùng</button>}
        {!admin && d.reason !== 'Factory' && (d.status === 'Open' || d.status === 'Prepared') && <form onSubmit={e => { e.preventDefault(); if (scan.trim()) void act(`${base}/${d.id}/scans`, { cartonId: scan.trim(), expectedVersion: d.version }); }} className="row-wrap" style={{ gap: 12, margin: '14px 0' }}>
          <label>Quét mã thùng <input ref={scanInput} autoComplete="off" value={scan} onChange={e => setScan(e.target.value)} placeholder="Quét QR bằng máy đọc rồi nhấn phím xác nhận" disabled={busy} /></label>
          <button className="btn" disabled={busy || !scan.trim() || d.status !== 'Open'}>Ghi nhận thùng</button>
          <button type="button" className="btn btn-primary" disabled={busy || active.cartons.length === 0 || active.cartons.filter(c => c.scannedAt).length !== active.lines.reduce((s, l) => s + l.quantity, 0)} onClick={() => void act(`${base}/${d.id}/post`, { expectedVersion: d.version })}>Xác nhận {(d.kind === 'Picking' || d.kind === 'Issue') ? 'xuất và ghi sổ PXK' : 'nhập'} kho</button>
        </form>}
        {cartonEdit?.documentId === d.id && !admin && (d.kind === 'Picking' || d.kind === 'Issue') && ['Open', 'Prepared'].includes(d.status) && <form aria-label="Sửa thùng đang soạn" onSubmit={e => {
          e.preventDefault();
          if (!cartonEdit.reason.trim() || cartonEdit.replace && !cartonEdit.replacementCode.trim()) return;
          void act(`${base}/${d.id}/remove-carton`, { cartonCode: cartonEdit.cartonCode, reason: cartonEdit.reason.trim(), expectedVersion: d.version,
            ...(cartonEdit.replace ? { replacementCode: cartonEdit.replacementCode.trim() } : {}) });
        }}>
          <p>{cartonEdit.replace ? 'Đổi' : 'Bỏ'} thùng: {cartonEdit.cartonCode}</p>
          {cartonEdit.replace && <label>CID thay thế cùng lô hàng <input required disabled={busy} value={cartonEdit.replacementCode} onChange={e => setCartonEdit({ ...cartonEdit, replacementCode: e.target.value })} /></label>}
          <label>Lý do sửa thùng <input required disabled={busy} value={cartonEdit.reason} onChange={e => setCartonEdit({ ...cartonEdit, reason: e.target.value })} /></label>
          <button className="btn" disabled={busy}>Xác nhận sửa thùng</button>
          <button className="btn" type="button" disabled={busy} onClick={() => setCartonEdit(null)}>Hủy sửa thùng</button>
        </form>}
        {(d.reason !== 'Factory' || active.cartons.length > 0) && <SimpleTable rows={active.cartons} columns={[
          { header: 'Mã thùng / QR', cell: c => c.cartonId },
          { header: 'Sửa khi đang soạn', cell: c => !admin && (d.kind === 'Picking' || d.kind === 'Issue') && ['Open', 'Prepared'].includes(d.status) ? <div className="row-wrap">
            <button className="btn btn-sm" disabled={busy} onClick={() => setCartonEdit({ documentId: d.id, cartonCode: c.cartonId, replace: false, replacementCode: '', reason: '' })}>Bỏ thùng</button>
            <button className="btn btn-sm" disabled={busy} onClick={() => setCartonEdit({ documentId: d.id, cartonCode: c.cartonId, replace: true, replacementCode: '', reason: '' })}>Đổi thùng</button>
          </div> : 'Đã khóa / không áp dụng' }, { header: 'Pallet gốc / sản phẩm trong thùng', cell: c => { const m = active.pallets?.find(p => p.cartonCode === c.cartonId); return m ? `${m.palletCode} · ${m.unitsPerCarton} sản phẩm` : 'Hàng tồn cũ'; } }, { header: 'SKU', cell: c => active.lines.find(l => l.id === c.lineId)?.sku },
          { header: 'Quét lúc', cell: c => c.scannedAt ? formatInstantDateTime(c.scannedAt) : 'Chờ quét' },
        ]} />}
      </>}
    </Card>}
  </>;
}
