import { useMemo, useState } from 'react';
import { Eye, LogOut, RotateCcw } from 'lucide-react';
import { useNavigate } from '@/shared/router/compat';
import { useDateParam, useEnumParam, useQueryParams } from '@/shared/router/listState';
import { useCursorPagination } from '@/shared/pagination';
import { parsePageSize } from '@/shared/pagination/urlSync';
import {
  ActionDropdown,
  Button,
  DataTable,
  Input,
  PageHeader,
  Select,
  StatusChip,
  type ActionDropdownItem,
  type Column,
} from '@/shared/ui';
import {
  formatMoney,
  formatShortDateTime,
  vietnamDate,
  paymentLabel,
  statusLabels, statusLabel,
} from '@/shared/lib';
import { useAuth } from '@/shared/auth/AuthContext';
import { useApiMutation } from '@/shared/hooks';
import { canWithdrawOrder } from '../orderAccess';
import { orderApi } from '../api';
import { useOrdersPage } from '../hooks';
import { ORDER_PAGE_SIZES, type OrderPageSize } from '../ordersGraphql';
import type { OrderSummary } from '../types';
import { useOrderSales } from '../orderSales';
import { WithdrawOrderDialog } from '../components/OrderDialogs';

const STATUS_VALUES = ['', 'Allocating', 'Quoted', 'AllocationFailed', 'OutOfStock',
  'AllocationConflict', 'Withdrawn', 'QuoteRejected', 'QuoteExpired', 'PaymentPending',
  'ConvertedToPo', 'Picking', 'Rejected', 'Cancelled', 'Issued', 'Delivering', 'Delivered',
  'Completed'] as const;
type StatusFilterValue = (typeof STATUS_VALUES)[number];

const SIZE_VALUES = ORDER_PAGE_SIZES.map(String) as `${OrderPageSize}`[];
const PAGE_RESETS = ['after', 'before', 'page'];

const statusFilterOptions = [
  { label: 'Tất cả', value: '' },
  ...Object.entries(statusLabels.order).map(([value, label]) => ({ label, value })),
];

export function OrdersPage() {
  const navigate = useNavigate();
  const { params } = useQueryParams();
  const { user } = useAuth();
  const retry = useApiMutation(orderApi.retryAllocation, { success: 'Đã thử phân bổ lại đơn.' });
  const [withdrawTarget, setWithdrawTarget] = useState<OrderSummary | null>(null);

  // Read cursor params directly from URL (same source as useCursorPagination)
  const after = params.get('after') ?? undefined;
  const before = after ? undefined : (params.get('before') ?? undefined);
  const pageSize = parsePageSize(params.get('size'), ORDER_PAGE_SIZES, 20) as OrderPageSize;

  // Server-side filters — resets cursor on change
  const [statusFilter, setStatusFilter] = useEnumParam<StatusFilterValue>(
    'status', STATUS_VALUES, '', { resets: PAGE_RESETS },
  );
  const [from, setFrom] = useDateParam('from', { resets: PAGE_RESETS });
  // sizeParam wires the size selector to URL and resets cursors when changed.
  // The raw value is not used directly — pageSize is derived above via parsePageSize.
  useEnumParam<`${OrderPageSize}`>('size', SIZE_VALUES, '20', { resets: PAGE_RESETS });

  // GraphQL cursor-paginated query
  const query = useOrdersPage({
    size: pageSize,
    after,
    before,
    status: statusFilter || undefined,
    from: from || undefined,
  });

  // Phase 0 cursor pagination hook — reads same URL params, provides navigation callbacks
  const { pagingProps } = useCursorPagination({
    pageInfo: query.data?.pageInfo,
    totalCount: query.data?.totalCount,
    loading: query.isLoading || query.isFetching,
    error: query.isPlaceholderData ? undefined : query.error,
    defaultPageSize: 20,
    pageSizeOptions: ORDER_PAGE_SIZES,
    urlState: true,
  });

  // Apply from-date filter client-side only for rows already on this page (server-side date filter
  // goes through GraphQL where clause; client-side keeps visual consistency during placeholder phase).
  const visibleRows = useMemo(
    () => (query.data?.rows ?? []).filter((order) => !from || vietnamDate(order.createdAt) >= from),
    [query.data?.rows, from],
  );

  const creatorIds = useMemo(
    () => visibleRows.map((order) => order.createdByUserId),
    [visibleRows],
  );
  const { salesNameOf, salesSearchTextOf } = useOrderSales(creatorIds);

  const salesFilterOptions = useMemo(() => {
    const options = new Set<string>();
    for (const order of visibleRows) {
      const name = salesNameOf(order.createdByUserId);
      if (name && name !== '…') options.add(name);
    }
    return [...options].sort((a, b) => a.localeCompare(b, 'vi-VN'));
  }, [visibleRows, salesNameOf]);

  const columns: Column<OrderSummary>[] = [
    {
      key: 'orderCode',
      header: 'Mã đơn',
      width: '104px',
      render: (order) => <span className="bold">{order.orderCode}</span>,
    },
    {
      key: 'retailer',
      header: 'Điểm bán',
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
      header: 'Server nhận',
      width: '105px',
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
        searchPlaceholder="Mã đơn, điểm bán, người đặt, trạng thái…"
        cursor={pagingProps}
        filters={[
          {
            label: 'Người đặt đơn',
            param: 'sales',
            searchable: true,
            options: salesFilterOptions,
            value: (order) => salesNameOf(order.createdByUserId),
          },
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
              <Input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
          </>
        }
        onRowClick={(order) => navigate(`/orders/${order.id}`)}
        rowActionsWidth="135px"
        rowActionHeader="Thao tác"
        rowActions={(order) => {
          const dropdownItems: ActionDropdownItem[] = [];
          if (
            ['AllocationFailed', 'AllocationConflict'].includes(order.status)
          ) {
            dropdownItems.push({
              key: 'retry',
              label: retry.isPending ? 'Đang thử lại…' : 'Thử phân bổ lại',
              icon: <RotateCcw size={14} style={{ color: '#1D4ED8' }} />,
              color: '#1D4ED8',
              disabled: retry.isPending,
              onClick: () => retry.mutate(order),
            });
          }
          if (canWithdrawOrder(user, order)) {
            dropdownItems.push({
              key: 'withdraw',
              label: 'Rút yêu cầu',
              icon: <LogOut size={14} style={{ color: '#C2410C' }} />,
              color: '#C2410C',
              onClick: () => setWithdrawTarget(order),
            });
          }
          return (
            <div
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                size="sm"
                variant="default"
                onClick={() => navigate(`/orders/${order.id}`)}
                title="Xem chi tiết đơn hàng"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: 12, fontWeight: 600, height: 30 }}
              >
                <Eye size={14} />
                <span>Xem</span>
              </Button>
              {dropdownItems.length > 0 && <ActionDropdown items={dropdownItems} />}
            </div>
          );
        }}
      />

      <WithdrawOrderDialog
        order={withdrawTarget}
        onClose={() => setWithdrawTarget(null)}
      />
    </>
  );
}
