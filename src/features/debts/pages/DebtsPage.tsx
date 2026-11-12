import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { Button, Callout, DataTable, FormDialog, PageHeader, Stat, StatusChip, type Column } from '@/shared/ui';
import { formatDate, formatMoney, statusLabel } from '@/shared/lib';
import { useCollectReceivable, useReceivables } from '../hooks';
import type { Receivable } from '../types';
import {
  useCreateRefund,
  useRefunds,
  useSubmitRefundEvidence,
  useVerifyRefund,
  type Refund,
} from '../refunds';

/** Staff monitoring and alternate confirmed-collection workflow. Retailer PayOS settlement lives on Mobile. */
export function DebtsPage() {
  const { user } = useAuth();
  const mayCollect = can(user, 'payments.collect');
  const navigate = useNavigate();
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
  const rows = query.data ?? [];
  const sum = (s: string) => rows.filter((r) => r.status === s).reduce((a, r) => a + r.outstandingAmount, 0);

  const columns: Column<Receivable>[] = [
    { key: 'orderCode', header: 'Mã đơn', width: '104px', render: (r) => <span className="bold">{r.orderCode}</span> },
    { key: 'retailer', header: 'Retailer', text: (r) => `${r.retailerName} ${r.retailerCode}`, render: (r) => (<><div className="strong">{r.retailerName}</div><div className="muted small">{r.retailerCode}</div></>) },
    { key: 'sales', header: 'Sales ID', width: '130px', text: (r) => r.salesUserId },
    { key: 'term', header: 'Kỳ hạn', width: '80px', text: (r) => `${r.creditTermDays} ngày` },
    { key: 'delivered', header: 'Ngày giao', width: '100px', text: (r) => r.deliveredDate ? formatDate(r.deliveredDate) : '—' },
    { key: 'due', header: 'Hạn thanh toán', width: '120px', text: (r) => r.dueDate ? formatDate(r.dueDate) : '—' },
    { key: 'total', header: 'Giá trị điều chỉnh', width: '120px', align: 'right', text: (r) => formatMoney(r.adjustedAmount) },
    { key: 'out', header: 'Còn phải thu', width: '120px', align: 'right', text: (r) => formatMoney(r.outstandingAmount) },
    { key: 'refund', header: 'Cần hoàn', width: '110px', align: 'right', text: (r) => formatMoney(r.refundDueAmount) },
    { key: 'status', header: 'Trạng thái', width: '110px', render: (r) => <StatusChip domain="receivable" value={r.status} /> },
  ];

  return (
    <>
      <PageHeader title="Công nợ" subtitle="Theo dõi số dư từng đơn sau các lần cấn tự động. Retailer thanh toán một hoặc nhiều khoản qua PayOS trên Mobile." />
      <div className="grid-3">
        <Stat label="Chưa thu (trong hạn)" value={formatMoney(sum('Unpaid'))} />
        <Stat label="Quá hạn" value={formatMoney(sum('Overdue'))} color="var(--c-danger)" note={`${rows.filter((r) => r.status === 'Overdue').length} đơn`} />
        <Stat label="Đã thu" value={rows.filter((r) => r.status === 'Paid').length + ' đơn'} />
      </div>
      {rows.some((r) => r.status === 'Overdue') && <Callout tone="danger">Có đơn quá hạn thanh toán – lọc "Quá hạn" để xem và liên hệ Sales phụ trách.</Callout>}
      <DataTable
        title="Danh sách công nợ"
        rows={rows}
        loading={query.isLoading}
        error={query.error}
        rowKey={(r) => r.orderId}
        columns={columns}
        searchPlaceholder="Mã đơn, retailer, Sales…"
        filters={[{ label: 'Trạng thái', options: ['Chưa thu', 'Đã thu đủ', 'Quá hạn', 'Đã hủy'], value: (r) => statusLabel('receivable', r.status) }]}
        onRowClick={(r) => navigate(`/orders/${r.orderId}`)}
        rowActionsWidth="200px"
        rowActions={(r) => (
          <>
            <Button size="sm" onClick={() => navigate(`/orders/${r.orderId}`)}>Xem đơn</Button>
            {mayCollect && (r.status === 'Unpaid' || r.status === 'Overdue') && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => setTarget(r)}
              >
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
          { key: 'info', type: 'info', label: 'Retailer / số tiền', info: () => `${target?.retailerName} · ${formatMoney(target?.outstandingAmount)}` },
          { key: 'method', type: 'info', label: 'Hình thức thu', info: () => 'Chuyển khoản đã đối soát' },
        ]}
        note="Thu một lần đủ số tiền. Sau khi xác nhận, điểm loyalty của đơn được cộng cho retailer."
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
        rows={refunds.data ?? []}
        loading={refunds.isLoading}
        error={refunds.error}
        rowKey={(refund) => refund.id}
        columns={[
          { key: 'order', header: 'Đơn', text: (refund) => refund.orderCode },
          { key: 'recipient', header: 'Người nhận', text: (refund) => refund.recipient },
          { key: 'amount', header: 'Số tiền', align: 'right', text: (refund) => formatMoney(refund.amount) },
          { key: 'reason', header: 'Lý do', text: (refund) => refund.reason },
          { key: 'status', header: 'Trạng thái', text: (refund) => refund.status === 'PendingRefund' ? 'Chờ hoàn' : refund.status === 'AwaitingVerification' ? 'Chờ Admin xác minh' : 'Đã hoàn' },
        ]}
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
        submitLabel="Gửi Admin xác minh"
        initial={{ transferredAt: new Date().toISOString().slice(0, 16), transactionReference: '', evidenceReference: '' }}
        fields={[
          { key: 'transferredAt', type: 'datetime-local', required: true, label: 'Thời điểm chuyển' },
          { key: 'transactionReference', required: true, label: 'Mã giao dịch' },
          { key: 'evidenceReference', required: true, label: 'Link / mã bằng chứng' },
        ]}
        onClose={() => setEvidenceTarget(null)}
        onSubmit={async (values) => {
          if (!evidenceTarget) return;
          await submitEvidence.mutateAsync({
            id: evidenceTarget.id,
            expectedVersion: evidenceTarget.version,
            transferredAt: new Date(values.transferredAt).toISOString(),
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
          { key: 'decision', type: 'select', required: true, label: 'Quyết định', options: [{ value: 'approve', label: 'Duyệt bằng chứng' }, { value: 'reject', label: 'Sai bằng chứng – yêu cầu nộp lại' }] },
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
