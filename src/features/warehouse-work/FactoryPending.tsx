import { Card, QueryState, SimpleTable } from '@/shared/ui';
import { formatDate, formatInstantDateTime } from '@/shared/lib/dates';
import { useStringParam } from '@/shared/router/listState';

export interface FactoryInboundPallet {
  palletId: string; palletCode: string; destinationWarehouseId: string; dispatchedAt: string | null;
  batchCode: string; sku: string; productName: string; cartonCount: number; expirationDate: string;
  receiptDocumentId: string | null;
}

export function FactoryPending({ query, warehouses, admin, busy, onOpen, refresh }: {
  query: { data: FactoryInboundPallet[] | undefined; isLoading: boolean; error: unknown };
  warehouses: { id: string; name: string }[];
  admin: boolean; busy: boolean; onOpen: (pallet: FactoryInboundPallet) => void; refresh: () => void;
}) {
  const [warehouseFilter, setWarehouseFilter] = useStringParam('incomingWarehouse');
  const [search, setSearch] = useStringParam('incomingQuery');
  const effectiveWarehouse = warehouses.length === 1 ? warehouses[0].id : warehouses.some(w => w.id === warehouseFilter) ? warehouseFilter : '';
  const visible = (query.data ?? []).filter(p => warehouses.some(w => w.id === p.destinationWarehouseId)
    && (!effectiveWarehouse || p.destinationWarehouseId === effectiveWarehouse)
    && [p.palletCode, p.batchCode, p.sku, p.productName].join(' ').toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')));
  return <Card title="Hàng chờ nhận từ nhà máy">
    <p>Kho nhận đã được nhà máy chỉ định. Chọn pallet để mở phiếu kiểm đếm; mở phiếu chưa cộng tồn kho.</p>
    <div className="warehouse-work-filters">
      <label>Tìm hàng chờ nhận<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Mã pallet, lô hàng hoặc SKU" /></label>
      {warehouses.length > 1 ? <label>Lọc kho nhận<select value={effectiveWarehouse} onChange={e => setWarehouseFilter(e.target.value)}><option value="">Tất cả kho được phân công</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
        : <p>Kho nhận: <b>{warehouses[0]?.name ?? 'Chưa được phân công kho'}</b></p>}
      <button className="btn" type="button" disabled={busy} onClick={refresh}>Làm mới hàng chờ nhận</button>
    </div>
    <QueryState query={query}>{() => <SimpleTable rows={visible} columns={[
      { header: 'Pallet / ngày xuất', width: '280px', cell: p => <><b className="warehouse-pallet-code">{p.palletCode}</b><div className="muted">{p.dispatchedAt ? formatInstantDateTime(p.dispatchedAt) : '—'}</div></> },
      { header: 'Sản phẩm / lô hàng', width: '240px', cell: p => <>{p.sku} · {p.productName}<div className="muted">{p.batchCode} · HSD {formatDate(p.expirationDate)}</div></> },
      { header: 'Kho nhận cố định', width: '180px', cell: p => warehouses.find(w => w.id === p.destinationWarehouseId)?.name ?? p.destinationWarehouseId },
      { header: 'Thùng', width: '100px', cell: p => p.cartonCount },
      { header: 'Thao tác', width: '190px', cell: p => admin && !p.receiptDocumentId ? 'Chờ thủ kho kiểm đếm' : <button className="btn btn-sm" disabled={busy} onClick={() => onOpen(p)}>{admin ? 'Xem phiếu nhập' : p.receiptDocumentId ? 'Tiếp tục kiểm đếm' : 'Chọn pallet'}</button> },
    ]} empty="Không có pallet chờ nhận tại các kho được phân công." />}</QueryState>
  </Card>;
}
