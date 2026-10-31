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
import { useCreateInventoryLock, useReleaseInventoryLock } from '../hooks';
import type { BatchInventoryItem, InventoryLockItem } from '../types';

const LOCK_REASONS = [
  'Kiểm định chất lượng định kỳ',
  'Hư hỏng bao bì / biến chất',
  'Nghi ngờ sai lệch tem nhãn / HSD',
  'Khiếu nại từ điểm bán / khách hàng',
  'Thu hồi theo chỉ thị',
  'Chờ phân tích mẫu phòng thí nghiệm',
  'Khác',
];

/* -------------------------------------------------------------------------- */
/*                       F100-FE: Khóa tồn lô hàng                             */
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
  const [reason, setReason] = useState(LOCK_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [note, setNote] = useState('');
  const [generalError, setGeneralError] = useState<string | null>(null);

  const createLock = useCreateInventoryLock();
  const toast = useToast();

  useEffect(() => {
    if (open && batch) {
      setQuantity(batch.availableQuantity > 0 ? Math.min(10, batch.availableQuantity) : '');
      setReason(LOCK_REASONS[0]);
      setCustomReason('');
      setNote('');
      setGeneralError(null);
    }
  }, [open, batch]);

  if (!batch) return null;

  const maxQty = batch.availableQuantity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      setGeneralError('Vui lòng nhập số lượng khóa lớn hơn 0.');
      return;
    }
    if (qty > maxQty) {
      setGeneralError(`Số lượng khóa không được vượt quá lượng có thể cấp (${maxQty} thùng).`);
      return;
    }

    const finalReason = reason === 'Khác' ? customReason.trim() || 'Lý do khác' : reason;

    try {
      await createLock.mutateAsync({
        batchId: batch.batchId,
        quantity: qty,
        reason: finalReason,
        note: note.trim() || undefined,
      });

      toast.show(`Đã khóa thành công ${qty} thùng của lô ${batch.batchCode}.`);
      onClose();
    } catch (err) {
      const apiErr = toApiError(err);
      setGeneralError(apiErr.message || 'Không thể thực hiện thao tác khóa lô hàng.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Khóa tồn lô hàng (F100-FE) · ${batch.batchCode}`}
      subtitle={`${batch.sku} - ${batch.productName} (${batch.warehouseName})`}
      width={560}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {generalError && (
          <Callout tone="danger">{generalError}</Callout>
        )}

        <Callout tone="warn">
          <b>⚠️ Quy tắc trừ kho:</b> Lượng bị khóa sẽ được trừ trực tiếp khỏi{' '}
          <b>Lượng có thể cấp (Khả dụng)</b> và chuyển vào trạng thái <b>Bị khóa</b>.
          Lô hàng không thể xuất bán số lượng này cho đến khi được mở khóa.
        </Callout>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            padding: 12,
            background: '#F8FAF9',
            borderRadius: 6,
            border: '1px solid #E2E8F0',
          }}
        >
          <div>
            <div className="muted small">Tồn thực tế</div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{batch.onHandQuantity} thùng</div>
          </div>
          <div>
            <div className="muted small">Đang giữ</div>
            <div style={{ fontWeight: 600, fontSize: 16, color: '#3182CE' }}>
              {batch.reservedQuantity} thùng
            </div>
          </div>
          <div>
            <div className="muted small">Có thể cấp tối đa</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#2F855A' }}>
              {batch.availableQuantity} thùng
            </div>
          </div>
        </div>

        <FormField label="Số lượng cần khóa (thùng)" required>
          <Input
            type="number"
            min={1}
            max={maxQty}
            step={1}
            placeholder={`Tối đa ${maxQty}`}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
            autoFocus
          />
        </FormField>

        <FormField label="Lý do khóa lô" required>
          <Select
            options={LOCK_REASONS}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </FormField>

        {reason === 'Khác' && (
          <FormField label="Mô tả lý do cụ thể" required>
            <Input
              placeholder="Nhập lý do chi tiết..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
            />
          </FormField>
        )}

        <FormField label="Ghi chú bổ sung (tùy chọn)">
          <Input
            placeholder="Ví dụ: Biên bản sự cố số 12/QC, chờ tái kiểm định..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </FormField>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <Button type="button" onClick={onClose} disabled={createLock.isPending}>
            Hủy bỏ
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={createLock.isPending || maxQty <= 0}
            style={{ background: '#C53030', borderColor: '#C53030' }}
          >
            {createLock.isPending ? 'Đang khóa...' : 'Xác nhận khóa lô (F100)'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*                      F100-FE: Mở khóa tồn lô hàng                          */
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

      toast.show(`Đã mở khóa thành công ${lock.lockedQuantity} thùng của lô ${lock.batchCode}.`);
      onClose();
    } catch (err) {
      const apiErr = toApiError(err);
      setGeneralError(apiErr.message || 'Không thể thực hiện thao tác mở khóa.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Mở khóa tồn lô hàng (F100-FE) · ${lock.batchCode}`}
      subtitle={`Mở khóa ${lock.lockedQuantity} thùng - SKU ${lock.sku}`}
      width={520}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {generalError && (
          <Callout tone="danger">{generalError}</Callout>
        )}

        <Callout tone="info">
          Lượng hàng mở khóa sẽ được hoàn trả trực tiếp về{' '}
          <b>Lượng có thể cấp (Khả dụng)</b> của lô hàng, sẵn sàng cấp phát cho các đơn hàng tiếp theo.
        </Callout>

        <div
          style={{
            padding: 12,
            background: '#F8FAF9',
            borderRadius: 6,
            border: '1px solid #E2E8F0',
            fontSize: 13.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div><b>Lý do khóa ban đầu:</b> {lock.reason}</div>
          {lock.note && <div><b>Ghi chú khóa:</b> {lock.note}</div>}
          <div><b>Số lượng đang khóa:</b> <span style={{ color: '#C53030', fontWeight: 600 }}>{lock.lockedQuantity} thùng</span></div>
          <div className="muted small"><b>Ngày lập khóa:</b> {new Date(lock.createdAt).toLocaleString('vi-VN')}</div>
        </div>

        <FormField label="Lý do / Kết quả xử lý để mở khóa" required>
          <Input
            placeholder="Ví dụ: Đã kiểm định lại đạt chuẩn, biên bản số..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            autoFocus
            required
          />
        </FormField>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <Button type="button" onClick={onClose} disabled={releaseLock.isPending}>
            Đóng
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={releaseLock.isPending || !note.trim()}
          >
            {releaseLock.isPending ? 'Đang mở khóa...' : 'Xác nhận mở khóa'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
