import { useMemo } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { useDateParam, useEnumParam, useQueryParams } from '@/shared/router/listState';
import { useCursorPagination } from '@/shared/pagination';
import { decodeSort, PAGINATION_PARAM_NAMES, PAGINATION_RESETS, parsePageSize } from '@/shared/pagination/urlSync';
import {
  Button,
  DataTable,
  DateInput,
  PageHeader,
  Select,
  StatusChip,
  type Column,
} from '@/shared/ui';
import {
  formatMoney,
  formatShortDateTime,
  vietnamDate,
  paymentLabel,
  statusLabels, statusLabel,
} from '@/shared/lib';
import { useOrdersPage } from '../hooks';
import { ORDER_PAGE_SIZES, ORDER_SORT_MAP, ORDER_SORTABLE_FIELDS, type OrderPageSize, type OrderSortField } from '../ordersGraphql';
import type { OrderSummary } from '../types';
import { useOrderSales } from '../orderSales';

const STATUS_VALUES = ['', 'Allocating', 'Quoted', 'AllocationFailed', 'OutOfStock',
  'AllocationConflict', 'Withdrawn', 'QuoteRejected', 'QuoteExpired', 'PaymentPending',
  'ConvertedToPo', 'Picking', 'Rejected', 'Cancelled', 'Issued', 'Delivering', 'Delivered',
  'Completed'] as const;
type StatusFilterValue = (typeof STATUS_VALUES)[number];

const SIZE_VALUES = ORDER_PAGE_SIZES.map(String) as `${OrderPageSize}`[];
const PAGE_RESETS = PAGINATION_RESETS;

const statusFilterOptions = [
  { label: 'Tất cả', value: '' },
  ...Object.entries(statusLabels.order).map(([value, label]) => ({ label, value })),
];

