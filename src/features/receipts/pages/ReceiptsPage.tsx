import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@/shared/router/compat';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { useEnumParam } from '@/shared/router/listState';
import { useRestPagination } from '@/shared/pagination';
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
import { useApproveReceipt, useReceipts } from '../hooks';
import { useReceiptUserNames } from '../userNames';
import type { ReceiptListItem } from '../types';

const RECEIPT_STATUSES = ['', 'Pending', 'Received'] as const;
type ReceiptStatusFilter = (typeof RECEIPT_STATUSES)[number];

export function ReceiptsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // URL-persisted pagination state (client-side data — GET /api/v1/goods-receipts returns flat array)
  const { page, pageSize, search, pagingProps: basePagingProps } = useRestPagination({
    defaultPageSize: 20,
    pageSizeOptions: [10, 20, 50],
    urlState: true,
  });
  const [statusFilter, setStatusFilter] = useEnumParam<ReceiptStatusFilter>(
    'status', RECEIPT_STATUSES, '', { resets: ['page'] },
  );
  const [warehouseFilter, setWarehouseFilter] = useState('');

  // Load full dataset — no server-side pagination or search available
  const query = useReceipts();

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

  // Warehouse options derived from full data
  const warehouseOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of query.data ?? []) {
      const name = r.warehouseName || r.warehouseCode;
      if (name) set.add(name);
    }
    return Array.from(set).sort();
  }, [query.data]);

  // Client-side filtering across the full dataset
  const filtered = useMemo(() => {
    let result = query.data ?? [];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        (r.receiptCode || r.code)?.toLowerCase().includes(q) ||
        r.warehouseName?.toLowerCase().includes(q) ||
        r.warehouseCode?.toLowerCase().includes(q),
      );
    }
    if (warehouseFilter) {
      result = result.filter(r => (r.warehouseName || r.warehouseCode) === warehouseFilter);
    }
    if (statusFilter) {
      result = result.filter(r => r.status === statusFilter);
    }
    return result;
  }, [query.data, search, warehouseFilter, statusFilter]);

  // Client-side pagination on filtered results
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pagingProps = { ...basePagingProps, total: totalCount, totalPages };

  // Resolve names only for visible-page users. React Query caches per ID — turning pages
  // only fetches IDs not already resolved on previous pages (no re-request for cached users).
  const visibleUserIds = useMemo(
    () => pageRows.flatMap(r => [r.createdByUserId, r.approvedByUserId]),
    [pageRows],
  );
  const users = useReceiptUserNames(visibleUserIds);

  const columns: Column<ReceiptListItem>[] = [
    {
      key: 'code',
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

      {/* Filter bar — client-side (Backend: GET /api/v1/goods-receipts only accepts warehouseId) */}
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
            value={warehouseFilter}
            onChange={e => { setWarehouseFilter(e.target.value); basePagingProps.onPageChange(1); }}
            options={[
              { value: '', label: 'Tất cả kho' },
              ...warehouseOptions.map(w => ({ value: w, label: w })),
            ]}
          />
        </label>
      </div>

      <DataTable
        title="Danh sách phiếu nhập kho"
        rows={pageRows}
        loading={query.isLoading}
        error={query.error}
        rowKey={(r) => r.id || r.receiptCode || r.code}
        columns={columns}
        searchPlaceholder="Mã phiếu, kho nhận…"
        server={pagingProps}
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
