import { useState } from 'react';
import { Modal, QueryState, Tabs } from '@/shared/ui';
import { formatMoney } from '@/shared/lib';
import { useAllocationTrace } from '../hooks';
import { TraceStepTables } from './TraceStepTables';

/** "Giải thích phân bổ" window: B1–B4 tables per SKU line + order-level conclusion with the estimated delivery cost. */
export function AllocationTraceDialog({ code, open, onClose }: { code: string; open: boolean; onClose: () => void }) {
  const query = useAllocationTrace(code, open);
  const [idx, setIdx] = useState(0);
  return (
    <Modal open={open} onClose={onClose} width={1180} height={820} wide title={`Giải thích phân bổ · ${code}${query.data ? ' · ' + query.data.retailerName : ''}`} subtitle={query.data ? `${query.data.basis} · Ngày xuất dự kiến ${query.data.dispatchDate.split('-').reverse().join('/')} (chuyến sáng sau khi duyệt)` : undefined}>
      <QueryState query={query}>
        {(t) => {
          const line = t.lines[Math.min(idx, t.lines.length - 1)];
          const whs = [...new Set(t.lines.flatMap((l) => l.allocations.map((a) => a.warehouseName)))];
          return (
            <>
              <Tabs
                variant="pills"
                value={String(Math.min(idx, t.lines.length - 1))}
                onChange={(k) => setIdx(Number(k))}
                items={t.lines.map((l, i) => ({ key: String(i), label: `${l.sku} × ${l.qty}${l.enough ? '' : ' (thiếu)'}` }))}
              />
              <TraceStepTables line={line} dmax={t.dmaxRetailerKm} weights={t.weights} />
              <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="bold">Kết luận cho cả đơn</span>
                <span style={{ fontSize: 13.5, lineHeight: 1.55 }}>
                  {t.ok
                    ? `Tất cả SKU đủ số lượng từ các batch hợp lệ. Đơn được xuất từ ${whs.length} kho (${whs.join(', ')}), chi phí giao ước tính ${formatMoney(t.estimatedDeliveryCost?.total)} theo bảng vận chuyển dùng chung (chỉ hiển thị, không là trọng số); đây là đơn đủ hàng có nhiều chuyến giao, không phải giao một phần. Hệ thống tạm giữ đúng kho – batch – số lượng, chờ Admin / Operator duyệt; khi duyệt, phần tạm giữ chuyển thành Reserved và sinh picking list theo từng kho.`
                    : 'Có SKU không đủ hàng hợp lệ sau khi duyệt hết các batch trên toàn mạng lưới kho. Theo quy tắc không giao một phần, hệ thống tự động từ chối cả đơn, không tạm giữ hàng và gửi thông báo cho Sales và retailer. Hệ thống không tự hạ MLOR hay nới phạm vi phục vụ.'}
                </span>
              </div>
            </>
          );
        }}
      </QueryState>
    </Modal>
  );
}
