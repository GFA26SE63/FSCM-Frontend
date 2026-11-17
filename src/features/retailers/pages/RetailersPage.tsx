import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { useEnumParam } from '@/shared/router/listState';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { useRestPagination, paginationQueryKeys } from '@/shared/pagination';
import {
  Button,
  DataTable,
  PageHeader,
  Select,
  StatusChip,
  type Column,
} from '@/shared/ui';
import { retailerApi } from '../api';
import type { Retailer } from '../types';
import { RetailerFormDialog } from '../components/RetailerFormDialog';
import { RetailerReviewDialog } from '../components/RetailerReviewDialog';

const statusLabel: Record<string, string> = {
  Draft: 'Bản nháp',
  PendingApproval: 'Chờ duyệt',
  Active: 'Hoạt động',
  Rejected: 'Từ chối',
  Inactive: 'Ngưng hoạt động',
  Locked: 'Đã khóa',
};

const STATUS_VALUES = ['', 'Draft', 'PendingApproval', 'Active', 'Rejected', 'Inactive', 'Locked'] as const;
type StatusValue = (typeof STATUS_VALUES)[number];

const STATUS_FILTER_OPTIONS = [
  { label: 'Tất cả', value: '' },
  ...Object.entries(statusLabel).map(([value, label]) => ({ label, value })),
];

/** Operational retailer queue backed by the current Retailers API. */
export function RetailersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reviewing, setReviewing] = useState<Retailer | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Status filter — synced to URL, resets page on change
  const [statusFilter, setStatusFilter] = useEnumParam<StatusValue>(
    'status',
    STATUS_VALUES,
    '',
    { resets: ['page'] },
  );

  // Phase 0 REST pagination hook — manages page/size/search from URL
  // total starts at 0; patched with real totalCount once query data arrives
  const { page, pageSize, search, pagingProps: basePagingProps } = useRestPagination({
    defaultPageSize: 20,
    pageSizeOptions: [10, 20, 50],
    urlState: true,
  });

  const query = useQuery({
    queryKey: paginationQueryKeys.restPage('retailers', {
      page,
      size: pageSize,
      search,
      filters: { status: statusFilter },
    }),
    queryFn: () =>
      retailerApi.list({
        page,
        pageSize,
        search: search || undefined,
        status: statusFilter || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  // Patch pagingProps with real total so DataTable shows correct page count
  const totalCount = query.data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pagingProps = { ...basePagingProps, total: totalCount, totalPages };

  const columns: Column<Retailer>[] = [
    { key: 'code', header: 'Mã', width: '120px', text: (row) => row.code },
    { key: 'name', header: 'Điểm bán', text: (row) => row.name },
    {
      key: 'contact',
      header: 'Liên hệ',
      text: (row) => `${row.contactName ?? '—'} · ${row.phone ?? '—'}`,
    },
    { key: 'salesGroup', header: 'Nhóm bán hàng', width: '130px', text: (row) => row.salesGroupCode },
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
        title="Điểm bán"
        subtitle="Theo dõi khai báo từ nhân viên bán hàng, duyệt điểm bán và quản lý hồ sơ điểm bán."
        actions={
          can(user, 'retailers.create') ? (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              + Tạo điểm bán
            </Button>
          ) : undefined
        }
      />
      <DataTable
        title="Danh sách điểm bán"
        rows={query.data?.items}
        loading={query.isLoading || query.isPlaceholderData}
        error={query.isPlaceholderData ? undefined : query.error}
        rowKey={(row) => row.id ?? row.code}
        columns={columns}
        onRowClick={(row) => navigate(`/retailers/${row.id || row.code}`)}
        searchPlaceholder="Mã, tên điểm bán, người liên hệ, SĐT..."
        server={pagingProps}
        filterExtra={
          <label className="lbl">
            Trạng thái
            <Select
              value={statusFilter}
              options={STATUS_FILTER_OPTIONS}
              onChange={(e) => setStatusFilter(e.target.value as StatusValue)}
            />
          </label>
        }
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
      {reviewing && reviewing.id && <RetailerReviewDialog retailer={reviewing as Retailer & { id: string }} onClose={() => setReviewing(null)} />}
      {createOpen && <RetailerFormDialog open retailer={null} onClose={() => setCreateOpen(false)} />}
    </>
  );
}
