import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { get } from '@/shared/api/http';
import { Card, PageHeader, QueryState, SimpleTable } from '@/shared/ui';
import { formatDate, formatInstantDateTime } from '@/shared/lib/dates';
import { statusLabel } from '@/shared/lib/status';

interface Batch { id: string; code: string; factoryCode: string; productionLine: string; productionDate: string; expirationDate: string; unitsPerCarton: number }
interface Pallet { id: string; code: string; status: string; destinationWarehouseId: string | null; receivedAt: string | null }
interface Carton { id: string; code: string; sequence: number }
interface Unit { id: string; code: string; sequence: number }
interface Trace { currentStock: { cartonId: string; warehouseId: string; status: string; stockBatchId: string }[]; batch: Batch; sku: string; pallet: Pallet | null; carton: Carton | null; unit: Unit | null; units: Unit[]; history: { cartonId: string; code: string; kind: string; reason: string; status: string; warehouseId: string; scannedAt: string | null }[] }
const base = '/factory-traceability';
const status: Record<string, string> = { Packed: 'Đã đóng pallet', Dispatched: 'Đã xuất nhà máy', Received: 'Kho đã nhận' };

export function TraceLookup({ initialCode = '' }: { initialCode?: string }) {
  const [input, setInput] = useState(initialCode);
  const [code, setCode] = useState(initialCode);
  const trace = useQuery({ queryKey: ['factory-trace', code], queryFn: () => get<Trace>(`${base}/trace`, { code }), enabled: !!code, retry: false });
  return <Card title="Truy xuất nguồn gốc nhà máy">
    <form className="row-wrap" style={{ gap: 12 }} onSubmit={e => { e.preventDefault(); setCode(input.trim()); }}>
      <label>Mã lô hàng / pallet / thùng / sản phẩm <input required value={input} onChange={e => setInput(e.target.value)} placeholder="BID / PID / CID / UID" /></label>
      <button className="btn" disabled={trace.isFetching}>Tra cứu</button>
    </form>
    {code && <QueryState query={trace}>{t => <>
      <p>SKU <b>{t.sku}</b> · lô hàng gốc <b>{t.batch.code}</b> · Nhà máy {t.batch.factoryCode} · dây chuyền {t.batch.productionLine}</p>
      <p>NSX {formatDate(t.batch.productionDate)} · HSD {formatDate(t.batch.expirationDate)} · {t.batch.unitsPerCarton} sản phẩm/thùng</p>
      <p>Pallet: {t.pallet?.code ?? 'Tra cứu lô hàng'} · thùng: {t.carton?.code ?? '—'} · số sê-ri: {t.unit?.code ?? '—'}</p>
      {t.pallet && <p>Trạng thái chuyến nhà máy: {status[t.pallet.status]}{t.pallet.receivedAt && ` · Nhận ${formatInstantDateTime(t.pallet.receivedAt)}`}</p>}
      {t.units.length > 0 && <details><summary>{t.units.length} số sê-ri sản phẩm trong thùng</summary><SimpleTable rows={t.units} columns={[
        { header: 'Số thứ tự', cell: u => u.sequence }, { header: 'Số sê-ri sản phẩm', cell: u => u.code },
      ]} /></details>}
      <p>Pallet bên trên là pallet đóng gói ban đầu; thùng có thể đã tách và chuyển kho.</p>
      <SimpleTable rows={t.currentStock} columns={[
        { header: 'Thùng', cell: c => c.cartonId }, { header: 'Kho hiện tại / kho xuất khi đang chuyển', cell: c => c.warehouseId }, { header: 'Trạng thái hiện tại', cell: c => statusLabel('stock', c.status) },
      ]} />
      <SimpleTable rows={t.history} columns={[
        { header: 'Thùng', cell: h => h.cartonId }, { header: 'Phiếu', cell: h => h.code },
        { header: 'Nghiệp vụ', cell: h => `${statusLabel('documentKind', h.kind)} · ${statusLabel('documentReason', h.reason)} · ${statusLabel('warehouseDocument', h.status)}` },
        { header: 'Thời gian quét', cell: h => h.scannedAt ? formatInstantDateTime(h.scannedAt) : 'Chờ quét' },
      ]} empty="Chưa có giao dịch kho trong phạm vi truy cập." />
    </>}</QueryState>}
  </Card>;
}

export function FactoryTraceabilityPage() {
  const application = useQuery({ queryKey: ['factory-application'], queryFn: () => get<{ url: string }>(`${base}/application`) });
  return <>
    <PageHeader title="Hệ thống nhà máy · truy xuất nguồn gốc" subtitle="Nhà máy vận hành trong ứng dụng riêng. FSCM nhận danh sách đóng gói và gửi xác nhận nhập hàng qua API." />
    <Card title="Mở ứng dụng truy xuất nguồn gốc"><QueryState query={application}>{data => <>
      <p>Tạo lô hàng, đóng thùng, xếp pallet, in QR và phát hành đến kho trên ứng dụng nhà máy.</p>
      <a className="btn btn-primary" href={data.url} target="_blank" rel="noopener noreferrer">Mở hệ thống truy xuất nguồn gốc</a>
      <p><Link to="/warehouse-inbound">Mở màn hình nhập kho của FSCM</Link></p>
    </>}</QueryState></Card>
    <TraceLookup />
  </>;
}
