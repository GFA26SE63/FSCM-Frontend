import { useState } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { errorMessage } from '@/shared/api/errors';
import { useLocation, useNavigate } from '@/shared/router/compat';
import { parsePage, useEnumParam, useQueryParams, useStringParam } from '@/shared/router/listState';
import { Button, Callout, Card, Chip, PageHeader, Pagination, Select, SimpleTable, Stat, type Tone } from '@/shared/ui';
import { formatCases, formatNumber, formatPercent, statusLabel } from '@/shared/lib';
import { formatDate, formatInstantDateTime } from '@/shared/lib/dates';
import { usePickingListPage, useWarehouseOptions } from '../hooks';
import { PAGE_SIZES, PICKING_SORT_MAP, PICKING_STATUSES, type PageSize, type PickingSortField } from '../pickingGraphql';
import { decodeSort, encodeSort, PAGINATION_PARAM_NAMES, PAGINATION_RESETS } from '@/shared/pagination/urlSync';
import type { PickingListRow, PickingRowItem, PickingStatus } from '../types';

/** Đổi bộ lọc / số dòng → về trang đầu. */
const PAGE_RESETS = PAGINATION_RESETS;
const SIZE_VALUES = PAGE_SIZES.map(String) as `${PageSize}`[];

const STATUS: Record<PickingStatus, { tone: Tone; label: string }> = {
  Pending: { tone: 'info', label: 'Chờ soạn' },
  InProgress: { tone: 'warn', label: 'Đang soạn' },
  Completed: { tone: 'success', label: 'Đã soạn xong' },
  Exception: { tone: 'danger', label: 'Có ngoại lệ' },
};

