import { useState } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { useNavigate } from '@/shared/router/compat';
import { Button, Callout, Card, Chip, DataTable, FormDialog, PageHeader, Stat, type Column, type Tone } from '@/shared/ui';
import { formatDateTime, formatMoney } from '@/shared/lib';
import { useCreateRefund, useRefundObligations, useRefunds } from '../hooks';
import { OPEN_REFUND_STATUSES, REFUND_STATUS_LABEL, type Refund, type RefundObligation, type RefundStatus } from '../types';

export const REFUND_TONE: Record<RefundStatus, Tone> = {
  PendingRefund: 'info',
  AwaitingVerification: 'warn',
  EvidenceRejected: 'danger',
  Refunded: 'success',
};

export function RefundStatusChip({ status }: { status: RefundStatus }) {
  return <Chip tone={REFUND_TONE[status] ?? 'neutral'}>{REFUND_STATUS_LABEL[status] ?? status}</Chip>;
}

/**
 * F101: refund records and the obligations that still need one.
 *
 * "Hoàn" here means a transfer a person made outside the system and proved with evidence. Nothing on
 * this page moves money, and a record is only "Đã hoàn" once an Admin has verified that proof.
 */
export function RefundsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const mayManage = can(user, 'refunds.manage');
  const refunds = useRefunds();
  const obligations = useRefundObligations(mayManage);
  const create = useCreateRefund();
  const [target, setTarget] = useState<RefundObligation | null>(null);

  const rows = refunds.data ?? [];
  const open = rows.filter((refund) => OPEN_REFUND_STATUSES.includes(refund.status));
  const sum = (items: Refund[]) => items.reduce((total, refund) => total + refund.amount, 0);

  const columns: Column<Refund>[] = [
    { key: 'order', header: 'Đơn', width: '110px', render: (r) => <span className="bold">{r.orderCode}</span>, text: (r) => r.orderCode },
    { key: 'recipient', header: 'Người nhận', text: (r) => r.recipient },
    { key: 'amount', header: 'Số tiền', width: '120px', align: 'right', text: (r) => formatMoney(r.amount) },
    { key: 'due', header: 'Còn phải hoàn (đơn)', width: '150px', align: 'right', text: (r) => formatMoney(r.refundDueAmount) },
    { key: 'source', header: 'Nguồn', width: '120px', text: (r) => (r.receiptDiscrepancyId ? 'Khiếu nại' : '—') },
    { key: 'status', header: 'Trạng thái', width: '180px', render: (r) => <RefundStatusChip status={r.status} />, text: (r) => REFUND_STATUS_LABEL[r.status] },
    { key: 'created', header: 'Tạo lúc', width: '140px', text: (r) => formatDateTime(r.createdAt) },
  ];

  return (
    <>
      <PageHeader
        title="Hoàn tiền"
        subtitle="Hồ sơ hoàn tiền thủ công. Hệ thống không chuyển tiền: người có quyền chuyển ngoài hệ thống, nộp bằng chứng, rồi Admin xác minh."
      />
      <div className="grid-3">
        <Stat label="Hồ sơ đang mở" value={String(open.length)} note={formatMoney(sum(open))} />
        <Stat label="Chờ Admin xác minh" value={String(rows.filter((r) => r.status === 'AwaitingVerification').length)} />
        <Stat label="Đã hoàn (đã xác minh)" value={formatMoney(sum(rows.filter((r) => r.status === 'Refunded')))} />
      </div>

      {mayManage && (
        <Card title="Khoản cần tạo hồ sơ hoàn" flush>
          {obligations.isError ? (
            <Callout tone="danger">Không tải được các khoản cần hoàn.</Callout>
          ) : (
            <DataTable
              stateKey="obligations"
              rows={(obligations.data ?? []).filter((item) => item.unrequestedAmount > 0)}
              loading={obligations.isLoading}
              rowKey={(item) => item.paymentId}
              searchable={false}
              emptyText="Không có khoản nào đã thu vượt mức phải thu mà chưa có hồ sơ hoàn."
              columns={[
                { key: 'order', header: 'Đơn', width: '110px', render: (r: RefundObligation) => <span className="bold">{r.orderCode}</span>, text: (r: RefundObligation) => r.orderCode },
                { key: 'retailer', header: 'Retailer', text: (r: RefundObligation) => r.retailerName },
                { key: 'confirmed', header: 'Đã thu', width: '120px', align: 'right', text: (r: RefundObligation) => formatMoney(r.confirmedAmount) },
                { key: 'adjusted', header: 'Phải thu sau điều chỉnh', width: '170px', align: 'right', text: (r: RefundObligation) => formatMoney(r.adjustedAmount) },
                { key: 'refunded', header: 'Đã hoàn', width: '110px', align: 'right', text: (r: RefundObligation) => formatMoney(r.refundedAmount) },
                { key: 'pending', header: 'Đang có hồ sơ', width: '130px', align: 'right', text: (r: RefundObligation) => formatMoney(r.pendingRefundAmount) },
                { key: 'unrequested', header: 'Chưa có hồ sơ', width: '130px', align: 'right', render: (r: RefundObligation) => <b>{formatMoney(r.unrequestedAmount)}</b>, text: (r: RefundObligation) => formatMoney(r.unrequestedAmount) },
              ]}
              rowActionsWidth="150px"
              rowActions={(item) => (
                <Button size="sm" variant="primary" onClick={() => setTarget(item)}>
                  Tạo hồ sơ hoàn
                </Button>
              )}
            />
          )}
        </Card>
      )}

      <DataTable
        title="Hồ sơ hoàn tiền"
        rows={rows}
        loading={refunds.isLoading}
        error={refunds.error}
        rowKey={(refund) => refund.id}
        columns={columns}
        searchPlaceholder="Mã đơn, người nhận…"
        filters={[{ label: 'Trạng thái', options: Object.values(REFUND_STATUS_LABEL), value: (r) => REFUND_STATUS_LABEL[r.status] }]}
        onRowClick={(refund) => navigate(`/refunds/${refund.id}`)}
        rowActionsWidth="120px"
        rowActions={(refund) => (
          <Button size="sm" onClick={() => navigate(`/refunds/${refund.id}`)}>
            Chi tiết
          </Button>
        )}
      />

      <FormDialog
        open={mayManage && !!target}
        width={560}
        columns={1}
        title={`Tạo hồ sơ hoàn · ${target?.orderCode ?? ''}`}
        submitLabel="Tạo hồ sơ"
        initial={{
          amount: target?.unrequestedAmount ?? 0,
          recipient: target?.retailerName ?? '',
          reason: 'Hoàn khoản đã thu vượt mức phải thu sau điều chỉnh được duyệt',
          claimId: target?.claimIds.length === 1 ? target.claimIds[0] : '',
        }}
        fields={[
          {
            key: 'amount',
            type: 'number',
            required: true,
            label: 'Số tiền hoàn',
            hint: `Tối đa ${formatMoney(target?.unrequestedAmount ?? 0)} (phần chưa có hồ sơ).`,
            validate: (value) =>
              Number(value) <= 0
                ? 'Số tiền phải lớn hơn 0.'
                : Number(value) > (target?.unrequestedAmount ?? 0)
                  ? 'Vượt phần còn phải hoàn.'
                  : false,
          },
          { key: 'recipient', required: true, label: 'Người nhận' },
          { key: 'reason', type: 'textarea', required: true, label: 'Lý do' },
          {
            key: 'claimId',
            type: 'select',
            label: 'Gắn với khiếu nại (nếu có)',
            options: [{ value: '', label: 'Không gắn khiếu nại' }, ...(target?.claimIds ?? []).map((id) => ({ value: id, label: `Khiếu nại ${id.slice(0, 8)}` }))],
            visible: () => (target?.claimIds.length ?? 0) > 0,
          },
        ]}
        note="Tạo hồ sơ không có nghĩa là đã chuyển tiền. Khoản chỉ được tính là đã hoàn sau khi có bằng chứng và Admin xác minh."
        onClose={() => setTarget(null)}
        onSubmit={async (values) => {
          if (!target) return;
          await create.mutateAsync({
            salesOrderId: target.salesOrderId,
            amount: Number(values.amount),
            recipient: values.recipient,
            reason: values.reason,
            receiptDiscrepancyId: values.claimId || null,
            operationKey: crypto.randomUUID(),
          });
          setTarget(null);
        }}
      />
    </>
  );
}
