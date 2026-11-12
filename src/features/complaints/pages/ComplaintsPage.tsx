import { useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { Button, DataTable, PageHeader, StatusChip, type Column } from '@/shared/ui';
import { formatDateTime, statusLabel, statusLabels } from '@/shared/lib';
import { useComplaints } from '../hooks';
import { ResolveDialog } from '../components/ResolveDialog';
import type { Complaint } from '../types';
import { requestTypeLabel } from '../types';

export function ComplaintsPage() {
  const navigate = useNavigate();
  const query = useComplaints();
  const [resolving, setResolving] = useState<string | null>(null);
  const columns: Column<Complaint>[] = [
    { key: 'code', header: 'Mã', width: '130px', render: (c) => <span className="bold">{c.code}</span> },
    { key: 'order', header: 'Đơn hàng', width: '110px', text: (c) => c.orderCode },
    { key: 'type', header: 'Loại yêu cầu', width: '160px', text: c => requestTypeLabel(c.requestType) },
    { key: 'retailer', header: 'Retailer', width: '180px', text: (c) => c.retailerName },
    { key: 'content', header: 'Nội dung', text: (c) => `${c.issueType === 'Return' ? 'Trả' : c.issueType === 'Damaged' ? 'Hỏng' : 'Thiếu'} ${c.requestedQuantity ?? c.expectedQuantity - c.actualQuantity} · ${c.sku}${c.note ? ` · ${c.note}` : ''}` },
    { key: 'at', header: 'Thời gian', width: '140px', text: (c) => formatDateTime(c.createdAt) },
    { key: 'status', header: 'Trạng thái', width: '110px', render: (c) => <StatusChip domain="complaint" value={c.reviewStatus === 'UnderReview' ? 'UnderReview' : c.status} /> },
    { key: 'handling', header: 'Tiến độ xử lý', width: '170px', text: c => c.documents?.some(d => d.status === 'Pending') ? 'Chờ xử lý hàng thực tế' : c.financialAdjustmentApplied ? 'Đã chốt tài chính' : c.status === 'Resolved' ? 'Đã hoàn tất' : c.status === 'Approved' && c.physicalHandlingCompleted ? 'Chờ chốt tài chính' : '—' },
  ];
  return (
    <>
      <PageHeader title="Yêu cầu" subtitle="Khiếu nại, trả hàng và thu hồi hàng hỏng. Admin duyệt; Operator xác nhận xử lý thực tế trước khi chốt tài chính." />
      <DataTable
        title="Danh sách yêu cầu"
        rows={query.data}
        loading={query.isLoading}
        error={query.error}
        rowKey={(c) => c.code}
        columns={columns}
        searchPlaceholder="Mã, đơn hàng, retailer, nội dung…"
        filters={[{ label: 'Trạng thái', options: Object.values(statusLabels.complaint), value: (c) => statusLabel('complaint', c.status) },
          {label:'Loại yêu cầu',options:['Khiếu nại đơn hàng','Trả hàng','Thu hồi hàng hỏng'],value:c=>requestTypeLabel(c.requestType)}]}
        onRowClick={(c) => navigate(`/complaints/${c.code}`)}
        rowActionsWidth="180px"
        rowActions={(c) => (
          <>
            <Button size="sm" onClick={() => navigate(`/complaints/${c.code}`)}>Xem</Button>
            {c.status === 'Open' && <Button size="sm" variant="primary" onClick={() => setResolving(c.code)}>Xử lý</Button>}
          </>
        )}
      />
      <ResolveDialog code={resolving} onClose={() => setResolving(null)} />
    </>
  );
}