export function RunPickingPage() {
  const requestedCode = new URLSearchParams(useLocation().search).get('code');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { params, setParams } = useQueryParams();
  const [rawWarehouseId, setWarehouseId] = useStringParam('warehouseId', { resets: PAGE_RESETS });
  const [status, setStatus] = useEnumParam<PickingStatus | ''>('status', ['', ...PICKING_STATUSES], '', { resets: PAGE_RESETS });
  const [sizeParam, setSize] = useEnumParam<`${PageSize}`>('size', SIZE_VALUES, '20', { resets: PAGE_RESETS });
  const size = Number(sizeParam) as PageSize;
  const after = params.get('after') ?? '';
  const before = after ? '' : params.get('before') ?? '';

  // Sort state: read from URL param 'sort', write via setParams (resets cursors)
  const rawSort = decodeSort(params.get(PAGINATION_PARAM_NAMES.SORT));
  const activeSort = rawSort?.field && PICKING_SORT_MAP[rawSort.field as PickingSortField]
    ? { field: rawSort.field as PickingSortField, direction: rawSort.direction }
    : undefined;
  const setSort = (field: PickingSortField | '', direction?: 'asc' | 'desc') => {
    const encoded = field ? encodeSort(field, direction) : null;
    setParams({ [PAGINATION_PARAM_NAMES.SORT]: encoded, after: null, before: null, page: null });
  };
  const requestedPage = parsePage(params.get('page'));
  const [openId, setOpenId] = useState<string | null>(null);
  const warehouses = useWarehouseOptions();
  const visibleWarehouses = user?.role === 'WarehouseKeeper'
    ? (warehouses.data ?? []).filter((warehouse) =>
        user.scopeLabels?.warehouses.some((scope) => scope.id === warehouse.id))
    : (warehouses.data ?? []);
  // Kho trên URL không thuộc danh sách kho được phép xem → "Tất cả kho".
  const warehouseId = !rawWarehouseId || !warehouses.data || visibleWarehouses.some((w) => w.id === rawWarehouseId) ? rawWarehouseId : '';
  // Backend bắt buộc scope qua EntityQueryService; danh sách ID này chỉ giúp thu hẹp truy vấn.
  const scopeWarehouseIds = user?.role === 'WarehouseKeeper' ? user.scope?.warehouseIds ?? [] : undefined;
  const lists = usePickingListPage(
    {
      size,
      after: after || undefined,
      before: before || undefined,
      warehouseId: warehouseId || undefined,
      status,
      pickingCode: requestedCode || undefined,
      scopeWarehouseIds,
      sort: activeSort,
    },
    !!user && (!rawWarehouseId || !!warehouses.data),
  );
  const data = lists.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / size)) : 1;
  // Số trang hiển thị: lấy từ URL nhưng luôn khớp cờ trang đầu / trang cuối của Backend.
  const currentPage = !data || !data.pageInfo.hasPreviousPage
    ? 1
    : !data.pageInfo.hasNextPage
      ? totalPages
      : Math.min(Math.max(requestedPage, 2), Math.max(2, totalPages - 1));
  const goNext = () => {
    if (data?.pageInfo.endCursor) setParams({ after: data.pageInfo.endCursor, before: null, page: currentPage + 1 });
  };
  const goPrev = () => {
    if (!data?.pageInfo.startCursor) return;
    if (currentPage <= 2) setParams({ after: null, before: null, page: null });
    else setParams({ before: data.pageInfo.startCursor, after: null, page: currentPage - 1 });
  };
  const firstPage = () => setParams({ after: null, before: null, page: null });
  // Trang mở bằng cursor nhưng không còn phiếu (dữ liệu đã thay đổi kể từ lúc mở trang).
  const stalePage = !!data && data.rows.length === 0 && !!(after || before);

  return (
    <>
      <PageHeader
        title="Phiếu soạn hàng"
        subtitle="Phiếu được tạo theo từng kho sau khi đơn bán hàng đủ điều kiện thành đơn thực hiện. Mỗi dòng giữ nguyên lô hàng và giá đã chốt từ phân bổ."
        actions={requestedCode ? <button className="btn" onClick={() => navigate('/runpicking')}>Xem tất cả phiếu</button> : undefined}
      />
      <Card title="Bộ lọc">
        <div className="row-wrap" style={{ gap: 12 }}>
          <Select
            value={warehouseId}
            onChange={(event) => setWarehouseId(event.target.value)}
            placeholder="Tất cả kho"
            options={visibleWarehouses.map((warehouse) => ({
              value: warehouse.id,
              label: `${warehouse.code} · ${warehouse.name}`,
            }))}
          />
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value as PickingStatus | '')}
            placeholder="Tất cả trạng thái"
            options={Object.entries(STATUS).map(([code, meta]) => ({ value: code, label: meta.label }))}
          />
          <Select
            aria-label="Sắp xếp"
            value={activeSort ? `${activeSort.field}:${activeSort.direction}` : ''}
            onChange={(event) => {
              const val = event.target.value;
              if (!val) { setSort(''); return; }
              const [field, dir] = val.split(':') as [PickingSortField, 'asc' | 'desc'];
              setSort(field, dir);
            }}
            options={[
              { value: '', label: 'Mặc định (mới nhất)' },
              { value: 'createdAt:asc', label: 'Ngày tạo ↑ (cũ nhất)' },
              { value: 'createdAt:desc', label: 'Ngày tạo ↓ (mới nhất)' },
              { value: 'pickingCode:asc', label: 'Mã phiếu ↑ A→Z' },
              { value: 'pickingCode:desc', label: 'Mã phiếu ↓ Z→A' },
            ]}
          />
        </div>
      </Card>

      {lists.isPending && (
        <div className="loading">
          <span className="spinner" /> Đang tải dữ liệu…
        </div>
      )}
      {lists.isError && (
        <Callout tone="danger">
          {errorMessage(lists.error)}
          {(after || before) && (
            <>
              {' '}
              <Button size="sm" onClick={firstPage}>Về trang đầu</Button>
            </>
          )}
        </Callout>
      )}
      {data && !lists.isError && (
        <>
          <div className="stats-grid" style={{ marginBottom: 12 }}>
            <Stat label="Tổng phiếu" value={formatNumber(data.totalCount)} />
            <Stat label="Đang soạn" value={formatNumber(data.statusCounts.InProgress)} />
            <Stat label="Đã xong" value={formatNumber(data.statusCounts.Completed)} />
            <Stat label="Ngoại lệ" value={formatNumber(data.statusCounts.Exception)} />
          </div>
          {data.rows.map((list) => (
            <PickingCard
              key={list.id}
              list={list}
              open={openId === list.id || openId === null && requestedCode === list.pickingCode}
              onToggle={() => setOpenId(openId === list.id || openId === null && requestedCode === list.pickingCode ? '' : list.id)}
            />
          ))}
          {data.rows.length === 0 && (
            <Card>
              {stalePage ? 'Trang đã chọn không còn phiếu soạn nào.' : 'Không có phiếu soạn phù hợp bộ lọc.'}
              {stalePage && (
                <>
                  {' '}
                  <Button size="sm" onClick={firstPage}>Về trang đầu</Button>
                </>
              )}
            </Card>
          )}
          <Pagination currentPage={currentPage} totalPages={totalPages} totalCount={data.totalCount}
            pageSize={size} itemCount={data.rows.length} pageSizeOptions={PAGE_SIZES} pageSizeLabel="Số phiếu mỗi trang" loading={lists.isFetching}
            hasPrev={data.pageInfo.hasPreviousPage} hasNext={data.pageInfo.hasNextPage}
            navigablePages={[1, currentPage, ...(data.pageInfo.hasPreviousPage ? [currentPage - 1] : []), ...(data.pageInfo.hasNextPage ? [currentPage + 1] : [])]}
            onPrev={goPrev} onNext={goNext}
            onPage={n => { if (n === 1) firstPage(); else if (n === currentPage - 1) goPrev(); else if (n === currentPage + 1) goNext(); }}
            onPageSizeChange={n => setSize(String(n) as `${PageSize}`)} />
        </>
      )}
    </>
  );
}

