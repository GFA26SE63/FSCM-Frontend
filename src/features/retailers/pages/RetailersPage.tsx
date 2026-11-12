import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { get } from '@/shared/api/http';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import {
  Button,
  DataTable,
  PageHeader,
  StatusChip,
  type Column,
} from '@/shared/ui';
import { RetailerFormDialog } from '../components/RetailerFormDialog';
import { RetailerReviewDialog } from '../components/RetailerReviewDialog';

type Retailer = {
  id: string;
  code: string;
  name: string;
  contactName?: string;
  phone?: string;
  address?: string;
  status: 'Draft' | 'PendingApproval' | 'Active' | 'Rejected' | 'Inactive' | 'Locked' | string;
  retailerType: string;
  salesGroupCode: string;
  creditTermDays: number;
};

type RetailerPage = { items: Retailer[]; totalCount: number };

const statusLabel: Record<string, string> = {
  Draft: 'Bản nháp',
  PendingApproval: 'Chờ duyệt',
  Active: 'Hoạt động',
  Rejected: 'Từ chối',
  Inactive: 'Ngưng hoạt động',
  Locked: 'Đã khóa',
};

/** Operational retailer queue backed by the current Retailers API. */
export function RetailersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reviewing, setReviewing] = useState<Retailer | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const query = useQuery({
    queryKey: ['retailers', 'portal'],
    queryFn: () => get<RetailerPage>('/retailers', { page: 1, pageSize: 100 }),
  });

  const rows = useMemo(() => query.data?.items ?? [], [query.data?.items]);

  const groups = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.salesGroupCode) set.add(r.salesGroupCode);
    });
    return Array.from(set).sort();
  }, [rows]);

  const columns: Column<Retailer>[] = [
    { key: 'code', header: 'Mã', width: '120px', text: (row) => row.code },
    { key: 'name', header: 'Điểm bán', text: (row) => row.name },
    {
      key: 'contact',
      header: 'Liên hệ',
      text: (row) => `${row.contactName ?? '—'} · ${row.phone ?? '—'}`,
    },
    { key: 'salesGroup', header: 'Nhóm Sales', width: '130px', text: (row) => row.salesGroupCode },
    { key: 'type', header: 'Loại hình', text: (row) => row.retailerType },
    {
      key: 'credit',
      header: 'Công nợ',
      width: '110px',
      text: (row) => (row.creditTermDays ? `${row.creditTermDays} ngày` : 'Không'),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '140px',
      render: (row) => <StatusChip value={statusLabel[row.status] || row.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Retailer"
        subtitle="Theo dõi khai báo từ Sales, duyệt retailer và quản lý hồ sơ điểm bán."
        actions={
          can(user, 'retailers.create') ? (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              + Tạo retailer
            </Button>
          ) : undefined
        }
      />
      <DataTable
        title="Danh sách retailer"
        rows={rows}
        loading={query.isLoading}
        error={query.error}
        rowKey={(row) => row.id}
        columns={columns}
        onRowClick={(row) => navigate(`/retailers/${row.id || row.code}`)}
        searchPlaceholder="Mã, tên điểm bán, người liên hệ, SĐT..."
        filters={[
          {
            label: 'Trạng thái',
            options: Object.values(statusLabel),
            value: (row) => statusLabel[row.status] || row.status,
          },
          ...(groups.length > 0
            ? [
                {
                  label: 'Nhóm Sales',
                  options: groups,
                  value: (row: Retailer) => row.salesGroupCode || '—',
                },
              ]
            : []),
        ]}
        rowActionHeader="Thao tác"
        rowActionsWidth="170px"
        rowActions={(row) => (
          <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'flex-end', width: '100%' }}>
            <Button
              size="sm"
              variant="default"
              onClick={() => navigate(`/retailers/${row.id || row.code}`)}
            >
              Xem
            </Button>
            {row.status === 'PendingApproval' && can(user, 'retailers.review') && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => setReviewing(row)}
              >
                Xét duyệt
              </Button>
            )}
          </div>
        )}
      />
      {reviewing && <RetailerReviewDialog retailer={reviewing} onClose={() => setReviewing(null)} />}
      {createOpen && <RetailerFormDialog open retailer={null} onClose={() => setCreateOpen(false)} />}
    </>
  );
}


