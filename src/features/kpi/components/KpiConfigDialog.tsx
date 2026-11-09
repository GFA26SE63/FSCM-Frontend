import { useEffect, useState } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import {
  Button,
  Callout,
  FormField,
  Input,
  Modal,
} from '@/shared/ui';
import { errorMessage } from '@/shared/api/errors';

import { canManageKpi, kpiApi } from '../api';
import type { KpiConfigPayload } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function KpiConfigDialog({ open, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [revWeight, setRevWeight] = useState<string>('70');
  const [ordWeight, setOrdWeight] = useState<string>('15');
  const [newWeight, setNewWeight] = useState<string>('15');
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user || !canManageKpi(user)) return;

    let active = true;
    setLoading(true);
    setError(null);

    kpiApi
      .getKpiConfig(user)
      .then((cfg) => {
        if (!active) return;
        if (cfg) {
          setRevWeight(String(cfg.revenueWeight ?? '70'));
          setOrdWeight(String(cfg.orderCountWeight ?? '15'));
          setNewWeight(String(cfg.newRetailerWeight ?? '15'));
          setNote(cfg.note ?? '');
        }
      })
      .catch((err) => {
        if (active) {
          setError(errorMessage(err));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, user]);

  const numRev = parseFloat(revWeight) || 0;
  const numOrd = parseFloat(ordWeight) || 0;
  const numNew = parseFloat(newWeight) || 0;
  const totalWeight = Math.round((numRev + numOrd + numNew) * 10) / 10;
  const isWeightValid = totalWeight === 100;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !canManageKpi(user)) {
      setError('Chỉ Quản trị viên (Admin) mới có quyền cập nhật cấu hình KPI.');
      return;
    }

    if (!isWeightValid) {
      setError(`Tổng trọng số phải bằng 100% (hiện tại: ${totalWeight}%).`);
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload: KpiConfigPayload = {
      revenueWeight: numRev,
      orderCountWeight: numOrd,
      newRetailerWeight: numNew,
      note: note.trim() || undefined,
    };

    try {
      await kpiApi.saveKpiConfig(payload, user);
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err) || 'Không thể lưu cấu hình KPI do API backend chưa hỗ trợ.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!canManageKpi(user)) {
    return (
      <Modal open={open} title="Phân quyền cấu hình" onClose={onClose}>
        <Callout tone="danger">
          Bạn không có quyền thực hiện chức năng này. Chỉ Quản trị viên (Admin) mới có thể cấu hình KPI.
        </Callout>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      title="Cấu hình chỉ tiêu & trọng số KPI"
      subtitle="Thiết lập trọng số tính điểm KPI cho đội ngũ Sales"
      onClose={onClose}
      width={560}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button type="button" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button
            type="submit"
            variant="primary"
            form="kpi-config-form"
            disabled={loading || submitting || !isWeightValid}
          >
            {submitting ? 'Đang lưu…' : 'Lưu cấu hình'}
          </Button>
        </div>
      }
    >
      <form id="kpi-config-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && <Callout tone="danger">{error}</Callout>}

        <Callout tone="info">
          Điểm KPI tổng thể được tổng hợp theo công thức:
          <br />
          <strong>
            Điểm KPI = (% Doanh thu × Trọng số DT) + (% Số đơn × Trọng số đơn) + (% Điểm mới × Trọng số mới)
          </strong>
        </Callout>

        <FormField label="Trọng số Doanh thu (%)" required>
          <Input
            type="number"
            min="0"
            max="100"
            step="1"
            value={revWeight}
            disabled={loading || submitting}
            placeholder="Nhập trọng số doanh thu (VD: 70)"
            onChange={(e) => setRevWeight(e.target.value)}
          />
        </FormField>

        <FormField label="Trọng số Số lượng đơn hàng (%)" required>
          <Input
            type="number"
            min="0"
            max="100"
            step="1"
            value={ordWeight}
            disabled={loading || submitting}
            placeholder="Nhập trọng số số đơn (VD: 15)"
            onChange={(e) => setOrdWeight(e.target.value)}
          />
        </FormField>

        <FormField label="Trọng số Phát triển điểm bán mới (%)" required>
          <Input
            type="number"
            min="0"
            max="100"
            step="1"
            value={newWeight}
            disabled={loading || submitting}
            placeholder="Nhập trọng số điểm bán mới (VD: 15)"
            onChange={(e) => setNewWeight(e.target.value)}
          />
        </FormField>

        <div
          style={{
            padding: '10px 14px',
            borderRadius: 6,
            backgroundColor: isWeightValid ? '#F0FDF4' : '#FEF2F2',
            border: `1px solid ${isWeightValid ? '#BBF7D0' : '#FECACA'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 13,
          }}
        >
          <span>Tổng trọng số:</span>
          <strong style={{ color: isWeightValid ? '#15803D' : '#DC2626' }}>
            {totalWeight}% {isWeightValid ? '✓ (Hợp lệ)' : '✗ (Phải bằng 100%)'}
          </strong>
        </div>

        <FormField label="Ghi chú áp dụng">
          <Input
            type="text"
            value={note}
            disabled={loading || submitting}
            placeholder="Ghi chú kỳ áp dụng (VD: Áp dụng từ Quý 4/2026)"
            onChange={(e) => setNote(e.target.value)}
          />
        </FormField>
      </form>
    </Modal>
  );
}