function PickingCard({ list, open, onToggle }: { list: PickingListRow; open: boolean; onToggle: () => void }) {
  const required = list.items.reduce((sum, item) => sum + item.requestedQuantity, 0);
  const picked = list.items.reduce((sum, item) => sum + item.pickedQuantity, 0);
  const meta = STATUS[list.status] ?? { tone: 'neutral' as Tone, label: list.status };
  const columns = [
    { header: 'SKU / sản phẩm', cell: (item: PickingRowItem) => <><strong>{item.sku}</strong><br /><span className="muted small">{item.productName}</span></> },
    { header: 'Lô hàng / HSD', cell: (item: PickingRowItem) => <><strong>{item.batchCode}</strong><br /><span className="muted small">{formatDate(item.expirationDate)}</span></> },
    { header: 'Cần soạn', align: 'right' as const, cell: (item: PickingRowItem) => formatCases(item.requestedQuantity) },
    { header: 'Đã soạn', align: 'right' as const, cell: (item: PickingRowItem) => formatCases(item.pickedQuantity) },
    { header: 'Còn lại', align: 'right' as const, cell: (item: PickingRowItem) => formatCases(item.remainingQuantity) },
    { header: 'Trạng thái', cell: (item: PickingRowItem) => statusLabel('pickingLine', item.status) },
  ];
  return (
    <Card
      title={`${list.pickingCode} · ${list.warehouseName || list.warehouseCode}`}
      actions={<button type="button" className="btn btn-sm" onClick={onToggle}>{open ? 'Thu gọn' : 'Xem chi tiết'}</button>}
    >
      <div className="row-wrap" style={{ gap: 20, alignItems: 'center' }}>
        <Chip tone={meta.tone}>{meta.label}</Chip>
        <span>Đơn <strong>{list.orderCode}</strong> · {list.retailerCode} {list.retailerName}</span>
        <span>Tiến độ <strong>{formatCases(picked)}</strong> / {formatCases(required)} {required > 0 && `(${formatPercent(picked / required * 100, 1)})`}</span>
        {list.startedAt && <span>Bắt đầu {formatInstantDateTime(list.startedAt)}</span>}
        {list.confirmedAt && <span>Hoàn tất {formatInstantDateTime(list.confirmedAt)}</span>}
      </div>
      {open && <SimpleTable columns={columns} rows={list.items} empty="Phiếu chưa có dòng hàng." />}
    </Card>
  );
}
