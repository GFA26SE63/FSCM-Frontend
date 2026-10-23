import { useState } from 'react';
import { useParams } from '@/shared/router/compat';
import { Button, Callout, Card, Chip, Fields, PageHeader, QueryState, SimpleTable, StatusChip } from '@/shared/ui';
import { formatCases, formatDate, formatDateTime, formatHours, formatKm, formatMoney, formatPercent, formatScore, paymentLabel } from '@/shared/lib';
import { env } from '@/shared/lib';
import { useConfirmReceipt, useOrder } from '../hooks';
import { AllocationTraceDialog } from '../components/AllocationTraceDialog';
import { OrderActions } from '../components/OrderActions';
import type { OrderDetail, OrderLineMlor } from '../types';

/** Where the threshold came from. Only the first is a rule the retailer has for this SKU. */
const MLOR_SOURCES: Record<OrderLineMlor['sourceScope'], string> = {
  RetailerProduct: 'riêng SKU của retailer',
  RetailerCategory: 'theo nhóm hàng',
  ProductDefault: 'mặc định sản phẩm',
};

const allocationChip: Record<OrderDetail['allocationState'], string> = {
  Held: 'Đang tạm giữ', Reserved: 'Đã giữ (Reserved)', Dispatched: 'Đã xuất kho', Released: 'Đã trả hàng', Failed: 'Không đủ hàng',
};

