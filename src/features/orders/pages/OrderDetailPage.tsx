import { useState } from 'react';
import { useParams, useNavigate } from '@/shared/router/compat';
import { useRole } from '@/shared/auth/AuthContext';
import { Button, Callout, Card, Fields, PageHeader, QueryState, SimpleTable, StatusChip } from '@/shared/ui';
import { formatCases, formatDate, formatDateTime, formatHours, formatMoney, formatPercent, paymentLabel, statusLabel } from '@/shared/lib';
import { useOrder } from '../hooks';
import { AllocationTraceDialog } from '../components/AllocationTraceDialog';
import { OrderActions } from '../components/OrderActions';
import { hasReconciledOfficialTotal, officialFragmentTotal } from '../priceBreakdown';
import type { OrderDetail, OrderLine, OrderLineMlor } from '../types';

const MLOR_SOURCES: Record<OrderLineMlor['sourceScope'], string> = {
  Sku: 'SKU riêng của retailer',
  Category: 'category của retailer',
  Default: 'mặc định sản phẩm',
};

function PriceBreakdown({ line }: { line: OrderLine }) {
  return (
    <details open={line.allocationFragments.length > 0} style={{ borderTop: '1px solid var(--c-border)' }}>
      <summary style={{ cursor: 'pointer', padding: '12px 16px' }}>
        <b>Dòng {line.lineNumber} · {line.sku} · {line.productName}</b>{' '}
        <span className="muted">— {line.allocationFragments.length} phần batch · {formatMoney(line.officialNetAmount ?? line.indicativeNetAmount)}</span>
      </summary>
      <SimpleTable
        compact
        rows={line.allocationFragments}
        empty="Chưa có bản giá theo batch; giá hiện tại vẫn là giá dự kiến trước phân bổ."
        columns={[
          { header: 'Kho / batch', cell: (x) => <>{x.warehouseCode}<br /><b>{x.batchCode}</b><br /><span className="muted small">HSD {formatDate(x.batchExpirationDate)}</span></> },
          { header: 'Lượng', align: 'right', cell: (x) => formatCases(x.quantity) },
          { header: 'Giá niêm yết', align: 'right', cell: (x) => formatMoney(x.listUnitPrice) },
          { header: 'KM thường', align: 'right', cell: (x) => <>−{formatMoney(x.ordinaryPromotionDiscountPerUnit)}<br /><span className="muted small">cơ sở {formatMoney(x.baseUnitPrice)}</span></> },
          { header: 'HSD tại mốc giá', align: 'right', cell: (x) => <>{formatPercent(x.remainingShelfLifePercent, 2)}<br /><span className="muted small">ETA còn {formatHours(x.remainingLifeHoursAtArrival)}</span></> },
          {
            header: 'Quy tắc F98',
            cell: (x) => <>{x.discountRuleId == null ? 'Không khớp bậc giảm' : [x.discountRuleScope, x.discountRuleCode].filter(Boolean).join(' · ')}<br /><span className="muted small">v{x.discountRuleVersion} · {x.discountReason}</span></>,
          },
          { header: 'Giảm HSD', align: 'right', cell: (x) => <>−{formatMoney(x.shelfLifeDiscountPerUnit)}<br /><span className="muted small">{x.discountType ?? 'Không giảm'}{x.discountValue == null ? '' : ` · ${x.discountValue}`}</span></> },
          { header: 'Giá cuối', align: 'right', cell: (x) => <><b>{formatMoney(x.finalUnitPrice)}</b><br /><span className="muted small">{formatMoney(x.netAmount)}</span></> },
        ]}
      />
      {line.allocationFragments.length > 0 && (
        <div className="kv" style={{ padding: '10px 16px' }}>
          <span className="muted">Tổng phần giá bất biến của dòng</span>
          <b>{formatMoney(officialFragmentTotal(line))}</b>
        </div>
      )}
    </details>
  );
}

function WorkflowLinks({ order }: { order: OrderDetail }) {
  const navigate = useNavigate();
  const role = useRole();
  return (
    <div className="row-wrap">
      {role === 'Admin' && order.allocationRunId && <Button onClick={() => navigate('/allocation')}>Duyệt đợt {order.allocationRunCode ?? ''}</Button>}
      {(role === 'Admin' || role === 'Operator') && order.warehouseProgress.some((x) => x.pickingListId) && <Button onClick={() => navigate('/runpicking')}>Theo dõi soạn hàng</Button>}
      {(role === 'Admin' || role === 'Operator') && order.officialAmount != null && <Button onClick={() => navigate('/debts')}>Thanh toán / công nợ</Button>}
    </div>
  );
}

