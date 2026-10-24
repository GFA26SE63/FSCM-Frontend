import { Chip, SimpleTable, StepSection, type Tone } from '@/shared/ui';
import { formatCases, formatHours, formatKm, formatNumber, formatPercent, formatScore } from '@/shared/lib';
import { formatInstantDateTime } from '@/shared/lib/dates';
import type { TraceCandidate, TraceLineDetail, TraceStage } from '../types';

/** Why a batch was ruled out, in the words an Operator would use. */
const REASONS: Record<TraceCandidate['reason'], string> = {
  Eligible: 'Giữ',
  NoRemainingQuantity: 'Loại: quỹ chung đã hết',
  RouteUnavailable: 'Loại: không có tuyến tới retailer',
  OutsideServiceRadius: 'Loại: ngoài bán kính phục vụ',
  ArrivesAfterDeadline: 'Loại: tới sau hạn nhận',
  BelowMlor: 'Loại: không đạt MLOR lúc nhận',
};

const MLOR_SOURCES: Record<TraceLineDetail['mlorSource'], string> = {
  RetailerProduct: 'MLOR riêng của retailer cho SKU này',
  RetailerCategory: 'MLOR của retailer theo nhóm hàng',
  ProductDefault: 'MLOR mặc định của sản phẩm',
};

const OUTCOMES: Record<TraceLineDetail['outcome'], { tone: Tone; label: string }> = {
  Allocated: { tone: 'success', label: 'Đã cấp đủ' },
  Short: { tone: 'danger', label: 'Thiếu hàng' },
  Released: { tone: 'warn', label: 'Đã trả về quỹ chung' },
};

const verdict = (c: TraceCandidate) => <Chip tone={c.passed ? 'success' : 'danger'}>{REASONS[c.reason]}</Chip>;

const atStage = (line: TraceLineDetail, stage: TraceStage) => line.candidates.filter((c) => c.stage === stage);

/**
 * One order line's working, stage by stage, as the run recorded it.
 *
 * Batches that were ruled out stay on screen, and every ranking of every greedy turn is shown, not
 * only the winners: "vì sao không phải batch kia" is what the window exists to answer, and a score
 * says nothing without the scores it beat.
 *
 * Nothing here is a price. Batches are settled first and priced after, so the near-expiry reduction
 * a batch later received is read from the price detail (F98), never from this table.
 */
