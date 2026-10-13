import { Chip, SimpleTable, StepSection } from '@/shared/ui';
import { formatCases, formatDate, formatDayMonth, formatKm, formatScore } from '@/shared/lib';
import type { TraceLine } from '../types';

const result = (kept: boolean, text: string) => <Chip tone={kept ? 'success' : 'danger'}>{text}</Chip>;

/** B1–B4 tables of one order line (prototype "Giải thích phân bổ"). */
export function TraceStepTables({ line, dmax, weights }: { line: TraceLine; dmax: number; weights: { wE: number; wD: number; wQ: number } }) {
  const whCount = new Set(line.allocations.map((a) => a.warehouseCode)).size;
  return (
    <>
      <div className="card" style={{ padding: '12px 16px', display: 'flex', gap: 32, flexWrap: 'wrap', fontSize: 13.5 }}>
        <span>SKU: <strong>{line.sku} · {line.productName}</strong></span>
        <span>Số lượng đặt: <strong>{line.qty} thùng</strong></span>
        <span>Tổng hạn dùng SL: <strong>{line.shelfLifeDays} ngày</strong></span>
        <span>MLOR retailer–SKU: <strong>m = {line.m}</strong> → cần còn ≥ <strong>{line.mlorDays} ngày</strong> tại ETA</span>
      </div>

      <StepSection num="B1" title="Lấy batch ứng viên trên toàn mạng lưới kho" hint="Đúng SKU · chưa hết hạn · khả dụng > 0 (đã trừ hàng giữ cho đơn khác)">
        <SimpleTable
          columns={[
            { header: 'Kho', cell: (r) => r.warehouseName },
            { header: 'Batch', cell: (r) => r.batchCode },
            { header: 'HSD', cell: (r) => formatDate(r.expiry) },
            { header: 'Khả dụng', cell: (r) => `${formatCases(r.available)}${r.heldBefore ? ` (đã trừ ${r.heldBefore} giữ cho đơn tới trước)` : ''}` },
            { header: 'Kết quả', cell: (r) => result(r.kept, r.reason) },
          ]}
          rows={line.b1}
        />
      </StepSection>

      <StepSection num="B2a" title="Lọc phạm vi phục vụ (Dijkstra trên đồ thị đường bộ)" hint={`Khoảng cách phục vụ tối đa ${dmax} km`}>
        <SimpleTable
          columns={[
            { header: 'Kho', cell: (r) => r.warehouseName },
            { header: 'Batch', cell: (r) => r.batchCode },
            { header: 'Khoảng cách đường bộ', cell: (r) => formatKm(r.km) },
            { header: 'Kết quả', cell: (r) => result(r.kept, r.reason) },
          ]}
          rows={line.b2a}
          empty="Không còn batch sau B1."
        />
      </StepSection>

      <StepSection num="B2b–d" title="Tính ETA và kiểm tra MLOR tại thời điểm nhận" hint="ETA = ngày xuất dự kiến + transit (bảng vận chuyển dùng chung) · giữ khi EXP − ETA ≥ m × SL">
        <SimpleTable
          columns={[
            { header: 'Kho', cell: (r) => r.warehouseName },
            { header: 'Batch', cell: (r) => r.batchCode },
            { header: 'Transit', cell: (r) => `${r.transitDays} ngày` },
            { header: 'ETA', cell: (r) => formatDayMonth(r.eta) },
            { header: 'HSD', cell: (r) => formatDayMonth(r.expiry) },
            { header: 'Còn lại tại ETA', cell: (r) => `${r.remainingDays} ngày` },
            { header: 'Ngưỡng MLOR', cell: () => `≥ ${line.mlorDays} ngày` },
            { header: 'Kết quả', cell: (r) => result(r.kept, r.reason), width: '170px' },
          ]}
          rows={line.b2d}
          empty="Không còn batch sau B2a."
        />
      </StepSection>

      <StepSection
        num="B3"
        title="Chấm điểm batch hợp lệ (trọng số)"
        hint={`S = wE·f_E + wD·f_D + wQ·f_Q · wE ${weights.wE} · wD ${weights.wD} · wQ ${weights.wQ} (Admin cấu hình)`}
        note="f_E = 1 − (L − MLOR) / (SL − MLOR): còn lại L càng sát MLOR càng ưu tiên xuất trước (FEFO) · f_D = 1 − d / Dmax · f_Q = min(khả dụng, cần) / cần: một batch gánh được nhiều hơn thì ít phải tách kho. Ràng buộc ở B1–B2 vẫn là bộ lọc cứng."
      >
        <SimpleTable
          columns={[
            { header: 'Hạng', cell: (r) => <strong>#{r.rank}</strong>, width: '70px' },
            { header: 'Kho', cell: (r) => r.warehouseName },
            { header: 'Batch', cell: (r) => r.batchCode },
            { header: 'L tại ETA', cell: (r) => `${r.remainingDays} ngày` },
            { header: 'f_E', cell: (r) => formatScore(r.fE) },
            { header: 'f_D', cell: (r) => formatScore(r.fD) },
            { header: 'f_Q (cần đủ)', cell: (r) => formatScore(r.fQ) },
            { header: 'Điểm S', cell: (r) => <strong className="text-primary">{formatScore(r.score)}</strong> },
          ]}
          rows={line.b3}
          empty="Không còn batch hợp lệ."
        />
      </StepSection>

      <StepSection num="B4" title="Cấp phát greedy theo điểm (tính lại f_Q theo phần còn thiếu ở mỗi lượt)">
        <SimpleTable
          columns={[
            { header: 'Lượt', cell: (r) => (r.turn ? `#${r.turn}` : '—'), width: '60px' },
            { header: 'Kho', cell: (r) => r.warehouseName },
            { header: 'Batch', cell: (r) => r.batchCode },
            { header: 'Khả dụng', cell: (r) => formatCases(r.available) },
            { header: 'Còn cần', cell: (r) => (r.turn ? formatCases(r.need) : '0') },
            { header: 'f_Q lượt', cell: (r) => formatScore(r.fQ) },
            { header: 'S lượt', cell: (r) => formatScore(r.score) },
            { header: 'Lấy', cell: (r) => <strong>{r.turn ? formatCases(r.take) : 'Không cần'}</strong> },
            { header: 'Còn thiếu', cell: (r) => (r.turn ? formatCases(r.left) : '0') },
          ]}
          rows={line.b4}
          empty="Không có lượt cấp phát."
        />
      </StepSection>

      <StepSection num="KL" title="Kết luận cho SKU này">
        <div className={`callout ${line.enough ? 'callout-ok' : 'callout-danger'}`} style={{ margin: '12px 14px' }}>
          {line.enough
            ? `Đủ ${line.qty} thùng từ ${line.allocations.length} batch tại ${whCount} kho. Tất cả batch được chọn đều đạt MLOR tại ETA; hàng được tạm giữ theo kho – batch – số lượng.`
            : `Chỉ cấp được ${line.allocated}/${line.qty} thùng (thiếu ${line.short}). Theo quy tắc không giao một phần, cả đơn bị từ chối và không tạm giữ hàng.`}
        </div>
      </StepSection>
    </>
  );
}
