import { useMemo } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { useDateParam } from '@/shared/router/listState';
import { Button, DataTable, Input, PageHeader, Stat, StatusChip, type Column } from '@/shared/ui';
import { formatCases, formatMoney, formatShortDateTime, vietnamDate, statusLabel } from '@/shared/lib';
import { useOrders } from '@/features/orders/hooks';
import type { OrderSummary } from '@/features/orders/types';

/** Read-only operational history for the Review-2 real-time allocation flow. */
export function AllocationRunPage() {
  const navigate = useNavigate();
  const query = useOrders();
  const [from, setFrom] = useDateParam('from', { resets: ['page'] });
  const [to, setTo] = useDateParam('to', { resets: ['page'] });

  const rows = useMemo(
    () => (query.data ?? []).filter((order) => {
      const date = vietnamDate(order.createdAt);
      return (!from || date >= from) && (!to || date <= to);
    }),
    [query.data, from, to],
  );

  const columns: Column<OrderSummary>[] = [
    {
      key: 'received', header: 'Hệ thống tiếp nhận', width: '145px',
      text: (order) => formatShortDateTime(order.createdAt),
    },
    {
      key: 'order', header: 'Đơn bán hàng / điểm bán', width: '220px',
      text: (order) => `${order.orderCode} ${order.retailerCode} ${order.retailerName}`,
      render: (order) => <><div className="strong">{order.orderCode}</div><div className="muted small">{order.retailerCode} · {order.retailerName}</div></>,
    },
    {
      key: 'demand', header: 'Nhu cầu', width: '120px',
      render: (order) => <>{order.lineCount} SKU<br /><span className="muted small">{formatCases(order.totalCartons)}</span></>,
    },
    {
      key: 'allocation', header: 'Kết quả phân bổ',
      text: (order) => `${statusLabel('allocation', order.allocationState)} ${statusLabel('allocation', order.allocationResult ?? '')}`,
      render: (order) => <><div className="strong">{statusLabel('allocation', order.allocationResult ?? order.allocationState)}</div><div className="muted small">{order.finalPricePendingAllocation ? 'Đang chọn lô hàng và tính giá HSD' : 'Đã chốt lô hàng và giá theo lô hàng'}</div></>,
    },
    {
      key: 'amount', header: 'Giá sau phân bổ', width: '150px', align: 'right',
      render: (order) => <>{formatMoney(order.officialAmount ?? order.indicativeAmount)}<br /><span className="muted small">{order.officialAmount == null ? 'đang tính' : 'chính thức'}</span></>,
    },
    {
      key: 'status', header: 'Trạng thái đơn bán hàng', width: '165px',
      render: (order) => <StatusChip domain="order" value={order.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Giám sát phân bổ theo thời gian thực"
        subtitle="Mỗi đơn bán hàng được chọn lô hàng/kho ngay khi gửi. Hệ thống giữ tồn sau phân bổ thành công, tính giảm HSD theo lô hàng rồi gửi báo giá cho điểm bán; quản trị viên không duyệt phương án."
      />
      <div className="stats-grid" style={{ marginBottom: 12 }}>
        <Stat label="Đơn bán hàng trong bộ lọc" value={rows.length} />
        <Stat label="Đang phân bổ" value={rows.filter((order) => order.status === 'Allocating').length} />
        <Stat label="Đã gửi báo giá" value={rows.filter((order) => order.status === 'Quoted').length} />
        <Stat label="Lỗi / thiếu hàng" value={rows.filter((order) => ['AllocationFailed', 'OutOfStock', 'AllocationConflict'].includes(order.status)).length} />
      </div>
      <DataTable
        title="Lịch sử xử lý đơn bán hàng"
        rows={rows}
        loading={query.isLoading}
        error={query.error}
        rowKey={(order) => order.id}
        columns={columns}
        searchPlaceholder="Mã đơn bán hàng, điểm bán, kết quả…"
        filterExtra={<><label className="lbl">Từ ngày<Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label className="lbl">Đến ngày<Input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label></>}
        onRowClick={(order) => navigate(`/orders/${order.id}`)}
        rowActionsWidth="110px"
        rowActions={(order) => <Button size="sm" onClick={() => navigate(`/orders/${order.id}`)}>Chi tiết</Button>}
      />
    </>
  );
}
