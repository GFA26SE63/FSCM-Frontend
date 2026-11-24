import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@/shared/router/compat';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { useEnumParam, useQueryParams, useStringParam } from '@/shared/router/listState';
import { useCursorPagination } from '@/shared/pagination';
import { decodeSort, PAGINATION_PARAM_NAMES, PAGINATION_RESETS, parsePageSize } from '@/shared/pagination/urlSync';
import {
  ActionDropdown,
  type ActionDropdownItem,
  Button,
  ConfirmDialog,
  DataTable,
  PageHeader,
  Select,
  StatusChip,
  type Column,
} from '@/shared/ui';
import { formatCases, formatDateTime, statusLabels } from '@/shared/lib';
import { useWarehouses } from '@/features/warehouses/hooks';
import { useApproveReceipt, useReceiptLineTotalsForPage, useReceiptsPage } from '../hooks';
import { useReceiptUserNames } from '../userNames';
import {
  RECEIPTS_PAGE_SIZES,
  RECEIPTS_SORT_MAP,
  RECEIPTS_SORTABLE_FIELDS,
  type ReceiptSortField,
  type ReceiptsPageSize,
} from '../receiptsGraphql';
import type { ReceiptListItem } from '../types';

const RECEIPT_STATUSES = ['', 'Pending', 'Received'] as const;
type ReceiptStatusFilter = (typeof RECEIPT_STATUSES)[number];
const PAGE_RESETS = PAGINATION_RESETS;

