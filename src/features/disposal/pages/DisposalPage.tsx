import { useMemo, useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import {
  ActionDropdown,
  Button,
  Callout,
  ConfirmDialog,
  DataTable,
  PageHeader,
  StatusChip,
  type Column,
} from '@/shared/ui';
import { formatCases, formatDateTime, formatMoney } from '@/shared/lib';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { Check, FileText, X } from 'lucide-react';
import {
  useApproveDisposal,
  useDisposalCandidates,
  useDisposals,
  useRejectDisposal,
} from '../hooks';
import type { Disposal } from '../types';

export function DisposalPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreate = can(user, 'disposal.create');
  const canApprove = can(user, 'disposal.approve');

  const isKeeper = user?.role === 'WarehouseKeeper';
  const assignedWhIds = useMemo(() => user?.scope?.warehouseIds ?? [], [user]);
  const assignedWhCode = user?.warehouseCode;

  // Real backend queries
  const disposalsQuery = useDisposals();
  const candidatesQuery = useDisposalCandidates();
  const approveMutation = useApproveDisposal();
  const rejectMutation = useRejectDisposal();

  const [approvingDisposal, setApprovingDisposal] = useState<Disposal | null>(null);
  const [rejectingDisposal, setRejectingDisposal] = useState<Disposal | null>(null);

  // Scoped list of disposals
  const disposals = useMemo(() => {
    const list = disposalsQuery.data ?? [];
    if (!isKeeper || (assignedWhIds.length === 0 && !assignedWhCode)) {
      return list;
    }
    return list.filter(
      (d) =>
        (assignedWhIds.length > 0 && d.warehouseId && assignedWhIds.includes(d.warehouseId)) ||
        (assignedWhCode &&
          (d.warehouseCode === assignedWhCode || d.warehouseName.includes(assignedWhCode))),
    );
  }, [disposalsQuery.data, isKeeper, assignedWhIds, assignedWhCode]);

  // Scoped candidates count
  const candidateCount = useMemo(() => {
    const list = candidatesQuery.data ?? [];
    if (!isKeeper || (assignedWhIds.length === 0 && !assignedWhCode)) {
      return list.length;
    }
    return list.filter(
      (c) =>
        (assignedWhIds.length > 0 && assignedWhIds.includes(c.warehouseId)) ||
        (assignedWhCode &&
          (c.warehouseCode === assignedWhCode || c.warehouseName.includes(assignedWhCode))),
    ).length;
  }, [candidatesQuery.data, isKeeper, assignedWhIds, assignedWhCode]);

  const handleApprove = async () => {
    if (!approvingDisposal) return;
    await approveMutation.mutateAsync(approvingDisposal.id || approvingDisposal.code);
    setApprovingDisposal(null);
  };

  const handleReject = async () => {
    if (!rejectingDisposal) return;
    await rejectMutation.mutateAsync({
      id: rejectingDisposal.id || rejectingDisposal.code,
      reason: 'Kiểm tra lại số lượng thực tế',
    });
    setRejectingDisposal(null);
  };

  const columns: Column<Disposal>[] = [
    {
      key: 'code',
      header: 'Mã phiếu',
      width: '140px',
      render: (d) => <span className="bold">{d.code}</span>,
      text: (d) => d.code,
    },
    {
      key: 'wh',
      header: 'Kho',
      width: '160px',
      text: (d) => d.warehouseName,
    },
    {
      key: 'at',
      header: 'Thời gian',
      width: '160px',
      text: (d) => formatDateTime(d.createdAt),
    },
    {
      key: 'by',
      header: 'Người lập',
      width: '140px',
      text: (d) => d.createdBy,
    },
    {
      key: 'reason',
      header: 'Lý do',
      width: '150px',
      text: (d) => d.reason,
    },
    {
      key: 'method',
      header: 'Hình thức',
      width: '150px',
      text: (d) => d.method,
    },
    {
      key: 'batches',
      header: 'Số batch',
      width: '90px',
      align: 'right',
      text: (d) => d.batchCount,
    },
    {
      key: 'qty',
      header: 'Tổng SL',
      width: '110px',
      align: 'right',
      text: (d) => formatCases(d.totalQty),
    },
    {
      key: 'value',
      header: 'Giá trị',
      width: '130px',
      align: 'right',
      text: (d) => formatMoney(d.totalValue),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '130px',
      render: (d) => <StatusChip domain="disposal" value={d.status} />,
      text: (d) => d.status,
    },
  ];

  return (
    <>
      <PageHeader
        title="Hủy hàng hết hạn"
        subtitle="Quản lý danh sách phiếu hủy hàng hết hạn hoặc hư hỏng đã được khóa."
        actions={
          canCreate ? (
            <Button variant="primary" onClick={() => navigate('/disposal/new')}>
              + Lập phiếu hủy {candidateCount > 0 ? `(${candidateCount} batch hết hạn)` : ''}
            </Button>
          ) : null
        }
      />

      {candidateCount > 0 && (
        <Callout tone="warn">
          Có <b>{candidateCount}</b> batch đã hết hạn hoặc có hàng bị khóa còn tồn trong kho, cần lập phiếu hủy.
        </Callout>
      )}

      <DataTable
        title="Danh sách phiếu hủy hàng"
        rows={disposals}
        loading={disposalsQuery.isLoading}
        error={disposalsQuery.error}
        rowKey={(d) => d.id || d.code}
        columns={columns}
        searchPlaceholder="Tìm kiếm mã phiếu, kho, lý do…"
        filters={[
          {
            label: 'Kho',
            options: [...new Set(disposals.map((d) => d.warehouseName).filter(Boolean))],
            value: (d) => d.warehouseName,
          },
          {
            label: 'Hình thức',
            options: ['Tiêu hủy tại kho', 'Trả nhà cung cấp'],
            value: (d) => d.method,
          },
          {
            label: 'Trạng thái',
            options: ['Chờ duyệt', 'Đã tiêu hủy', 'Bị từ chối'],
            value: (d) => (d.status === 'Pending' ? 'Chờ duyệt' : d.status === 'Disposed' ? 'Đã tiêu hủy' : d.status),
          },
        ]}
        emptyText="Chưa có phiếu hủy hàng nào."
        onRowClick={(d) => navigate(`/disposal/${encodeURIComponent(d.id || d.code)}`)}
        rowActionHeader="Thao tác"
        rowActionsWidth="110px"
        rowActions={(d) => {
          const isPending = d.status === 'Pending' || d.status === 'Chờ duyệt' || d.status === 'Chờ Admin duyệt';

          const dropdownItems = [
            ...(isPending && canApprove
              ? [
                  {
                    key: 'approve',
                    label: 'Duyệt hủy',
                    icon: <Check size={14} />,
                    color: '#1b7a42',
                    onClick: () => setApprovingDisposal(d),
                  },
                  {
                    key: 'reject',
                    label: 'Từ chối',
                    icon: <X size={14} />,
                    color: '#B42318',
                    onClick: () => setRejectingDisposal(d),
                  },
                ]
              : []),
            {
              key: 'print',
              label: 'In biên bản hủy',
              icon: <FileText size={14} />,
              color: '#2b5ea7',
              onClick: () => navigate(`/disposal/${encodeURIComponent(d.id || d.code)}`),
            },
          ];

          return (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                justifyContent: 'flex-end',
                width: '100%',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                size="sm"
                onClick={() => navigate(`/disposal/${encodeURIComponent(d.id || d.code)}`)}
              >
                Xem
              </Button>
              {dropdownItems.length > 0 && <ActionDropdown items={dropdownItems} />}
            </div>
          );
        }}
      />

      {/* Approval Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(approvingDisposal)}
        title="Xác nhận duyệt phiếu xuất hủy"
        message={
          approvingDisposal ? (
            <div>
              <p style={{ margin: 0 }}>
                Bạn có chắc chắn muốn duyệt phiếu hủy <b>{approvingDisposal.code}</b> tại{' '}
                <b>{approvingDisposal.warehouseName}</b>?
              </p>
              <p className="muted small" style={{ marginTop: 8 }}>
                Sau khi duyệt, hệ thống sẽ trừ tồn kho thực tế của các batch tương ứng và ghi nhận lịch sử xuất hủy.
              </p>
            </div>
          ) : null
        }
        confirmLabel="Duyệt hủy"
        confirmVariant="primary"
        onClose={() => setApprovingDisposal(null)}
        onConfirm={handleApprove}
      />

      {/* Reject Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(rejectingDisposal)}
        title="Từ chối duyệt phiếu xuất hủy"
        message={
          rejectingDisposal ? (
            <p style={{ margin: 0 }}>
              Xác nhận từ chối phiếu hủy <b>{rejectingDisposal.code}</b>? Phiếu sẽ chuyển sang trạng thái bị từ chối và tồn kho được giữ nguyên.
            </p>
          ) : null
        }
        confirmLabel="Từ chối"
        danger
        onClose={() => setRejectingDisposal(null)}
        onConfirm={handleReject}
      />
    </>
  );
}
