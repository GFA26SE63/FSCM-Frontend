import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Button, Callout, DataTable, DateInput, Input, PageHeader, Select, Stat, type Column } from '@/shared/ui';
import { useCursorPagination } from '@/shared/pagination/useCursorPagination';
import type { PageInfo } from '@/shared/pagination/types';
import { formatNumber, statusLabel } from '@/shared/lib';
import { formatInstantDateTime } from '@/shared/lib/dates';
import { useAuth } from '@/shared/auth/AuthContext';
import { defaultDashboardDates } from '@/features/dashboard/dashboardModel';
import { useWarehouses } from '@/features/warehouses/hooks';
import { fetchRetailersPage } from '@/features/retailers/retailersGraphql';
import { fetchFinancialOrders, fetchFinancialWriteOffs, type FinancialFilters, type FinancialOrderRow, type FinancialPage, type FinancialWriteOffRow, type PageArgs } from './financialGraphql';
import { fetchOrderValueTotal, formatMinorVnd } from './orderValueTotal';
import { fetchWriteOffValueTotal, writeOffReasonText } from './writeOffValueTotal';
import './reports.css';

const money = (n: number) => `${formatNumber(n)} VND`;

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

type Fetcher<T> = (after: string | undefined, args: PageArgs) => Promise<FinancialPage<T>>;

