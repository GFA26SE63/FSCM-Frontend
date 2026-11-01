import { useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { Button, DataTable, Input, PageHeader, StatusChip, type Column } from '@/shared/ui';
import { formatCases, formatMoney, formatShortDateTime, paymentLabel, statusLabel, statusLabels } from '@/shared/lib';
import { useOrders } from '../hooks';
import { OrderActions } from '../components/OrderActions';
import type { OrderSummary } from '../types';

export function OrdersPage() {
  const navigate = useNavigate();
  const query = useOrders();
  const [from, setFrom] = useState('');
  const rows = (query.data ?? []).filter((o) => !from || o.createdAt.slice(0, 10) >= from);

  const columns: Column<OrderSummary>[] = [
    { key: 'orderCode', header: 'Mã đơn', width: '112px', render: (o) => <span className="bold">{o.orderCode}</span> },
    { key: 'retailer', header: 'Retailer', width: '180px', text: (o) => `${o.retailerCode} ${o.retailerName}`, render: (o) => (<><div className="strong">{o.retailerName}</div><div className="muted small">{o.retailerCode}</div></>) },
    { key: 'lines', header: 'Đơn hàng', text: (o) => `${o.lineCount} SKU ${o.totalCartons} thùng`, render: (o) => <>{o.lineCount} SKU<br /><span className="muted small">{formatCases(o.totalCartons)}</span></> },
    { key: 'createdAt', header: 'Server nhận', width: '125px', text: (o) => formatShortDateTime(o.createdAt) },
    { key: 'source', header: 'Nguồn', width: '82px', render: (o) => <StatusChip domain="channel" value={o.source === 'Offline' ? 'Offline' : 'Online'} /> },
    { key: 'payment', header: 'Thanh toán', width: '120px', text: (o) => paymentLabel(o.paymentMethod) },
    {
      key: 'amount', header: 'Giá trị', width: '138px', align: 'right',
      render: (o) => <>{formatMoney(o.officialAmount ?? o.indicativeAmount)}<br /><span className="muted small">{o.officialAmount == null ? 'dự kiến' : 'chính thức'}</span></>,
    },
    { key: 'status', header: 'Trạng thái', width: '145px', render: (o) => <StatusChip domain="order" value={o.status} /> },
    { key: 'progress', header: 'Đợt / giao', width: '145px', text: (o) => `${o.allocationResult ?? o.allocationState} ${o.shipmentCount}`, render: (o) => <>{o.allocationResult ?? o.allocationState}<br /><span className="muted small">{o.shipmentCount} phần giao</span></> },
  ];

  return (
    <OrderActions>
      {({ buttons, dialogs }) => (
        <>
          <PageHeader title="Đơn hàng" subtitle="Giá dự kiến trước đợt, giá chính thức sau duyệt và tiến độ từng phần theo kho." />
          <DataTable
            title="Danh sách đơn hàng"
            rows={rows}
            loading={query.isLoading}
            error={query.error}
            rowKey={(o) => o.id}
            columns={columns}
            searchPlaceholder="Mã đơn, retailer, trạng thái…"
            filters={[
              { label: 'Trạng thái', options: Object.values(statusLabels.order), value: (o) => statusLabel('order', o.status) },
              { label: 'Nguồn', options: ['Online', 'Offline'], value: (o) => o.source === 'Offline' ? 'Offline' : 'Online' },
            ]}
            filterExtra={<label className="lbl">Từ ngày<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>}
            onRowClick={(o) => navigate(`/orders/${o.id}`)}
            rowActionsWidth="300px"
            rowActions={(o) => <><Button size="sm" onClick={() => navigate(`/orders/${o.id}`)}>Xem</Button>{buttons(o)}</>}
          />
          {dialogs}
        </>
      )}
    </OrderActions>
  );
}
