import {
  useState,
} from 'react';

import {
  useNavigate,
} from '@/shared/router/compat';
import {
  Button,
  DataTable,
  Input,
  PageHeader,
  StatusChip,
  type Column,
} from '@/shared/ui';
import {
  formatMoney,
  formatShortDateTime,
  paymentLabel,
  statusLabel,
  statusLabels,
} from '@/shared/lib';
import {
  useOrders,
} from '../hooks';
import {
  OrderActions,
} from '../components/OrderActions';
import type {
  OrderSummary,
} from '../types';

export function OrdersPage() {
  const navigate = useNavigate();
  const query = useOrders();

  const [from, setFrom] =
    useState('');

  const rows = (
    query.data ?? []
  ).filter(
    (order) =>
      !from ||
      order.createdAt.slice(0, 10) >=
        from,
  );

  const statusOptions = [
    ...new Set(
      Object.values(
        statusLabels.order,
      ),
    ),
  ];

  const columns:
    Column<OrderSummary>[] = [
      {
        key: 'orderCode',
        header: 'Mã đơn',
        width: '112px',
        render: (order) => (
          <span className="bold">
            {order.orderCode}
          </span>
        ),
      },
      {
        key: 'retailer',
        header: 'Retailer',
        width: '180px',
        text: (order) =>
          `${order.retailerCode} ${order.retailerName}`,
        render: (order) => (
          <>
            <div className="strong">
              {order.retailerName}
            </div>
            <div className="muted small">
              {order.retailerCode}
            </div>
          </>
        ),
      },
      {
        key: 'lines',
        header: 'Đơn hàng',
        width: '130px',
        text: (order) =>
          `${order.lineCount} SKU ${order.totalCartons} thùng`,
        render: (order) => (
          <div style={{ whiteSpace: 'nowrap' }}>
            <div>{order.lineCount} SKU</div>
            <div className="muted small">
              {order.totalCartons} thùng
            </div>
          </div>
        ),
      },
      {
        key: 'createdAt',
        header: 'Server nhận',
        width: '125px',
        text: (order) =>
          formatShortDateTime(
            order.createdAt,
          ),
      },
      {
        key: 'source',
        header: 'Nguồn',
        width: '82px',
        render: (order) => (
          <StatusChip
            domain="channel"
            value={
              order.source ===
              'Offline'
                ? 'Offline'
                : 'Online'
            }
          />
        ),
      },
      {
        key: 'payment',
        header: 'Thanh toán',
        width: '120px',
        text: (order) =>
          paymentLabel(
            order.paymentMethod,
          ),
      },
      {
        key: 'amount',
        header: 'Giá trị',
        width: '138px',
        align: 'right',
        render: (order) => (
          <>
            {formatMoney(
              order.officialAmount ??
                order.indicativeAmount,
            )}
            <br />
            <span className="muted small">
              {order.officialAmount ==
              null
                ? 'dự kiến'
                : 'chính thức'}
            </span>
          </>
        ),
      },
      {
        key: 'status',
        header: 'Trạng thái',
        width: '210px',
        render: (order) => (
          <div className="order-status-cell">
            <StatusChip
              domain="order"
              value={order.status}
            />
          </div>
        ),
      },
      {
        key: 'progress',
        header: 'Phân bổ / giao',
        width: '145px',
        text: (order) =>
          `${order.allocationResult ?? order.allocationState} ${order.shipmentCount}`,
        render: (order) => (
          <>
            {order.allocationResult ??
              order.allocationState}
            <br />
            <span className="muted small">
              {order.shipmentCount}
              {' '}phần giao
            </span>
          </>
        ),
      },
    ];

  return (
    <OrderActions>
      {({
        buttons,
        dialogs,
      }) => (
        <>
          <PageHeader
            title="Đơn hàng"
            subtitle="Theo dõi SO, phân bổ real-time, báo giá, PO và tiến độ giao hàng."
            actions={
              <Button
                loading={
                  query.isFetching
                }
                onClick={() =>
                  void query.refetch()
                }
              >
                Tải lại dữ liệu
              </Button>
            }
          />

          <DataTable
            title="Danh sách đơn hàng"
            rows={rows}
            loading={
              query.isLoading
            }
            error={query.error}
            rowKey={(order) =>
              order.id
            }
            columns={columns}
            searchPlaceholder="Mã đơn, retailer, trạng thái…"
            filters={[
              {
                label:
                  'Trạng thái',
                options:
                  statusOptions,
                value: (order) =>
                  statusLabel(
                    'order',
                    order.status,
                  ),
              },
              {
                label: 'Nguồn',
                options: [
                  'Online',
                  'Offline',
                ],
                value: (order) =>
                  order.source ===
                  'Offline'
                    ? 'Offline'
                    : 'Online',
              },
            ]}
            filterExtra={
              <label className="lbl">
                Từ ngày
                <Input
                  type="date"
                  value={from}
                  onChange={(
                    event,
                  ) =>
                    setFrom(
                      event.target.value,
                    )
                  }
                />
              </label>
            }
            onRowClick={(
              order,
            ) =>
              navigate(
                `/orders/${order.id}`,
              )
            }
            rowActionsWidth="220px"
            rowActions={(
              order,
            ) => (
              <>
                <Button
                  size="sm"
                  onClick={() =>
                    navigate(
                      `/orders/${order.id}`,
                    )
                  }
                >
                  Xem
                </Button>

                {buttons(order)}
              </>
            )}
          />

          {dialogs}
        </>
      )}
    </OrderActions>
  );
}