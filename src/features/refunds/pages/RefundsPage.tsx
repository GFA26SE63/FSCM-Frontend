import { useState } from 'react';
import { Button, DataTable, FormDialog, PageHeader, StatusChip, type Column } from '@/shared/ui';
import { formatDateTime, formatMoney } from '@/shared/lib';
import { useAuth } from '@/shared/auth/AuthContext';
import { useCreateRefund, useRefunds, useSubmitRefundEvidence, useVerifyRefund } from '../hooks';
import type { Refund } from '../types';

const statusLabels: Record<Refund['status'], string> = {
  PendingRefund: 'Chờ hoàn',
  AwaitingVerification: 'Chờ xác nhận',
  Refunded: 'Đã hoàn',
};

export function RefundsPage() {
  const { user } = useAuth();
  const query = useRefunds();
  const create = useCreateRefund();
  const evidence = useSubmitRefundEvidence();
  const verify = useVerifyRefund();
  const [dialog, setDialog] = useState<'create' | 'evidence' | 'verify' | null>(null);
  const [target, setTarget] = useState<Refund | null>(null);
  const isAdmin = user?.role === 'Admin';

  const open = (name: Exclude<typeof dialog, null>, refund?: Refund) => { setTarget(refund ?? null); setDialog(name); };
  const close = () => { setDialog(null); setTarget(null); };
  const columns: Column<Refund>[] = [
    { key: 'order', header: 'Đơn hàng', width: '125px', text: (r) => r.orderCode },
    { key: 'recipient', header: 'Người nhận', width: '180px', text: (r) => r.recipient },
    { key: 'amount', header: 'Số tiền', width: '130px', align: 'right', text: (r) => formatMoney(r.amount) },
    { key: 'reason', header: 'Lý do', text: (r) => r.reason },
    { key: 'transfer', header: 'Mã giao dịch', width: '150px', text: (r) => r.transactionReference ?? '—' },
    { key: 'status', header: 'Trạng thái', width: '140px', render: (r) => <StatusChip value={statusLabels[r.status]} /> },
    { key: 'created', header: 'Tạo lúc', width: '145px', text: (r) => formatDateTime(r.createdAt) },
  ];

  return <>
    <PageHeader title="Hoàn tiền" subtitle="Theo dõi nghĩa vụ hoàn tiền, bằng chứng chuyển khoản và xác nhận cuối cùng của Admin." actions={<Button variant="primary" onClick={() => open('create')}>Tạo nghĩa vụ</Button>} />
    <DataTable
      title="Danh sách hoàn tiền"
      rows={query.data ?? []}
      loading={query.isLoading}
      error={query.error}
      rowKey={(r) => r.id}
      columns={columns}
      searchPlaceholder="Mã đơn, người nhận, mã giao dịch…"
      rowActionsWidth="220px"
      rowActions={(r) => <>
        {r.status === 'PendingRefund' && <Button size="sm" variant="primary" onClick={() => open('evidence', r)}>Gửi bằng chứng</Button>}
        {isAdmin && r.status === 'AwaitingVerification' && <Button size="sm" variant="primary" onClick={() => open('verify', r)}>Xác nhận đã hoàn</Button>}
      </>}
    />
    <FormDialog open={dialog === 'create'} title="Tạo nghĩa vụ hoàn tiền" submitLabel="Tạo" initial={{}} columns={1} fields={[
      { key: 'salesOrderId', label: 'Sales order ID (GUID)', required: true, placeholder: 'Nhập ID đơn hàng' },
      { key: 'amount', label: 'Số tiền hoàn', type: 'number', required: true },
      { key: 'recipient', label: 'Người nhận', required: true },
      { key: 'reason', label: 'Lý do', type: 'textarea', required: true },
    ]} onClose={close} onSubmit={async (v) => { await create.mutateAsync({ salesOrderId: v.salesOrderId, amount: v.amount, recipient: v.recipient, reason: v.reason, operationKey: crypto.randomUUID() }); close(); }} />
    <FormDialog open={dialog === 'evidence'} title={`Gửi bằng chứng · ${target?.orderCode ?? ''}`} submitLabel="Gửi bằng chứng" initial={{ transferredAt: new Date().toISOString().slice(0, 16) }} columns={1} fields={[
      { key: 'version', label: 'Phiên bản', type: 'info', info: () => target?.version ?? '' },
      { key: 'transferredAt', label: 'Thời điểm chuyển khoản', type: 'datetime-local', required: true },
      { key: 'transactionReference', label: 'Mã giao dịch ngân hàng', required: true },
      { key: 'evidenceReference', label: 'Tham chiếu bằng chứng', required: true, hint: 'URL hoặc mã file chứng từ.' },
    ]} onClose={close} onSubmit={async (v) => { await evidence.mutateAsync({ id: target!.id, expectedVersion: target!.version, transferredAt: new Date(v.transferredAt).toISOString(), transactionReference: v.transactionReference, evidenceReference: v.evidenceReference, operationKey: crypto.randomUUID() }); close(); }} />
    <FormDialog open={dialog === 'verify'} title={`Xác nhận hoàn tiền · ${target?.orderCode ?? ''}`} submitLabel="Xác nhận" initial={{ note: '' }} columns={1} fields={[{ key: 'note', label: 'Ghi chú', type: 'textarea', placeholder: 'Ghi chú đối soát (không bắt buộc)' }]} note="Chỉ Admin được xác nhận. Sau bước này nghĩa vụ chuyển sang Đã hoàn." onClose={close} onSubmit={async (v) => { await verify.mutateAsync({ id: target!.id, expectedVersion: target!.version, note: v.note ?? '', operationKey: crypto.randomUUID() }); close(); }} />
  </>;
}
