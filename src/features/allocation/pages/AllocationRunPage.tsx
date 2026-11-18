import { useQuery } from '@tanstack/react-query';
import { Eye } from 'lucide-react';
import { useNavigate } from '@/shared/router/compat';
import { useEnumParam } from '@/shared/router/listState';
import { useRestPagination, paginationQueryKeys } from '@/shared/pagination';
import {
  Button,
  DataTable,
  PageHeader,
  Select,
  StatusChip,
  type Column,
} from '@/shared/ui';
import { formatCases, formatMoney, formatShortDateTime, statusLabel } from '@/shared/lib';
import type { OrderStatus, OrderSummary } from '@/features/orders/types';
import { fetchAllocationOrdersPage } from '../allocationOrdersApi';

/**
 * Read-only operational history for the Review-2 real-time allocation flow.
 * Shows Sales Orders (SO) that have entered the allocation pipeline.
 * Each row is one Sales Order; allocation state/result fields are properties OF that SO.
 *
 * BACKEND DEPENDENCY — date range filter (from/to) requires Backend to add
 * `from` and `to` query params to GET /api/v1/orders. See allocationOrdersApi.ts.
 *
 * BACKEND DEPENDENCY — per-status global order counts require an aggregation endpoint.
 * GET /api/v1/orders only returns page-level data; GET /api/v1/dashboard returns
 * ordersByStatus but is a general dashboard scope. No allocation-specific aggregate exists.
 */

/**
 * These are OrderStatus values (not AllocationRun statuses).
 * GET /api/v1/orders?status=X filters by the Sales Order status field.
 * The allocation-phase statuses exposed here cover the monitoring use case.
 */
const ORDER_STATUS_FILTER_VALUES = [
  '', 'Allocating', 'Quoted', 'AllocationFailed', 'OutOfStock', 'AllocationConflict',
] as const;
type OrderStatusFilter = (typeof ORDER_STATUS_FILTER_VALUES)[number];

const STATUS_OPTIONS = [
  { label: 'Tất cả trạng thái đơn bán hàng', value: '' },
  { label: 'Đang phân bổ', value: 'Allocating' },
  { label: 'Đã báo giá', value: 'Quoted' },
  { label: 'Phân bổ thất bại', value: 'AllocationFailed' },
  { label: 'Hết hàng', value: 'OutOfStock' },
  { label: 'Xung đột allocation', value: 'AllocationConflict' },
];

export function AllocationRunPage() {
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useEnumParam<OrderStatusFilter>(
    'status',
    ORDER_STATUS_FILTER_VALUES,
    '',
    { resets: ['page'] },
  );

  const { page, pageSize, search, pagingProps: basePagingProps } = useRestPagination({
    defaultPageSize: 20,
    pageSizeOptions: [10, 20, 50],
    urlState: true,
  });

  const query = useQuery({
    queryKey: paginationQueryKeys.restPage('allocation-orders', {
      page,
      size: pageSize,
      search,
      filters: { status: statusFilter },
    }),
    queryFn: () =>
      fetchAllocationOrdersPage({
        page,
        pageSize,
        search: search || undefined,
        status: statusFilter || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const totalCount = query.data?.totalCount ?? 0;
  const totalPages = query.data?.totalPages ?? Math.max(1, Math.ceil(totalCount / pageSize));
  const pagingProps = { ...basePagingProps, total: totalCount, totalPages };

  const rows = query.data?.items ?? [];

  // BACKEND DEPENDENCY: per-status global counts require a dedicated aggregate endpoint.
  // Page-level counts removed to avoid presenting partial counts as global statistics.

  const columns: Column<OrderSummary>[] = [
    {
      key: 'received',
      header: 'Hệ thống tiếp nhận',
      width: '145px',
      text: (order) => formatShortDateTime(order.createdAt),
    },
    {
      key: 'order',
      header: 'Đơn bán hàng / nhà bán lẻ',
      width: '220px',
      text: (order) => `${order.orderCode} ${order.retailerCode} ${order.retailerName}`,
      render: (order) => (
        <>
          <div className="strong">{order.orderCode}</div>
          <div className="muted small">{order.retailerCode} · {order.retailerName}</div>
        </>
      ),
    },
    {
      key: 'demand',
      header: 'Nhu cầu',
      width: '120px',
      render: (order) => (
        <>
          {order.lineCount} SKU
          <br />
          <span className="muted small">{formatCases(order.totalCartons)}</span>
        </>
      ),
    },
    {
      key: 'allocation',
      header: 'Kết quả phân bổ',
      text: (order) => `${statusLabel('allocation', order.allocationState)} ${statusLabel('allocation', order.allocationResult ?? '')}`,
      render: (order) => (
        <>
          <div className="strong">{statusLabel('allocation', order.allocationResult ?? order.allocationState ?? '—')}</div>
          <div className="muted small">
            {order.allocationRunId
              ? `Lần phân bổ: ${order.allocationRunId.slice(0, 8)}…`
              : order.finalPricePendingAllocation
                ? 'Đang tính giá HSD'
                : null}
          </div>
        </>
      ),
    },
    {
      key: 'amount',
      header: 'Giá sau phân bổ',
      width: '150px',
      align: 'right',
      render: (order) => (
        <>
          {formatMoney(order.officialAmount ?? order.indicativeAmount)}
          <br />
          <span className="muted small">
            {order.officialAmount == null ? 'đang tính' : 'chính thức'}
          </span>
        </>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái đơn bán hàng',
      width: '165px',
      render: (order) => <StatusChip domain="order" value={order.status as OrderStatus} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Giám sát phân bổ theo thời gian thực"
        subtitle="Mỗi đơn bán hàng được chọn lô hàng/kho ngay khi gửi. Hệ thống giữ tồn sau phân bổ thành công, tính giảm HSD theo lô hàng rồi gửi báo giá cho nhà bán lẻ; quản trị viên không duyệt phương án."
      />
      <DataTable
        title="Lịch sử xử lý đơn bán hàng"
        rows={rows}
        loading={query.isLoading || query.isFetching}
        error={query.error}
        rowKey={(order) => order.id}
        columns={columns}
        searchPlaceholder="Mã đơn bán hàng, nhà bán lẻ…"
        filterExtra={
          <Select
            aria-label="Lọc theo trạng thái đơn bán hàng"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as OrderStatusFilter)}
            options={STATUS_OPTIONS}
          />
        }
        server={pagingProps}
        onRowClick={(order) => navigate(`/orders/${order.id}`)}
        rowActionsWidth="110px"
        rowActionHeader="Thao tác"
        rowActions={(order) => (
          <Button
            size="sm"
            variant="default"
            onClick={() => navigate(`/orders/${order.id}`)}
            title="Xem chi tiết đơn hàng"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: 12, fontWeight: 600, height: 30 }}
          >
            <Eye size={14} />
            <span>Chi tiết</span>
          </Button>
        )}
      />
    </>
  );
}
