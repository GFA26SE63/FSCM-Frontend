import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@/shared/router/compat';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import {
  ActionDropdown,
  type ActionDropdownItem,
  Button,
  ConfirmDialog,
  DataTable,
  PageHeader,
  StatusChip,
  type Column,
} from '@/shared/ui';
import { formatCases, formatDateTime, statusLabels } from '@/shared/lib';
import { useApproveReceipt, useReceipts } from '../hooks';
import type { ReceiptListItem } from '../types';

export function ReceiptsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
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
      text: (r) => (r.createdByUserId ? `${r.createdByUserId.slice(0, 8)}…` : '—'),
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

  const warehouseOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of query.data ?? []) {
      const name = r.warehouseName || r.warehouseCode;
      if (name) set.add(name);
    }
    return Array.from(set);
  }, [query.data]);

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

      <DataTable
        title="Danh sách phiếu nhập kho"
        rows={query.data}
        loading={query.isLoading}
        error={query.error}
        rowKey={(r) => r.id || r.receiptCode || r.code}
        columns={columns}
        searchPlaceholder="Mã phiếu, kho nhận, người tạo…"
        filters={[
          {
            label: 'Kho',
            options: warehouseOptions,
            value: (r) => r.warehouseName || r.warehouseCode,
          },
          {
            label: 'Trạng thái',
            options: [statusLabels.receipt.Pending, statusLabels.receipt.Received],
            value: (r) =>
              statusLabels.receipt[r.status as keyof typeof statusLabels.receipt] ?? r.status,
          },
        ]}
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
