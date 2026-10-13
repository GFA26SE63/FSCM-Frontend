import { FormDialog } from '@/shared/ui';
import { formatDate } from '@/shared/lib';
import { useCreateTransfer, useTransferLookups } from '../hooks';
import type { TransferInput } from '../types';

/** Create a (replenishment) transfer; the batch dropdown follows the chosen source warehouse. */
export function TransferDialog({ open, initial, onClose }: { open: boolean; initial?: Partial<TransferInput>; onClose: () => void }) {
  const { warehouses, batches } = useTransferLookups(open);
  const create = useCreateTransfer();
  const whs = (warehouses.data ?? []).filter((w) => w.status === 'Active');
  if (!open || !whs.length || !batches.data) return null;
  const batchesOf = (wh: string) => batches.data!.filter((b) => b.warehouseCode === wh && b.available > 0 && b.expiryStatus !== 'Expired' && b.expiryStatus !== 'Disposed');
  const from = initial?.fromWarehouse ?? whs[0].code;
  return (
    <FormDialog
      open
      width={640}
      title="Tạo phiếu điều chuyển"
      submitLabel="Tạo phiếu điều chuyển"
      initial={{ fromWarehouse: from, toWarehouse: initial?.toWarehouse ?? whs.find((w) => w.code !== from)?.code ?? '', sourceBatch: initial?.sourceBatch ?? batchesOf(from)[0]?.code ?? '', qty: initial?.qty ?? '', note: '' }}
      fields={[
        { key: 'fromWarehouse', type: 'select', required: true, label: 'Kho đi', options: whs.map((w) => ({ value: w.code, label: w.name })) },
        { key: 'toWarehouse', type: 'select', required: true, label: 'Kho đến', options: whs.map((w) => ({ value: w.code, label: w.name })), validate: (v, all) => (v === all.fromWarehouse ? 'Kho đến phải khác kho đi.' : undefined) },
        {
          key: 'sourceBatch', type: 'select', required: true, span: 2, label: 'Batch (chọn từ kho đi)',
          options: batches.data.filter((b) => b.available > 0).map((b) => ({ value: b.code, label: `${b.code} · ${b.productName} · HSD ${formatDate(b.expiry)} · khả dụng ${b.available}` })),
          validate: (v, all) => (batches.data!.find((b) => b.code === v)?.warehouseCode !== all.fromWarehouse ? 'Batch không thuộc kho đi.' : undefined),
        },
        { key: 'qty', type: 'number', required: true, label: 'Số thùng', validate: (v, all) => { const b = batches.data!.find((x) => x.code === all.sourceBatch); return b && Number(v) > b.available ? `Vượt khả dụng ${b.available} thùng.` : undefined; } },
        { key: 'note', label: 'Ghi chú' },
      ]}
      onClose={onClose}
      onSubmit={async (v) => {
        await create.mutateAsync({ kind: initial?.kind ?? 'Replenishment', fromWarehouse: v.fromWarehouse, toWarehouse: v.toWarehouse, sourceBatch: v.sourceBatch, qty: Number(v.qty), note: v.note });
        onClose();
      }}
    />
  );
}