export function OrdersPage() {
  const navigate = useNavigate();
  const { params } = useQueryParams();

  // Read cursor params directly from URL (same source as useCursorPagination)
  const after = params.get('after') ?? undefined;
  const before = after ? undefined : (params.get('before') ?? undefined);
  const pageSize = parsePageSize(params.get('size'), ORDER_PAGE_SIZES, 20) as OrderPageSize;

  // Server-side filters — resets cursor on change
  const [statusFilter, setStatusFilter] = useEnumParam<StatusFilterValue>(
    'status', STATUS_VALUES, '', { resets: PAGE_RESETS },
  );
  const [from, setFrom] = useDateParam('from', { resets: PAGE_RESETS });
  const [to, setTo] = useDateParam('to', { resets: PAGE_RESETS });
  const [sort, setSort] = useEnumParam<'newest' | 'oldest'>('sort', ['newest', 'oldest'] as const, 'newest', { resets: PAGE_RESETS });
  const search = params.get('q') ?? undefined;
  const source = params.get('nguon') ?? undefined;
  // sizeParam wires the size selector to URL and resets cursors when changed.
  // The raw value is not used directly — pageSize is derived above via parsePageSize.
  useEnumParam<`${OrderPageSize}`>('size', SIZE_VALUES, '20', { resets: PAGE_RESETS });

  // Read sort from URL synchronously — available before query runs
  const rawSort = decodeSort(params.get(PAGINATION_PARAM_NAMES.SORT));
  const activeSort = rawSort?.field && ORDER_SORT_MAP[rawSort.field as OrderSortField]
    ? { field: rawSort.field as OrderSortField, direction: rawSort.direction }
    : undefined;

  // GraphQL cursor-paginated query
  const query = useOrdersPage({
    size: pageSize,
    after,
    before,
    status: statusFilter || undefined,
    from: from || undefined,
    to: to || undefined,
    source,
    search,
    sort: activeSort,
  });

  // Phase 0 cursor pagination hook — reads same URL params, provides navigation + sort callbacks
  const { pagingProps, sortProps } = useCursorPagination({
    pageInfo: query.data?.pageInfo,
    totalCount: query.data?.totalCount,
    loading: query.isLoading || query.isFetching,
    error: query.isPlaceholderData ? undefined : query.error,
    defaultPageSize: 20,
    pageSizeOptions: ORDER_PAGE_SIZES,
    urlState: true,
  });

  // Keep the current page visually consistent while a server-side date-filter request is in flight.
  const visibleRows = useMemo(
    () => (query.data?.rows ?? []).filter((order) =>
      (!from || vietnamDate(order.createdAt) >= from)
      && (!to || vietnamDate(order.createdAt) <= to)),
    [query.data?.rows, from, to],
  );

  const creatorIds = useMemo(
    () => visibleRows.map((order) => order.createdByUserId),
    [visibleRows],
  );
  const { salesNameOf, salesSearchTextOf } = useOrderSales(creatorIds);

  const columns: Column<OrderSummary>[] = [
    {
      key: 'orderCode',
      header: 'Mã đơn',
      width: '104px',
      sortable: true,
      render: (order) => <span className="bold">{order.orderCode}</span>,
    },
    {
      key: 'retailer',
      header: 'Nhà bán lẻ',
      text: (order) => `${order.retailerCode} ${order.retailerName}`,
      render: (order) => (
        <>
          <div className="strong">{order.retailerName}</div>
          <div className="muted small">{order.retailerCode}</div>
        </>
      ),
    },
    {
      key: 'sales',
      header: 'Người đặt đơn',
      width: '135px',
      text: (order) => salesSearchTextOf(order.createdByUserId),
      render: (order) => (
        <div className="strong" title={salesNameOf(order.createdByUserId)}>
          {salesNameOf(order.createdByUserId)}
        </div>
      ),
    },
    {
      key: 'lines',
      header: 'Đơn hàng',
      width: '95px',
      text: (order) => `${order.lineCount} SKU ${order.totalCartons} thùng`,
      render: (order) => (
        <div style={{ whiteSpace: 'nowrap' }}>
          <div>{order.lineCount} SKU</div>
          <div className="muted small">{order.totalCartons} thùng</div>
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Ngày nhận đơn',
      width: '105px',
      sortable: true,
      text: (order) => formatShortDateTime(order.createdAt),
    },
    {
      key: 'source',
      header: 'Nguồn',
      width: '78px',
      render: (order) => (
        <StatusChip
          domain="channel"
          value={order.source === 'Offline' ? 'Offline' : 'Online'}
        />
      ),
    },
    {
      key: 'payment',
      header: 'Thanh toán',
      width: '105px',
      text: (order) => paymentLabel(order.paymentMethod),
    },
    {
      key: 'amount',
      header: 'Giá trị',
      width: '115px',
      align: 'right',
      sortable: true,
      render: (order) => (
        <>
          {formatMoney(order.officialAmount ?? order.indicativeAmount)}
          <br />
          <span className="muted small">
            {order.officialAmount == null ? 'dự kiến' : 'chính thức'}
          </span>
        </>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '150px',
      render: (order) => (
        <div className="order-status-cell">
          <StatusChip domain="order" value={order.status} />
        </div>
      ),
    },
    {
      key: 'progress',
      header: 'Phân bổ / giao',
      width: '110px',
      text: (order) => `${statusLabel('allocation', order.allocationResult ?? order.allocationState)} ${order.shipmentCount}`,
      render: (order) => (
        <>
          {statusLabel('allocation', order.allocationResult ?? order.allocationState)}
          <br />
          <span className="muted small">{order.shipmentCount} phần giao</span>
        </>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Đơn hàng"
        subtitle="Theo dõi đơn bán hàng, phân bổ theo thời gian thực, báo giá, đơn thực hiện và tiến độ giao hàng."
        actions={
          <Button loading={query.isFetching} onClick={() => void query.refetch()}>
            Tải lại dữ liệu
          </Button>
        }
      />

      <DataTable
        title="Danh sách đơn hàng"
        rows={visibleRows}
        loading={query.isLoading || query.isPlaceholderData}
        error={query.isPlaceholderData ? undefined : query.error}
        rowKey={(order) => order.id}
        columns={columns}
        summaryColumns={['orderCode', 'retailer', 'sales', 'createdAt', 'amount', 'status']}
        searchPlaceholder="Mã đơn, nhà bán lẻ, người đặt, trạng thái…"
        filterClassName="orders-filter-card"
        onClear={() => {
          setStatusFilter('');
          setFrom('');
          setTo('');
          setSort('newest');
        }}
        cursor={pagingProps}
        serverSort={{ ...sortProps, sortableFields: ORDER_SORTABLE_FIELDS }}
        filters={[
          {
            label: 'Nguồn',
            options: ['Online', 'Offline'],
            value: (order) => (order.source === 'Offline' ? 'Offline' : 'Online'),
          },
        ]}
        filterExtra={
          <>
            <label className="lbl">
              Trạng thái
              <Select
                value={statusFilter}
                options={statusFilterOptions}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilterValue)}
              />
            </label>
            <label className="lbl">
              Từ ngày
              <DateInput
                value={from}
                max={to || undefined}
                onChange={(value) => {
                  setFrom(value);
                  if (value && to && value > to) setTo(value);
                }}
              />
            </label>
            <label className="lbl">
              Đến ngày
              <DateInput
                value={to}
                min={from || undefined}
                onChange={(value) => {
                  setTo(value);
                  if (value && from && value < from) setFrom(value);
                }}
              />
            </label>
            <label className="lbl">Thời gian<Select value={sort} options={[{ value: 'newest', label: 'Mới nhất' }, { value: 'oldest', label: 'Cũ nhất' }]} onChange={e => setSort(e.target.value as 'newest' | 'oldest')} /></label>
          </>
        }
        onRowClick={(order) => navigate(`/orders/${order.id}`)}
      />

    </>
  );
}
