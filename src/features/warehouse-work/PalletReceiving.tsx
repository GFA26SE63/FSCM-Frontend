import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, http } from '@/shared/api/http';
import { errorMessage } from '@/shared/api/errors';
import { ConfirmDialog, SimpleTable } from '@/shared/ui';
import { PalletCamera } from './PalletCamera';
import { formatInstantDateTime } from '@/shared/lib/dates';

type Disposition = 'Accepted' | 'Damaged' | 'Missing';
interface Inspection { cartonCode: string; disposition: Disposition | ''; reason: string; quarantineLocation: string }
interface Report { palletCode: string; cartons: Inspection[] }
interface Manifest { pallet: { code: string }; sku: string; cartons: { code: string }[] }
interface Scan { id: string; palletCode: string; scannedByUserId: string; scannedByName: string; scannedAt: string; source: string; documentVersion: number; manifest: Manifest }
const labels = { Accepted: 'Đạt', Damaged: 'Hỏng · cách ly', Missing: 'Thiếu', '': 'Chưa kiểm' };
/** `missing`: the whole pallet was recorded "Thiếu" (never arrived); it counts as handled like a received pallet. */
interface ExpectedPallet { palletId: string; palletCode: string; batchCode: string; sku: string; productName: string; cartonCount: number; expirationDate: string; received: boolean; receivedAt: string | null; missing?: boolean }
/** GET /warehouse-documents/{id}/expected-pallets: the dispatch note behind a factory PNK and its pallets. */
interface Expectation { dispatchNoteId: string; dispatchCode: string; vehicleNumber: string | null; driverName: string | null; pallets: ExpectedPallet[] }
const asExpectation = (data: unknown): Expectation | null =>
  data && typeof data === 'object' && Array.isArray((data as Expectation).pallets) ? data as Expectation : null;
/** Client-side check before the server scan: the pallet must be on the note and not received yet. */
const scanProblem = (expectation: Expectation, code: string): string => {
  const pallet = expectation.pallets.find(p => p.palletCode === code.trim());
  if (!pallet) return `Pallet ${code.trim()} không thuộc phiếu xuất ${expectation.dispatchCode}. Chỉ quét các pallet trong danh sách cần nhận.`;
  return pallet.received ? `Pallet ${pallet.palletCode} đã được nhận trên phiếu này.` : '';
};
/** Free-text fields are sent without surrounding whitespace (also trimmed on blur in the inputs). */
const trimmed = (r: Inspection): Inspection => ({ ...r, reason: r.reason.trim(), quarantineLocation: r.quarantineLocation.trim() });