/** Shared DataTable + cursor pagination for one report tab. Mounted with a key per filter set, so cursors reset on filter change. */
function FinancialTable<T>({ title, queryKey, fetcher, columns, rowKey, empty }: {
  title: string; queryKey: unknown[]; fetcher: Fetcher<T>; columns: Column<T>[]; rowKey: (row: T) => string; empty: string;
}) {
  const [info, setInfo] = useState<{ pageInfo?: PageInfo; totalCount?: number }>({});
  const pg = useCursorPagination({ pageInfo: info.pageInfo, totalCount: info.totalCount, urlState: false, defaultPageSize: 10 });
  const query = useQuery({
    queryKey: [...queryKey, pg.after, pg.before, pg.pageSize],
    queryFn: () => fetcher(pg.after, { before: pg.before, size: pg.pageSize }),
    placeholderData: keepPreviousData,
  });
  useEffect(() => {
    if (query.data) setInfo({ pageInfo: query.data.pageInfo, totalCount: query.data.totalCount });
  }, [query.data]);
  return (
    <DataTable<T>
      title={title}
      rows={query.data?.rows}
      loading={query.isLoading || query.isPlaceholderData}
      error={query.isPlaceholderData ? undefined : query.error}
      rowKey={rowKey}
      columns={columns}
      searchable={false}
      excelFileName={null}
      urlState={false}
      cursor={pg.pagingProps}
      emptyText={empty}
    />
  );
}
export function FinancialReportsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const initial = (): FinancialFilters => {
    const d = defaultDashboardDates();
    return { from: d.fromDate, to: d.toDate, retailerId: '', warehouseId: '' };
  };
  const [draft, setDraft] = useState<FinancialFilters>(initial);
  const [retailerSearch, setRetailerSearch] = useState('');
  const [selectedRetailer, setSelectedRetailer] = useState<{ value: string; label: string } | null>(null);
  const filters = useDebounced(draft, 300);
  const term = useDebounced(retailerSearch.trim(), 400);
  const valid = !!filters.from && !!filters.to && filters.from <= filters.to;

  const warehouses = useWarehouses();
  const retailers = useQuery({
    queryKey: ['financial-retailers', user?.id, term],
    queryFn: () => fetchRetailersPage({ size: 20, search: term || undefined }),
    enabled: !!user,
  });
  const retailerOptions = useMemo(
    () => retailers.data?.rows.map(r => ({ value: r.id, label: `${r.code} · ${r.name}` })) ?? [],
    [retailers.data],
  );
  const retailerChoices = selectedRetailer && !retailerOptions.some(o => o.value === selectedRetailer.value)
    ? [selectedRetailer, ...retailerOptions]
    : retailerOptions;
  const warehouseOptions = (warehouses.data ?? []).filter(w => w.id).map(w => ({ value: w.id as string, label: w.name }));
  const orderValue = useQuery({ queryKey: ['financial-order-value', user?.id, filters], queryFn: () => fetchOrderValueTotal(filters), enabled: valid && !!user });
  const orderValueText = (() => {
    if (!valid) return '—';
    if (orderValue.isLoading) return 'Đang tính…';
    if (orderValue.isError) return 'Không tính được';
    const v = orderValue.data;
    if (!v) return '—';
    if (v.status === 'ok') return formatMinorVnd(v.amountMinor);
    if (v.status === 'warehouse-unsupported') return 'Chưa hỗ trợ lọc theo kho';
    if (v.status === 'too-large') return 'Quá nhiều đơn để tính';
    return 'Chưa đủ dữ liệu';
  })();
  const writeOffValue = useQuery({ queryKey: ['financial-writeoff-value', user?.id, filters], queryFn: () => fetchWriteOffValueTotal(filters), enabled: valid && !!user });
  const writeOffValueText = (() => {
    if (!valid) return '—';
    if (writeOffValue.isLoading) return 'Đang tính…';
    if (writeOffValue.isError) return 'Không tính được';
    const v = writeOffValue.data;
    if (!v) return '—';
    if (v.status === 'ok') return formatMinorVnd(v.amountMinor);
    if (v.status === 'too-large') return 'Quá nhiều phiếu để tính';
    return 'Chưa đủ dữ liệu';
  })();
  const warehouseName = (id: string) => warehouseOptions.find(w => w.value === id)?.label ?? 'Kho không xác định';

  const [tab, setTab] = useState<'orders' | 'writeoffs'>('orders');
  const filterKey = JSON.stringify(filters);
  // Counts for the KPI cards: one-row pages, only totalCount is used.
  const orderCount = useQuery({ queryKey: ['financial-orders-count', user?.id, filters], queryFn: () => fetchFinancialOrders(filters, undefined, { size: 1 }), enabled: valid && !!user });
  const writeOffCount = useQuery({ queryKey: ['financial-writeoffs-count', user?.id, filters], queryFn: () => fetchFinancialWriteOffs(filters, undefined, { size: 1 }), enabled: valid && !!user });

  return (
    <>
      <PageHeader title="Báo cáo tài chính" />
      <div className="card report-filters">
        <label className="lbl">Từ ngày<DateInput required value={draft.from} onChange={from => setDraft(f => ({ ...f, from }))} /></label>
        <label className="lbl">Đến ngày<DateInput required min={draft.from} value={draft.to} onChange={to => setDraft(f => ({ ...f, to }))} /></label>
        <label className="lbl">Tìm nhà bán lẻ
          <Input placeholder="Mã hoặc tên nhà bán lẻ" value={retailerSearch} onChange={e => setRetailerSearch(e.target.value)} />
        </label>
        <label className="lbl">Nhà bán lẻ
          <Select
            value={draft.retailerId}
            onChange={e => {
              const id = e.target.value;
              setSelectedRetailer(retailerChoices.find(o => o.value === id) ?? null);
              setDraft(f => ({ ...f, retailerId: id }));
            }}
            options={[{ value: '', label: 'Tất cả nhà bán lẻ' }, ...retailerChoices]}
          />
        </label>
        <label className="lbl">Kho
          <Select value={draft.warehouseId} onChange={e => setDraft(f => ({ ...f, warehouseId: e.target.value }))}
            options={[{ value: '', label: 'Tất cả kho' }, ...warehouseOptions]} />
        </label>
        <Button onClick={() => { void orderCount.refetch(); void writeOffCount.refetch(); void orderValue.refetch(); void writeOffValue.refetch(); }} loading={orderCount.isFetching || writeOffCount.isFetching} disabled={!valid}>Làm mới</Button>
      </div>

      {!valid && <Callout tone="danger">Chọn khoảng ngày hợp lệ: &quot;Từ ngày&quot; không được sau &quot;Đến ngày&quot;.</Callout>}
      {retailers.isError && <Callout tone="danger">Không tải được danh sách nhà bán lẻ.</Callout>}

      <div className="report-summary" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <Stat label="Số đơn hàng tạo trong kỳ (ngày tạo đơn)" value={orderCount.data ? formatNumber(orderCount.data.totalCount) : '—'} />
        <Stat label="Giá trị đơn hàng đủ điều kiện (đã giao và thanh toán đủ)" value={orderValueText} />
        <Stat label="Số phiếu hủy hàng (ngày lập phiếu)" value={writeOffCount.data ? formatNumber(writeOffCount.data.totalCount) : '—'} />
        <Stat label="Giá trị hàng hủy (theo đơn giá tại thời điểm lập phiếu)" value={writeOffValueText} />
      </div>

      {valid && (
        <>
          <div className="row-wrap" style={{ gap: 8 }} role="tablist">
            <Button size="sm" variant={tab === 'orders' ? 'primary' : 'default'} role="tab" aria-selected={tab === 'orders'} onClick={() => setTab('orders')}>Đơn hàng</Button>
            <Button size="sm" variant={tab === 'writeoffs' ? 'primary' : 'default'} role="tab" aria-selected={tab === 'writeoffs'} onClick={() => setTab('writeoffs')}>Hàng hủy</Button>
          </div>
          {tab === 'orders' ? (
            <FinancialTable<FinancialOrderRow>
              key={`o-${filterKey}`}
              title="Danh sách đơn hàng"
              queryKey={['financial-orders', user?.id, filters]}
              fetcher={(after, args) => fetchFinancialOrders(filters, after, args)}
              rowKey={o => o.id}
              empty="Không có đơn hàng trong khoảng lọc."
              columns={[
                { key: 'orderCode', header: 'Mã đơn', render: o => <b>{o.orderCode}</b>, text: o => o.orderCode },
                { key: 'createdAt', header: 'Ngày tạo', render: o => formatInstantDateTime(o.createdAt), text: o => formatInstantDateTime(o.createdAt) },
                { key: 'retailer', header: 'Nhà bán lẻ', text: o => `${o.retailerCodeSnapshot} · ${o.retailerNameSnapshot}` },
                { key: 'status', header: 'Trạng thái', text: o => statusLabel('order', o.status) },
                { key: 'finalAmount', header: 'Giá trị cuối cùng', align: 'right', text: o => money(o.finalAmount) },
                { key: 'actions', header: 'Thao tác', align: 'right', render: o => <Button size="sm" onClick={() => navigate(`/orders/${o.id}`)}>Xem đơn hàng</Button> },
              ]}
            />
          ) : (
            <FinancialTable<FinancialWriteOffRow>
              key={`w-${filterKey}`}
              title="Danh sách phiếu hủy hàng tồn kho"
              queryKey={['financial-writeoffs', user?.id, filters]}
              fetcher={(after, args) => fetchFinancialWriteOffs(filters, after, args)}
              rowKey={w => w.id}
              empty="Không có phiếu hủy hàng trong khoảng lọc."
              columns={[
                { key: 'writeOffCode', header: 'Mã phiếu', render: w => <b>{w.writeOffCode}</b>, text: w => w.writeOffCode },
                { key: 'createdAt', header: 'Ngày lập phiếu', render: w => formatInstantDateTime(w.createdAt), text: w => formatInstantDateTime(w.createdAt) },
                { key: 'warehouse', header: 'Kho', text: w => warehouseName(w.warehouseId) },
                { key: 'status', header: 'Trạng thái', text: w => statusLabel('disposal', w.status) },
                { key: 'reason', header: 'Lý do', text: w => writeOffReasonText(w.reason) },
                { key: 'actions', header: 'Thao tác', align: 'right', render: w => <Button size="sm" onClick={() => navigate(`/disposal/${w.writeOffCode}`)}>Xem phiếu hủy</Button> },
              ]}
            />
          )}
        </>
      )}
    </>
  );
}