export function ReceiptsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { params } = useQueryParams();

  const after = params.get('after') ?? undefined;
  const before = after ? undefined : (params.get('before') ?? undefined);
  const pageSize = parsePageSize(params.get('size'), RECEIPTS_PAGE_SIZES, 20) as ReceiptsPageSize;
  const search = params.get('q') ?? undefined;

  const [statusFilter, setStatusFilter] = useEnumParam<ReceiptStatusFilter>(
    'status', RECEIPT_STATUSES, '', { resets: PAGE_RESETS },
  );
  const [warehouseId, setWarehouseId] = useStringParam('wh', { resets: PAGE_RESETS });

  const rawSort = decodeSort(params.get(PAGINATION_PARAM_NAMES.SORT));
  const activeSort = rawSort?.field && RECEIPTS_SORT_MAP[rawSort.field as ReceiptSortField]
    ? { field: rawSort.field as ReceiptSortField, direction: rawSort.direction }
    : undefined;

  // Warehouse names/codes stay on REST (GoodsReceipt has no navigation to Warehouse).
  const { data: warehouses = [] } = useWarehouses();
  const warehouseById = useMemo(() => new Map(warehouses.map((w) => [w.id, w])), [warehouses]);
  const searchWarehouseIds = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    return warehouses
      .filter((w) => w.name?.toLowerCase().includes(q) || w.code?.toLowerCase().includes(q))
      .map((w) => w.id)
      .filter((id): id is string => !!id);
  }, [warehouses, search]);

  const query = useReceiptsPage({
    size: pageSize,
    after,
    before,
    status: statusFilter || undefined,
    warehouseId: warehouseId || undefined,
    search,
    searchWarehouseIds: search ? searchWarehouseIds : undefined,
    sort: activeSort,
  });

  const { pagingProps, sortProps } = useCursorPagination({
    pageInfo: query.data?.pageInfo,
    totalCount: query.data?.totalCount,
    loading: query.isLoading || query.isFetching,
    error: query.isPlaceholderData ? undefined : query.error,
    defaultPageSize: 20,
    pageSizeOptions: RECEIPTS_PAGE_SIZES,
    urlState: true,
  });

  const pageIds = useMemo(() => (query.data?.rows ?? []).map((r) => r.id), [query.data?.rows]);
  const totalsQuery = useReceiptLineTotalsForPage(pageIds);

  const pageRows: ReceiptListItem[] = useMemo(
    () => (query.data?.rows ?? []).map((r) => {
      const wh = warehouseById.get(r.warehouseId);
      const t = totalsQuery.data?.get(r.id);
      return {
        ...r,
        code: r.receiptCode,
        warehouseCode: wh?.code ?? '',
        warehouseName: wh?.name ?? '',
        lines: [],
        batchCount: t?.batchCount ?? 0,
        totalQty: t?.totalQty ?? 0,
      };
    }),
    [query.data?.rows, warehouseById, totalsQuery.data],
  );

  const approveMutation = useApproveReceipt();
  const [approveTarget, setApproveTarget] = useState<ReceiptListItem | null>(null);

  const canCreate = can(user, 'receipts.create');
  const canApprove = can(user, 'receipts.approve');

  const handleApprove = async () => {
    if (!approveTarget) return;
    try {
      await approveMutation.mutateAsync(approveTarget.id);
      await Promise.all([
        query.refetch(),
        queryClient.refetchQueries({ queryKey: ['batches'] }),
        queryClient.refetchQueries({ queryKey: ['inventory'] }),
      ]);
      setApproveTarget(null);
    } catch {
      // Error is handled and toasted by useApiMutation
    }
  };

  // Resolve names only for visible-page users. React Query caches per ID — turning pages
  // only fetches IDs not already resolved on previous pages (no re-request for cached users).
  const visibleUserIds = useMemo(
    () => pageRows.flatMap(r => [r.createdByUserId, r.approvedByUserId]),
    [pageRows],
  );
  const users = useReceiptUserNames(visibleUserIds);

  const columns: Column<ReceiptListItem>[] = [
    {
      key: 'receiptCode',
      header: 'Mã phiếu',
      width: '140px',
      render: (r) => <span className="bold">{r.receiptCode || r.code}</span>,
    },
    {
      key: 'wh',
      header: 'Kho nhận',
      width: '180px',
      text: (r) => r.warehouseName || r.warehouseCode,
    },
    {
      key: 'createdAt',
      header: 'Thời gian tạo',
      width: '150px',
      text: (r) => formatDateTime(r.createdAt),
    },
    {
      key: 'receivedAt',
      header: 'Thời gian nhập',
      width: '150px',
      text: (r) => (r.receivedAt ? formatDateTime(r.receivedAt) : '—'),
    },
    {
      key: 'by',
      header: 'Người tạo',
      width: '130px',
      text: (r) => users.nameOf(r.createdByUserId),
    },
    {
      key: 'approvedBy',
      header: 'Người duyệt',
      width: '130px',
      text: (r) => users.approverOf(r),
    },
    {
      key: 'batches',
      header: 'Số dòng',
      width: '90px',
      align: 'right',
      text: (r) => r.batchCount ?? r.lines?.length ?? 0,
    },
    {
      key: 'qty',
      header: 'Tổng SL',
      width: '110px',
      align: 'right',
      text: (r) => formatCases(r.totalQty ?? 0),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '130px',
      render: (r) => <StatusChip domain="receipt" value={r.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Nhập kho"
        subtitle="Quản lý và tiếp nhận hàng hóa từ nhà sản xuất vào kho tổng và kho vùng."
        actions={
          canCreate ? (
            <Button variant="primary" onClick={() => navigate('/receipts/new')}>
              + Tạo phiếu nhập
            </Button>
          ) : undefined
        }
      />

      <div className="row-wrap" style={{ gap: 12, marginBottom: 8 }}>
        <label className="lbl">Trạng thái
          <Select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as ReceiptStatusFilter)}
            options={[
              { value: '', label: 'Tất cả trạng thái' },
              { value: 'Pending', label: statusLabels.receipt.Pending },
              { value: 'Received', label: statusLabels.receipt.Received },
            ]}
          />
        </label>
        <label className="lbl">Kho nhận
          <Select
            value={warehouseId}
            onChange={e => setWarehouseId(e.target.value)}
            options={[
              { value: '', label: 'Tất cả kho' },
              ...warehouses.filter(w => w.id).map(w => ({ value: w.id as string, label: w.name })),
            ]}
          />
        </label>
        <label className="lbl">Thời gian tạo<Select value={activeSort?.field === 'createdAt' ? activeSort.direction : 'desc'} onChange={e => sortProps.onChange('createdAt', e.target.value as 'desc' | 'asc')} options={[{ value: 'desc', label: 'Mới nhất' }, { value: 'asc', label: 'Cũ nhất' }]} /></label>
      </div>

      <DataTable
        title="Danh sách phiếu nhập kho"
        rows={pageRows}
        loading={query.isLoading || query.isPlaceholderData}
        error={query.isPlaceholderData ? undefined : query.error}
        rowKey={(r) => r.id || r.receiptCode || r.code}
        columns={columns}
        searchPlaceholder="Mã phiếu, kho nhận…"
        cursor={pagingProps}
        serverSort={{ ...sortProps, sortableFields: RECEIPTS_SORTABLE_FIELDS }}
        onRowClick={(r) => navigate(`/receipts/${r.receiptCode || r.id}`)}
        rowActionsWidth="120px"
        rowActions={(r) => {
          const isPending = r.status === 'Pending';
          const secondaryActions: ActionDropdownItem[] = [];

          if (isPending && canApprove) {
            secondaryActions.push({
              key: 'approve',
              label: 'Duyệt phiếu nhập',
              color: 'var(--c-primary, #14655B)',
              onClick: () => setApproveTarget(r),
            });
          }

          return (
            <div
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={(e) => e.stopPropagation()}
            >
              <Button size="sm" onClick={() => navigate(`/receipts/${r.receiptCode || r.id}`)}>
                Xem
              </Button>
              {secondaryActions.length > 0 && <ActionDropdown items={secondaryActions} />}
            </div>
          );
        }}
      />

      {approveTarget && (
        <ConfirmDialog
          open={Boolean(approveTarget)}
          title="Xác nhận duyệt phiếu nhập kho"
          confirmLabel={approveMutation.isPending ? 'Đang duyệt…' : 'Duyệt & ghi sổ kho'}
          onConfirm={handleApprove}
          onClose={() => {
            if (!approveMutation.isPending) setApproveTarget(null);
          }}
          message={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ margin: 0 }}>
                Xác nhận duyệt phiếu nhập kho <b>{approveTarget.receiptCode}</b>?
              </p>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--c-muted, #555)',
                  padding: '8px 12px',
                  background: 'var(--c-surface-2, #F8F9FA)',
                  borderRadius: 6,
                  lineHeight: 1.6,
                }}
              >
                <div>Kho nhận: <b>{approveTarget.warehouseName || approveTarget.warehouseCode}</b></div>
                <div>Số dòng hàng: <b>{approveTarget.batchCount}</b></div>
                <div>Tổng số lượng: <b>{formatCases(approveTarget.totalQty)}</b></div>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--c-text-muted, #666)' }}>
                Khi duyệt phiếu, hệ thống sẽ chính thức ghi nhận số lượng vào <b>tồn kho thực tế</b> và khởi tạo hoặc cập nhật các lô hàng tương ứng.
              </p>
            </div>
          }
        />
      )}
    </>
  );
}
