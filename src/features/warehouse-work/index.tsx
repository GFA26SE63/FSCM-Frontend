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
      <p>Kho gửi phải xác nhận xuất trước. Mở phiếu nhập tại kho đích, quét từng carton và xác nhận nhập mới cộng tồn.</p>
      <SimpleTable rows={transferArrivals} columns={[
        { header: 'Phiếu xuất', width: '300px', cell: w => w.document.code },
        { header: 'Kho gửi → kho nhận', width: '280px', cell: w => `${whName(w.document.warehouseId)} → ${whName(w.document.destinationWarehouseId)}` },
        { header: 'Thao tác', width: '200px', cell: w => admin ? 'Chờ thủ kho nhận' : <button className="btn" disabled={busy} onClick={() => void act(`${base}/${w.document.id}/create-document`, undefined, true)}>Mở phiếu nhập luân chuyển</button> },
      ]} empty="Không có hàng luân chuyển chờ nhận tại kho của bạn." />
    </Card>}
    {workflow === 'trace' && <>
    <TraceLookup />
    <Card title="Lịch sử thùng trong chứng từ kho"><label>Mã thùng <input value={trace} onChange={e => setTrace(e.target.value)} placeholder="Quét hoặc nhập mã thùng để xem hành trình" /></label><QueryState query={docs}>{() => trace.trim() ? <SimpleTable rows={(docs.data ?? []).flatMap(w => w.cartons.filter(c => c.cartonId === trace.trim()).map(c => ({ w, c, l: w.lines.find(l => l.id === c.lineId) })))} columns={[
      { header: 'Chứng từ', width: '320px', cell: x => <button className="btn btn-sm warehouse-document-code" onClick={() => setSelected(x.w.document.id)}><span>{x.w.document.code}</span></button> },
      { header: 'Nghiệp vụ / kho', cell: x => `${kinds[x.w.document.kind]} · ${whName(x.w.document.warehouseId)}` },
      { header: 'Lô hàng / SKU / đơn', cell: x => `${x.l?.batchCode ?? x.l?.sourceLotCode ?? '—'} · ${x.l?.sku ?? '—'} · ${x.l?.orderCode ?? '—'}` },
      { header: 'Quét lúc', cell: x => x.c.scannedAt ? formatInstantDateTime(x.c.scannedAt) : 'Chưa quét' },
    ]} empty="Không tìm thấy thùng trong các chứng từ thuộc phạm vi của bạn." /> : <p className="muted">Nhập mã thùng để xem các lần nhập, xuất và luân chuyển.</p>}</QueryState></Card>
    </>}
    {error && <p role="alert" className="danger">{error}</p>}{notice && <p role="status">{notice}</p>}
    {workflow === 'inbound' && operationReason === 'Factory' && !selected && <QueryState query={warehouses}>{() => <FactoryPending query={incoming} warehouses={executionWarehouses ?? []} admin={admin} busy={busy}
      refresh={() => { void incoming.refetch(); }} onOpen={pallet => {
        if (admin && pallet.receiptDocumentId) history.push(`${screen.path}/${encodeURIComponent(pallet.receiptDocumentId)}?pallet=${encodeURIComponent(pallet.palletCode)}`);
        else if (!admin) void act(`${base}/factory-receipts/from-pallet`, { palletCode: pallet.palletCode }, false, pallet.palletCode);
      }} />}</QueryState>}
    {creating && !canCreate && <Card title="Không có quyền tạo chứng từ"><p>{workflow === 'inbound' ? 'Thủ kho tạo và thực hiện phiếu nhập tại kho được phân công.' : 'Quản trị viên phát hành yêu cầu. Thủ kho mở chứng từ trong danh sách để thực hiện.'}</p><Link className="btn" to={screen.path}>Về danh sách</Link></Card>}
    {creating && canCreate && <Card title={screen.create}>
      <p className="muted">{workflow === 'outbound' ? 'Chọn kho và đơn đã có đơn thực hiện. Thủ kho sẽ soạn thùng theo yêu cầu này.' : 'Chọn kho gửi, kho nhận và số thùng từng lô hàng cần chuyển.'}</p>
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
    {workflow !== 'trace' && !selected && !creating && <Card title={`Danh sách ${screen.title.toLocaleLowerCase('vi')}`}>
      <div className="warehouse-work-filters">
        <label>Tìm chứng từ<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Mã chứng từ, đơn hàng, SKU hoặc lô hàng" /></label>
        <label>Trạng thái<select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Lọc theo kho<select value={warehouseFilter} onChange={e => setWarehouseFilter(e.target.value)}><option value="">Tất cả kho</option>{warehouses.data?.filter(w => admin || user?.scope?.warehouseIds.includes(w.id)).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
      </div>
      <p className="muted">{visibleRows.length} chứng từ · Chọn mã chứng từ để xem và xử lý.</p>
      <QueryState query={docs}>{() => <SimpleTable rows={visibleRows} columns={[
      { header: 'Chứng từ', width: '320px', cell: w => <button className="btn btn-sm warehouse-document-code" onClick={() => { setSelected(w.document.id); setError(''); }}><span>{w.document.code}</span></button> },
      { header: 'Loại / lý do', width: '220px', cell: w => `${kinds[w.document.kind]} · ${reasons[w.document.reason]}` },
      { header: 'Kho', width: '220px', cell: w => `${whName(w.document.warehouseId)}${w.document.destinationWarehouseId && w.document.destinationWarehouseId !== w.document.warehouseId ? ' → ' + whName(w.document.destinationWarehouseId) : ''}` },
      { header: 'Đơn / thùng', width: '130px', cell: w => `${new Set(w.lines.map(l => l.orderCode).filter(Boolean)).size} đơn · ${w.lines.reduce((s, l) => s + l.quantity, 0)} carton` },
      { header: 'Trạng thái', width: '150px', cell: w => statuses[w.document.status] ?? w.document.status },
    ]} empty="Không có chứng từ phù hợp." />}</QueryState></Card>}
    {selected && <QueryState query={docs}>{() => !active && <Card title="Không tìm thấy chứng từ"><p>Chứng từ không thuộc màn hình này hoặc ngoài phạm vi kho của bạn.</p><Link className="btn" to={screen.path}>Về danh sách</Link></Card>}</QueryState>}
    {active && d && <Card title={`${kinds[d.kind]} · ${d.code}`}>
      <p>{reasons[d.reason]} · {whName(d.warehouseId)} · {statuses[d.status]} · {formatInstantDateTime(d.createdAt)}</p>
      {d.sourceDocumentId && <p>Chứng từ nguồn: <button className="btn btn-sm warehouse-document-code" onClick={() => setSelected(d.sourceDocumentId!)}><span>{docs.data?.find(w => w.document.id === d.sourceDocumentId)?.document.code}</span></button></p>}
      {d.note && <p>{d.note}</p>}
      {d.kind === 'Receipt' && <button className="btn" onClick={() => void printLabels(false, true)}>In / Lưu PDF phiếu nhập kho</button>}
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
      {admin && d.kind === 'Request' && d.status === 'Open' && <button className="btn" disabled={busy} onClick={() => void act(`${base}/${d.id}/cancel`, { expectedVersion: d.version })}>Hủy yêu cầu chưa lấy hàng</button>}
      {canCreateChild && <button className="btn btn-primary" disabled={busy} onClick={() => void act(`${base}/${d.id}/create-document`, undefined, true)}>{d.kind === 'Request' ? 'Tạo phiếu xuất kho để quét' : 'Tạo phiếu nhập kho nhận'}</button>}
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