function OrderBody({ order }: { order: OrderDetail }) {
  const [trace, setTrace] = useState(false);
  const reconciled = hasReconciledOfficialTotal(order);
  return (
    <OrderActions>
      {({ buttons, dialogs }) => (
        <>
          <PageHeader
            back="/orders"
            title={`Đơn ${order.orderCode}`}
            subtitle={`${order.retailerName} · ${order.retailerCode} · server nhận ${formatDateTime(order.serverReceivedAt)}`}
            chips={<StatusChip domain="order" value={order.status} />}
            actions={<div className="row-wrap"><Button onClick={() => setTrace(true)}>Giải thích phân bổ</Button>{buttons(order, 'md')}</div>}
          />

          {order.rejectionReason && <Callout tone="danger"><b>Lý do từ chối/thiếu:</b> {order.rejectionReason}</Callout>}
          {order.hasOfflineDifference && <Callout tone="warn">Điều kiện/giá server nhận khác snapshot offline; giá dự kiến offline là {formatMoney(order.offlineEstimatedAmount)}.</Callout>}
          {!reconciled && <Callout tone="danger">Tổng giá chính thức không khớp tổng các fragment F98. Không dùng số tiền này để thu hoặc đối soát.</Callout>}

          <Card title="Thông tin đơn hàng">
            <Fields cols={3} items={[
              { label: 'Retailer', value: `${order.retailerName} (${order.retailerCode})` },
              { label: 'Địa chỉ giao', value: order.deliveryAddress },
              { label: 'Ngày yêu cầu nhận', value: formatDate(order.requestedDeliveryDate) },
              { label: 'Nguồn', value: order.source === 'Offline' ? 'Offline gửi thủ công' : 'Sales tạo online' },
              { label: 'Thanh toán', value: paymentLabel(order.paymentMethod, order.creditTermDays) },
              { label: 'Đợt phân bổ', value: order.allocationRunCode ? `${order.allocationRunCode} · bản ${order.allocationPlanVersion ?? '—'}` : 'Chưa vào đợt' },
              { label: 'Kết quả phân bổ', value: order.allocationResult ?? order.allocationState },
              { label: 'Người tạo', value: order.createdByUserId },
              { label: 'Người duyệt', value: order.reviewedByUserId ?? '—' },
            ]} />
          </Card>

          <Card title="Giá dự kiến và giá chính thức" flush>
            <SimpleTable
              rows={order.lines}
              columns={[
                { header: '#', width: '40px', cell: (line) => line.lineNumber },
                { header: 'SKU / sản phẩm', cell: (line) => <><b>{line.sku}</b><br /><span className="muted small">{line.productName}</span></> },
                { header: 'SL', align: 'right', cell: (line) => formatCases(line.quantity) },
                { header: 'Giá niêm yết', align: 'right', cell: (line) => formatMoney(line.unitPrice) },
                { header: 'KM thường', align: 'right', cell: (line) => <>−{formatMoney(line.discountAmount)}<br /><span className="muted small">{line.ordinaryPromotion?.code ?? 'Không có'}</span></> },
                { header: 'Giá dự kiến', align: 'right', cell: (line) => formatMoney(line.indicativeNetAmount) },
                { header: 'Giá chính thức', align: 'right', cell: (line) => line.officialNetAmount == null ? 'Chưa chốt' : <b>{formatMoney(line.officialNetAmount)}</b> },
                {
                  header: 'MLOR · nguồn', cell: (line) => <>{formatPercent(line.mlor.minimumLifeRatio * 100, 1)}{line.mlor.minimumLifeHours != null && <> · ≥ {formatHours(line.mlor.minimumLifeHours)}</>}<br /><span className="muted small">{MLOR_SOURCES[line.mlor.sourceScope]} · v{line.mlor.sourceVersion}</span></>,
                },
              ]}
            />
            <div className="kv" style={{ padding: '12px 16px' }}>
              <span>Dự kiến: <b>{formatMoney(order.indicativeAmount)}</b></span>
              <span>Chính thức: <b>{order.officialAmount == null ? 'Chưa chốt sau duyệt đợt' : formatMoney(order.officialAmount)}</b></span>
            </div>
          </Card>

          <Card title="Chi tiết giá bất biến theo SKU / batch (F98)" flush>
            {order.lines.map((line) => <PriceBreakdown key={line.id} line={line} />)}
          </Card>

          <Card title="Tiến độ theo kho" flush>
            <SimpleTable
              rows={order.warehouseProgress}
              empty="Chưa phát sinh phần giao theo kho."
              columns={[
                { header: 'Kho', cell: (x) => x.warehouseCode },
                { header: 'Phiếu soạn', cell: (x) => x.pickingCode ?? '—' },
                { header: 'Trạng thái soạn', cell: (x) => x.pickingStatus ?? '—' },
                { header: 'Phần giao', cell: (x) => x.shipmentCode ?? '—' },
                { header: 'Trạng thái giao', cell: (x) => x.shipmentStatus ?? '—' },
                { header: 'Dự kiến', align: 'right', cell: (x) => formatCases(x.plannedQuantity) },
                { header: 'Đã soạn', align: 'right', cell: (x) => formatCases(x.pickedQuantity) },
                { header: 'Đã nhận', align: 'right', cell: (x) => formatCases(x.receivedQuantity) },
              ]}
            />
          </Card>

          <Card title="Đi tới nghiệp vụ liên quan"><WorkflowLinks order={order} /></Card>

          <Card title="Lịch sử xử lý">
            <div className="timeline">
              {[...order.history].reverse().map((event, index) => (
                <div className="timeline-item" key={`${event.changedAt}-${index}`}>
                  <span className="t">{formatDateTime(event.changedAt)}</span>
                  <span>{statusLabel('order', event.toStatus)}{event.reason ? ` · ${event.reason}` : ''}</span>
                </div>
              ))}
            </div>
          </Card>

          {dialogs}
          <AllocationTraceDialog orderId={order.id} code={order.orderCode} open={trace} onClose={() => setTrace(false)} />
        </>
      )}
    </OrderActions>
  );
}

export function OrderDetailPage() {
  const { orderId = '' } = useParams();
  const query = useOrder(orderId);
  return <QueryState query={query}>{(order) => <OrderBody order={order} />}</QueryState>;
}
