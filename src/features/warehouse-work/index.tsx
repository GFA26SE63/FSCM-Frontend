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
export function WarehouseInboundCreatePage() { return <Redirect to="/warehouse-inbound" />; }
export function WarehouseOutboundPage() { return <WarehouseOperationsPage key="outbound" workflow="outbound" />; }
export function WarehouseTransferPage() { return <WarehouseOperationsPage key="transfer" workflow="transfer" />; }
export function WarehouseTracePage() { return <WarehouseOperationsPage key="trace" workflow="trace" />; }

function WarehouseTraceCenter({ docs, warehouses, setSelected }: {
  docs: { data: Work[] | undefined; isLoading: boolean; error: unknown };
  warehouses: { id: string; name: string }[];
  setSelected: (id: string) => void;
}) {
  const [tab, setTab] = useState<'lookup' | 'cartons' | 'factory'>('lookup');
  const [trace, setTrace] = useState('');
  const whName = (id: string | null) => warehouses.find(w => w.id === id)?.name ?? id ?? '—';

  return <div className="warehouse-trace-center">
    <div className="warehouse-tabs" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'lookup'}
        className={`btn ${tab === 'lookup' ? 'btn-primary' : ''}`}
        onClick={() => setTab('lookup')}
      >
        Tra cứu nguồn gốc đa cấp
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'cartons'}
        className={`btn ${tab === 'cartons' ? 'btn-primary' : ''}`}
        onClick={() => setTab('cartons')}
      >
        Tồn kho thùng carton (QR)
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'factory'}
        className={`btn ${tab === 'factory' ? 'btn-primary' : ''}`}
        onClick={() => setTab('factory')}
      >
        Kết nối hệ thống Nhà máy
      </button>
    </div>

    {tab === 'lookup' && <>
      <Card title="Cấu trúc định danh & Truy xuất nguồn gốc 4 cấp độ">
        <p className="muted">Chuỗi định danh khép kín từ Nhà máy sản xuất đến tận tay Người tiêu dùng qua FSCM:</p>
        <div className="trace-hierarchy-grid">
          <div className="trace-hierarchy-node">
            <span className="node-level">Cấp 1 · Lô sản xuất (BID)</span>
            <strong>Lô sản xuất tại nhà máy</strong>
            <span className="node-desc">Gắn liền công thức, ngày sản xuất (NSX), hạn sử dụng (HSD) và phân xưởng sản xuất.</span>
          </div>
          <div className="trace-arrow">➔</div>
          <div className="trace-hierarchy-node">
            <span className="node-level">Cấp 2 · Pallet đóng gói (PID)</span>
            <strong>Kiện hàng giao vận</strong>
            <span className="node-desc">Đơn vị xếp dỡ vận chuyển từ nhà máy tới kho tổng, gồm nhiều thùng carton cùng lô.</span>
          </div>
          <div className="trace-arrow">➔</div>
          <div className="trace-hierarchy-node">
            <span className="node-level">Cấp 3 · Thùng carton (CID)</span>
            <strong>Đơn vị kiểm soát kho FSCM</strong>
            <span className="node-desc">Mã QR định danh từng thùng, quét kiểm đếm khi nhập kho và soạn hàng xuất kho.</span>
          </div>
          <div className="trace-arrow">➔</div>
          <div className="trace-hierarchy-node">
            <span className="node-level">Cấp 4 · Đơn vị / Lô kho (UID & Batch)</span>
            <strong>Sản phẩm & Lô tồn FSCM</strong>
            <span className="node-desc">Lô kho (WH-SKU-...) quản lý tồn bán và mã tem sê-ri từng sản phẩm đến tay khách.</span>
          </div>
        </div>
      </Card>
      <TraceLookup />
      <Card title="Lịch sử thùng trong chứng từ kho">
        <label>Mã thùng <input value={trace} onChange={e => setTrace(e.target.value)} placeholder="Quét hoặc nhập mã thùng (CID) để xem hành trình" /></label>
        <QueryState query={docs}>{() => trace.trim() ? <SimpleTable rows={(docs.data ?? []).flatMap(w => w.cartons.filter(c => c.cartonId === trace.trim()).map(c => ({ w, c, l: w.lines.find(l => l.id === c.lineId) })))} columns={[
          { header: 'Chứng từ', width: '320px', cell: x => <button className="btn btn-sm warehouse-document-code" onClick={() => setSelected(x.w.document.id)}><span>{x.w.document.code}</span></button> },
          { header: 'Nghiệp vụ / kho', cell: x => `${kinds[x.w.document.kind]} · ${whName(x.w.document.warehouseId)}` },
          { header: 'Lô hàng / SKU / đơn', cell: x => `${x.l?.batchCode ?? x.l?.sourceLotCode ?? '—'} · ${x.l?.sku ?? '—'} · ${x.l?.orderCode ?? '—'}` },
          { header: 'Quét lúc', cell: x => x.c.scannedAt ? formatInstantDateTime(x.c.scannedAt) : 'Chưa quét' },
        ]} empty="Không tìm thấy thùng trong các chứng từ thuộc phạm vi của bạn." /> : <p className="muted">Nhập mã thùng để xem các lần nhập, xuất và luân chuyển.</p>}</QueryState>
      </Card>
    </>}

    {tab === 'cartons' && <Card title="Theo dõi thùng carton & QR trong kho">
      <p>Mỗi thùng carton khi nhập vào FSCM được cấp một mã QR duy nhất (CID), liên kết với Pallet gốc (PID) và Lô kho FSCM (Batch).</p>
      <div className="trace-quick-actions" style={{ display: 'flex', gap: 12, margin: '16px 0', flexWrap: 'wrap' }}>
        <Link className="btn btn-primary" to="/inventory">Mở bảng tra cứu chi tiết toàn bộ carton (50 carton / trang)</Link>
        <Link className="btn" to="/batches">Xem tồn khả dụng theo Lô hàng (Batches)</Link>
        <Link className="btn" to="/warehouse-inbound">Tiếp nhận lô hàng mới tại Nhập kho</Link>
      </div>
      <div className="trace-carton-lifecycle" style={{ background: 'var(--surface-subtle, #f8fafc)', border: '1px solid var(--border, #e2e8f0)', padding: 16, borderRadius: 8 }}>
        <h4 style={{ margin: '0 0 10px 0' }}>Vòng đời trạng thái tem QR thùng carton trong FSCM:</h4>
        <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li><b>Available (Sẵn sàng):</b> Thùng đã qua kiểm đếm đạt chuẩn và nhập kho, sẵn sàng phân bổ hoặc soạn xuất.</li>
          <li><b>Picked (Đã soạn):</b> Đã quét vào phiếu soạn hàng (Picking) cho đơn hàng cụ thể.</li>
          <li><b>InTransit (Đang vận chuyển):</b> Đang trên đường luân chuyển giữa các kho hoặc giao đến khách.</li>
          <li><b>Delivered (Đã giao):</b> Đã giao thành công đến điểm bán lẻ hoặc người nhận.</li>
          <li><b>Invalidated / Split (Đã tách / Hủy):</b> Thùng được xả lẻ hoặc tem được cấp mới thay thế.</li>
        </ul>
      </div>
    </Card>}

    {tab === 'factory' && <Card title="Cổng kết nối hệ thống Nhà máy sản xuất">
      <p>Nhà máy và FSCM vận hành đồng bộ qua cơ chế tích hợp API 2 chiều để bảo đảm truy xuất nguồn gốc không đứt gãy:</p>
      <div className="trace-quick-actions" style={{ display: 'flex', gap: 12, margin: '16px 0', flexWrap: 'wrap' }}>
        <Link className="btn btn-primary" to="/factory-traceability">Mở cổng ứng dụng Nhà máy · Truy xuất nguồn gốc</Link>
        <Link className="btn" to="/warehouse-inbound">Kiểm tra Pallet chờ nhận từ nhà máy</Link>
      </div>
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 16, borderRadius: 8, marginTop: 12 }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#166534' }}>Cơ chế xác nhận biên bản nhập kho (ACK):</h4>
        <p style={{ margin: 0 }}>Khi thủ kho hoàn tất kiểm đếm và bấm "Hoàn tất phiếu nhập", FSCM tự động gửi thông điệp ACK về dịch vụ Traceability nhà máy kèm thống kê số thùng Đạt, Hỏng (vị trí cách ly) và Thiếu. Trạng thái đồng bộ hiển thị chi tiết tại bảng tồn carton.</p>
      </div>
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
  const [trace, setTrace] = useState('');
  const [search, setSearch] = useStringParam('q');
  const [statusFilter, setStatusFilter] = useStringParam('status');
  const [warehouseFilter, setWarehouseFilter] = useStringParam('warehouse');
  const [operationSource, setOperationSource] = useStringParam('source');
  const operationReason = operationSource === 'Transfer' ? 'Transfer' : workflow === 'inbound' ? 'Factory' : 'Order';
  const [cartonEdit, setCartonEdit] = useState<{ documentId: string; cartonCode: string; replace: boolean; replacementCode: string; reason: string } | null>(null);
  const scanInput = useRef<HTMLInputElement>(null);
  const operation = useRef<{ fingerprint: string; key: string } | null>(null);
  const inFlight = useRef(false);
  const docs = useQuery({ queryKey: ['warehouse-documents'], queryFn: () => get<Work[]>(base) });
  const incoming = useQuery({ queryKey: ['factory-pending'], queryFn: () => get<FactoryInboundPallet[]>(`${base}/factory-pending`), enabled: workflow === 'inbound' });
  const warehouses = useQuery({ queryKey: ['warehouse-work', 'warehouses'], queryFn: receiptApi.warehouses });
  const pickings = useQuery({ queryKey: ['warehouse-work', 'picking', wh], queryFn: () => pickingApi.lists(wh), enabled: admin && workflow === 'outbound' && creating && !!wh });
  const batches = useQuery({ queryKey: ['warehouse-work', 'batches', wh], queryFn: () => get<BatchInventoryItem[]>('/inventory', { warehouseId: wh }), enabled: admin && creating && !!wh && reason === 'Transfer' });
  const active = docs.data?.find(x => x.document.id === selected && belongsToWorkflow(x.document, workflow));
  const canCreate = admin && (workflow === 'outbound' && operationReason === 'Order' || workflow === 'transfer');
  const executionWarehouses = warehouses.data?.filter(w => w.isActive &&
    (admin || user?.scope?.warehouseIds.includes(w.id)));
  const whName = (id: string | null) => warehouses.data?.find(w => w.id === id)?.name ?? id ?? '—';
  const setSelected = (id: string) => {
    const work = docs.data?.find(w => w.document.id === id);
    if (work) history.push(warehouseDocumentPath(work.document));
  };
  const workflowRows = (docs.data ?? []).filter(w => belongsToWorkflow(w.document, workflow) && (!['inbound', 'outbound'].includes(workflow) || w.document.reason === operationReason));
  const transferArrivals = (docs.data ?? []).filter(w => w.document.reason === 'Transfer' && w.document.kind === 'Issue' && w.document.status === 'Posted'
    && (admin || user?.scope?.warehouseIds.includes(w.document.destinationWarehouseId ?? ''))
    && !docs.data?.some(r => r.document.kind === 'Receipt' && r.document.sourceDocumentId === w.document.id));
  const visibleRows = workflowRows.filter(w => {
    const text = [w.document.code, w.document.note, ...w.lines.flatMap(l => [l.sku, l.batchCode, l.orderCode])].join(' ').toLocaleLowerCase('vi');
    return (!search.trim() || text.includes(search.trim().toLocaleLowerCase('vi')))
      && (!statusFilter || w.document.status === statusFilter)
      && (!warehouseFilter || [w.document.warehouseId, w.document.destinationWarehouseId].includes(warehouseFilter));
  });
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
  async function printLabels(stock = false, receipt = false) {
    if (!active) return;
    const win = window.open('', '_blank');
    if (!win) { setError('Cho phép mở cửa sổ để in nhãn.'); return; }
    try {
      const { data } = await http.get<string>(`${base}/${active.document.id}/${receipt ? 'receipt-print' : stock ? 'stock-labels' : 'labels'}`, { responseType: 'text' });
      win.document.open(); win.document.write(data); win.document.close();
    } catch (e) { win.close(); setError(errorMessage(e)); }
  }
  const d = active?.document;
  const canCreateChild = d && !admin && ((d.kind === 'Request' && d.status === 'Open') || (d.kind === 'Issue' && d.reason === 'Transfer' && d.status === 'Posted')) && !docs.data?.some(x => x.document.sourceDocumentId === d.id);
  return <>
    <PageHeader title={selected ? `Chi tiết ${screen.title.toLocaleLowerCase('vi')}` : creating ? screen.create : screen.title} subtitle={screen.description}
      back={selected || creating ? screen.path + (d?.reason === 'Transfer' && workflow !== 'transfer' ? '?source=Transfer' : '') : undefined}
      actions={!selected && !creating && canCreate ? <Link className="btn btn-primary" to={`${screen.path}/new`}>{screen.create}</Link> : undefined} />
    {!selected && !creating && (workflow === 'inbound' || workflow === 'outbound') && <div className="row-wrap" role="group" aria-label="Loại nghiệp vụ kho" style={{ gap: 12, marginBottom: 16 }}>
      <button className={`btn ${operationReason !== 'Transfer' ? 'btn-primary' : ''}`} aria-pressed={operationReason !== 'Transfer'} onClick={() => setOperationSource('')}>{workflow === 'inbound' ? 'Nhập từ nhà máy' : 'Xuất bán hàng'}</button>
      <button className={`btn ${operationReason === 'Transfer' ? 'btn-primary' : ''}`} aria-pressed={operationReason === 'Transfer'} onClick={() => setOperationSource('Transfer')}>{workflow === 'inbound' ? 'Nhập luân chuyển' : 'Xuất luân chuyển'}</button>
    </div>}
    {!selected && !creating && workflow === 'inbound' && operationReason === 'Transfer' && <Card title="Hàng luân chuyển chờ nhận">
      <p>Kho gửi đã xác nhận xuất kho. Thủ kho nhận mở phiếu nhập tại kho đích, quét từng carton thực nhận và xác nhận nhập kho để cộng tồn.</p>
      <SimpleTable rows={transferArrivals} columns={[
        { header: 'Phiếu xuất', width: '300px', cell: w => w.document.code },
        { header: 'Kho gửi → kho nhận', width: '280px', cell: w => `${whName(w.document.warehouseId)} → ${whName(w.document.destinationWarehouseId)}` },
        { header: 'Thao tác', width: '240px', cell: w => admin ? 'Chờ thủ kho nhận' : <button className="btn btn-primary" disabled={busy} onClick={() => void act(`${base}/${w.document.id}/create-document`, undefined, true)}>Bắt đầu nhập luân chuyển & quét</button> },
      ]} empty="Không có hàng luân chuyển chờ nhận tại kho của bạn." />
    </Card>}
    {workflow === 'trace' && <WarehouseTraceCenter docs={docs} warehouses={warehouses.data ?? []} setSelected={setSelected} />}
    {error && <p role="alert" className="danger">{error}</p>}{notice && <p role="status">{notice}</p>}
    {!selected && !creating && workflow === 'inbound' && operationReason === 'Factory' && <div className="warehouse-guide-steps">
      <div className="warehouse-guide-step">
        <div className="step-badge">Bước 1</div>
        <div>
          <strong>Tiếp nhận Pallet (PID)</strong>
          <p>Xe nhà máy chở pallet đến kho. Chọn pallet trong bảng chờ nhận bên dưới để mở phiếu kiểm đếm.</p>
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
          <p>Bấm Hoàn tất phiếu nhập. Thùng đạt tự động map vào Lô kho FSCM để bán và gửi ACK về nhà máy.</p>
        </div>
      </div>
    </div>}
    {workflow === 'inbound' && operationReason === 'Factory' && !selected && <QueryState query={warehouses}>{() => <FactoryPending query={incoming} warehouses={executionWarehouses ?? []} admin={admin} busy={busy}
      refresh={() => { void incoming.refetch(); }} onOpen={pallet => {
        if (admin && pallet.receiptDocumentId) history.push(`${screen.path}/${encodeURIComponent(pallet.receiptDocumentId)}?pallet=${encodeURIComponent(pallet.palletCode)}`);
        else if (!admin) void act(`${base}/factory-receipts/from-pallet`, { palletCode: pallet.palletCode }, false, pallet.palletCode);
      }} />}</QueryState>}
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
    {workflow !== 'trace' && !selected && !creating && <Card title={workflow === 'inbound' ? (operationReason === 'Transfer' ? 'Danh sách Phiếu Nhập Luân Chuyển (PNK)' : 'Danh sách Phiếu Nhập Kho (PNK)') : `Danh sách ${screen.title.toLocaleLowerCase('vi')}`}>
      <div className="warehouse-work-filters">
        <label>Tìm chứng từ<input value={search} onChange={e => setSearch(e.target.value)} placeholder={workflow === 'inbound' ? "Mã PNK, mã pallet (PID), SKU hoặc mã lô" : "Mã chứng từ, đơn hàng, SKU hoặc lô hàng"} /></label>
        <label>Trạng thái<select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Lọc theo kho<select value={warehouseFilter} onChange={e => setWarehouseFilter(e.target.value)}><option value="">Tất cả kho</option>{warehouses.data?.filter(w => admin || user?.scope?.warehouseIds.includes(w.id)).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
      </div>
      <p className="muted">{visibleRows.length} chứng từ · {workflow === 'inbound' ? 'Tra cứu theo mã PNK, mã pallet (PID), SKU hoặc mã lô.' : 'Chọn mã chứng từ để xem và xử lý.'}</p>
      <QueryState query={docs}>{() => <SimpleTable rows={visibleRows} columns={[
      { header: 'Chứng từ', width: '320px', cell: w => <button className="btn btn-sm warehouse-document-code" onClick={() => { setSelected(w.document.id); setError(''); }}><span>{w.document.code}</span></button> },
      { header: 'Loại chứng từ', width: '250px', cell: w => documentTypeLabel(w.document.kind, w.document.reason) },
      { header: 'Kho', width: '220px', cell: w => `${whName(w.document.warehouseId)}${w.document.destinationWarehouseId && w.document.destinationWarehouseId !== w.document.warehouseId ? ' → ' + whName(w.document.destinationWarehouseId) : ''}` },
      { header: 'Đơn / thùng', width: '130px', cell: w => `${new Set(w.lines.map(l => l.orderCode).filter(Boolean)).size} đơn · ${w.lines.reduce((s, l) => s + l.quantity, 0)} carton` },
      { header: 'Trạng thái', width: '150px', cell: w => statuses[w.document.status] ?? w.document.status },
    ]} empty="Không có chứng từ phù hợp." />}</QueryState></Card>}
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
      </div> : <p>{reasons[d.reason]} · {whName(d.warehouseId)}{d.destinationWarehouseId && d.destinationWarehouseId !== d.warehouseId ? ` → ${whName(d.destinationWarehouseId)}` : ''} · {statuses[d.status]} · {formatInstantDateTime(d.createdAt)}</p>}
      {d.sourceDocumentId && <p>Chứng từ nguồn: <button className="btn btn-sm warehouse-document-code" onClick={() => setSelected(d.sourceDocumentId!)}><span>{docs.data?.find(w => w.document.id === d.sourceDocumentId)?.document.code}</span></button></p>}
      {d.note && <p>{d.note}</p>}
      {d.reason === 'Factory' && d.kind === 'Receipt' && <div className="notice-banner" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
        <strong>Liên kết truy xuất nguồn gốc nhập kho:</strong>
        <p style={{ margin: '4px 0 0 0' }}>Lô SX Nhà máy (BID) ➔ Pallet đóng gói (PID) ➔ Thùng carton (CID) ➔ Phiếu Nhập Kho (PNK: <b>{d.code}</b>) ➔ Lô kho FSCM (Batch)</p>
        <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#166534' }}>Thủ kho quét kiểm đếm từng thùng từ Pallet. Khi hoàn tất phiếu nhập, các thùng Đạt tự động được ghi tăng tồn khả dụng và gửi xác nhận (ACK) về hệ thống Traceability nhà máy.</p>
      </div>}
      {d.sourceDocumentId && <p>Chứng từ nguồn: <button className="btn btn-sm warehouse-document-code" onClick={() => setSelected(d.sourceDocumentId!)}><span>{docs.data?.find(w => w.document.id === d.sourceDocumentId)?.document.code}</span></button></p>}
      {d.note && <p>{d.note}</p>}
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