export function TraceStepTables({ line }: { line: TraceLineDetail }) {
  const outcome = OUTCOMES[line.outcome];
  const turns = [...new Set(line.scores.map((s) => s.iteration))];
  return (
    <>
      <div className="card" style={{ padding: '12px 16px', display: 'flex', gap: 28, flexWrap: 'wrap', fontSize: 13.5 }}>
        <span>SKU: <strong>{line.sku}</strong></span>
        <span>Đặt: <strong>{formatCases(line.orderedQuantity)}</strong></span>
        <span>Tổng hạn dùng: <strong>{formatHours(line.totalShelfLifeHours)}</strong></span>
        <span>
          MLOR <strong>{formatPercent(line.effectiveMlorRatio * 100, 1)}</strong> → cần còn ≥{' '}
          <strong>{formatHours(line.requiredShelfLifeHours)}</strong> lúc nhận
        </span>
        <span>Nguồn MLOR: <strong>{MLOR_SOURCES[line.mlorSource]}</strong></span>
        <Chip tone={outcome.tone}>{outcome.label}</Chip>
      </div>

      <StepSection
        num="B1"
        title="Batch ứng viên trong quỹ chung của đợt"
        hint="Đúng SKU · còn lượng trong quỹ chung sau khi các đơn ưu tiên cao hơn đã rút"
      >
        <SimpleTable
          columns={[
            { header: 'Kho', cell: (r) => r.warehouseCode },
            { header: 'Batch', cell: (r) => r.batchCode },
            { header: 'Kết quả', cell: (r) => verdict(r) },
          ]}
          rows={atStage(line, 'Pool')}
          empty="Không có batch nào của SKU này trong quỹ chung."
        />
      </StepSection>

      <StepSection num="B2" title="Lọc tuyến và bán kính phục vụ" hint={`Bán kính tối đa ${formatKm(line.weights.maximumDistanceMeters / 1000)}`}>
        <SimpleTable
          columns={[
            { header: 'Kho', cell: (r) => r.warehouseCode },
            { header: 'Batch', cell: (r) => r.batchCode },
            { header: 'Kết quả', cell: (r) => verdict(r) },
          ]}
          rows={atStage(line, 'Distance')}
          empty="Không còn batch sau B1."
        />
      </StepSection>

      <StepSection
        num="B3"
        title="Kiểm hạn nhận và MLOR tại thời điểm nhận"
        hint="Giữ khi tới trước hạn nhận và EXP − ETA ≥ MLOR × tổng hạn dùng, đo bằng giờ"
      >
        <SimpleTable
          columns={[
            { header: 'Kho', cell: (r) => r.warehouseCode },
            { header: 'Batch', cell: (r) => r.batchCode },
            { header: 'Dự kiến nhận', cell: (r) => (r.estimatedArrivalAt ? formatInstantDateTime(r.estimatedArrivalAt) : '—') },
            { header: 'Còn lại lúc nhận', cell: (r) => formatHours(r.remainingShelfLifeHours) },
            { header: 'Ngưỡng MLOR', cell: (r) => `≥ ${formatHours(r.requiredShelfLifeHours)}` },
            { header: 'Kết quả', cell: (r) => verdict(r), width: '220px' },
          ]}
          rows={atStage(line, 'Delivery')}
          empty="Không còn batch sau B2."
        />
      </StepSection>

      <StepSection
        num="B4"
        title="Chấm điểm và cấp phát theo lượt"
        hint={`S = ${line.weights.shelfLife}·f_E + ${line.weights.distance}·f_D + ${line.weights.coverage}·f_Q (Admin cấu hình, đợt này đã đóng băng)`}
        note="f_E = 1 − (còn lại − MLOR) / (tổng hạn − MLOR): càng sát MLOR càng ưu tiên xuất trước (FEFO) · f_D = 1 − khoảng cách / bán kính tối đa · f_Q = min(khả dụng, còn cần) / còn cần, tính lại mỗi lượt vì phần còn thiếu co lại. Giảm giá cận hạn không tham gia chấm điểm."
      >
        {turns.length === 0 ? (
          <SimpleTable columns={[{ header: '', cell: () => null }]} rows={[]} empty="Không có batch nào hợp lệ để chấm điểm." />
        ) : (
          turns.map((turn) => (
            <div key={turn} style={{ marginBottom: 10 }}>
              <div style={{ padding: '6px 14px', fontSize: 13, fontWeight: 600 }}>
                Lượt #{turn} · còn cần{' '}
                {formatCases(line.scores.find((s) => s.iteration === turn)?.remainingDemand)}
              </div>
              <SimpleTable
                columns={[
                  { header: 'Hạng', cell: (r) => <strong>#{r.rank}</strong>, width: '70px' },
                  { header: 'Kho', cell: (r) => r.warehouseCode },
                  { header: 'Batch', cell: (r) => r.batchCode },
                  { header: 'f_E', cell: (r) => formatScore(r.shelfLifeScore) },
                  { header: 'f_D', cell: (r) => formatScore(r.distanceScore) },
                  { header: 'f_Q', cell: (r) => formatScore(r.coverageScore) },
                  { header: 'Điểm S', cell: (r) => <strong className="text-primary">{formatScore(r.weightedScore)}</strong> },
                  {
                    header: 'Lấy',
                    cell: (r) => (r.selected ? <strong>{formatCases(r.selectedQuantity)}</strong> : '—'),
                  },
                ]}
                rows={line.scores.filter((s) => s.iteration === turn)}
              />
            </div>
          ))
        )}
      </StepSection>

      <StepSection num="KL" title="Kết luận cho SKU này">
        <div
          className={`callout ${line.outcome === 'Allocated' ? 'callout-ok' : line.outcome === 'Short' ? 'callout-danger' : 'callout-warn'}`}
          style={{ margin: '12px 14px' }}
        >
          {line.outcome === 'Allocated' &&
            `Cấp đủ ${formatCases(line.drawnQuantity)} từ ${line.scores.filter((s) => s.selected).length} batch. Mọi batch được chọn đều đạt MLOR lúc nhận. Hàng chỉ được giữ thật sau khi Admin duyệt phương án.`}
          {line.outcome === 'Short' &&
            `Chỉ cấp được ${formatNumber(line.drawnQuantity)}/${formatNumber(line.orderedQuantity)} thùng (thiếu ${formatNumber(line.shortageQuantity)}). Theo quy tắc không giao một phần, cả đơn được ghi là thiếu hàng — hệ thống không tự từ chối đơn và không tự hạ MLOR.`}
          {line.outcome === 'Released' &&
            `Dòng này đã rút được ${formatCases(line.drawnQuantity)}, nhưng một dòng khác của cùng đơn thiếu hàng. Vì đơn là đủ-hoặc-không-gì, toàn bộ lượng tạm của đơn được trả về quỹ chung cho các đơn phía sau. Đây không phải dòng bị thiếu.`}
          {line.note && <div style={{ marginTop: 6, opacity: 0.85 }}>{line.note}</div>}
        </div>
      </StepSection>
    </>
  );
}
