import { useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { Button, DataTable, Input, PageHeader, StatusChip, type Column } from '@/shared/ui';
import { formatMoney, formatShortDateTime, paymentLabel, statusLabel, statusLabels } from '@/shared/lib';
import { useOrders } from '../hooks';
import { OrderActions } from '../components/OrderActions';
import type { OrderSummary } from '../types';

/** "Đơn hàng" list – filters Trạng thái / Kênh tạo / Từ ngày; row actions depend on status. */
export function OrdersPage() {
  const navigate = useNavigate();
  const query = useOrders();
  const [from, setFrom] = useState('');
  const rows = (query.data ?? []).filter((o) => !from || o.createdAt.slice(0, 10) >= from);

  const columns: Column<OrderSummary>[] = [
    { key: 'code', header: 'Mã đơn', width: '104px', render: (o) => <span className="bold">{o.code}</span> },
    { key: 'retailer', header: 'Retailer', width: '180px', text: (o) => `${o.retailerCode} ${o.retailerName}`, render: (o) => (<><div className="strong">{o.retailerName}</div><div className="muted small">{o.retailerCode}</div></>) },
    { key: 'items', header: 'Sản phẩm', text: (o) => o.itemsSummary },
    { key: 'sales', header: 'Sales', width: '130px', text: (o) => o.salesName },
    { key: 'createdAt', header: 'Ngày tạo', width: '110px', text: (o) => formatShortDateTime(o.createdAt) },
    { key: 'channel', header: 'Kênh', width: '80px', render: (o) => <StatusChip domain="channel" value={o.channel} /> },
    { key: 'payment', header: 'Thanh toán', width: '150px', text: (o) => paymentLabel(o.paymentMethod, o.termDays) },
    { key: 'total', header: 'Thành tiền', width: '120px', align: 'right', text: (o) => formatMoney(o.total) },
    { key: 'status', header: 'Trạng thái', width: '130px', render: (o) => <StatusChip domain="order" value={o.status} /> },
  ];

  return (
    <OrderActions>
      {({ buttons, dialogs }) => (
        <>
          <PageHeader title="Đơn hàng" subtitle="Duyệt đơn, xem giải thích phân bổ B1–B4, cập nhật giao hàng. Đơn không đủ hàng được ghi là thiếu, đợt không tự từ chối đơn." />
          <DataTable
            title="Danh sách đơn hàng"
            rows={rows}
            loading={query.isLoading}
            error={query.error}
            rowKey={(o) => o.code}
            columns={columns}
            searchPlaceholder="Mã đơn, retailer, sản phẩm, Sales…"
            filters={[
              { label: 'Trạng thái', options: Object.values(statusLabels.order), value: (o) => statusLabel('order', o.status) },
              { label: 'Kênh tạo', options: ['Online', 'Offline'], value: (o) => o.channel },
            ]}
            filterExtra={
              <label className="lbl">
                Từ ngày
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
            }
            onRowClick={(o) => navigate(`/orders/${o.code}`)}
            rowActionsWidth="270px"
            rowActions={(o) => (
              <>
                <Button size="sm" onClick={() => navigate(`/orders/${o.code}`)}>Xem</Button>
                {buttons(o.code, o.status)}
              </>
            )}
          />
          {dialogs}
        </>
      )}
    </OrderActions>
  );
}
