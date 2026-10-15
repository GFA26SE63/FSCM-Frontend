import { Chip, SimpleTable, StepSection } from '@/shared/ui';
import { formatCases, formatKm, formatNumber, formatScore } from '@/shared/lib';
import type { RotationTrace } from '../types';

/** The four calculation steps of the rotation planner (SPEC §6), with all candidates incl. rejected + reasons. */
export function RotationSteps({ t }: { t: RotationTrace }) {
  const w = t.weights;
  return (
    <div className="stack">
      <StepSection
        num="Bước 1"
        title="Năng lực bán của kho nguồn → lượng dư"
        hint={`L = ${t.remainingDays} ngày · SL vòng đời ${t.shelfLifeDays} ngày`}
        note={`Cửa sổ bán W = L − m·SL − 1 cho từng nhóm khách; C = Σ v·W − tồn batch cũ hơn cùng SKU (${formatCases(t.olderAhead)}); dư E = q − C = ${t.quantity} − ${formatNumber(t.sellable)} = ${formatCases(t.excess)}.`}
      >
        <SimpleTable
          compact
          rows={t.step1}
          empty="Kho nguồn không có nhóm khách mua SKU này (v = 0)."
          columns={[
            { header: 'Nhóm khách', cell: (r) => r.group },
            { header: 'v (thùng/ngày)', align: 'right', cell: (r) => formatNumber(r.velocity, 2) },
            { header: 'm', align: 'right', cell: (r) => formatNumber(r.m, 2) },
            { header: 'MLOR (ngày)', align: 'right', cell: (r) => formatNumber(r.mlorDays, 1) },
            { header: 'W (ngày)', align: 'right', cell: (r) => formatNumber(r.windowDays, 1) },
            { header: 'v·W (thùng)', align: 'right', cell: (r) => formatNumber(r.sellable, 1) },
          ]}
        />
      </StepSection>

      <StepSection num="Bước 2" title="Lọc kho đích (điều kiện cứng)" hint="Dmax_kho · v > 0 · còn hạn · năng lực nhận N > 0" note="Mọi kho ứng viên đều hiển thị; kho bị loại ghi rõ lý do.">
        <SimpleTable
          compact
          rows={t.step2}
          columns={[
            { header: 'Kho', cell: (r) => r.warehouseName },
            { header: 'Khoảng cách', align: 'right', cell: (r) => formatKm(r.km) },
            { header: 'Vận chuyển', align: 'right', cell: (r) => (r.transitDays == null ? '—' : `${r.transitDays} ngày`) },
            { header: 'Còn hạn khi đến', align: 'right', cell: (r) => (r.remainingAtDest == null ? '—' : `${r.remainingAtDest} ngày`) },
            { header: 'Năng lực bán', align: 'right', cell: (r) => (r.salesCapacity == null ? '—' : formatNumber(r.salesCapacity, 1)) },
            { header: 'Tồn trước (Q)', align: 'right', cell: (r) => formatNumber(r.qAhead) },
            { header: 'Năng lực nhận N', align: 'right', cell: (r) => (r.receivingCapacity == null ? '—' : formatNumber(r.receivingCapacity)) },
            { header: 'Kết quả', cell: (r) => <Chip tone={r.accepted ? 'ok' : 'danger'}>{r.accepted ? 'Đạt' : 'Loại'}</Chip> },
            { header: 'Lý do', cell: (r) => r.reason },
          ]}
        />
      </StepSection>

      <StepSection num="Bước 3" title="Chấm điểm kho đạt điều kiện" hint={`S = ${w.wE}·fE + ${w.wD}·fD + ${w.wQ}·fQ`} note="fE: HSD còn lại khi đến; fD: gần; fQ: nhận được nhiều so với lượng dư. Điểm cao hơn được chia trước.">
        <SimpleTable
          compact
          rows={[...t.step3].sort((a, b) => b.score - a.score)}
          empty="Không có kho nào đạt điều kiện cứng."
          columns={[
            { header: 'Kho', cell: (r) => r.warehouseName },
            { header: 'SL dự kiến nhận', align: 'right', cell: (r) => formatCases(r.tentativeQty) },
            { header: 'fE', align: 'right', cell: (r) => formatScore(r.fE) },
            { header: 'fD', align: 'right', cell: (r) => formatScore(r.fD) },
            { header: 'fQ', align: 'right', cell: (r) => formatScore(r.fQ) },
            { header: 'Điểm S', align: 'right', cell: (r) => <b>{formatScore(r.score)}</b> },
          ]}
        />
      </StepSection>

      <StepSection num="Bước 4" title="Chia lượng dư" hint={`Làm tròn xuống bội số ${t.roundTo} · tối thiểu ${t.minQty} thùng`} note={t.leftover > 0 ? `Còn dư ${formatCases(t.leftover)} chưa có kho nhận → gợi ý giảm giá theo HSD.` : 'Toàn bộ lượng dư được chia hết cho các kho đích.'}>
        <SimpleTable
          compact
          rows={t.step4}
          empty="Không có lượt chia."
          columns={[
            { header: 'Lượt', width: '60px', cell: (r) => r.turn },
            { header: 'Kho', cell: (r) => r.warehouseName },
            { header: 'Dư còn lại', align: 'right', cell: (r) => formatCases(r.excessLeft) },
            { header: 'Chia', align: 'right', cell: (r) => <b>{formatCases(r.qty)}</b> },
            { header: 'Dư sau', align: 'right', cell: (r) => formatCases(r.after) },
            { header: 'Ghi chú', cell: (r) => r.note },
          ]}
        />
      </StepSection>
    </div>
  );
}
