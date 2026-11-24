import { useState } from 'react';
import { Card, ConfirmDialog, QueryState, SimpleTable } from '@/shared/ui';
import { formatDate, formatInstantDateTime } from '@/shared/lib/dates';
import { useStringParam } from '@/shared/router/listState';

export interface FactoryInboundPallet {
  palletId: string; palletCode: string; destinationWarehouseId: string; dispatchedAt: string | null;
  batchCode: string; sku: string; productName: string; cartonCount: number; expirationDate: string;
  receiptDocumentId: string | null;
  dispatchNoteId?: string | null; dispatchCode?: string | null; vehicleNumber?: string | null; driverName?: string | null;
}

/**
 * One factory dispatch note (PXN) waiting at the warehouse, with every pallet on it; GET factory-pending-dispatches.
 * Pallets dispatched before dispatch notes existed come as a group of one with `dispatchNoteId` null.
 */
export interface FactoryInboundDispatch {
  key: string; dispatchNoteId: string | null; dispatchCode: string; destinationWarehouseId: string;
  dispatchedAt: string | null; vehicleNumber: string | null; driverName: string | null;
  pallets: FactoryInboundPallet[]; receiptDocumentId: string | null;
}

const cartons = (d: FactoryInboundDispatch) => d.pallets.reduce((sum, p) => sum + (p.cartonCount || 0), 0);

