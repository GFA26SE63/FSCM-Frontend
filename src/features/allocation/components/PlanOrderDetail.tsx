import { Callout, Chip, SimpleTable } from '@/shared/ui';
import { formatCases, formatHours, formatMoney, formatNumber, formatPercent, formatScore } from '@/shared/lib';
import { formatInstantDateTime } from '@/shared/lib/dates';
import type { PlanAllocation, PlanPrice, RunLine, RunOrder } from '../types';

const MLOR_SOURCES: Record<RunLine['mlorSource'], string> = {
  RetailerProduct: 'riêng SKU',
  RetailerCategory: 'theo nhóm hàng',
  ProductDefault: 'mặc định sản phẩm',
};

/** One batch of one line: what was chosen, and what it was priced at. Keyed alike, read together. */
interface Part {
  allocation: PlanAllocation;
  price: PlanPrice | undefined;
}

const discountRule = (price: PlanPrice | undefined) => {
  if (!price || price.shelfLifeDiscountTierId == null) return 'Không khớp bậc nào';
  return price.discountType === 'Percent'
    ? `Giảm ${formatPercent(price.discountValue ?? 0, 1)} (bảng bản ${price.discountTableVersion})`
    : `Giảm ${formatMoney(price.discountValue)}/thùng (bảng bản ${price.discountTableVersion})`;
};

/**
 * One order inside the proposal, line by line and batch by batch.
 *
 * The shelf life at arrival sits next to the MLOR threshold it had to clear, because that pair is
 * the whole reason a batch was eligible. The price columns follow the same part, so an Admin
 * approves a choice and its price together rather than two things that happen to be on one screen.
 */
export function PlanOrderDetail({
  order,
  allocations,
  prices,
}: {
  order: RunOrder;
  allocations: PlanAllocation[];
  prices: PlanPrice[];
}) {
  if (order.status === 'Short') {
    return (
      <Callout tone="danger">
        {order.shortageReason ?? 'Đơn không đủ hàng hợp lệ trong quỹ chung của đợt.'} Theo quy tắc không giao một
        phần, toàn bộ lượng tạm của đơn đã được trả về quỹ chung cho các đơn phía sau. Đơn được ghi là thiếu — đợt
        không tự từ chối đơn.
      </Callout>
    );
  }

  return (
    <>
      {order.lines
        .slice()
        .sort((a, b) => a.lineNumber - b.lineNumber)
        .map((line) => {
          const required = line.effectiveMlorRatio * line.totalShelfLifeHours;
          const parts: Part[] = allocations
            .filter((a) => a.allocationRunLineId === line.id)
            .sort((a, b) => a.sequence - b.sequence)
            .map((allocation) => ({
              allocation,
              price: prices.find((p) => p.allocationRunLineId === line.id && p.batchId === allocation.batchId),
            }));

          return (
            <div key={line.id} style={{ marginBottom: 14 }}>
              <div
                className="card"
                style={{ padding: '10px 14px', display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}
              >
                <span>
                  Dòng {line.lineNumber} · <strong>{line.sku}</strong>
                </span>
                <span>Đặt: <strong>{formatCases(line.orderedQuantity)}</strong></span>
                <span>Giá cơ sở: <strong>{formatMoney(line.baseNetUnitPrice)}</strong>/thùng</span>
                <span>
                  MLOR <strong>{formatPercent(line.effectiveMlorRatio * 100, 1)}</strong> ({MLOR_SOURCES[line.mlorSource]}) → cần còn ≥{' '}
                  <strong>{formatHours(required)}</strong> lúc nhận
                </span>
              </div>
              <SimpleTable
                columns={[
                  { header: 'Kho', cell: (r: Part) => r.allocation.warehouseCode },
                  { header: 'Batch', cell: (r: Part) => r.allocation.batchCode },
                  { header: 'Lượng', cell: (r: Part) => formatCases(r.allocation.quantity) },
                  { header: 'Dự kiến nhận', cell: (r: Part) => formatInstantDateTime(r.allocation.estimatedArrivalAt) },
                  {
                    header: 'Hạn còn lúc nhận',
                    cell: (r: Part) => (
                      <span>
                        {formatHours(r.allocation.remainingShelfLifeHours)}{' '}
                        <Chip tone={r.allocation.remainingShelfLifeHours >= required ? 'success' : 'danger'}>
                          {r.allocation.remainingShelfLifeHours >= required ? 'đạt MLOR' : 'dưới MLOR'}
                        </Chip>
                      </span>
                    ),
                  },
                  { header: 'Điểm S', cell: (r: Part) => formatScore(r.allocation.weightedScore) },
                  {
                    header: '% HSD tính giá',
                    cell: (r: Part) => (r.price ? formatPercent(r.price.remainingShelfLifePercent, 2) : '—'),
                  },
                  { header: 'Quy tắc giảm', cell: (r: Part) => discountRule(r.price) },
                  {
                    header: 'Giảm/thùng',
                    cell: (r: Part) => (r.price ? formatMoney(r.price.shelfLifeDiscountPerUnit) : '—'),
                  },
                  {
                    header: 'Giá cuối',
                    cell: (r: Part) => <strong>{r.price ? formatMoney(r.price.finalNetUnitPrice) : '—'}</strong>,
                  },
                  {
                    header: 'Thành tiền',
                    cell: (r: Part) => <strong className="text-primary">{r.price ? formatMoney(r.price.amount) : '—'}</strong>,
                  },
                ]}
                rows={parts}
                empty="Dòng này chưa có batch nào được chọn."
              />
              {parts.some((p) => !p.price) && (
                <Callout tone="warn">
                  Có phần hàng chưa có bản giá đi kèm. Không duyệt bản này — phương án và giá phải thuộc cùng một
                  phiên bản.
                </Callout>
              )}
            </div>
          );
        })}
      <div style={{ fontSize: 12.5, opacity: 0.75, padding: '0 14px 8px' }}>
        Ưu tiên #{formatNumber(order.priorityRank)} · nhận lúc {formatInstantDateTime(order.acceptedAt)}. Đơn tới
        trước rút hàng trước và không bị lấy lại để nhường đơn sau.
      </div>
    </>
  );
}
