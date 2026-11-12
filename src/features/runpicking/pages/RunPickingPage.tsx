import { useState } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { errorMessage } from '@/shared/api/errors';
import { useLocation, useNavigate } from '@/shared/router/compat';
import { parsePage, useEnumParam, useQueryParams, useStringParam } from '@/shared/router/listState';
import { Button, Callout, Card, Chip, PageHeader, Select, SimpleTable, Stat, type Tone } from '@/shared/ui';
import { formatCases, formatNumber, formatPercent } from '@/shared/lib';
import { formatDate, formatInstantDateTime } from '@/shared/lib/dates';
import { usePickingListPage, useWarehouseOptions } from '../hooks';
import { PAGE_SIZES, PICKING_STATUSES, type PageSize } from '../pickingGraphql';
import type { PickingListRow, PickingRowItem, PickingStatus } from '../types';

/** Đổi bộ lọc / số dòng → về trang đầu. */
const PAGE_RESETS = ['after', 'before', 'page'];
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
  const requestedPage = parsePage(params.get('page'));
  const [openId, setOpenId] = useState<string | null>(null);
  const warehouses = useWarehouseOptions();
  // Kho trên URL không thuộc danh sách kho được phép xem → "Tất cả kho".
  const warehouseId = !rawWarehouseId || !warehouses.data || warehouses.data.some((w) => w.id === rawWarehouseId) ? rawWarehouseId : '';
  // Thủ kho chỉ xem phiếu thuộc kho được phân công (Backend không tự giới hạn truy vấn này).
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
  const from = data && data.rows.length ? (currentPage - 1) * size + 1 : 0;
  const to = data && data.rows.length ? Math.min(data.totalCount, from + data.rows.length - 1) : 0;
  // Trang mở bằng cursor nhưng không còn phiếu (dữ liệu đã thay đổi kể từ lúc mở trang).
  const stalePage = !!data && data.rows.length === 0 && !!(after || before);

  return (
    <>
      <PageHeader
        title="Phiếu soạn hàng"
        subtitle="Phiếu được tạo theo từng kho sau khi SO đủ điều kiện thành PO. Mỗi dòng giữ nguyên batch và giá đã chốt từ allocation."
        actions={requestedCode ? <button className="btn" onClick={() => navigate('/runpicking')}>Xem tất cả phiếu</button> : undefined}
      />
      <Card title="Bộ lọc">
        <div className="row-wrap" style={{ gap: 12 }}>
          <Select
            value={warehouseId}
            onChange={(event) => setWarehouseId(event.target.value)}
            placeholder="Tất cả kho"
            options={(warehouses.data ?? []).map((warehouse) => ({
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
          <div className="pager">
            <span>
              Hiển thị {from}–{to} / {data.totalCount} · Trang {currentPage} / {totalPages}
            </span>
            <span className="pages">
              <Select
                aria-label="Số phiếu mỗi trang"
                value={sizeParam}
                onChange={(event) => setSize(event.target.value as `${PageSize}`)}
                options={PAGE_SIZES.map((n) => ({ value: String(n), label: `${n} / trang` }))}
              />
              <Button size="sm" disabled={!data.pageInfo.hasPreviousPage || lists.isFetching} onClick={goPrev}>
                Trước
              </Button>
              <Button size="sm" disabled={!data.pageInfo.hasNextPage || lists.isFetching} onClick={goNext}>
                Sau
              </Button>
            </span>
          </div>
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
    { header: 'Batch / HSD', cell: (item: PickingRowItem) => <><strong>{item.batchCode}</strong><br /><span className="muted small">{formatDate(item.expirationDate)}</span></> },
    { header: 'Cần soạn', align: 'right' as const, cell: (item: PickingRowItem) => formatCases(item.requestedQuantity) },
    { header: 'Đã soạn', align: 'right' as const, cell: (item: PickingRowItem) => formatCases(item.pickedQuantity) },
    { header: 'Còn lại', align: 'right' as const, cell: (item: PickingRowItem) => formatCases(item.remainingQuantity) },
    { header: 'Trạng thái', cell: (item: PickingRowItem) => item.status },
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
