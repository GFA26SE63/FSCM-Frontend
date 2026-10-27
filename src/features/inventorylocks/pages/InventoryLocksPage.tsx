import { useState } from 'react';
import { Button, DataTable, FormDialog, PageHeader, StatusChip, type Column } from '@/shared/ui';
import { formatDateTime } from '@/shared/lib';
import { useCreateInventoryLock, useInventoryBatches, useInventoryLocks, useReleaseInventoryLock } from '../hooks';
import type { InventoryLock } from '../types';

const reasons = [
  { value: 'Expired', label: 'Hết hạn' }, { value: 'Damaged', label: 'Hư hỏng' },
  { value: 'QualityHold', label: 'Giữ kiểm định' }, { value: 'Recall', label: 'Thu hồi' }, { value: 'Other', label: 'Khác' },
];
const reasonLabel = (value: string) => reasons.find((x) => x.value === value)?.label ?? value;

export function InventoryLocksPage() {
  const locks = useInventoryLocks();
  const batches = useInventoryBatches();
  const create = useCreateInventoryLock();
  const release = useReleaseInventoryLock();
  const [creating, setCreating] = useState(false);
  const [target, setTarget] = useState<InventoryLock | null>(null);
  const rows = locks.data ?? [];
  const batchOptions = (batches.data ?? []).filter((b) => b.onHandQuantity > 0).map((b) => ({ value: b.batchId, label: `${b.batchCode} · ${b.sku} · ${b.warehouseCode} · khả dụng ${b.availableQuantity}` }));
  const columns: Column<InventoryLock>[] = [
    { key: 'batch', header: 'Batch', width: '170px', render: (r) => <><span className="bold">{r.batchCode}</span><div className="muted small">{r.sku} · {r.warehouseCode}</div></> },
    { key: 'qty', header: 'Lượng khóa', width: '100px', align: 'right', text: (r) => String(r.lockedQuantity) },
    { key: 'reason', header: 'Lý do', width: '120px', text: (r) => reasonLabel(r.reason) },
    { key: 'status', header: 'Trạng thái', width: '120px', render: (r) => <StatusChip value={r.status === 'Active' ? 'Đang khóa' : r.status === 'Released' ? 'Đã mở khóa' : 'Đã hủy tồn'} /> },
    { key: 'resolution', header: 'Cần xử lý', width: '110px', text: (r) => r.requiresResolution ? 'Có — đụng Reserved' : 'Không' },
    { key: 'created', header: 'Tạo lúc', width: '145px', text: (r) => formatDateTime(r.createdAt) },
  ];
  return <>
    <PageHeader title="Khóa hàng không được xuất" subtitle="Khóa hàng hỏng/hết hạn khỏi lượng khả dụng, không tự giảm OnHand. Nếu đụng Reserved, cần xử lý trước khi hủy." actions={<Button variant="primary" onClick={() => setCreating(true)}>Tạo khóa hàng</Button>} />
    <DataTable title="Lịch sử khóa hàng" rows={rows} loading={locks.isLoading} error={locks.error} rowKey={(r) => r.id} columns={columns} searchPlaceholder="Batch, SKU, kho, lý do…" rowActionsWidth="120px" rowActions={(r) => r.status === 'Active' ? <Button size="sm" onClick={() => setTarget(r)}>Mở khóa</Button> : null} />
    <FormDialog open={creating} title="Khóa hàng" submitLabel="Khóa hàng" initial={{}} columns={1} fields={[
      { key: 'batchId', label: 'Batch', type: 'select', required: true, options: batchOptions, hint: 'Chỉ chọn batch còn OnHand.' },
      { key: 'quantity', label: 'Số lượng khóa', type: 'number', required: true },
      { key: 'reason', label: 'Lý do', type: 'select', required: true, options: reasons },
      { key: 'note', label: 'Ghi chú', type: 'textarea' },
    ]} onClose={() => setCreating(false)} onSubmit={async (v) => { await create.mutateAsync({ batchId: v.batchId, quantity: v.quantity, reason: v.reason, note: v.note ?? '' }); setCreating(false); }} />
    <FormDialog open={!!target} title={`Mở khóa · ${target?.batchCode ?? ''}`} submitLabel="Mở khóa" initial={{ note: '' }} columns={1} fields={[{ key: 'note', label: 'Lý do mở khóa', type: 'textarea' }]} note="Mở khóa không hoàn tác một chứng từ hủy đã ghi nhận; chỉ dùng cho khóa còn Active." onClose={() => setTarget(null)} onSubmit={async (v) => { await release.mutateAsync({ id: target!.id, expectedVersion: target!.version, note: v.note ?? '' }); setTarget(null); }} />
  </>;
}
