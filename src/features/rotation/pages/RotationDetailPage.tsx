import { useParams } from '@/shared/router/compat';
import { Callout, Card, Fields, PageHeader, QueryState, StatusChip } from '@/shared/ui';
import { formatCases, formatDate, formatKm, formatMoney, formatScore } from '@/shared/lib';
import { useProposal } from '../hooks';
import { ProposalActions } from '../components/ProposalActions';
import { RotationSteps } from '../components/RotationSteps';

export function RotationDetailPage() {
  const { id = '' } = useParams();
  const query = useProposal(id);
  return (
    <QueryState query={query}>
      {({ proposal: p, trace: t }) => (
        <>
          <PageHeader
            back="/rotation"
            title={`Đề xuất luân chuyển · ${p.batchCode}`}
            subtitle={`${p.productName} · ${p.fromWarehouseName}${p.toWarehouseName ? ' → ' + p.toWarehouseName : ''}`}
            chips={<StatusChip domain="rotation" value={p.status} />}
            actions={<ProposalActions p={p} size="md" />}
          />
          {p.transferCode && <Callout tone="ok">Đã tạo phiếu điều chuyển <b>{p.transferCode}</b>.</Callout>}
          {p.toWarehouseName == null && <Callout tone="warn">Không kho nào nhận được phần dư {formatCases(p.qty)} → hệ thống gợi ý giảm giá theo hạn sử dụng.</Callout>}
          <Card title="Tổng quan">
            <Fields cols={3} items={[
              { label: 'Batch', value: p.batchCode },
              { label: 'HSD / còn lại', value: `${formatDate(p.expiry)} · ${t.remainingDays} ngày` },
              { label: 'Tồn batch / dư ước tính', value: `${formatCases(t.quantity)} / ${formatCases(p.excess)}` },
              { label: 'Kho đích', value: p.toWarehouseName ?? '—' },
              { label: 'Khoảng cách', value: p.toWarehouseName ? formatKm(p.km) : '—' },
              { label: 'SL đề xuất (tối đa)', value: p.toWarehouseName ? `${formatCases(p.qty)} (${p.maxQty})` : formatCases(p.qty) },
              { label: 'Điểm S', value: p.toWarehouseName ? formatScore(p.score) : '—' },
              { label: 'Giá trị cứu vãn', value: p.toWarehouseName ? formatMoney(p.salvage) : '—' },
              { label: 'Chi phí chuyến', value: p.toWarehouseName ? formatMoney(p.tripCost) : '—' },
            ]} />
          </Card>
          <RotationSteps t={t} />
        </>
      )}
    </QueryState>
  );
}