export function FactoryPending({ query, warehouses, admin, busy, onOpen, refresh }: {
  query: { data: FactoryInboundDispatch[] | undefined; isLoading: boolean; error: unknown };
  warehouses: { id: string; name: string }[];
  admin: boolean; busy: boolean; onOpen: (dispatch: FactoryInboundDispatch) => void; refresh: () => void;
}) {
  const [confirming, setConfirming] = useState<FactoryInboundDispatch | null>(null);
  const [warehouseFilter, setWarehouseFilter] = useStringParam('incomingWarehouse');
  const [search, setSearch] = useStringParam('incomingQuery');
  const [sort, setSort] = useStringParam('incomingSort');
  const effectiveWarehouse = warehouses.length === 1 ? warehouses[0].id : warehouses.some(w => w.id === warehouseFilter) ? warehouseFilter : '';
  const term = search.trim().toLocaleLowerCase('vi');
  const visible = (query.data ?? []).filter(d => warehouses.some(w => w.id === d.destinationWarehouseId)
    && (!effectiveWarehouse || d.destinationWarehouseId === effectiveWarehouse)
    && [d.dispatchCode, d.vehicleNumber, d.driverName, ...d.pallets.flatMap(p => [p.palletCode, p.batchCode, p.sku, p.productName])]
      .join(' ').toLocaleLowerCase('vi').includes(term));
  const sorted = [...visible].sort((a, b) => sort === 'codeAsc'
    ? a.dispatchCode.localeCompare(b.dispatchCode) : (b.dispatchedAt ?? '').localeCompare(a.dispatchedAt ?? ''));
  const warehouseName = (id: string) => warehouses.find(w => w.id === id)?.name ?? id;
  return <Card title="Hàng chờ nhận từ nhà máy">
    <p>Mỗi dòng là một phiếu xuất xưởng của nhà máy (có thể gồm nhiều pallet). Mở phiếu để quét lần lượt từng pallet và kiểm đếm thùng; mở phiếu chưa cộng tồn kho.</p>
    <section className="filter-card" aria-label="Bộ lọc nâng cao hàng chờ nhận">
      <div className="row"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14655B" strokeWidth="2" aria-hidden><path d="M3 5h18l-7 8v6l-4 2v-8z" /></svg><h2 className="sec">Bộ lọc nâng cao</h2></div>
    <div className="filter-grid">
      <label className="lbl">Tìm kiếm<input className="inp" value={search} onChange={e => setSearch(e.target.value)} placeholder="Mã phiếu xuất, pallet, lô hàng, SKU hoặc biển số xe" /></label>
      {warehouses.length > 1 ? <label className="lbl">Kho nhận<select className="inp" value={effectiveWarehouse} onChange={e => setWarehouseFilter(e.target.value)}><option value="">Tất cả kho được phân công</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
        : <p>Kho nhận: <b>{warehouses[0]?.name ?? 'Chưa được phân công kho'}</b></p>}
      <label className="lbl">Sắp xếp<select className="inp" value={sort} onChange={e => setSort(e.target.value)}><option value="">Mới nhất</option><option value="codeAsc">Mã phiếu A–Z</option></select></label>
      <div className="warehouse-filter-action"><button className="btn" type="button" disabled={busy || query.isLoading} onClick={refresh}>Làm mới hàng chờ nhận</button></div>
    </div>
    </section>
    <QueryState query={query}>{() => <SimpleTable rows={sorted} columns={[
      { header: 'Phiếu xuất / ngày xuất', width: '260px', cell: d => <><b className="warehouse-pallet-code">{d.dispatchCode}</b><div className="muted">{d.dispatchedAt ? formatInstantDateTime(d.dispatchedAt) : '—'}</div></> },
      { header: 'Xe / tài xế', width: '180px', cell: d => [d.vehicleNumber, d.driverName].filter(Boolean).join(' · ') || '—' },
      { header: 'Pallet cần nhận', width: '300px', cell: d => <>
        <b>{`${d.pallets.length} pallet · ${cartons(d)} thùng`}</b>
        {d.pallets.map(p => <div key={p.palletId} className="muted"><span className="warehouse-pallet-code">{p.palletCode}</span> · {p.sku} · HSD {formatDate(p.expirationDate)}</div>)}
      </> },
      { header: 'Kho nhận cố định', width: '180px', cell: d => warehouseName(d.destinationWarehouseId) },
      { header: 'Thao tác', width: '210px', cell: d => {
        if (admin && !d.receiptDocumentId) return 'Chờ thủ kho kiểm đếm';
        if (admin) return <button className="btn btn-sm" disabled={busy} onClick={() => onOpen(d)}>Xem tiến độ kiểm đếm</button>;
        if (d.receiptDocumentId) return <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => onOpen(d)}>Tiếp tục kiểm đếm</button>;
        return <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => setConfirming(d)}>Bắt đầu kiểm đếm</button>;
      } },
    ]} empty="Không có phiếu xuất nhà máy chờ nhận tại các kho được phân công." />}</QueryState>
    {confirming && <ConfirmDialog
      open={true}
      title="Xác nhận mở phiếu nhập kho"
      confirmLabel="Bắt đầu kiểm đếm"
      onClose={() => setConfirming(null)}
      onConfirm={() => {
        const target = confirming;
        setConfirming(null);
        onOpen(target);
      }}
      message={<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p>Bạn sắp mở một phiếu nhập kho (PNK) cho toàn bộ pallet của phiếu xuất sau:</p>
        <div style={{ background: 'var(--c-bg-subtle, #f8f9fa)', padding: 12, borderRadius: 8, fontSize: 14 }}>
          <div><b>Phiếu xuất:</b> <span className="warehouse-pallet-code">{confirming.dispatchCode}</span></div>
          <div><b>Xe / tài xế:</b> {[confirming.vehicleNumber, confirming.driverName].filter(Boolean).join(' · ') || '—'}</div>
          <div><b>Số lượng dự kiến:</b> {confirming.pallets.length} pallet · {cartons(confirming)} thùng</div>
          <div><b>Pallet:</b> {confirming.pallets.map(p => p.palletCode).join(', ')}</div>
          <div><b>Kho nhận cố định:</b> {warehouseName(confirming.destinationWarehouseId)}</div>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--c-text-muted, #666)' }}>
          Trên phiếu, quét lần lượt từng pallet rồi kiểm đếm thùng (CID). Khi đã nhận đủ các pallet, bấm hoàn tất để ghi sổ nhập kho.
        </p>
      </div>}
    />}
  </Card>;
}
