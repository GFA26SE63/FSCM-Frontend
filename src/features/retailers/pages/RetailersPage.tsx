import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { get, post } from '@/shared/api/http';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { Button, DataTable, FormDialog, PageHeader, StatusChip, type Column } from '@/shared/ui';

type Retailer = { id: string; code: string; name: string; contactName?: string; phone?: string; address?: string; status: 'Draft' | 'PendingApproval' | 'Active' | 'Rejected' | 'Inactive'; retailerType: string; salesGroupCode: string; creditTermDays: number };
type RetailerPage = { items: Retailer[]; totalCount: number };
const statusLabel: Record<Retailer['status'], string> = { Draft: 'Bản nháp', PendingApproval: 'Chờ duyệt', Active: 'Hoạt động', Rejected: 'Từ chối', Inactive: 'Ngưng hoạt động' };

function ReviewDialog({ retailer, onClose }: { retailer: Retailer; onClose: () => void }) {
  const client = useQueryClient();
  return <FormDialog open width={560} title={`Duyệt khai báo ${retailer.code}`} submitLabel="Duyệt retailer" initial={{ reason: '', creditTermDays: String(retailer.creditTermDays || 0) }} fields={[{ key: 'creditTermDays', type: 'select' as const, label: 'Kỳ hạn công nợ', required: true, options: [{ value: '0', label: 'Không công nợ' }, { value: '7', label: '7 ngày' }, { value: '14', label: '14 ngày' }, { value: '30', label: '30 ngày' }] }, { key: 'reason', type: 'textarea' as const, label: 'Ghi chú phê duyệt', required: true }]} onClose={onClose} onSubmit={async (value) => { await post(`/retailers/${retailer.id}/review`, { approve: true, creditTermDays: Number(value.creditTermDays), reason: value.reason }); await client.invalidateQueries({ queryKey: ['retailers', 'portal'] }); onClose(); }} />;
}

/** Operational retailer queue backed by the current Retailers API. */
export function RetailersPage() {
  const { user } = useAuth();
  const [reviewing, setReviewing] = useState<Retailer | null>(null);
  const query = useQuery({ queryKey: ['retailers', 'portal'], queryFn: () => get<RetailerPage>('/retailers', { page: 1, pageSize: 100 }) });
  const rows = query.data?.items ?? [];
  const columns: Column<Retailer>[] = [
    { key: 'code', header: 'Mã', width: '120px', text: (row) => row.code },
    { key: 'name', header: 'Điểm bán', text: (row) => row.name },
    { key: 'contact', header: 'Liên hệ', text: (row) => `${row.contactName ?? '—'} · ${row.phone ?? '—'}` },
    { key: 'salesGroup', header: 'Nhóm Sales', width: '130px', text: (row) => row.salesGroupCode },
    { key: 'type', header: 'Loại hình', text: (row) => row.retailerType },
    { key: 'credit', header: 'Công nợ', width: '110px', text: (row) => row.creditTermDays ? `${row.creditTermDays} ngày` : 'Không' },
    { key: 'status', header: 'Trạng thái', width: '140px', render: (row) => <StatusChip value={statusLabel[row.status]} /> },
  ];
  return <>
    <PageHeader title="Retailer" subtitle="Theo dõi khai báo từ Sales, duyệt retailer và quản lý trạng thái tài khoản." />
    <DataTable title="Danh sách retailer" rows={rows} loading={query.isLoading} error={query.error} rowKey={(row) => row.id} columns={columns} searchPlaceholder="Mã, tên điểm bán, liên hệ..." filters={[{ label: 'Trạng thái', options: Object.values(statusLabel), value: (row) => statusLabel[row.status] }]} rowActionsWidth="130px" rowActions={(row) => row.status === 'PendingApproval' && can(user, 'retailers.review') ? <Button size="sm" variant="primary" onClick={() => setReviewing(row)}>Xét duyệt</Button> : null} />
    {reviewing && <ReviewDialog retailer={reviewing} onClose={() => setReviewing(null)} />}
  </>;
}
