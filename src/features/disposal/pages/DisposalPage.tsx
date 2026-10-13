import { useNavigate } from 'react-router-dom';
import { Button, Callout, DataTable, PageHeader, StatusChip, type Column } from '@/shared/ui';
import { formatCases, formatDateTime, formatMoney } from '@/shared/lib';
import { useDisposalCandidates, useDisposals } from '../hooks';
import type { Disposal } from '../types';

export function DisposalPage() {
  const navigate = useNavigate();
  const query = useDisposals();
  const candidates = useDisposalCandidates();
  const columns: Column<Disposal>[] = [
    { key: 'code', header: 'Mã phiếu', width: '130px', render: (d) => <span className="bold">{d.code}</span> },
    { key: 'wh', header: 'Kho', text: (d) => d.warehouseName },
    { key: 'at', header: 'Thời gian', width: '150px', text: (d) => formatDateTime(d.createdAt) },
    { key: 'by', header: 'Người lập', width: '150px', text: (d) => d.createdBy },
    { key: 'method', header: 'Hình thức', width: '150px', text: (d) => d.method },
    { key: 'batches', header: 'Số batch', width: '85px', align: 'right', text: (d) => d.batchCount },
    { key: 'qty', header: 'Tổng SL', width: '100px', align: 'right', text: (d) => formatCases(d.totalQty) },
    { key: 'value', header: 'Giá trị', width: '120px', align: 'right', text: (d) => formatMoney(d.totalValue) },
    { key: 'status', header: 'Trạng thái', width: '115px', render: () => <StatusChip domain="disposal" value="Disposed" /> },
  ];
  const n = candidates.data?.length ?? 0;
  return (
    <>
      <PageHeader title="Hủy hàng hết hạn" subtitle="Lập phiếu hủy cho batch đã quá hạn sử dụng; sau khi hủy tồn batch về 0." actions={<Button variant="primary" onClick={() => navigate('/disposal/new')}>+ Lập phiếu hủy</Button>} />
      {n > 0 && <Callout tone="warn">Có {n} batch đã hết hạn còn tồn kho, cần lập phiếu hủy.</Callout>}
      <DataTable
        title="Phiếu hủy hàng"
        rows={query.data}
        loading={query.isLoading}
        error={query.error}
        rowKey={(d) => d.code}
        columns={columns}
        searchPlaceholder="Mã phiếu, kho, batch…"
        filters={[{ label: 'Kho', options: [...new Set((query.data ?? []).map((d) => d.warehouseName))], value: (d) => d.warehouseName }]}
        onRowClick={(d) => navigate(`/disposal/${d.code}`)}
        rowActionsWidth="90px"
        rowActions={(d) => <Button size="sm" onClick={() => navigate(`/disposal/${d.code}`)}>Xem</Button>}
      />
    </>
  );
}
