import { useMemo, useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { Button, DataTable, Input, PageHeader, Stat, StatusChip, type Column } from '@/shared/ui';
import { formatCases, formatMoney, formatShortDateTime } from '@/shared/lib';
import { useOrders } from '@/features/orders/hooks';
import type { OrderSummary } from '@/features/orders/types';

/** Read-only operational history for the Review-2 real-time allocation flow. */
export function AllocationRunPage() {
  const navigate = useNavigate();
  const query = useOrders();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const rows = useMemo(
    () => (query.data ?? []).filter((order) => {
      const date = order.createdAt.slice(0, 10);
      return (!from || date >= from) && (!to || date <= to);
    }),
    [query.data, from, to],
  );

  const columns: Column<OrderSummary>[] = [
    {
      key: 'received', header: 'Server nhận', width: '145px',
      text: (order) => formatShortDateTime(order.createdAt),
    },
    {
      key: 'order', header: 'SO / Retailer', width: '220px',
      text: (order) => `${order.orderCode} ${order.retailerCode} ${order.retailerName}`,
      render: (order) => <><div className="strong">{order.orderCode}</div><div className="muted small">{order.retailerCode} · {order.retailerName}</div></>,
    },
    {
      key: 'demand', header: 'Nhu cầu', width: '120px',
      render: (order) => <>{order.lineCount} SKU<br /><span className="muted small">{formatCases(order.totalCartons)}</span></>,
    },
    {
      key: 'allocation', header: 'Kết quả allocation',
      text: (order) => `${order.allocationState} ${order.allocationResult ?? ''}`,
      render: (order) => <><div className="strong">{order.allocationResult ?? order.allocationState}</div><div className="muted small">{order.finalPricePendingAllocation ? 'Đang chọn batch và tính giá HSD' : 'Đã chốt batch và giá theo batch'}</div></>,
    },
    {
      key: 'amount', header: 'Giá sau phân bổ', width: '150px', align: 'right',
      render: (order) => <>{formatMoney(order.officialAmount ?? order.indicativeAmount)}<br /><span className="muted small">{order.officialAmount == null ? 'đang tính' : 'chính thức'}</span></>,
    },
    {
      key: 'status', header: 'Trạng thái SO', width: '165px',
      render: (order) => <StatusChip domain="order" value={order.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Giám sát allocation real-time"
        subtitle="Mỗi SO được chọn batch/kho ngay khi gửi. Hệ thống giữ tồn sau allocation thành công, tính giảm HSD theo batch rồi gửi báo giá cho Retailer; Admin không duyệt phương án."
      />
      <div className="stats-grid" style={{ marginBottom: 12 }}>
        <Stat label="SO trong bộ lọc" value={rows.length} />
        <Stat label="Đang phân bổ" value={rows.filter((order) => order.status === 'Allocating').length} />
        <Stat label="Đã gửi báo giá" value={rows.filter((order) => order.status === 'Quoted').length} />
        <Stat label="Lỗi / thiếu hàng" value={rows.filter((order) => ['AllocationFailed', 'OutOfStock', 'AllocationConflict'].includes(order.status)).length} />
      </div>
      <DataTable
        title="Lịch sử xử lý SO"
        rows={rows}
        loading={query.isLoading}
        error={query.error}
        rowKey={(order) => order.id}
        columns={columns}
        searchPlaceholder="Mã SO, Retailer, kết quả…"
        filterExtra={<><label className="lbl">Từ ngày<Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label className="lbl">Đến ngày<Input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label></>}
        onRowClick={(order) => navigate(`/orders/${order.id}`)}
        rowActionsWidth="110px"
        rowActions={(order) => <Button size="sm" onClick={() => navigate(`/orders/${order.id}`)}>Chi tiết</Button>}
      />
    </>
  );
}
