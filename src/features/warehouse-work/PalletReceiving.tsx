import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, http } from '@/shared/api/http';
import { errorMessage } from '@/shared/api/errors';
import { SimpleTable } from '@/shared/ui';
import { PalletCamera } from './PalletCamera';
import { formatInstantDateTime } from '@/shared/lib/dates';

type Disposition = 'Accepted' | 'Damaged' | 'Missing';
interface Inspection { cartonCode: string; disposition: Disposition | ''; reason: string; quarantineLocation: string }
interface Report { palletCode: string; cartons: Inspection[] }
interface Manifest { pallet: { code: string }; sku: string; cartons: { code: string }[] }
interface Scan { id: string; palletCode: string; scannedByUserId: string; scannedByName: string; scannedAt: string; source: string; documentVersion: number; manifest: Manifest }
const labels = { Accepted: 'Đạt', Damaged: 'Hỏng · cách ly', Missing: 'Thiếu', '': 'Chưa kiểm' };

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
  async function preview(code: string) {
    if (running.current) return;
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
      await http.post(`${path}/receive-pallet`, { palletCode: manifest.pallet.code, expectedVersion: scan.documentVersion, scanId: scan.id, cartons: rows });
      setManifest(undefined); setRows([]); setScan(undefined);
      await refresh();
    } catch (e) { setError(errorMessage(e)); await refresh(); }
    finally { running.current = false; setBusy(false); }
  }
  async function refresh() {
    await Promise.all(['receipt-scans', 'receipt-inspection', 'warehouse-documents', 'factory-pending', 'inventory', 'qr-inventory', 'batches', 'qr-labels'].map(key => client.invalidateQueries({ queryKey: [key] })));
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
  return <section>
    <h3>Kiểm đếm pallet và sổ hàng cách ly</h3>
    <p>Quét pallet chỉ mở danh sách kiểm đếm. Xác nhận nhận mới cộng carton đạt vào tồn. Hàng hỏng giữ tại vị trí cách ly, không có QR khả dụng để soạn; hàng thiếu không cộng tồn. Kết quả đã nhận không sửa trực tiếp.</p>
    {error && <p role="alert" className="danger">{error}</p>}
    {reports.isError && <p role="alert">{errorMessage(reports.error)}</p>}
    {editable && <>
      {initialCode && <p>Pallet dự kiến trên phiếu: <b className="warehouse-pallet-code">{initialCode}</b></p>}
      {!manifest && <PalletCamera disabled={busy} onScan={preview} />}
      {manifest && <>
        <p role="status">Đã quét đúng pallet · {scan && formatInstantDateTime(scan.scannedAt)}. Chờ kiểm đếm và xác nhận nhập.</p>
        <p>{manifest.pallet.code} · {manifest.sku} · {rows.length} carton</p>
        <button className="btn" disabled={busy} onClick={() => setRows(items => items.map(r => r.disposition ? r : { ...r, disposition: 'Accepted' }))}>Đánh dấu các carton chưa kiểm là đạt</button>
        <SimpleTable rows={rows} columns={[
          { header: 'CID', cell: r => r.cartonCode },
          { header: 'Kiểm đếm', cell: r => <select disabled={busy} aria-label={`Kết quả ${r.cartonCode}`} value={r.disposition} onChange={e => update(r.cartonCode, { disposition: e.target.value as Inspection['disposition'] })}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> },
          { header: 'Lý do thiếu/hỏng', cell: r => <input maxLength={300} disabled={busy || r.disposition === 'Accepted'} aria-label={`Lý do ${r.cartonCode}`} value={r.reason} onChange={e => update(r.cartonCode, { reason: e.target.value })} /> },
          { header: 'Vị trí cách ly', cell: r => <input maxLength={100} disabled={busy || r.disposition !== 'Damaged'} aria-label={`Vị trí ${r.cartonCode}`} value={r.quarantineLocation} onChange={e => update(r.cartonCode, { quarantineLocation: e.target.value })} /> },
        ]} />
        <p>Đạt: {rows.filter(r => r.disposition === 'Accepted').length} · Cách ly: {rows.filter(r => r.disposition === 'Damaged').length} · Thiếu: {rows.filter(r => r.disposition === 'Missing').length}</p>
        <button className="btn btn-primary" disabled={busy || !valid} onClick={() => void receive()}>Xác nhận kết quả và nhận pallet</button>
        <button className="btn" disabled={busy} onClick={() => { setManifest(undefined); setRows([]); setScan(undefined); }}>Hủy kiểm đếm chưa lưu</button>
      </>}
      <button className="btn" disabled={busy || !!manifest || (!reports.data?.length && receivedCount === 0)} onClick={() => void close()}>Hoàn tất phiếu nhập</button>
    </>}
    {scans.isError && <p role="alert">{errorMessage(scans.error)}</p>}
    <h3>Lịch sử quét pallet trên phiếu</h3>
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
  </section>;
}
