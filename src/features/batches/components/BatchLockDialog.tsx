import { useState, useEffect } from 'react';
import { toApiError } from '@/shared/api/errors';
import {
  Button,
  Callout,
  FormField,
  Input,
  Modal,
  Select,
  useToast,
} from '@/shared/ui';
import {
  INVENTORY_LOCK_REASONS,
  formatLockReason,
  type InventoryLockReason,
} from '@/shared/lib/status';
import { useCreateInventoryLock, useReleaseInventoryLock } from '../hooks';
import type { BatchInventoryItem, InventoryLockItem } from '../types';

/* -------------------------------------------------------------------------- */
/*                       Khóa hàng hỏng / hết hạn                             */
/* -------------------------------------------------------------------------- */

export function LockBatchDialog({
  open,
  batch,
  onClose,
}: {
  open: boolean;
  batch: BatchInventoryItem | null;
  onClose: () => void;
}) {
  const [quantity, setQuantity] = useState<number | ''>('');
  const [reason, setReason] = useState<string>('');
  const [customReason, setCustomReason] = useState('');
  const [note, setNote] = useState('');
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);

  const createLock = useCreateInventoryLock();
  const toast = useToast();

  useEffect(() => {
    if (open && batch) {
      setQuantity(batch.availableQuantity > 0 ? Math.min(10, batch.availableQuantity) : '');
      setReason('');
      setCustomReason('');
      setNote('');
      setGeneralError(null);
      setReasonError(null);
    }
  }, [open, batch]);

  if (!batch) return null;

  const maxOnHand = batch.onHandQuantity;
  const avail = batch.availableQuantity;
  const numQty = typeof quantity === 'number' ? quantity : 0;
  const isOverAvail = numQty > avail;
  const overAmount = numQty - avail;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setReasonError(null);

    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      setGeneralError('Vui lòng nhập số lượng khóa lớn hơn 0.');
      return;
    }
    if (qty > maxOnHand) {
      setGeneralError(`Không thể khóa vượt quá lượng tồn thực tế trong kho (${maxOnHand} thùng).`);
      return;
    }

    if (!reason || !INVENTORY_LOCK_REASONS.some((r) => r.value === reason)) {
      setReasonError('Vui lòng chọn lý do khóa hàng hợp lệ.');
      return;
    }

    const fullNote = [
      reason === 'Other' && customReason.trim() ? customReason.trim() : null,
      note.trim() || null,
    ]
      .filter(Boolean)
      .join(' - ') || undefined;

    try {
      await createLock.mutateAsync({
        batchId: batch.batchId,
        quantity: qty,
        reason: reason as InventoryLockReason,
        note: fullNote,
      });

      toast.show(`Đã khóa ${qty} thùng của lô hàng ${batch.batchCode}.`);
      onClose();
    } catch (err) {
      const apiErr = toApiError(err);
      setGeneralError(apiErr.message || 'Không thể thực hiện thao tác. Vui lòng thử lại sau.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Khóa hàng hỏng / hết hạn"
      subtitle={`Lô hàng ${batch.batchCode} · ${batch.sku} - ${batch.productName} (${batch.warehouseName})`}
      width={560}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {generalError && (
          <Callout tone="danger">{generalError}</Callout>
        )}

        <div style={{ fontSize: 13, color: '#5B625E', lineHeight: 1.5 }}>
          Hàng bị khóa sẽ không được xuất bán cho đơn hàng mới và không thể khóa vượt quá lượng tồn thực tế trong kho.
          Nếu số lượng khóa ảnh hưởng đến các đơn hàng đang giữ, vui lòng xử lý các đơn hàng liên quan trước khi xuất hủy.
        </div>

        <div
          style={{
            padding: '10px 14px',
            background: '#F4F6F3',
            borderRadius: 8,
            border: '1px solid #E2E5E0',
            fontSize: 13,
          }}
        >
          <span className="muted">Tồn thực tế / Đã giữ / Có thể cấp: </span>
          <span style={{ fontWeight: 700 }}>
            {batch.onHandQuantity} / {batch.reservedQuantity} / {batch.availableQuantity} thùng
          </span>
        </div>

        <FormField
          label="Số lượng khóa (thùng) *"
          required
          hint={
            isOverAvail && overAmount > 0
              ? `Vượt số lượng có thể cấp ${overAmount} thùng (ảnh hưởng đến đơn hàng đang giữ)`
              : undefined
          }
        >
          <Input
            type="number"
            min={1}
            max={maxOnHand}
            step={1}
            placeholder={`Tối đa ${maxOnHand} thùng`}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
            autoFocus
          />
        </FormField>

        <FormField label="Lý do khóa hàng" required error={reasonError}>
          <Select
            placeholder="-- Chọn lý do khóa hàng --"
            options={INVENTORY_LOCK_REASONS.map((r) => ({
              value: r.value,
              label: r.label,
            }))}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (reasonError) setReasonError(null);
            }}
          />
        </FormField>

        {reason === 'Other' && (
          <FormField label="Mô tả lý do cụ thể">
            <Input
              placeholder="Nhập mô tả chi tiết lý do khác…"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
            />
          </FormField>
        )}

        <FormField label="Ghi chú">
          <Input
            placeholder="Ví dụ: phát hiện khi soạn hàng ca sáng"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </FormField>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
          <Button type="button" onClick={onClose} disabled={createLock.isPending}>
            Hủy
          </Button>
          <Button
            type="submit"
            className="btn-danger-solid"
            disabled={createLock.isPending || maxOnHand <= 0}
          >
            {createLock.isPending ? 'Đang khóa…' : 'Khóa hàng'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Mở khóa hàng                                 */
/* -------------------------------------------------------------------------- */

export function ReleaseBatchLockDialog({
  open,
  lock,
  onClose,
}: {
  open: boolean;
  lock: InventoryLockItem | null;
  onClose: () => void;
}) {
  const [note, setNote] = useState('');
  const [generalError, setGeneralError] = useState<string | null>(null);

  const releaseLock = useReleaseInventoryLock();
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setNote('');
      setGeneralError(null);
    }
  }, [open]);

  if (!lock) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    try {
      await releaseLock.mutateAsync({
        lockId: lock.id,
        input: {
          expectedVersion: lock.version,
          note: note.trim() || undefined,
        },
      });

      toast.show(`Đã mở khóa lô hàng ${lock.batchCode}.`);
      onClose();
    } catch (err) {
      const apiErr = toApiError(err);
      setGeneralError(apiErr.message || 'Không thể thực hiện thao tác. Vui lòng thử lại sau.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Mở khóa hàng · ${lock.batchCode}`}
      subtitle={`Mở khóa ${lock.lockedQuantity} thùng - SKU: ${lock.sku}`}
      width={520}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {generalError && (
          <Callout tone="danger">{generalError}</Callout>
        )}

        <div style={{ fontSize: 13, color: '#5B625E', lineHeight: 1.5 }}>
          Số lượng sau khi mở khóa sẽ được chuyển về <b>hàng có thể sử dụng</b> để tiếp tục xuất kho cho các đơn hàng.
        </div>

        <div
          style={{
            padding: '10px 14px',
            background: '#F4F6F3',
            borderRadius: 8,
            border: '1px solid #E2E5E0',
            fontSize: 13,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div>
            <b>Số lượng đang khóa:</b>{' '}
            <span style={{ color: '#B42318', fontWeight: 700 }}>
              {lock.lockedQuantity} thùng
            </span>
          </div>
          <div>
            <b>Lý do khóa:</b> {formatLockReason(lock.reason)}
          </div>
          {lock.note && (
            <div className="muted small">
              <b>Ghi chú ban đầu:</b> {lock.note}
            </div>
          )}
        </div>

        <FormField label="Ghi chú / Kết quả xử lý *" required>
          <Input
            placeholder="Ví dụ: Đã kiểm tra đạt chất lượng, biên bản số…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            autoFocus
            required
          />
        </FormField>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
          <Button type="button" onClick={onClose} disabled={releaseLock.isPending}>
            Hủy
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={releaseLock.isPending || !note.trim()}
          >
            {releaseLock.isPending ? 'Đang mở khóa…' : 'Mở khóa'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
