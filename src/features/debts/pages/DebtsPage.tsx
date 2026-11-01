import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { Button, Callout, DataTable, FormDialog, PageHeader, Stat, StatusChip, type Column } from '@/shared/ui';
import { formatDate, formatMoney, statusLabel } from '@/shared/lib';
import { useCollectReceivable, useReceivables } from '../hooks';
import type { Receivable } from '../types';

/** "Công nợ" – Unpaid / Paid / Overdue, one full collection per order (no partial payments, no credit limit). */
export function DebtsPage() {
  const { user } = useAuth();
  const mayCollect = can(user, 'payments.collect');
  const navigate = useNavigate();
  const query = useReceivables();
  const collect = useCollectReceivable();
  const [target, setTarget] = useState<Receivable | null>(null);
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
    { key: 'status', header: 'Trạng thái', width: '110px', render: (r) => <StatusChip domain="receivable" value={r.status} /> },
  ];

  return (
    <>
      <PageHeader title="Công nợ" subtitle="Đơn trả sau của retailer. Thu một lần đủ số tiền; không có thu từng phần, không có hạn mức công nợ." />
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
        filters={[{ label: 'Trạng thái', options: ['Chưa thu', 'Đã thu đủ', 'Quá hạn'], value: (r) => statusLabel('receivable', r.status) }]}
        onRowClick={(r) => navigate(`/orders/${r.orderId}`)}
        rowActionsWidth="200px"
        rowActions={(r) => (
          <>
            <Button size="sm" onClick={() => navigate(`/orders/${r.orderId}`)}>Xem đơn</Button>
            {mayCollect && r.status !== 'Paid' && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => setTarget(r)}
              >
                Ghi nhận đã thu
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
          { key: 'method', type: 'select', required: true, label: 'Hình thức thu', options: [{ value: 'BankTransfer', label: 'Chuyển khoản' }, { value: 'Cash', label: 'Tiền mặt (Sales thu)' }] },
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
    </>
  );
}
