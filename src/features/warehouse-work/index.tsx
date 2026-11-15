import { PalletReceiving } from "./PalletReceiving";
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/shared/auth/AuthContext';
import { get, http } from '@/shared/api/http';
import { errorMessage } from '@/shared/api/errors';
import { Card, PageHeader, QueryState, SimpleTable } from '@/shared/ui';
import { receiptApi } from '@/features/receipts/api';
import { pickingApi } from '@/features/runpicking/api';
import type { BatchInventoryItem } from '@/features/batches/types';
import { Link } from 'react-router-dom';
import { TraceLookup } from '@/features/factory-traceability';
import { formatDate, formatInstantDateTime } from '@/shared/lib/dates';

interface Document { id: string; code: string; kind: 'Request' | 'Picking' | 'Issue' | 'Receipt'; reason: 'Transfer' | 'Order' | 'Factory'; warehouseId: string; destinationWarehouseId: string | null; sourceDocumentId: string | null; status: string; version: number; note: string | null; createdAt: string }
interface Line { id: string; sku: string; productName: string; batchCode: string | null; sourceLotCode: string | null; orderCode: string | null; quantity: number; expirationDate: string }
interface Carton { id: string; cartonId: string; lineId: string; scannedAt: string | null }
interface Work { document: Document; lines: Line[]; cartons: Carton[]; pallets?: { palletCode: string; cartonCode: string; unitsPerCarton: number }[] }
const kinds = { Request: 'Yêu cầu kho', Picking: 'Phiếu soạn hàng', Issue: 'Phiếu xuất kho', Receipt: 'Phiếu nhập kho' };
const reasons = { Transfer: 'Luân chuyển kho', Order: 'Xuất cho đơn hàng', Factory: 'Nhận từ nhà máy' };
const statuses: Record<string, string> = { Open: 'Chờ thực hiện', Prepared: 'Đã soạn đủ · chờ xuất', Posted: 'Đã ghi sổ', Fulfilled: 'Đã thực hiện', Cancelled: 'Đã hủy' };
const base = '/warehouse-documents';

