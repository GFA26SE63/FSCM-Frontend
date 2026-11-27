import { hasScreen } from '@/shared/auth/permissions';
import './inventory.css';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { get } from '@/shared/api/http';
import { errorMessage } from '@/shared/api/errors';
import { Card, Drawer, PageHeader, Pagination, QueryState, SimpleTable } from '@/shared/ui';
import { receiptApi } from '@/features/receipts/api';
import { qrLabelApi } from '@/features/qr-labels/api';
import { labelStatusText } from '@/features/qr-labels/types';
import { TraceLookup } from '@/features/factory-traceability';
import { formatDate, formatInstantDateTime } from '@/shared/lib/dates';
import { useAuth } from '@/shared/auth/AuthContext';
import { statusLabel } from '@/shared/lib/status';

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

export function InventoryPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({ warehouseId: '', status: '', syncStatus: '', search: '', page: 1, pageSize: 10 });
  const [search, setSearch] = useState('');
  const [selectedCode, setSelectedCode] = useState('');
  const warehouses = useQuery({ queryKey: ['qr-inventory', 'warehouses'], queryFn: receiptApi.warehouses });
  const inventory = useQuery({
    queryKey: ['qr-inventory', filters],
    queryFn: () => get<QrPage>('/inventory/qr-codes', filters),
    refetchInterval: 15000,
  });
  const detail = useQuery({
    queryKey: ['qr-inventory', 'detail', selectedCode],
    queryFn: () => qrLabelApi.detail(selectedCode), enabled: !!selectedCode,
  });
  const changeFilter = (name: 'warehouseId' | 'status' | 'syncStatus', value: string) =>
    setFilters(current => ({ ...current, [name]: value, page: 1 }));
  return <div className="carton-inventory">
    <PageHeader title="Danh sách carton trong kho" subtitle="Theo dõi từng carton đã nhận vào FSCM, mapping pallet / batch / SKU và xác nhận nhập về Traceability." />
    <p className="row-wrap" style={{ gap: 12 }}><Link className="btn" to="/batches">Tồn và reservation theo batch</Link>{hasScreen(user, 'warehouse-inbound') && <Link className="btn" to="/warehouse-inbound">Nhập kho</Link>}</p>
    <Card title="Danh sách QR đã nhận">
      <p>Mỗi dòng là một carton. Pallet là pallet đóng gói gốc; kho và trạng thái QR phản ánh vị trí hiện tại hoặc kho xuất khi đang vận chuyển.</p>
      <p className="muted">Allocation giữ số lượng theo batch; QR “Sẵn sàng” chưa được soạn nhưng có thể thuộc batch đang giữ cho đơn. Xem tồn khả dụng ở bảng batch. Trạng thái xác nhận nhà máy không làm thay đổi tồn đã nhập.</p>
      <form className="inventory-filters" onSubmit={e => { e.preventDefault(); setFilters(current => ({ ...current, search: search.trim(), page: 1 })); }}>
        <label>Kho <select value={filters.warehouseId} onChange={e => changeFilter('warehouseId', e.target.value)}><option value="">Tất cả kho được phép</option>{warehouses.data?.filter(w => user?.role !== 'WarehouseKeeper' || user.scope?.warehouseIds.includes(w.id)).map(w => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></label>
        <label>Trạng thái QR <select value={filters.status} onChange={e => changeFilter('status', e.target.value)}><option value="">Tất cả</option>{['Available', 'Picked', 'InTransit', 'Delivered', 'Invalidated', 'Split'].map(s => <option key={s} value={s}>{labelStatusText(s)}</option>)}</select></label>
        <label>Xác nhận về nhà máy <select value={filters.syncStatus} onChange={e => changeFilter('syncStatus', e.target.value)}><option value="">Tất cả</option><option value="Pending">Chờ gửi / đang thử lại</option><option value="Synced">Đã xác nhận</option><option value="Legacy">Dữ liệu cũ chưa có xác nhận</option></select></label>
        <label>Tìm QR / pallet / lô hàng / SKU <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Quét CID, PID hoặc nhập mã" /></label>
        <button className="btn" type="submit">Tìm kiếm</button>
        <button className="btn" type="button" disabled={inventory.isFetching} onClick={() => { void inventory.refetch(); if (selectedCode) void detail.refetch(); }}>Làm mới</button>
      </form>
      {warehouses.isError && <p role="alert">Không tải được danh sách kho. Bảng QR vẫn giới hạn theo quyền của bạn. {errorMessage(warehouses.error)}</p>}
      <QueryState query={inventory}>{data => <>
        <SimpleTable paginate={false} rows={data.items} columns={[
          { header: 'Carton / QR', width: '260px', cell: r => <button className="btn btn-sm inventory-code" aria-label={`Xem chi tiết carton ${r.cartonCode}`} onClick={() => setSelectedCode(r.cartonCode)}><span>{r.cartonCode}</span></button> },
          { header: 'Pallet gốc / batch nhà máy', width: '240px', cell: r => <>{r.palletCode}<br />{r.productionBatchCode}</> },
          { header: 'SKU / sản phẩm', width: '200px', cell: r => <>{r.sku}<br />{r.productName}<br />{r.unitsPerCarton} sản phẩm/carton</> },
          { header: 'Kho hiện tại / mã tồn', width: '260px', cell: r => <>{r.warehouseCode} · {r.warehouseName}<br /><Link to={`/batches/${encodeURIComponent(r.stockBatchId)}`}>{r.stockBatchCode}</Link></> },
          { header: 'NSX / HSD', width: '130px', cell: r => <>{formatDate(r.productionDate)}<br />{formatDate(r.expirationDate)}</> },
          { header: 'Trạng thái QR', width: '150px', cell: r => labelStatusText(r.status) },
          { header: 'Phiếu nhập nhà máy / nhận lúc', width: '230px', cell: r => <>{r.receiptCode ?? 'Dữ liệu cũ'}<br />{r.receivedAt ? formatInstantDateTime(r.receivedAt) : '—'}</> },
          { header: 'Xác nhận về Traceability', width: '210px', cell: r => r.syncedAt ? <>Đã xác nhận<br />{formatInstantDateTime(r.syncedAt)}</> : r.hasAcknowledgement ? <>Chờ gửi · {r.syncAttempts} lần thử{r.syncError && <><br />Lỗi lần trước: {r.syncError}</>}</> : 'Dữ liệu cũ chưa có ACK' },
        ]} empty="Chưa có carton từ Traceability trong phạm vi và bộ lọc này. Tạo phiếu nhập và quét pallet đã phát hành để nhận hàng." />
        <Pagination currentPage={data.page} totalPages={Math.max(1, Math.ceil(data.totalCount / data.pageSize))}
          totalCount={data.totalCount} pageSize={data.pageSize} itemCount={data.items.length} loading={inventory.isFetching}
          hasPrev={data.page > 1} hasNext={data.page * data.pageSize < data.totalCount}
          onPage={page => setFilters(current => ({ ...current, page }))}
          onPrev={() => setFilters(current => ({ ...current, page: data.page - 1 }))}
          onNext={() => setFilters(current => ({ ...current, page: data.page + 1 }))}
          onPageSizeChange={pageSize => setFilters(current => ({ ...current, pageSize, page: 1 }))} />
      </>}</QueryState>
    </Card>
    {selectedCode && <Drawer open title={`Chi tiết carton · ${selectedCode}`} onClose={() => setSelectedCode('')} width={1080}>
      <Card title={`Lịch sử QR · ${selectedCode}`}>
        <button className="btn" onClick={() => setSelectedCode('')}>Đóng chi tiết</button>
        <QueryState query={detail}>{data => <>
          <p>{data.label.sku} · {data.label.warehouseCode} · {labelStatusText(data.label.status)}</p>
          <SimpleTable rows={data.events} columns={[
            { header: 'Thời gian', cell: e => formatInstantDateTime(e.occurredAt) },
            { header: 'Kho / sự kiện', cell: e => `${e.warehouseCode} · ${statusLabel('qrEvent', e.eventType)}` },
            { header: 'Trạng thái', cell: e => `${labelStatusText(e.fromStatus)} → ${labelStatusText(e.toStatus)}` },
            { header: 'Chứng từ', cell: e => e.referenceCode ?? '—' },
          ]} />
        </>}</QueryState>
      </Card>
      <TraceLookup key={selectedCode} initialCode={selectedCode} />
    </Drawer>}
  </div>;
}
