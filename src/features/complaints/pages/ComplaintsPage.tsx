import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, DataTable, PageHeader, StatusChip, type Column } from '@/shared/ui';
import { formatDateTime, statusLabel, statusLabels } from '@/shared/lib';
import { useComplaints } from '../hooks';
import { ResolveDialog } from '../components/ResolveDialog';
import type { Complaint } from '../types';

export function ComplaintsPage() {
  const navigate = useNavigate();
  const query = useComplaints();
  const [resolving, setResolving] = useState<string | null>(null);
  const columns: Column<Complaint>[] = [
    { key: 'code', header: 'Mã', width: '130px', render: (c) => <span className="bold">{c.code}</span> },
    { key: 'order', header: 'Đơn hàng', width: '110px', text: (c) => c.orderCode },
    { key: 'retailer', header: 'Retailer', width: '180px', text: (c) => c.retailerName },
    { key: 'content', header: 'Nội dung', text: (c) => c.content },
    { key: 'at', header: 'Thời gian', width: '140px', text: (c) => formatDateTime(c.createdAt) },
    { key: 'status', header: 'Trạng thái', width: '110px', render: (c) => <StatusChip domain="complaint" value={c.status} /> },
  ];
  return (
    <>
      <PageHeader title="Khiếu nại" subtitle="Retailer gửi khiếu nại theo đơn từ app; Admin / Operator ghi nhận kết quả xử lý." />
      <DataTable
        title="Danh sách khiếu nại"
        rows={query.data}
        loading={query.isLoading}
        error={query.error}
        rowKey={(c) => c.code}
        columns={columns}
        searchPlaceholder="Mã, đơn hàng, retailer, nội dung…"
        filters={[{ label: 'Trạng thái', options: Object.values(statusLabels.complaint), value: (c) => statusLabel('complaint', c.status) }]}
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
