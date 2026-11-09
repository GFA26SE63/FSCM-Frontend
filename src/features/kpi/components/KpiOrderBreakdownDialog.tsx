import { useNavigate } from '@/shared/router/compat';
import {
  Button,
  Callout,
  DataTable,
  Drawer,
  Stat,
  type Column,
} from '@/shared/ui';
import { formatDate, formatMoney } from '@/shared/lib';

import type {
  SalesKpiEntry,
  SalesKpiOrder,
} from '../types';

interface Props {
  open: boolean;
  entry: SalesKpiEntry | null;
  fromDate: string;
  toDate: string;
  recognitionRule?: string;
  onClose: () => void;
}

export function KpiOrderBreakdownDialog({
  open,
  entry,
  fromDate,
  toDate,
  recognitionRule,
  onClose,
}: Props) {
  const navigate = useNavigate();

  if (!entry) return null;

  const orders = entry.orders ?? [];
  const totalRecognized = entry.recognizedRevenue;

  const columns: Column<SalesKpiOrder>[] = [
    {
      key: 'orderCode',
      header: 'Mã đơn',
      width: '120px',
      text: (row) => row.orderCode,
      render: (row) => (
        <button
          type="button"
          onClick={() => navigate(`/orders/${row.orderId}`)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--c-primary, #14655B)',
            cursor: 'pointer',
            padding: 0,
            fontWeight: 600,
            textDecoration: 'underline',
          }}
          title="Bấm để xem chi tiết đơn hàng"
        >
          {row.orderCode}
        </button>
      ),
    },
    {
      key: 'recognitionDate',
      header: 'Ngày ghi nhận',
      width: '110px',
      text: (row) => formatDate(row.recognitionDate),
    },
    {
      key: 'retailer',
      header: 'Retailer',
      text: (row) => `${row.retailerCode} · ${row.retailerName}`,
      render: (row) => (
        <div>
          <span style={{ fontWeight: 500 }}>{row.retailerName}</span>
          <div className="muted small">{row.retailerCode}</div>
        </div>
      ),
    },
    {
      key: 'revenueBeforePromotion',
      header: 'Trước KM',
      align: 'right',
      text: (row) => formatMoney(row.revenueBeforePromotion),
    },
    {
      key: 'promotionAmount',
      header: 'Khuyến mãi',
      align: 'right',
      text: (row) => (row.promotionAmount > 0 ? `-${formatMoney(row.promotionAmount)}` : '0 đ'),
      render: (row) => (
        <span style={{ color: row.promotionAmount > 0 ? 'var(--c-danger, #DC2626)' : undefined }}>
          {row.promotionAmount > 0 ? `-${formatMoney(row.promotionAmount)}` : '0 đ'}
        </span>
      ),
    },
    {
      key: 'approvedAdjustmentAmount',
      header: 'Điều chỉnh',
      align: 'right',
      text: (row) => formatMoney(row.approvedAdjustmentAmount),
      render: (row) => (
        <span style={{ color: row.approvedAdjustmentAmount !== 0 ? 'var(--c-accent, #B45309)' : undefined }}>
          {formatMoney(row.approvedAdjustmentAmount)}
        </span>
      ),
    },
    {
      key: 'recognizedRevenue',
      header: 'Doanh thu tính KPI',
      align: 'right',
      text: (row) => formatMoney(row.recognizedRevenue),
      render: (row) => (
        <strong style={{ color: 'var(--c-primary, #14655B)' }}>
          {formatMoney(row.recognizedRevenue)}
        </strong>
      ),
    },
    {
      key: 'contribution',
      header: 'Đóng góp',
      align: 'right',
      width: '90px',
      text: (row) => (totalRecognized > 0 ? `${((row.recognizedRevenue / totalRecognized) * 100).toFixed(1)}%` : '0%'),
      render: (row) => {
        const pct = totalRecognized > 0 ? Math.round((row.recognizedRevenue / totalRecognized) * 1000) / 10 : 0;
        return <span style={{ fontWeight: 600 }}>{pct.toFixed(1)}%</span>;
      },
    },
    {
      key: 'action',
      header: 'Thao tác',
      align: 'center',
      width: '90px',
      render: (row) => (
        <Button
          size="sm"
          onClick={() => navigate(`/orders/${row.orderId}`)}
        >
          Xem đơn
        </Button>
      ),
    },
  ];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Đơn hàng cấu thành KPI · ${entry.salesUserName}`}
      subtitle={`${entry.salesGroupCode} · ${entry.salesGroupName} | Kỳ: ${formatDate(fromDate)} – ${formatDate(toDate)}`}
      width={1050}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="stats-grid">
          <Stat
            label="Tổng doanh thu ghi nhận"
            value={formatMoney(entry.recognizedRevenue)}
            color="var(--c-primary, #14655B)"
          />
          <Stat
            label="Số đơn ghi nhận"
            value={orders.length}
          />
          <Stat
            label="Hoàn thành chỉ tiêu"
            value={`${entry.overallCompletionRate}%`}
            color={entry.overallCompletionRate >= 100 ? '#15803d' : '#d97706'}
          />
        </div>

        <Callout tone="info">
          <strong>Quy tắc đối soát KPI:</strong>{' '}
          {recognitionRule ||
            'Doanh thu tính KPI = Doanh thu trước KM − Khuyến mãi + Điều chỉnh khiếu nại đã duyệt. Chỉ các đơn giao thành công và ghi nhận trong kỳ báo cáo mới được tổng hợp vào KPI.'}
        </Callout>

        {orders.length === 0 ? (
          <Callout tone="warn">
            Không có đơn hàng nào được ghi nhận doanh thu cho nhân viên này trong kỳ và phạm vi được chọn.
          </Callout>
        ) : (
          <DataTable
            title="Danh sách đơn hàng đóng góp"
            rows={orders}
            columns={columns}
            rowKey={(r) => r.orderId}
            searchPlaceholder="Tìm mã đơn, tên retailer…"
          />
        )}
      </div>
    </Drawer>
  );
}

