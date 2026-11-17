import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { get } from '@/shared/api/http';
import { Card, PageHeader, QueryState, SimpleTable } from '@/shared/ui';
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
    queryFn: () => qrLabelApi.detail(selectedCode), enabled: !!selectedCode,
  });
  const changeFilter = (name: 'warehouseId' | 'status' | 'syncStatus', value: string) =>
    setFilters(current => ({ ...current, [name]: value, page: 1 }));
  return <>
    <PageHeader title="Tồn kho · QR từ nhà máy" subtitle="Theo dõi từng thùng đã nhận vào FSCM, liên kết pallet / lô hàng / SKU và xác nhận nhập về truy xuất nguồn gốc." />
    <p className="row-wrap" style={{ gap: 12 }}><Link className="btn" to="/batches">Tồn và giữ chỗ theo lô hàng</Link>{user?.role !== 'Operator' && <Link className="btn" to="/warehouse-inbound">Nhập kho</Link>}</p>
    <Card title="Danh sách QR đã nhận">
      <p>Mỗi dòng là một thùng. Pallet là pallet đóng gói gốc; kho và trạng thái QR phản ánh vị trí hiện tại hoặc kho xuất khi đang vận chuyển.</p>
      <p className="muted">Phân bổ giữ số lượng theo lô hàng; QR “Sẵn sàng” chưa được soạn nhưng có thể thuộc lô hàng đang giữ cho đơn. Xem tồn khả dụng ở bảng lô hàng. Trạng thái xác nhận nhà máy không làm thay đổi tồn đã nhập.</p>
      <form className="row-wrap" style={{ gap: 12, marginBottom: 16 }} onSubmit={e => { e.preventDefault(); setFilters(current => ({ ...current, search: search.trim(), page: 1 })); }}>
        <label>Kho <select value={filters.warehouseId} onChange={e => changeFilter('warehouseId', e.target.value)}><option value="">Tất cả kho được phép</option>{warehouses.data?.filter(w => user?.role !== 'WarehouseKeeper' || user.scope?.warehouseIds.includes(w.id)).map(w => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></label>
        <label>Trạng thái QR <select value={filters.status} onChange={e => changeFilter('status', e.target.value)}><option value="">Tất cả</option>{['Available', 'Picked', 'InTransit', 'Delivered', 'Invalidated', 'Split'].map(s => <option key={s} value={s}>{labelStatusText(s)}</option>)}</select></label>
        <label>Xác nhận về nhà máy <select value={filters.syncStatus} onChange={e => changeFilter('syncStatus', e.target.value)}><option value="">Tất cả</option><option value="Pending">Chờ gửi / đang thử lại</option><option value="Synced">Đã xác nhận</option><option value="Legacy">Dữ liệu cũ chưa có xác nhận</option></select></label>
        <label>Tìm QR / pallet / lô hàng / SKU <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Quét CID, PID hoặc nhập mã" /></label>
        <button className="btn" type="submit">Tìm kiếm</button>
        <button className="btn" type="button" disabled={inventory.isFetching} onClick={() => { void inventory.refetch(); if (selectedCode) void detail.refetch(); }}>Làm mới</button>
      </form>
      {warehouses.isError && <p role="alert">Không tải được danh sách kho. Bảng QR vẫn giới hạn theo quyền của bạn.</p>}
      <QueryState query={inventory}>{data => <>
        <p>{data.totalCount} thùng khớp bộ lọc · Trang {data.page}</p>
        <SimpleTable rows={data.items} columns={[
          { header: 'Thùng / QR', cell: r => <button className="btn btn-sm" onClick={() => setSelectedCode(r.cartonCode)}>{r.cartonCode}</button> },
          { header: 'Pallet gốc / lô hàng nhà máy', cell: r => <>{r.palletCode}<br />{r.productionBatchCode}</> },
          { header: 'SKU / sản phẩm', cell: r => <>{r.sku}<br />{r.productName}<br />{r.unitsPerCarton} sản phẩm/thùng</> },
          { header: 'Kho hiện tại / mã tồn', cell: r => <>{r.warehouseCode} · {r.warehouseName}<br /><Link to={`/batches/${encodeURIComponent(r.stockBatchId)}`}>{r.stockBatchCode}</Link></> },
          { header: 'NSX / HSD', cell: r => <>{formatDate(r.productionDate)}<br />{formatDate(r.expirationDate)}</> },
          { header: 'Trạng thái QR', cell: r => labelStatusText(r.status) },
          { header: 'Phiếu nhập nhà máy / nhận lúc', cell: r => <>{r.receiptCode ?? 'Dữ liệu cũ'}<br />{r.receivedAt ? formatInstantDateTime(r.receivedAt) : '—'}</> },
          { header: 'Xác nhận về truy xuất nguồn gốc', cell: r => r.syncedAt ? <>Đã xác nhận<br />{formatInstantDateTime(r.syncedAt)}</> : r.hasAcknowledgement ? <>Chờ gửi · {r.syncAttempts} lần thử{r.syncError && <><br />Lỗi lần trước: {r.syncError}</>}</> : 'Dữ liệu cũ chưa có xác nhận' },
        ]} empty="Chưa có thùng từ truy xuất nguồn gốc trong phạm vi và bộ lọc này. Tạo phiếu nhập và quét pallet đã phát hành để nhận hàng." />
        <div className="row-wrap" style={{ gap: 12, marginTop: 16 }}>
          <button className="btn" disabled={inventory.isFetching || data.page <= 1} onClick={() => setFilters(current => ({ ...current, page: current.page - 1 }))}>Trang trước</button>
          <button className="btn" disabled={inventory.isFetching || data.page * data.pageSize >= data.totalCount} onClick={() => setFilters(current => ({ ...current, page: current.page + 1 }))}>Trang sau</button>
        </div>
      </>}</QueryState>
    </Card>
    {selectedCode && <>
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
    </>}
  </>;
}
