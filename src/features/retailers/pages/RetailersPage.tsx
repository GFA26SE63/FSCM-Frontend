import { useMemo, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { useNavigate } from '@/shared/router/compat';
import { useEnumParam, useQueryParams } from '@/shared/router/listState';
import { useCursorPagination } from '@/shared/pagination';
import { decodeSort, PAGINATION_PARAM_NAMES, PAGINATION_RESETS, parsePageSize } from '@/shared/pagination/urlSync';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import {
  ActionDropdown,
  Button,
  DataTable,
  PageHeader,
  Select,
  StatusChip,
  type Column,
} from '@/shared/ui';
import { useRetailersPage, useRetailerSalesGroupsForPage } from '../hooks';
import {
  RETAILERS_PAGE_SIZES,
  RETAILERS_SORT_MAP,
  RETAILERS_SORTABLE_FIELDS,
  type RetailerListRow,
  type RetailerSortField,
  type RetailersPageSize,
} from '../retailersGraphql';
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

const PAGE_RESETS = PAGINATION_RESETS;

/**
 * Retailer list — migrated to GraphQL cursor pagination (entities.retailers), Phase C.1.
 *
 * Note: the former "Liên hệ" (contact/phone) column is not reproducible via GraphQL —
 * RetailerDeclarationContact has no entities.* resolver (confirmed REST-only in the
 * Backend capability audit). Full contact info remains available on the Detail page,
 * which stays on REST. See docs/audits/FSCM_Phase_C1_Retailers_Migration_Report.md.
 */
export function RetailersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { params } = useQueryParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [reviewing, setReviewing] = useState<{ id: string; code: string } | null>(null);

  const after = params.get('after') ?? undefined;
  const before = after ? undefined : (params.get('before') ?? undefined);
  const pageSize = parsePageSize(params.get('size'), RETAILERS_PAGE_SIZES, 20) as RetailersPageSize;
  const search = params.get('q') ?? undefined;

  const [statusFilter, setStatusFilter] = useEnumParam<StatusValue>(
    'status',
    STATUS_VALUES,
    '',
    { resets: PAGE_RESETS },
  );

  const rawSort = decodeSort(params.get(PAGINATION_PARAM_NAMES.SORT));
  const activeSort = rawSort?.field && RETAILERS_SORT_MAP[rawSort.field as RetailerSortField]
    ? { field: rawSort.field as RetailerSortField, direction: rawSort.direction }
    : undefined;

  const query = useRetailersPage({
    size: pageSize,
    after,
    before,
    status: statusFilter || undefined,
    search: search || undefined,
    sort: activeSort,
  });

  const { pagingProps, sortProps } = useCursorPagination({
    pageInfo: query.data?.pageInfo,
    totalCount: query.data?.totalCount,
    loading: query.isLoading || query.isFetching,
    error: query.isPlaceholderData ? undefined : query.error,
    defaultPageSize: 20,
    pageSizeOptions: RETAILERS_PAGE_SIZES,
    urlState: true,
  });

  const pageRetailerIds = useMemo(
    () => (query.data?.rows ?? []).map((r) => r.id),
    [query.data?.rows],
  );
  const salesGroupsQuery = useRetailerSalesGroupsForPage(pageRetailerIds);

  const rows = useMemo(() => {
    const groups = salesGroupsQuery.data;
    return (query.data?.rows ?? []).map((r) => ({
      ...r,
      salesGroupCode: groups?.get(r.id) ?? null,
    }));
  }, [query.data?.rows, salesGroupsQuery.data]);

  const columns: Column<RetailerListRow>[] = [
    { key: 'code', header: 'Mã', width: '120px', sortable: true, text: (row) => row.code },
    { key: 'name', header: 'Điểm bán', sortable: true, text: (row) => row.name },
    { key: 'salesGroup', header: 'Nhóm bán hàng', width: '130px', text: (row) => row.salesGroupCode ?? '—' },
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
        title="Nhà bán lẻ"
        subtitle="Theo dõi khai báo từ nhân viên bán hàng, duyệt nhà bán lẻ và quản lý hồ sơ nhà bán lẻ."
        actions={
          can(user, 'retailers.create') ? (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              + Tạo nhà bán lẻ
            </Button>
          ) : undefined
        }
      />
      <DataTable
        title="Danh sách điểm bán"
        rows={rows}
        loading={query.isLoading || query.isPlaceholderData}
        error={query.isPlaceholderData ? undefined : query.error}
        rowKey={(row) => row.id}
        columns={columns}
        summaryColumns={['code', 'name', 'salesGroup', 'type', 'status']}
        onRowClick={(row) => navigate(`/retailers/${row.id}`)}
        searchPlaceholder="Mã, tên điểm bán, địa chỉ..."
        cursor={pagingProps}
        serverSort={{ ...sortProps, sortableFields: RETAILERS_SORTABLE_FIELDS }}
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
        rowActionsWidth="70px"
        rowActions={(row) =>
          row.status === 'PendingApproval' && can(user, 'retailers.review') ? (
            <div className="table-actions-inline">
              <ActionDropdown triggerTitle={`Thao tác nhà bán lẻ ${row.code}`} items={[{
                key: 'review', label: 'Xét duyệt', icon: <ClipboardCheck size={16} />,
                onClick: () => setReviewing({ id: row.id, code: row.code }),
              }]} />
            </div>
          ) : null
        }
      />
      {reviewing && <RetailerReviewDialog retailer={reviewing} onClose={() => setReviewing(null)} />}
      {createOpen && <RetailerFormDialog open retailer={null} onClose={() => setCreateOpen(false)} />}
    </>
  );
}