export function PalletReceiving({ documentId, version, editable, receivedCount = 0, initialCode = '' }: { documentId: string; version: number; editable: boolean; receivedCount?: number; initialCode?: string }) {
  const client = useQueryClient();
  const [scan, setScan] = useState<Scan>();
  const [manifest, setManifest] = useState<Manifest>();
  const [rows, setRows] = useState<Inspection[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const path = `/warehouse-documents/${documentId}`;
  const reports = useQuery({ queryKey: ['receipt-inspection', documentId], queryFn: () => get<Report[]>(`${path}/receipt-reports`) });
  const scans = useQuery({ queryKey: ['receipt-scans', documentId], queryFn: () => get<Scan[]>(`${path}/pallet-scans`) });
  // Dispatch-note PNK: the pallets to receive (204 / empty for receipts opened from a single pallet).
  const expected = useQuery({ queryKey: ['receipt-expected', documentId], queryFn: () => get<Expectation | ''>(`${path}/expected-pallets`) });
  const expectation = asExpectation(expected.data);
  const remaining = expectation?.pallets.filter(p => !p.received) ?? [];
  const allReceived = !!expectation && expectation.pallets.length > 0 && remaining.length === 0;
  async function preview(code: string) {
    if (running.current) return;
    const wrong = expectation && scanProblem(expectation, code);
    if (wrong) { setError(wrong); return; }
    running.current = true; setBusy(true); setError('');
    try {
      setScan(undefined); setManifest(undefined); setRows([]);
      const { data } = await http.post<Scan>(`${path}/pallet-scans`, { code: code.trim(), expectedVersion: version, source: 'Camera' });
      setScan(data); setManifest(data.manifest);
      setRows(data.manifest.cartons.map(c => ({ cartonCode: c.code, disposition: '', reason: '', quarantineLocation: '' })));
    } catch (e) { setError(errorMessage(e)); }
    finally { await refresh(); running.current = false; setBusy(false); }
  }
  async function receive() {
    if (running.current || !manifest || !scan) return;
    running.current = true; setBusy(true); setError('');
    try {
      await http.post(`${path}/receive-pallet`, { palletCode: manifest.pallet.code, expectedVersion: scan.documentVersion, scanId: scan.id, cartons: rows.map(trimmed) });
      setManifest(undefined); setRows([]); setScan(undefined);
      await refresh();
    } catch (e) { setError(errorMessage(e)); await refresh(); }
    finally { running.current = false; setBusy(false); }
  }
  async function refresh() {
    await Promise.all(['receipt-scans', 'receipt-inspection', 'receipt-expected', 'warehouse-documents', 'factory-pending', 'inventory', 'qr-inventory', 'batches', 'qr-labels'].map(key => client.invalidateQueries({ queryKey: [key] })));
  }
  async function close() {
    if (running.current) return;
    running.current = true; setBusy(true); setError('');
    try { await http.post(`${path}/post`, { expectedVersion: version }); await refresh(); }
    catch (e) { setError(errorMessage(e)); await refresh(); }
    finally { running.current = false; setBusy(false); }
  }
  const valid = !!scan && rows.length > 0 && rows.every(r => r.disposition && (r.disposition === 'Accepted' || r.reason.trim()) && (r.disposition !== 'Damaged' || r.quarantineLocation.trim()));
  const update = (code: string, value: Partial<Inspection>) => setRows(items => items.map(r => r.cartonCode === code ? { ...r, ...value } : r));
  const [confirming, setConfirming] = useState(false);
  // "Thiếu cả pallet": the pallet on the dispatch note never arrived, so it cannot be scanned.
  const [missingTarget, setMissingTarget] = useState('');
  const [missingReasonState, setMissingReason] = useState('');
  const missingReason = missingReasonState ?? '';
  const missingCount = expectation?.pallets.filter(p => p.missing).length ?? 0;
  async function markMissing() {
    if (running.current || !missingTarget) return;
    const reason = missingReason.trim();
    if (!reason) { setError('Nhập lý do thiếu pallet.'); return; }
    running.current = true; setBusy(true); setError('');
    try {
      await http.post(`${path}/missing-pallet`, { palletCode: missingTarget, expectedVersion: version, reason });
      setMissingTarget(''); setMissingReason('');
    } catch (e) { setError(errorMessage(e)); }
    finally { await refresh(); running.current = false; setBusy(false); }
  }
  const counts = {
    accepted: rows.filter(r => r.disposition === 'Accepted').length,
    damaged: rows.filter(r => r.disposition === 'Damaged').length,
    missing: rows.filter(r => r.disposition === 'Missing').length,
  };
  return <section>
    <h3>Kiểm đếm pallet và sổ hàng cách ly</h3>
    <p>Quét pallet chỉ mở danh sách kiểm đếm. Xác nhận nhận mới cộng thùng đạt vào tồn. Hàng hỏng giữ tại vị trí cách ly, không có QR khả dụng để soạn; hàng thiếu không cộng tồn. Kết quả đã nhận không sửa trực tiếp.</p>
    {error && <p role="alert" className="danger">{error}</p>}
    {reports.isError && <p role="alert">{errorMessage(reports.error)}</p>}
    {expected.isError && <p role="alert">{errorMessage(expected.error)}</p>}
    {expectation && <div className="pallet-expected">
      <h4 style={{ margin: '0 0 6px' }}>
        Phiếu xuất nhà máy <b className="warehouse-pallet-code">{expectation.dispatchCode}</b>
        {` · Đã xử lý ${expectation.pallets.length - remaining.length} / ${expectation.pallets.length} pallet${missingCount ? ` (thiếu cả pallet: ${missingCount})` : ''}`}
      </h4>
      <p className="muted" style={{ margin: '0 0 8px' }}>Xe / tài xế: {[expectation.vehicleNumber, expectation.driverName].filter(Boolean).join(' · ') || '—'}</p>
      <SimpleTable rows={expectation.pallets} columns={[
        { header: 'Pallet cần nhận', cell: p => <b className="warehouse-pallet-code">{p.palletCode}</b> },
        { header: 'SKU / lô hàng', cell: p => `${p.sku} · ${p.productName} · ${p.batchCode}` },
        { header: 'Thùng', align: 'right', cell: p => p.cartonCount },
        { header: 'Trạng thái', cell: p => p.received && p.missing
          ? <span className="chip tone-danger">Thiếu cả pallet</span>
          : p.received
          ? <span className="chip tone-success">Đã nhận{p.receivedAt ? ` · ${formatInstantDateTime(p.receivedAt)}` : ''}</span>
          : manifest?.pallet.code === p.palletCode ? <span className="chip tone-info">Đang kiểm đếm</span>
          : <span className="chip tone-warn">Chờ quét</span> },
        ...(editable ? [{ header: 'Thao tác', cell: (p: ExpectedPallet) => p.received || manifest?.pallet.code === p.palletCode ? '—'
          : <button className="btn btn-sm" disabled={busy || !!manifest} onClick={() => { setError(''); setMissingReason(''); setMissingTarget(p.palletCode); }}>Đánh dấu thiếu cả pallet</button> }] : []),
      ]} />
    </div>}
    {editable && <>
      {!expectation && initialCode && <p>Pallet dự kiến trên phiếu: <b className="warehouse-pallet-code">{initialCode}</b></p>}
      {expectation && !manifest && remaining.length > 0 && <p>Quét QR của một pallet đang <b>Chờ quét</b> ({remaining.map(p => p.palletCode).join(', ')}) để kiểm đếm thùng.</p>}
      {allReceived && expectation && !manifest && <p role="status">{`Đã nhận đủ ${expectation.pallets.length} pallet của phiếu xuất. Bấm `} <b>Hoàn tất &amp; Thực hiện nhập kho</b> để xác nhận toàn bộ PNK.</p>}
      {!manifest && (!expectation || remaining.length > 0) && <PalletCamera disabled={busy} onScan={preview} />}
      {manifest && <>
        <p role="status">Đã quét đúng pallet · {scan && formatInstantDateTime(scan.scannedAt)}. Chờ kiểm đếm và xác nhận nhập.</p>
        <p>{manifest.pallet.code} · {manifest.sku} · {rows.length} carton</p>
        <button className="btn" disabled={busy} onClick={() => setRows(items => items.map(r => r.disposition ? r : { ...r, disposition: 'Accepted' }))}>Đánh dấu các carton chưa kiểm là đạt</button>
        <SimpleTable rows={rows} columns={[
          { header: 'CID', cell: r => r.cartonCode },
          { header: 'Kiểm đếm', cell: r => <select disabled={busy} aria-label={`Kết quả ${r.cartonCode}`} value={r.disposition} onChange={e => update(r.cartonCode, { disposition: e.target.value as Inspection['disposition'] })}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> },
          { header: 'Lý do thiếu/hỏng', cell: r => <input maxLength={300} disabled={busy || r.disposition === 'Accepted'} aria-label={`Lý do ${r.cartonCode}`} value={r.reason} onChange={e => update(r.cartonCode, { reason: e.target.value })} onBlur={e => update(r.cartonCode, { reason: e.target.value.trim() })} /> },
          { header: 'Vị trí cách ly', cell: r => <input maxLength={100} disabled={busy || r.disposition !== 'Damaged'} aria-label={`Vị trí ${r.cartonCode}`} value={r.quarantineLocation} onChange={e => update(r.cartonCode, { quarantineLocation: e.target.value })} onBlur={e => update(r.cartonCode, { quarantineLocation: e.target.value.trim() })} /> },
        ]} />
        <p>Đạt: {counts.accepted} · Cách ly: {counts.damaged} · Thiếu: {counts.missing}</p>
        <div className="pallet-receiving-actions">
          <button className="btn btn-primary" disabled={busy || !valid} onClick={() => setConfirming(true)}>Xác nhận kết quả và nhận pallet</button>
          <button className="btn" disabled={busy} onClick={() => { setManifest(undefined); setRows([]); setScan(undefined); }}>Hủy kiểm đếm chưa lưu</button>
        </div>
      </>}
      <div className="pallet-receiving-actions">
        {/* Dispatch-note PNK: lights up only after every pallet of the note was received. */}
        <button className="btn btn-primary" disabled={busy || !!manifest || (expectation ? !allReceived : (!reports.data?.length && receivedCount === 0))} onClick={() => void close()}>Hoàn tất & Thực hiện nhập kho</button>
      </div>
    </>}
    {scans.isError && <p role="alert">{errorMessage(scans.error)}</p>}
    <h3 className="pallet-receiving-history">Lịch sử quét pallet trên phiếu</h3>
    <SimpleTable rows={scans.data ?? []} columns={[
      { header: 'Pallet', cell: s => s.palletCode },
      { header: 'Thời gian máy chủ', cell: s => formatInstantDateTime(s.scannedAt) },
      { header: 'Người quét', cell: s => s.scannedByName || s.scannedByUserId },
      { header: 'Thiết bị', cell: () => 'Camera' },
    ]} empty="Phiếu chưa có lần quét pallet hợp lệ." />
    <SimpleTable rows={(reports.data ?? []).flatMap(p => p.cartons.map(c => ({ ...c, palletCode: p.palletCode })))} columns={[
      { header: 'Pallet / CID', cell: r => `${r.palletCode} / ${r.cartonCode}` },
      { header: 'Kết quả nhận', cell: r => labels[r.disposition] },
      { header: 'Lý do', cell: r => r.reason || '—' },
      { header: 'Vị trí cách ly', cell: r => r.quarantineLocation || '—' },
    ]} empty="Chưa xác nhận kiểm đếm pallet." />
    <ConfirmDialog
      open={!!missingTarget}
      title="Đánh dấu thiếu cả pallet"
      confirmLabel="Ghi nhận thiếu pallet"
      danger
      onClose={() => { if (!busy) { setMissingTarget(''); setMissingReason(''); } }}
      onConfirm={markMissing}
      message={missingTarget && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ margin: 0 }}>Ghi nhận pallet <b className="warehouse-pallet-code">{missingTarget}</b> không về kho?</p>
        <label>Lý do thiếu pallet (*)
          <input maxLength={300} autoFocus disabled={busy} aria-label="Lý do thiếu pallet" value={missingReason}
            onChange={e => setMissingReason(e.target.value)} onBlur={e => setMissingReason(e.target.value.trim())}
            placeholder="VD: Xe giao thiếu, nhà máy chưa xếp lên xe" />
        </label>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--c-text-muted, #666)' }}>
          Toàn bộ thùng của pallet được ghi "Thiếu", không cộng tồn kho và được báo về nhà máy. Kết quả này không sửa được sau khi ghi nhận.
        </p>
      </div>}
    />
    <ConfirmDialog
      open={confirming && !!manifest}
      title="Xác nhận kết quả kiểm đếm pallet"
      confirmLabel="Xác nhận và nhận pallet"
      onClose={() => { if (!busy) setConfirming(false); }}
      onConfirm={async () => { await receive(); setConfirming(false); }}
      message={manifest && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ margin: 0 }}>Xác nhận kết quả kiểm đếm và nhận pallet <b className="warehouse-pallet-code">{manifest.pallet.code}</b>?</p>
        <div style={{ background: 'var(--c-bg-subtle, #f8f9fa)', padding: 12, borderRadius: 8, fontSize: 14 }}>
          <div><b>Sản phẩm:</b> {manifest.sku} · {rows.length} carton</div>
          <div><b>Đạt:</b> {counts.accepted} · <b>Hỏng (cách ly):</b> {counts.damaged} · <b>Thiếu:</b> {counts.missing}</div>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--c-text-muted, #666)' }}>
          Thùng đạt được cộng vào tồn kho. Kết quả đã nhận không sửa trực tiếp được.
        </p>
      </div>}
    />
  </section>;
}
