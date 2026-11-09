import { useState } from 'react';
import { Callout, Chip, Modal, SimpleTable, Tabs } from '@/shared/ui';
import { formatDateTime, formatHours, formatMoney, formatNumber, formatPercent } from '@/shared/lib';
import type { OrderDetail } from '../types';

const MLOR_SOURCE = {
  Sku: 'SKU riêng của retailer',
  Category: 'category của retailer',
  Default: 'mặc định sản phẩm',
} as const;

/** Explains the persisted real-time allocation outcome without inventing rejected candidates. */
export function AllocationTraceDialog({ order, open, onClose }: {
  order: OrderDetail;
  open: boolean;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const lineIndex = Math.min(idx, Math.max(order.lines.length - 1, 0));
  const line = order.lines[lineIndex];
  const fragments = line ? [...line.allocationFragments].sort((a, b) => a.sequence - b.sequence) : [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={1180}
      height={820}
      wide
      title={`Giải thích phân bổ · ${order.orderCode}`}
      subtitle={order.allocationRunCode
        ? `${order.allocationRunCode} · chạy real-time · ${formatDateTime(order.officialPricedAt)}`
        : 'Đơn chưa có kết quả phân bổ'}
    >
      <Callout tone={fragments.length > 0 ? 'info' : 'warn'}>
        {fragments.length > 0
          ? 'Đây là kết quả allocation đã lưu và đã giữ tồn bằng khóa lạc quan; không có bước Admin duyệt phương án.'
          : 'Đơn chưa có batch được chọn. Xem trạng thái và lý do trong lịch sử đơn.'}
      </Callout>

      <Tabs
        variant="pills"
        value={String(lineIndex)}
        onChange={(key) => setIdx(Number(key))}
        items={order.lines.map((item, index) => ({
          key: String(index),
          label: `${item.sku} × ${formatNumber(item.quantity)}`,
        }))}
      />

      {line && (
        <div style={{ display: 'grid', gap: 14 }}>
          <section className="card" style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>B1 · Nhận SO và đóng băng điều kiện</h3>
            <div className="row-wrap">
              <Chip tone="info">{line.sku}</Chip>
              <span>Nhu cầu: <b>{formatNumber(line.quantity)}</b></span>
              <span>MLOR: <b>{formatPercent(line.mlor.minimumLifeRatio * 100, 1)}</b></span>
              {line.mlor.minimumLifeHours != null && <span>Tối thiểu: <b>{formatHours(line.mlor.minimumLifeHours)}</b></span>}
              <span>Nguồn: <b>{MLOR_SOURCE[line.mlor.sourceScope]}</b></span>
              <span>Phiên bản: <b>v{line.mlor.sourceVersion}</b></span>
            </div>
          </section>

          <section className="card" style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>B2 · Lọc batch đủ điều kiện</h3>
            <p className="muted small">
              Hệ thống loại batch hết tồn, không có tuyến giao, ngoài vùng phục vụ, đến trễ hoặc không đạt MLOR.
              Bảng dưới chỉ hiển thị các batch đã được chọn vì phiên bản hiện tại chưa lưu các ứng viên bị loại.
            </p>
            <SimpleTable
              compact
              rows={fragments}
              empty="Không có batch hợp lệ được lưu cho dòng này."
              columns={[
                { header: 'Kho / batch', cell: (item) => <>{item.warehouseCode}<br /><b>{item.batchCode}</b></> },
                { header: 'ETA', cell: (item) => formatDateTime(item.estimatedArrivalAt) },
                { header: 'Khoảng cách', align: 'right', cell: (item) => item.distanceMeters == null ? '—' : `${formatNumber(item.distanceMeters / 1000)} km` },
                { header: 'Hạn còn lại tại ETA', align: 'right', cell: (item) => formatHours(item.remainingLifeHoursAtArrival) },
                { header: 'Kết quả', cell: () => <Chip tone="success">Đạt điều kiện</Chip> },
              ]}
            />
          </section>

          <section className="card" style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>B3 · Kiểm tra MLOR tại lúc hàng tới</h3>
            <SimpleTable
              compact
              rows={fragments}
              empty="Không có kết quả MLOR."
              columns={[
                { header: 'Batch', cell: (item) => item.batchCode },
                { header: 'Hạn còn lại tại ETA', align: 'right', cell: (item) => formatHours(item.remainingLifeHoursAtArrival) },
                { header: 'Ngưỡng dòng hàng', align: 'right', cell: () => line.mlor.minimumLifeHours != null
                  ? formatHours(line.mlor.minimumLifeHours)
                  : formatPercent(line.mlor.minimumLifeRatio * 100, 1) },
                { header: 'Kết luận', cell: (item) => {
                  const passed = line.mlor.minimumLifeHours == null || item.remainingLifeHoursAtArrival >= line.mlor.minimumLifeHours;
                  return <Chip tone={passed ? 'success' : 'danger'}>{passed ? 'Đạt MLOR' : 'Không đạt'}</Chip>;
                } },
              ]}
            />
          </section>

          <section className="card" style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>B4 · Xếp điểm, cấp hàng và chốt giá</h3>
            <p className="muted small">
              Trong mỗi lượt, hệ thống chọn ứng viên có weighted score cao nhất, cấp tối đa phần nhu cầu còn thiếu,
              rồi tính lại cho lượt kế tiếp. Sau khi batch đã được chọn, hệ thống mới áp dụng giảm HSD.
            </p>
            <SimpleTable
              compact
              rows={fragments}
              empty="Không có lượt cấp hàng."
              columns={[
                { header: 'Lượt', align: 'right', cell: (item) => item.sequence },
                { header: 'Kho / batch', cell: (item) => `${item.warehouseCode} / ${item.batchCode}` },
                { header: 'Weighted score', align: 'right', cell: (item) => item.weightedScore.toFixed(3) },
                { header: 'Lượng cấp', align: 'right', cell: (item) => formatNumber(item.quantity) },
                { header: 'Giá sau KM số lượng', align: 'right', cell: (item) => formatMoney(item.baseUnitPrice) },
                { header: 'Giảm HSD / đơn vị', align: 'right', cell: (item) => `−${formatMoney(item.shelfLifeDiscountPerUnit)}` },
                { header: 'Giá cuối', align: 'right', cell: (item) => <b>{formatMoney(item.finalUnitPrice)}</b> },
              ]}
            />
          </section>
        </div>
      )}
    </Modal>
  );
}
