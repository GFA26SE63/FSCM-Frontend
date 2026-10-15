import { useNavigate } from '@/shared/router/compat';
import { Button, Callout, DataTable, PageHeader, Stat, StatusChip, type Column } from '@/shared/ui';
import { formatCases, formatDate, formatDateTime, formatKm, formatScore, statusLabel, statusLabels } from '@/shared/lib';
import { useProposals, useRunRotation } from '../hooks';
import { ProposalActions } from '../components/ProposalActions';
import type { RotationProposal } from '../types';

/** "Luân chuyển cận hạn" – proposals of the 02:00 job; Admin approves / edits quantity / skips. */
export function RotationPage() {
  const navigate = useNavigate();
  const query = useProposals();
  const run = useRunRotation();
  const rows = query.data?.items ?? [];

  const columns: Column<RotationProposal>[] = [
    { key: 'batch', header: 'Batch nguồn', width: '200px', render: (p) => (<><div className="bold">{p.batchCode}</div><div className="muted small">{p.productName}</div></>), text: (p) => `${p.batchCode} ${p.productName}` },
    { key: 'from', header: 'Kho nguồn', width: '130px', text: (p) => p.fromWarehouseName },
    { key: 'expiry', header: 'HSD', width: '95px', text: (p) => formatDate(p.expiry) },
    { key: 'excess', header: 'Dư ước tính', width: '100px', align: 'right', text: (p) => formatCases(p.excess) },
    { key: 'to', header: 'Kho đích đề xuất', width: '150px', text: (p) => p.toWarehouseName ?? '—' },
    { key: 'km', header: 'Khoảng cách', width: '95px', align: 'right', text: (p) => (p.toWarehouseName ? formatKm(p.km) : '—') },
    { key: 'qty', header: 'SL đề xuất', width: '100px', align: 'right', text: (p) => formatCases(p.qty) },
    { key: 'score', header: 'Điểm S', width: '75px', align: 'right', text: (p) => (p.toWarehouseName ? formatScore(p.score) : '—') },
    { key: 'status', header: 'Trạng thái', width: '140px', render: (p) => <StatusChip domain="rotation" value={p.status} /> },
  ];
  return (
    <>
      <PageHeader title="Luân chuyển cận hạn" subtitle={`Job chạy lúc ${formatDateTime(query.data?.jobRanAt)} – điểm S = wE·fE + wD·fD + wQ·fQ; đề xuất chờ Admin duyệt.`} actions={<Button loading={run.isPending} onClick={() => run.mutate()}>Chạy lại job</Button>} />
      <div className="grid-3">
        <Stat label="Chờ duyệt" value={rows.filter((p) => p.status === 'Proposed').length} />
        <Stat label="Đã duyệt / bỏ qua" value={`${rows.filter((p) => p.status === 'Approved').length} / ${rows.filter((p) => p.status === 'Skipped').length}`} />
        <Stat label="Gợi ý giảm giá / không có kho đích" value={rows.filter((p) => p.status === 'DiscountSuggested' || p.status === 'NoDestination').length} />
      </div>
      <Callout tone="neutral">Phần dư không kho nào nhận được (hoặc nhận không đủ) chuyển sang gợi ý giảm giá theo HSD; không tự điều chuyển.</Callout>
      <DataTable
        title="Đề xuất luân chuyển"
        rows={rows}
        loading={query.isLoading}
        error={query.error}
        rowKey={(p) => p.id}
        columns={columns}
        searchPlaceholder="Batch, sản phẩm, kho…"
        filters={[
          { label: 'Trạng thái', options: Object.values(statusLabels.rotation), value: (p) => statusLabel('rotation', p.status) },
          { label: 'Kho nguồn', options: [...new Set(rows.map((p) => p.fromWarehouseName))], value: (p) => p.fromWarehouseName },
        ]}
        onRowClick={(p) => navigate(`/rotation/${encodeURIComponent(p.id)}`)}
        rowActionsWidth="270px"
        rowActions={(p) => (
          <>
            <Button size="sm" onClick={() => navigate(`/rotation/${encodeURIComponent(p.id)}`)}>Chi tiết</Button>
            <ProposalActions p={p} />
          </>
        )}
      />
    </>
  );
}