function OrderBody({ o }: { o: OrderDetail }) {
  const [trace, setTrace] = useState(false);
  const receipt = useConfirmReceipt();
  return (
    <OrderActions>
      {({ buttons, dialogs }) => (
        <>
          <PageHeader
            back="/orders"
            title={`Đơn ${o.code}`}
            subtitle={`${o.retailerName} · ${o.retailerCode} · tạo ${formatDateTime(o.createdAt)}`}
            chips={<StatusChip domain="order" value={o.status} />}
            actions={
              <div className="row-wrap">
                <Button onClick={() => setTrace(true)}>Giải thích phân bổ (B1–B4)</Button>
                {buttons(o.code, o.status, 'md')}
                {env.useMock && o.status === 'Delivering' && (
                  <Button loading={receipt.isPending} onClick={() => receipt.mutate(o.code)}>Giả lập quét QR nhận hàng</Button>
                )}
              </div>
            }
          />

          {o.rejectReason && <Callout tone="danger"><b>Lý do từ chối:</b> {o.rejectReason}</Callout>}
          {o.cancelReason && <Callout tone="danger"><b>Lý do hủy đơn:</b> {o.cancelReason}</Callout>}
          {o.promoChange && (
            <Callout tone="warn">
              <b>Khuyến mãi thay đổi khi đồng bộ:</b> giảm giá offline {formatMoney(o.promoChange.localDiscount)} → chính thức {formatMoney(o.promoChange.officialDiscount)}. {o.promoChange.reason}
            </Callout>
          )}

          <Card title="Thông tin đơn hàng">
            <Fields
              cols={3}
              items={[
                { label: 'Retailer', value: `${o.retailerName} (${o.retailerCode})` },
                { label: 'Địa chỉ giao', value: o.retailerAddress },
                { label: 'Khu vực / nhóm Sales', value: `${o.areaName} · ${o.groupCode}` },
                { label: 'Sales phụ trách', value: o.salesName },
                { label: 'Kênh tạo', value: <StatusChip domain="channel" value={o.channel} /> },
                { label: 'Đồng bộ', value: o.syncedAt ? `${formatDateTime(o.syncedAt)} · ${o.syncMode}` : '—' },
                { label: 'Thanh toán', value: paymentLabel(o.paymentMethod, o.termDays) },
                { label: 'Tình trạng thanh toán', value: o.paymentStatus },
                { label: 'Người duyệt', value: o.reviewer || '—' },
              ]}
            />
          </Card>

          <div className="grid-aside">
            <Card title="Tóm tắt đơn hàng" flush>
              <SimpleTable
                rows={o.lines}
                columns={[
                  { header: '#', width: '40px', cell: (l) => l.no },
                  { header: 'SKU', width: '90px', cell: (l) => l.sku },
                  { header: 'Sản phẩm', cell: (l) => l.name },
                  { header: 'Đơn giá', align: 'right', cell: (l) => formatMoney(l.unitPrice) },
                  { header: 'SL (thùng)', align: 'right', cell: (l) => l.qty },
                  { header: 'Khuyến mãi', cell: (l) => (l.promotionCode ? <Chip tone="ok">{l.promotionCode} · {l.promotionPct}%</Chip> : '—') },
                  {
                    header: 'MLOR · nguồn',
                    cell: (l) => (
                      <span>
                        {formatPercent(l.mlor.minimumLifeRatio * 100, 1)}
                        {l.mlor.minimumLifeHours != null && <> · ≥ {formatHours(l.mlor.minimumLifeHours)}</>}
                        <br />
                        <span className="muted small">{MLOR_SOURCES[l.mlor.sourceScope]}</span>
                      </span>
                    ),
                  },
                  {
                    header: 'Thành tiền',
                    align: 'right',
                    cell: (l) => (
                      <span>
                        {formatMoney(l.lineTotal)}
                        {l.finalPricePendingAllocation && <><br /><span className="muted small">dự kiến</span></>}
                      </span>
                    ),
                  },
                ]}
              />
            </Card>
            <Card title="Tóm tắt khuyến mãi">
              <div className="stack-sm">
                {o.promotions.length === 0 && <span className="muted">Không có khuyến mãi áp dụng.</span>}
                {o.promotions.map((p) => (
                  <div key={p.no} className="kv"><span><b>{p.code}</b> · {p.name}<br /><span className="muted small">{p.detail}</span></span><span>−{formatMoney(p.amount)}</span></div>
                ))}
                <div className="kv"><span className="muted">Tổng tiền hàng</span><span>{formatMoney(o.totalBeforePromo)}</span></div>
                <div className="kv"><span className="muted">Giảm giá</span><span>−{formatMoney(o.discount)}</span></div>
                <div className="total-line"><span>Thành tiền</span><span>{formatMoney(o.finalPrice)}</span></div>
                <span className="muted small">Tổng {o.totalQty} thùng</span>
              </div>
            </Card>
          </div>

          <Card title="Kết quả phân bổ hàng" actions={<Chip tone={o.allocationState === 'Failed' ? 'danger' : o.allocationState === 'Released' ? 'neutral' : 'ok'}>{allocationChip[o.allocationState]}</Chip>} flush>
            <SimpleTable
              rows={o.allocations}
              empty="Chưa có phân bổ (đơn bị từ chối hoặc đã trả hàng)."
              columns={[
                { header: 'Kho', cell: (a) => a.warehouseName },
                { header: 'SKU', width: '90px', cell: (a) => a.sku },
                { header: 'Batch', cell: (a) => a.batchCode },
                { header: 'HSD', cell: (a) => formatDate(a.expiry) },
                { header: 'Khoảng cách', align: 'right', cell: (a) => formatKm(a.km) },
                { header: 'Dự kiến đến', cell: (a) => formatDate(a.eta) },
                { header: 'HSD còn lại', align: 'right', cell: (a) => `${a.remainingDays} ngày` },
                { header: 'Số lượng', align: 'right', cell: (a) => formatCases(a.qty) },
                { header: 'Điểm', align: 'right', cell: (a) => formatScore(a.score) },
              ]}
            />
            {o.estimatedDeliveryCost && (
              <div style={{ padding: '12px 16px' }}>
                <b>Chi phí giao ước tính: {formatMoney(o.estimatedDeliveryCost.total)}</b>
                <span className="muted small"> — {o.estimatedDeliveryCost.parts.map((p) => `${p.warehouseName} ${formatKm(p.km)} ${formatMoney(p.cost)}`).join(' · ')}. Chỉ hiển thị, không là trọng số phân bổ.</span>
              </div>
            )}
          </Card>

          {o.delivery && (
            <Card title="Giao hàng">
              <Fields cols={3} items={[
                { label: 'Xe giao', value: `${o.delivery.plate} · ${o.delivery.vehicleType}` },
                { label: 'Người giao', value: `${o.delivery.driverCode} · ${o.delivery.driverName}` },
                { label: 'SĐT / xuất phát', value: `${o.delivery.driverPhone} · ${formatDateTime(o.delivery.departedAt)}` },
              ]} />
            </Card>
          )}
          {o.receivable && (
            <Callout tone={o.receivable.status === 'Overdue' ? 'danger' : 'info'}>
              Công nợ: <StatusChip domain="receivable" value={o.receivable.status} /> · hạn {formatDate(o.receivable.dueDate)} · còn phải thu {formatMoney(o.receivable.outstanding)}
            </Callout>
          )}
          <Card title="Loyalty">
            <span>{o.loyalty.state === 'Earned' ? `Đã cộng ${o.loyalty.points} điểm.` : o.loyalty.state === 'None' ? 'Chưa phát sinh điểm.' : `Dự kiến ${o.loyalty.points} điểm – ${o.loyalty.state === 'AwaitingScan' ? 'chờ retailer quét QR nhận hàng' : 'chờ thanh toán'}.`}</span>
          </Card>

          <Card title="Lịch sử xử lý">
            <div className="timeline">
              {[...o.timeline].reverse().map((t, i) => (
                <div className="timeline-item" key={i}><span className="t">{formatDateTime(t.at)}</span><span>{t.label}</span></div>
              ))}
            </div>
          </Card>

          {dialogs}
          <AllocationTraceDialog code={o.code} open={trace} onClose={() => setTrace(false)} />
        </>
      )}
    </OrderActions>
  );
}

export function OrderDetailPage() {
  const { code = '' } = useParams();
  const query = useOrder(code);
  return <QueryState query={query}>{(o) => <OrderBody o={o} />}</QueryState>;
}