export function WarehouseWorkPage() {
  const { user } = useAuth();
  const admin = user?.role === 'Admin';
  const client = useQueryClient();
  const [selected, setSelected] = useState('');
  const [wh, setWh] = useState('');
  const [destination, setDestination] = useState('');
  const [reason, setReason] = useState<'Order' | 'Transfer'>('Order');
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [transferLines, setTransferLines] = useState<{ batchId: string; quantity: number }[]>([]);
  const [note, setNote] = useState('');
  const [scan, setScan] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [trace, setTrace] = useState('');
  const scanInput = useRef<HTMLInputElement>(null);
  const operation = useRef<{ fingerprint: string; key: string } | null>(null);
  const inFlight = useRef(false);
  const docs = useQuery({ queryKey: ['warehouse-documents'], queryFn: () => get<Work[]>(base) });
  const warehouses = useQuery({ queryKey: ['warehouse-work', 'warehouses'], queryFn: receiptApi.warehouses });
  const pickings = useQuery({ queryKey: ['warehouse-work', 'picking', wh], queryFn: () => pickingApi.lists(wh), enabled: admin && !!wh });
  const batches = useQuery({ queryKey: ['warehouse-work', 'batches', wh], queryFn: () => get<BatchInventoryItem[]>('/inventory', { warehouseId: wh }), enabled: admin && !!wh && reason === 'Transfer' });
  const active = docs.data?.find(x => x.document.id === selected);
  const whName = (id: string | null) => warehouses.data?.find(w => w.id === id)?.name ?? id ?? '—';
  const selectable = (pickings.data ?? []).filter(p => p.status === 'Pending' && !docs.data?.some(d => d.document.kind === 'Request' && d.document.status !== 'Cancelled' && d.lines.some(l => l.orderCode === p.orderCode) && d.document.warehouseId === wh));
  async function act(path: string, payload?: unknown, idempotent = false) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError(''); setNotice('');
    try {
      const fingerprint = JSON.stringify([path, payload]);
      if (idempotent && operation.current?.fingerprint !== fingerprint) operation.current = { fingerprint, key: crypto.randomUUID() };
      const { data } = await http.post<Work>(path, payload, idempotent ? { headers: { 'Idempotency-Key': operation.current!.key } } : undefined);
      operation.current = null;
      await client.invalidateQueries({ queryKey: ['warehouse-documents'] });
      await client.invalidateQueries({ queryKey: ['warehouse-work'] });
      await client.invalidateQueries({ queryKey: ['qr-inventory'] });
      await client.invalidateQueries({ queryKey: ['inventory'] });
      await client.invalidateQueries({ queryKey: ['batches'] });
      await client.invalidateQueries({ queryKey: ['qr-labels'] });
      setSelected(data.document.id); setScan(''); setNotice('Đã lưu chứng từ.');
    } catch (e) {
      setError(errorMessage(e));
      // Refresh versions after concurrent changes or a lost response; keep scanner input
      // and the idempotency key so the operator can safely retry the same operation.
      await client.invalidateQueries({ queryKey: ['warehouse-documents'] });
      await client.invalidateQueries({ queryKey: ['warehouse-work'] });
      await client.invalidateQueries({ queryKey: ['qr-inventory'] });
      await client.invalidateQueries({ queryKey: ['batches'] });
    }
    finally { inFlight.current = false; setBusy(false); scanInput.current?.focus(); }
  }
  async function printLabels(stock = false) {
    if (!active) return;
    const win = window.open('', '_blank');
    if (!win) { setError('Cho phép mở cửa sổ để in nhãn.'); return; }
    try {
      const { data } = await http.get<string>(`${base}/${active.document.id}/${stock ? 'stock-labels' : 'labels'}`, { responseType: 'text' });
      win.document.open(); win.document.write(data); win.document.close();
    } catch (e) { win.close(); setError(errorMessage(e)); }
  }
  const d = active?.document;
  const canCreateChild = d && !admin && ((d.kind === 'Request' && d.status === 'Open') || (d.kind === 'Issue' && d.reason === 'Transfer' && d.status === 'Posted')) && !docs.data?.some(x => x.document.sourceDocumentId === d.id);
  return <>
    <PageHeader title="Chứng từ nhập · xuất · luân chuyển" subtitle="Admin phát hành yêu cầu; thủ kho soạn và kiểm tra carton, sau đó xác nhận lập phiếu xuất theo kho được giao." />
    <p><Link className="btn" to="/inventory">Theo dõi inventory và QR đã nhận từ nhà máy</Link></p>
    <Card title="Xuất kho sau khi retailer chấp nhận báo giá">
      <p>Đơn công nợ: accept báo giá → PO và phiếu soạn theo kho. Đơn trả trước: accept → thanh toán đủ → PO và phiếu soạn. Allocation đã xác định SKU, batch và số carton cần lấy.</p>
      <p>Admin chọn kho và các đơn có PO để phát hành yêu cầu xuất. Thủ kho mở yêu cầu → tạo phiếu soạn → quét CID đúng batch (được bỏ/đổi trước xuất) → xác nhận xuất và tạo PXK. Một yêu cầu có thể gom nhiều đơn cùng kho; hệ thống giữ mapping từng carton về từng đơn.</p>
      <p>Quét đủ chuyển phiếu sang “Đã soạn đủ · chờ xuất”; xác nhận xuất mới trừ tồn. Đơn lấy từ nhiều kho cần các kho soạn đủ trước khi ghi sổ; Operator tiếp tục phân xe và tài xế.</p>
    </Card>
    {admin && <p><Link className="btn" to="/factory-traceability">Mô phỏng nhà máy · tạo batch, pallet, carton và serial</Link></p>}
    <TraceLookup />
    <Card title="Lịch sử carton trong chứng từ kho"><label>Carton ID <input value={trace} onChange={e => setTrace(e.target.value)} placeholder="Quét hoặc nhập carton_id để xem hành trình" /></label>{trace.trim() && <SimpleTable rows={(docs.data ?? []).flatMap(w => w.cartons.filter(c => c.cartonId === trace.trim()).map(c => ({ w, c, l: w.lines.find(l => l.id === c.lineId)! })))} columns={[
      { header: 'Chứng từ', cell: x => <button className="btn btn-sm" onClick={() => setSelected(x.w.document.id)}>{x.w.document.code}</button> },
      { header: 'Nghiệp vụ / kho', cell: x => `${kinds[x.w.document.kind]} · ${whName(x.w.document.warehouseId)}` },
      { header: 'Batch / SKU / đơn', cell: x => `${x.l.batchCode ?? x.l.sourceLotCode} · ${x.l.sku} · ${x.l.orderCode ?? '—'}` },
      { header: 'Quét lúc', cell: x => x.c.scannedAt ? formatInstantDateTime(x.c.scannedAt) : 'Chưa quét' },
    ]} empty="Không tìm thấy carton trong các chứng từ thuộc phạm vi của bạn." />}</Card>
    {error && <p role="alert" className="danger">{error}</p>}{notice && <p role="status">{notice}</p>}
    <Card title={admin ? 'Phát hành yêu cầu kho' : 'Tạo phiếu nhập từ nhà máy'}>
      <form onSubmit={e => { e.preventDefault(); void act(admin ? `${base}/requests` : `${base}/factory-receipts`, admin ? { warehouseId: wh, destinationWarehouseId: reason === 'Transfer' ? destination : null, reason, orderIds: reason === 'Order' ? orderIds : [], lines: reason === 'Transfer' ? transferLines : [], note } : { warehouseId: wh, note }, true); }}>
        <div className="row-wrap" style={{ gap: 12, marginBottom: 12 }}>
          <label>Kho thực hiện <select required value={wh} onChange={e => { setWh(e.target.value); setOrderIds([]); setTransferLines([]); }}><option value="">Chọn kho</option>{warehouses.data?.filter(w => w.isActive).map(w => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></label>
          {admin && <label>Lý do <select value={reason} onChange={e => setReason(e.target.value as typeof reason)}><option value="Order">Xuất cho đơn hàng</option><option value="Transfer">Xuất luân chuyển</option></select></label>}
          {admin && reason === 'Transfer' && <label>Kho nhận <select required value={destination} onChange={e => setDestination(e.target.value)}><option value="">Chọn kho nhận</option>{warehouses.data?.filter(w => w.id !== wh && w.isActive).map(w => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></label>}
        </div>
        {admin && reason === 'Order' && <><p>Chọn các đơn có PO tại kho để phát hành một yêu cầu xuất tổng.</p>{pickings.isError && <p role="alert">{errorMessage(pickings.error)}</p>}<SimpleTable rows={selectable} columns={[
          { header: 'Chọn', cell: p => <input type="checkbox" aria-label={`Chọn đơn ${p.orderCode}`} checked={orderIds.includes(p.orderId)} onChange={e => setOrderIds(e.target.checked ? [...orderIds, p.orderId] : orderIds.filter(id => id !== p.orderId))} /> },
          { header: 'Đơn / khách hàng', cell: p => `${p.orderCode} · ${p.retailerName}` },
          { header: 'Batch theo allocation', cell: p => p.items.map(i => `${i.sku}: ${i.batchCode} (${i.requestedQuantity} carton)`).join('; ') },
        ]} /></>}
        {admin && reason === 'Transfer' && <>{batches.isError && <p role="alert">{errorMessage(batches.error)}</p>}<SimpleTable rows={(batches.data ?? []).filter(b => b.availableQuantity > 0 && b.expiryStatus !== 'Expired')} columns={[
          { header: 'SKU / batch / HSD', cell: b => `${b.sku} · ${b.batchCode} · ${formatDate(b.expirationDate)}` },
          { header: 'Khả dụng', cell: b => b.availableQuantity },
          { header: 'Carton chuyển', cell: b => <input aria-label={`Số carton ${b.batchCode}`} type="number" min={0} max={b.availableQuantity} step={1} value={transferLines.find(l => l.batchId === b.batchId)?.quantity ?? 0} onChange={e => setTransferLines([...transferLines.filter(l => l.batchId !== b.batchId), ...(Number(e.target.value) > 0 ? [{ batchId: b.batchId, quantity: Number(e.target.value) }] : [])])} /> },
        ]} /></>}
        {!admin && <p>Chọn kho nhận và tạo phiếu. Quét mã pallet đã được nhà máy phát hành đến kho này để tự động nhận toàn bộ carton/SKU. Mỗi lần quét hợp lệ cộng tồn ngay; quét trùng không cộng lại.</p>}
        <div className="row-wrap" style={{ gap: 12, marginTop: 12 }}><label>Ghi chú / chứng từ nhà máy <input value={note} onChange={e => setNote(e.target.value)} /></label><button className="btn btn-primary" disabled={busy || !wh || admin && (reason === 'Order' ? !orderIds.length : !transferLines.length)}>{admin ? 'Phát hành yêu cầu' : 'Tạo phiếu nhập từ nhà máy'}</button></div>
      </form>
    </Card>
    <Card title="Danh sách chứng từ"><QueryState query={docs}>{rows => <SimpleTable rows={rows} columns={[
      { header: 'Chứng từ', cell: w => <button className="btn btn-sm" onClick={() => { setSelected(w.document.id); setError(''); }}>{w.document.code}</button> },
      { header: 'Loại / lý do', cell: w => `${kinds[w.document.kind]} · ${reasons[w.document.reason]}` },
      { header: 'Kho', cell: w => `${whName(w.document.warehouseId)}${w.document.destinationWarehouseId ? ' → ' + whName(w.document.destinationWarehouseId) : ''}` },
      { header: 'Đơn / carton', cell: w => `${new Set(w.lines.map(l => l.orderCode).filter(Boolean)).size} đơn · ${w.lines.reduce((s, l) => s + l.quantity, 0)} carton` },
      { header: 'Trạng thái', cell: w => statuses[w.document.status] ?? w.document.status },
    ]} />}</QueryState></Card>
    {active && d && <Card title={`${kinds[d.kind]} · ${d.code}`}>
      <p>{reasons[d.reason]} · {whName(d.warehouseId)} · {statuses[d.status]} · {formatInstantDateTime(d.createdAt)}</p>
      {d.sourceDocumentId && <p>Chứng từ nguồn: <button className="btn btn-sm" onClick={() => setSelected(d.sourceDocumentId!)}>{docs.data?.find(w => w.document.id === d.sourceDocumentId)?.document.code}</button></p>}
      {d.note && <p>{d.note}</p>}
      <h3>Tổng hợp lấy hàng theo SKU / batch</h3>
      <SimpleTable rows={Object.values(active.lines.reduce<Record<string, { sku: string; batch: string; expiry: string; required: number; scanned: number }>>((result, line) => {
        const key = `${line.sku}:${line.batchCode ?? line.sourceLotCode}:${line.expirationDate}`;
        const row = result[key] ??= { sku: line.sku, batch: line.batchCode ?? line.sourceLotCode ?? 'Chờ nhập', expiry: line.expirationDate, required: 0, scanned: 0 };
        row.required += line.quantity; row.scanned += active.cartons.filter(c => c.lineId === line.id && c.scannedAt).length;
        return result;
      }, {})).sort((a, b) => a.expiry.localeCompare(b.expiry))} columns={[
        { header: 'SKU', cell: r => r.sku }, { header: 'Batch cần lấy', cell: r => r.batch }, { header: 'HSD', cell: r => formatDate(r.expiry) },
        { header: 'Tổng carton', cell: r => r.required }, { header: 'Đã quét', cell: r => r.scanned }, { header: 'Còn lấy', cell: r => r.required - r.scanned },
      ]} />
      {admin && d.kind === 'Request' && d.status === 'Open' && <button className="btn" disabled={busy} onClick={() => void act(`${base}/${d.id}/cancel`, { expectedVersion: d.version })}>Hủy yêu cầu chưa lấy hàng</button>}
      {canCreateChild && <button className="btn btn-primary" disabled={busy} onClick={() => void act(`${base}/${d.id}/create-document`, undefined, true)}>{d.kind === 'Request' ? 'Tạo phiếu soạn cho yêu cầu' : 'Tạo phiếu nhập kho nhận'}</button>}
      <SimpleTable rows={active.lines} columns={[
        { header: 'Đơn hàng', cell: l => l.orderCode ?? '—' }, { header: 'SKU / sản phẩm', cell: l => `${l.sku} · ${l.productName}` },
        { header: 'Mã tồn / batch nhà máy', cell: l => [l.batchCode, l.sourceLotCode].filter(Boolean).join(' · ') || 'Chờ nhập' }, { header: 'HSD', cell: l => formatDate(l.expirationDate) },
        { header: 'Số carton', cell: l => l.quantity }, { header: 'Đã quét', cell: l => active.cartons.filter(c => c.lineId === l.id && c.scannedAt).length },
      ]} />
      {d.kind !== 'Request' && <>
        {d.reason === 'Factory' && <PalletReceiving key={d.id} documentId={d.id} version={d.version} receivedCount={active.cartons.length} editable={!admin && d.status === 'Open'} />}<p>Tiến độ: {active.cartons.filter(c => c.scannedAt).length} / {active.lines.reduce((s, l) => s + l.quantity, 0)} carton. Mỗi mã QR đại diện một carton chứa một SKU.</p>
        {!admin && d.kind === 'Picking' && d.status === 'Open' && active.lines.some(l => !l.sourceLotCode?.startsWith('BID-')) && <div className="row-wrap" style={{ gap: 12 }}><button className="btn" disabled={busy} onClick={() => void act(`${base}/${d.id}/prepare-cartons`)}>Chuẩn bị nhãn một carton cho hàng tồn</button><button className="btn" onClick={() => void printLabels(true)}>Mở nhãn hàng tồn để in</button><span className="muted">Dán nhãn mới lên từng carton; nhãn gộp cũ sau khi tách sẽ hết hiệu lực.</span></div>}{active.cartons.length > 0 && d.reason !== 'Factory' && <button className="btn" onClick={() => void printLabels()}>In nhãn QR carton</button>}
        {!admin && d.reason !== 'Factory' && (d.status === 'Open' || d.status === 'Prepared') && <form onSubmit={e => { e.preventDefault(); if (scan.trim()) void act(`${base}/${d.id}/scans`, { cartonId: scan.trim(), expectedVersion: d.version }); }} className="row-wrap" style={{ gap: 12, margin: '14px 0' }}>
          <label>Quét carton_id <input ref={scanInput} autoComplete="off" value={scan} onChange={e => setScan(e.target.value)} placeholder="Quét QR bằng máy đọc rồi Enter" disabled={busy} /></label>
          <button className="btn" disabled={busy || !scan.trim() || d.status !== 'Open'}>Ghi nhận carton</button>
          <button type="button" className="btn btn-primary" disabled={busy || active.cartons.length === 0 || active.cartons.filter(c => c.scannedAt).length !== active.lines.reduce((s, l) => s + l.quantity, 0)} onClick={() => void act(`${base}/${d.id}/post`, { expectedVersion: d.version })}>Xác nhận {d.kind === 'Picking' || d.kind === 'Issue' ? 'xuất và lập PXK' : 'nhập'} kho</button>
        </form>}
        <SimpleTable rows={active.cartons} columns={[
          { header: 'Carton ID / QR', cell: c => c.cartonId },
          { header: 'Sửa khi đang soạn', cell: c => !admin && d.kind === 'Picking' && ['Open', 'Prepared'].includes(d.status) ? <div className="row-wrap">
            <button className="btn btn-sm" disabled={busy} onClick={() => { const reason = window.prompt('Lý do bỏ carton khỏi phiếu soạn:'); if (reason?.trim()) void act(`${base}/${d.id}/remove-carton`, { cartonCode: c.cartonId, reason, expectedVersion: d.version }); }}>Bỏ carton</button>
            <button className="btn btn-sm" disabled={busy} onClick={() => { const replacementCode = window.prompt('Quét/nhập CID thay thế cùng batch:'); if (!replacementCode?.trim()) return; const reason = window.prompt('Lý do đổi carton:'); if (reason?.trim()) void act(`${base}/${d.id}/remove-carton`, { cartonCode: c.cartonId, replacementCode, reason, expectedVersion: d.version }); }}>Đổi carton</button>
          </div> : 'Đã khóa / không áp dụng' }, { header: 'Pallet gốc / sản phẩm trong carton', cell: c => { const m = active.pallets?.find(p => p.cartonCode === c.cartonId); return m ? `${m.palletCode} · ${m.unitsPerCarton} sản phẩm` : 'Hàng tồn cũ'; } }, { header: 'SKU', cell: c => active.lines.find(l => l.id === c.lineId)?.sku },
          { header: 'Quét lúc', cell: c => c.scannedAt ? formatInstantDateTime(c.scannedAt) : 'Chờ quét' },
        ]} />
      </>}
    </Card>}
  </>;
}
