import { useState } from 'react';
import { Chip, Modal, QueryState, Tabs } from '@/shared/ui';
import { formatNumber } from '@/shared/lib';
import { useAllocationTrace } from '../hooks';
import { TraceStepTables } from './TraceStepTables';

/**
 * "Giải thích phân bổ": why the 12:00 run chose the batches it did, for one order.
 *
 * The plan version's status is on screen because it changes what the window means. While the
 * proposal is still awaiting a decision this is a proposal, not an outcome, and nothing has been
 * held yet; an Operator who cannot tell the two apart will promise stock that is not reserved.
 */
export function AllocationTraceDialog({
  orderId,
  code,
  open,
  onClose,
}: {
  orderId: string;
  code: string;
  open: boolean;
  onClose: () => void;
}) {
  const query = useAllocationTrace(orderId, open);
  const [idx, setIdx] = useState(0);
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={1180}
      height={820}
      wide
      title={`Giải thích phân bổ · ${code}`}
      subtitle={query.data ? `Đợt ${query.data.runCode} · phương án bản ${query.data.planVersionNumber}` : undefined}
    >
      <QueryState query={query}>
        {(t) => {
          const line = t.lines[Math.min(idx, t.lines.length - 1)];
          const short = t.lines.filter((l) => l.outcome === 'Short');
          const released = t.lines.filter((l) => l.outcome === 'Released');
          return (
            <>
              <div className="card" style={{ padding: '10px 16px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <Chip tone={t.isApproved ? 'success' : 'warn'}>
                  {t.isApproved ? 'Phương án đã duyệt' : 'Phương án chờ duyệt'}
                </Chip>
                <span style={{ fontSize: 13 }}>
                  {t.isApproved
                    ? 'Admin đã duyệt bản này; hàng đã được giữ đúng kho – batch – số lượng.'
                    : 'Đây là đề xuất của đợt, chưa phải kết quả: chưa giữ hàng và không có việc tự duyệt sau hạn.'}
                </span>
              </div>

              <Tabs
                variant="pills"
                value={String(Math.min(idx, t.lines.length - 1))}
                onChange={(k) => setIdx(Number(k))}
                items={t.lines.map((l, i) => ({
                  key: String(i),
                  label: `${l.sku} × ${formatNumber(l.orderedQuantity)}${
                    l.outcome === 'Short' ? ' (thiếu)' : l.outcome === 'Released' ? ' (đã trả quỹ)' : ''
                  }`,
                }))}
              />

              {line && <TraceStepTables line={line} />}

              <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="bold">Kết luận cho cả đơn</span>
                <span style={{ fontSize: 13.5, lineHeight: 1.55 }}>
                  {short.length === 0
                    ? 'Mọi dòng đều cấp đủ từ batch đạt MLOR lúc nhận. Đơn đủ hàng có thể xuất từ nhiều kho — đó vẫn là một đơn đủ, không phải giao một phần. Khi Admin duyệt, phần tạm giữ mới chuyển thành Reserved và phiếu soạn được phát hành theo từng kho.'
                    : `Dòng ${short
                        .map((l) => `${l.lineNumber} (${l.sku})`)
                        .join(', ')} không đủ hàng hợp lệ trong quỹ chung của đợt. Theo quy tắc không giao một phần, đơn được ghi là thiếu hàng${
                        released.length > 0
                          ? ` và toàn bộ lượng tạm của ${released.length} dòng đã rút được trả về quỹ chung cho các đơn phía sau`
                          : ''
                      }. Hệ thống không tự từ chối đơn, không tự hạ MLOR, không nới bán kính phục vụ, và không đổi batch của đơn trước để nhường cho đơn sau.`}
                </span>
                <span style={{ fontSize: 12.5, opacity: 0.75 }}>
                  Cửa sổ này chỉ giải thích việc chọn batch. Mức giảm cận hạn và giá từng batch xem ở chi tiết giá —
                  đợt chọn batch trước, định giá sau, nên giảm giá không tham gia chấm điểm.
                </span>
              </div>
            </>
          );
        }}
      </QueryState>
    </Modal>
  );
}
