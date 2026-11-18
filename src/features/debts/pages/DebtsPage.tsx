import { useMemo, useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { useEnumParam, useQueryParams } from '@/shared/router/listState';
import { useRestPagination } from '@/shared/pagination';
import {
  Button,
  Callout,
  DataTable,
  FormDialog,
  Input,
  PageHeader,
  Select,
  Stat,
  StatusChip,
  type Column,
} from '@/shared/ui';
import { formatDate, formatMoney, statusLabels, toIsoDateTime, vietnamDateTimeToIso } from '@/shared/lib';
import { useCollectReceivable, useReceivables } from '../hooks';
import type { Receivable, ReceivableStatus } from '../types';
import { useOrderSales } from '@/features/orders/orderSales';
import {
  useCreateRefund,
  useRefunds,
  useSubmitRefundEvidence,
  useVerifyRefund,
  type Refund,
} from '../refunds';

const RECEIVABLE_STATUSES = ['', 'Unpaid', 'PartiallyPaid', 'Paid', 'Overdue', 'Cancelled'] as const;
type ReceivableStatusFilter = (typeof RECEIVABLE_STATUSES)[number];

/** Staff monitoring and alternate confirmed-collection workflow. Retailer PayOS settlement lives on Mobile. */
export function DebtsPage() {
  const { user } = useAuth();
  const mayCollect = can(user, 'payments.collect');
  const navigate = useNavigate();

  // ── Receivables: URL-persisted pagination (client-side — GraphQL receivables returns flat array)
  const { page, pageSize, search, setSearch, pagingProps: basePagingProps } = useRestPagination({
    defaultPageSize: 20,
    pageSizeOptions: [10, 20, 50],
    urlState: true,
  });
  const [statusFilter, setStatusFilter] = useEnumParam<ReceivableStatusFilter>(
    'status', RECEIVABLE_STATUSES, '', { resets: ['page'] },
  );
  const { setParams } = useQueryParams();
  const hasActiveFilters = !!(search || statusFilter);
  const clearFilters = () => setParams({ status: null, q: null, page: null });

  // ── Refunds: separate URL-persisted pagination (stateKey namespaces the URL params)
  const {
    page: refundPage,
    pageSize: refundPageSize,
    pagingProps: refundBasePagingProps,
  } = useRestPagination({
    defaultPageSize: 20,
    pageSizeOptions: [10, 20, 50],
    urlState: true,
    stateKey: 'ref',
  });

  const query = useReceivables();
  const collect = useCollectReceivable();
  const refunds = useRefunds();
  const createRefund = useCreateRefund();
  const submitEvidence = useSubmitRefundEvidence();
  const verifyRefund = useVerifyRefund();

  const [target, setTarget] = useState<Receivable | null>(null);
  const [refundTarget, setRefundTarget] = useState<Receivable | null>(null);
  const [evidenceTarget, setEvidenceTarget] = useState<Refund | null>(null);
  const [verifyTarget, setVerifyTarget] = useState<Refund | null>(null);

  // Full dataset — stats and callout always use the global totals, not page/filter totals
  const rows = useMemo(() => query.data ?? [], [query.data]);
  const { salesNameOf, salesSearchTextOf } = useOrderSales(rows.map((row) => row.salesUserId));
  const sum = (s: ReceivableStatus) => rows.filter((r) => r.status === s).reduce((a, r) => a + r.outstandingAmount, 0);

  // Client-side filtering for receivables list
  const filtered = useMemo(() => {
    let result = rows;
    if (search) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.orderCode.toLowerCase().includes(q) ||
          r.retailerName.toLowerCase().includes(q) ||
          r.retailerCode.toLowerCase().includes(q) ||
          salesSearchTextOf(r.salesUserId).toLowerCase().includes(q),
      );
    }
    if (statusFilter) {
      result = result.filter((r) => r.status === statusFilter);
    }
    return result;
  }, [rows, search, statusFilter, salesSearchTextOf]);

  // Pagination on filtered results
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pagingProps = { ...basePagingProps, total: totalCount, totalPages };

  // Refunds pagination (no search/filter — small dataset managed by Operator/Admin only)
  const allRefunds = refunds.data ?? [];
  const refundTotalCount = allRefunds.length;
  const refundTotalPages = Math.max(1, Math.ceil(refundTotalCount / refundPageSize));
  const refundCurrentPage = Math.min(refundPage, refundTotalPages);
  const refundPageRows = allRefunds.slice((refundCurrentPage - 1) * refundPageSize, refundCurrentPage * refundPageSize);
  const refundPagingProps = { ...refundBasePagingProps, total: refundTotalCount, totalPages: refundTotalPages };

  const columns: Column<Receivable>[] = [
    { key: 'orderCode', header: 'Mã đơn', width: '104px', render: (r) => <span className="bold">{r.orderCode}</span> },
    { key: 'retailer', header: 'Điểm bán', text: (r) => `${r.retailerName} ${r.retailerCode}`, render: (r) => (<><div className="strong">{r.retailerName}</div><div className="muted small">{r.retailerCode}</div></>) },
    { key: 'sales', header: 'Nhân viên bán hàng', width: '160px', text: (r) => salesSearchTextOf(r.salesUserId), render: (r) => <span className="strong">{salesNameOf(r.salesUserId)}</span> },
    { key: 'term', header: 'Kỳ hạn', width: '80px', text: (r) => `${r.creditTermDays} ngày` },
    { key: 'delivered', header: 'Ngày giao', width: '110px', text: (r) => r.deliveredDate ? formatDate(r.deliveredDate) : 'Chưa giao' },
    { key: 'due', header: 'Hạn thanh toán', width: '130px', text: (r) => r.dueDate ? formatDate(r.dueDate) : 'Chưa phát sinh' },
    { key: 'total', header: 'Giá trị điều chỉnh', width: '120px', align: 'right', text: (r) => formatMoney(r.adjustedAmount) },
    { key: 'out', header: 'Còn phải thu', width: '120px', align: 'right', text: (r) => formatMoney(r.outstandingAmount) },
    { key: 'refund', header: 'Cần hoàn', width: '110px', align: 'right', text: (r) => formatMoney(r.refundDueAmount) },
    { key: 'status', header: 'Trạng thái', width: '110px', render: (r) => <StatusChip domain="receivable" value={r.status} /> },
  ];

  return (
    <>
      <PageHeader title="Công nợ" subtitle="Theo dõi số dư từng đơn sau các lần cấn tự động. điểm bán thanh toán một hoặc nhiều khoản qua PayOS trên Mobile." />
      <div className="grid-3">
        {/* Stats always reflect global totals (full rows dataset, not filtered/paged) */}
        <Stat label="Chưa thu (trong hạn)" value={formatMoney(sum('Unpaid'))} />
        <Stat label="Quá hạn" value={formatMoney(sum('Overdue'))} color="var(--c-danger)" note={`${rows.filter((r) => r.status === 'Overdue').length} đơn`} />
        <Stat label="Đã thu" value={rows.filter((r) => r.status === 'Paid').length + ' đơn'} />
      </div>
      {rows.some((r) => r.status === 'Overdue') && <Callout tone="danger">Có đơn quá hạn thanh toán – lọc "Quá hạn" để xem và liên hệ nhân viên bán hàng phụ trách.</Callout>}
      <div className="row-wrap" style={{ gap: 12, marginBottom: 12 }}>
        <label className="lbl">Tìm kiếm<Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Mã đơn, điểm bán, nhân viên bán hàng…" /></label>
        <label className="lbl">Trạng thái<Select value={statusFilter} onChange={e => setStatusFilter(e.target.value as ReceivableStatusFilter)}
          options={[{ value: '', label: 'Tất cả trạng thái' }, ...RECEIVABLE_STATUSES.filter(Boolean).map(value => ({ value, label: statusLabels.receivable[value as Exclude<ReceivableStatusFilter, ''>] }))]} /></label>
        {hasActiveFilters && <Button onClick={clearFilters}>Xóa bộ lọc</Button>}
      </div>
      <DataTable
        title="Danh sách công nợ"
        searchable={false}
        rows={pageRows}
        loading={query.isLoading}
        error={query.error}
        rowKey={(r) => r.orderId}
        columns={columns}
        server={pagingProps}
        onRowClick={(r) => navigate(`/orders/${r.orderId}`)}
        rowActionsWidth="200px"
        rowActions={(r) => (
          <>
            <Button size="sm" onClick={() => navigate(`/orders/${r.orderId}`)}>Xem đơn</Button>
            {mayCollect && (r.status === 'Unpaid' || r.status === 'Overdue') && (
              <Button size="sm" variant="primary" onClick={() => setTarget(r)}>
                Ghi nhận đã thu
              </Button>
            )}
            {user?.role === 'Operator' && r.refundDueAmount > 0 && (
              <Button size="sm" variant="primary" onClick={() => setRefundTarget(r)}>
                Tạo phiếu hoàn
              </Button>
            )}
          </>
        )}
      />

      <FormDialog
        open={mayCollect && !!target}
        width={540}
        columns={1}
        title={`Ghi nhận thu tiền · ${target?.orderCode ?? ''}`}
        submitLabel="Xác nhận đã thu đủ"
        initial={{ method: 'BankTransfer' }}
        fields={[
          { key: 'info', type: 'info', label: 'Điểm bán / số tiền', info: () => `${target?.retailerName} · ${formatMoney(target?.outstandingAmount)}` },
          { key: 'method', type: 'info', label: 'Hình thức thu', info: () => 'Chuyển khoản đã đối soát' },
        ]}
        note="Thu đủ khoản được phép thu của đơn. Điểm tích lũy chỉ được xét khi đơn hoàn tất đủ điều kiện nhận hàng, đối soát tiền và xử lý khiếu nại."
        onClose={() => setTarget(null)}
        onSubmit={async (values) => {
          if (!mayCollect || !target) return;
          await collect.mutateAsync({
            orderId: target.orderId,
            collectionMethod: values.method,
            expectedVersion: target.version,
            operationKey: crypto.randomUUID(),
          });
          setTarget(null);
        }}
      />

      <DataTable
        stateKey="refunds"
        title="Phiếu hoàn tiền"
        rows={refundPageRows}
        loading={refunds.isLoading}
        error={refunds.error}
        rowKey={(refund) => refund.id}
        columns={[
          { key: 'order', header: 'Đơn', text: (refund) => refund.orderCode },
          { key: 'recipient', header: 'Người nhận', text: (refund) => refund.recipient },
          { key: 'amount', header: 'Số tiền', align: 'right', text: (refund) => formatMoney(refund.amount) },
          { key: 'reason', header: 'Lý do', text: (refund) => refund.reason },
          { key: 'status', header: 'Trạng thái', text: (refund) => refund.status === 'PendingRefund' ? 'Chờ hoàn' : refund.status === 'AwaitingVerification' ? 'Chờ quản trị viên xác minh' : 'Đã hoàn' },
        ]}
        server={refundPagingProps}
        rowActions={(refund) => (
          <>
            {user?.role === 'Operator' && refund.status === 'PendingRefund' && (
              <Button size="sm" onClick={() => setEvidenceTarget(refund)}>Nộp bằng chứng</Button>
            )}
            {user?.role === 'Admin' && refund.status === 'AwaitingVerification' && (
              <Button size="sm" variant="primary" onClick={() => setVerifyTarget(refund)}>Xác minh</Button>
            )}
          </>
        )}
      />

      <FormDialog
        open={user?.role === 'Operator' && !!refundTarget}
        width={560}
        columns={1}
        title={`Tạo phiếu hoàn · ${refundTarget?.orderCode ?? ''}`}
        submitLabel="Tạo phiếu"
        initial={{
          amount: refundTarget?.refundDueAmount ?? 0,
          recipient: refundTarget?.retailerName ?? '',
          reason: 'Hoàn chênh lệch sau điều chỉnh được duyệt',
        }}
        fields={[
          { key: 'amount', type: 'number', required: true, label: 'Số tiền hoàn' },
          { key: 'recipient', required: true, label: 'Người nhận' },
          { key: 'reason', type: 'textarea', required: true, label: 'Lý do' },
        ]}
        onClose={() => setRefundTarget(null)}
        onSubmit={async (values) => {
          if (!refundTarget) return;
          await createRefund.mutateAsync({
            salesOrderId: refundTarget.orderId,
            amount: values.amount,
            recipient: values.recipient,
            reason: values.reason,
            operationKey: crypto.randomUUID(),
          });
          setRefundTarget(null);
        }}
      />

      <FormDialog
        open={user?.role === 'Operator' && !!evidenceTarget}
        width={560}
        columns={1}
        title={`Bằng chứng hoàn tiền · ${evidenceTarget?.orderCode ?? ''}`}
        submitLabel="Gửi quản trị viên xác minh"
        initial={{ transferredAt: toIsoDateTime(new Date()), transactionReference: '', evidenceReference: '' }}
        fields={[
          {
            key: 'transferredAt', type: 'datetime-local', required: true, label: 'Thời điểm chuyển (giờ Việt Nam)',
            validate: value => {
              try {
                return Date.parse(vietnamDateTimeToIso(String(value))) > Date.now() ? 'Thời điểm chuyển không được ở tương lai.' : undefined;
              } catch { return 'Nhập ngày và giờ hợp lệ.'; }
            },
          },
          { key: 'transactionReference', required: true, label: 'Mã giao dịch' },
          { key: 'evidenceReference', required: true, label: 'Link / mã bằng chứng' },
        ]}
        onClose={() => setEvidenceTarget(null)}
        onSubmit={async (values) => {
          if (!evidenceTarget) return;
          await submitEvidence.mutateAsync({
            id: evidenceTarget.id,
            expectedVersion: evidenceTarget.version,
            transferredAt: vietnamDateTimeToIso(values.transferredAt),
            transactionReference: values.transactionReference,
            evidenceReference: values.evidenceReference,
            operationKey: crypto.randomUUID(),
          });
          setEvidenceTarget(null);
        }}
      />

      <FormDialog
        open={user?.role === 'Admin' && !!verifyTarget}
        width={560}
        columns={1}
        title={`Xác minh hoàn tiền · ${verifyTarget?.orderCode ?? ''}`}
        submitLabel="Xác nhận quyết định"
        initial={{ decision: 'approve', note: '' }}
        fields={[
          {
            key: 'decision', type: 'select', required: true, label: 'Quyết định',
            options: [
              { value: 'approve', label: 'Duyệt bằng chứng' },
              { value: 'reject', label: 'Sai bằng chứng – yêu cầu nộp lại' },
            ],
          },
          { key: 'note', type: 'textarea', label: 'Ghi chú', required: true },
        ]}
        onClose={() => setVerifyTarget(null)}
        onSubmit={async (values) => {
          if (!verifyTarget) return;
          await verifyRefund.mutateAsync({
            id: verifyTarget.id,
            expectedVersion: verifyTarget.version,
            approved: values.decision === 'approve',
            note: values.note,
            operationKey: crypto.randomUUID(),
          });
          setVerifyTarget(null);
        }}
      />
    </>
  );
}
