import { useState } from 'react';
import { Button, FormField, Modal, TextArea } from '@/shared/ui';
import type { Warehouse } from '../types';

interface DeactivateWarehouseModalProps {
  warehouse: Warehouse | { code: string; name: string } | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  loading?: boolean;
}

export function DeactivateWarehouseModal({
  warehouse,
  open,
  onClose,
  onConfirm,
  loading = false,
}: DeactivateWarehouseModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (loading) return;
    setReason('');
    setError(null);
    onClose();
  };

  const handleConfirm = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('Vui lòng nhập lý do vô hiệu hóa.');
      return;
    }
    setError(null);
    await onConfirm(trimmed);
    setReason('');
    onClose();
  };

  const isValid = reason.trim().length > 0;

  return (
    <Modal
      open={open}
      title={`Xác nhận vô hiệu hóa kho ${warehouse?.code || ''}`}
      subtitle="Kho bị vô hiệu hóa sẽ tạm dừng hoạt động và không còn được chọn khi phân bổ đơn hàng mới."
      width={520}
      onClose={handleClose}
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button onClick={handleClose} disabled={loading}>
            Hủy
          </Button>
          <Button
            variant="danger"
            disabled={!isValid || loading}
            onClick={handleConfirm}
          >
            {loading ? 'Đang xử lý…' : 'Xác nhận vô hiệu hóa'}
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
          Bạn đang thực hiện vô hiệu hóa kho{' '}
          <strong style={{ color: '#1E293B' }}>
            {warehouse?.code} · {warehouse?.name}
          </strong>
          . Vui lòng nhập lý do bên dưới để xác nhận thao tác.
        </div>

        <FormField label="Lý do vô hiệu hóa *" error={error || undefined}>
          <TextArea
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error && e.target.value.trim()) {
                setError(null);
              }
            }}
            placeholder="Ví dụ: Tạm dừng để nâng cấp hạ tầng, kiểm kê định kỳ, sự cố kho bãi..."
            rows={3}
            autoFocus
          />
        </FormField>
      </div>
    </Modal>
  );
}

