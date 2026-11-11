import { useState } from 'react';
import { toApiError } from '@/shared/api/errors';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { Button, Callout, FormField, Input, Modal } from '@/shared/ui';
import { formatDate } from '@/shared/lib';
import { useGenerateQrLabel, useQrGenerationCapacity } from '../hooks';

export interface BatchForQrGeneration {
  batchId: string;
  batchCode: string;
  sku: string;
  productName: string;
  warehouseId?: string;
  warehouseCode?: string;
  warehouseName?: string;
  expirationDate?: string;
  onHandQuantity?: number;
  availableQuantity?: number;
  expiryStatus?: string;
}

interface Props {
  open: boolean;
  batch: BatchForQrGeneration | null;
  existingCount?: number;
  onClose: () => void;
  onPrintExisting?: () => void;
}

export function GenerateQrDialog({
  open,
  batch,
  existingCount = 0,
  onClose,
  onPrintExisting,
}: Props) {
  const { user } = useAuth();
  const generate = useGenerateQrLabel();

  const isKeeper = user?.role === 'WarehouseKeeper';
  const assignedWhIds = user?.scope?.warehouseIds ?? [];
  const assignedWhCode = user?.warehouseCode;

  const isWarehouseScoped =
    !isKeeper ||
    (batch?.warehouseId ? assignedWhIds.includes(batch.warehouseId) : false) ||
    (batch?.warehouseCode ? batch.warehouseCode === assignedWhCode : false) ||
    assignedWhIds.length === 0;

  const hasPermission = can(user, 'qr.generate') && isWarehouseScoped;

  const capacityQuery = useQrGenerationCapacity(batch?.batchId ?? '', open && hasPermission);
  const capacity = capacityQuery.data;
  const [quantityInput, setQuantity] = useState<{ batchId: string; value: string } | null>(null);
  const quantity = quantityInput?.batchId === batch?.batchId
    ? quantityInput!.value
    : capacity ? String(capacity.unlabelledQuantity) : '';
  const [error, setError] = useState<string | null>(null);

  if (!open || !batch) return null;

  const isDisposed = batch.expiryStatus === 'Disposed';
  const hasQuantityInfo =
    batch.onHandQuantity !== undefined || batch.availableQuantity !== undefined;
  const hasZeroStock =
    hasQuantityInfo &&
    (batch.onHandQuantity ?? 0) <= 0 &&
    (batch.availableQuantity ?? 0) <= 0;
  const isEligible = !isDisposed && !hasZeroStock;
  const capacityReady = capacityQuery.isSuccess && !capacityQuery.isFetching;
  const canSubmit = isEligible && hasPermission && capacityReady && (capacity?.unlabelledQuantity ?? 0) > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) {
      setError('Bạn chưa được cấp quyền thực hiện thao tác này.');
      return;
    }
    if (!isEligible) {
      setError(
        isDisposed
          ? 'Lô hàng đã bị tiêu hủy nên không thể sinh mã QR.'
          : 'Lô hàng chưa đủ điều kiện sinh mã QR. Vui lòng kiểm tra trạng thái ghi nhận hàng tồn.',
      );
      return;
    }
    if (!canSubmit || !capacity) {
      setError('Vui lòng tải lại số thùng chưa có tem QR trước khi sinh mã.');
      return;
    }

    const num = Number(quantity);
    if (!Number.isFinite(num) || num <= 0) {
      setError('Vui lòng nhập số lượng hợp lệ lớn hơn 0.');
      return;
    }
    if (!Number.isInteger(num)) {
      setError('Số lượng thùng phải là số nguyên.');
      return;
    }
    if (num > capacity.unlabelledQuantity) {
      setError(`Chỉ còn ${capacity.unlabelledQuantity.toLocaleString('vi-VN')} thùng chưa có tem QR.`);
      return;
    }

    setError(null);
    try {
      await generate.mutateAsync({
        batchId: batch.batchId,
        quantity: num,
      });
      onClose();
    } catch (err) {
      const apiErr = toApiError(err);
      if (apiErr.status === 409) void capacityQuery.refetch();
      if (apiErr.status === 403) {
        setError('Bạn chưa được cấp quyền thực hiện thao tác này.');
      } else {
        setError(
          apiErr.detail ||
            apiErr.title ||
            'Không thể sinh mã QR. Vui lòng thử lại.',
        );
      }
    }
  };

  return (
    <Modal
      open={open}
      title={`Sinh mã QR · Lô ${batch.batchCode}`}
      subtitle="Tạo tem QR chính thức từ hệ thống cho số lượng quy định của lô hàng."
      onClose={onClose}
      width={560}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, width: '100%' }}>
          <Button onClick={onClose} disabled={generate.isPending}>
            Hủy
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!canSubmit || generate.isPending}
          >
            {generate.isPending ? 'Đang sinh mã…' : 'Sinh mã QR'}
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!hasPermission && (
          <Callout tone="danger">
            Bạn chưa được cấp quyền thực hiện thao tác này.
          </Callout>
        )}

        {!isEligible && (
          <Callout tone="danger">
            {isDisposed
              ? 'Lô hàng đã bị tiêu hủy nên không thể sinh mã QR.'
              : 'Lô hàng chưa đủ điều kiện sinh mã QR. Vui lòng kiểm tra trạng thái ghi nhận hàng tồn.'}
          </Callout>
        )}

        {existingCount > 0 && isEligible && (
          <Callout tone="info">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span>
                Lô hàng này đã có <strong>{existingCount} tem QR</strong> trong hệ thống.
                Bạn có thể in lại tem hiện có. Chỉ sinh thêm cho số thùng chưa có tem QR.
              </span>
              {onPrintExisting && (
                <Button
                  size="sm"
                  onClick={() => {
                    onClose();
                    onPrintExisting();
                  }}
                >
                  In tem hiện có
                </Button>
              )}
            </div>
          </Callout>
        )}

        {error && <Callout tone="danger">{error}</Callout>}
        {capacityQuery.isFetching && <Callout tone="info">Đang kiểm tra số thùng chưa có tem QR…</Callout>}
        {capacityQuery.isError && (
          <Callout tone="danger">
            Không tải được số thùng chưa có tem QR. Vui lòng thử lại.
            <Button size="sm" onClick={() => void capacityQuery.refetch()}>Tải lại</Button>
          </Callout>
        )}
        {capacityReady && capacity?.unlabelledQuantity === 0 && (
          <Callout tone="info">Hàng còn trong kho đã có đủ tem QR. Hãy in lại tem hiện có.</Callout>
        )}

        {/* Batch Overview Box */}
        <div
          style={{
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: 6,
            padding: '12px 14px',
            fontSize: 13,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '8px 16px',
          }}
        >
          <div>
            <span className="muted" style={{ display: 'block', fontSize: 11.5 }}>
              Mã lô hàng:
            </span>
            <strong style={{ fontFamily: 'monospace' }}>{batch.batchCode}</strong>
          </div>
          <div>
            <span className="muted" style={{ display: 'block', fontSize: 11.5 }}>
              Sản phẩm:
            </span>
            <strong>{batch.sku} · {batch.productName}</strong>
          </div>
          <div>
            <span className="muted" style={{ display: 'block', fontSize: 11.5 }}>
              Kho lưu trữ:
            </span>
            <span>{batch.warehouseName || batch.warehouseCode || '—'}</span>
          </div>
          <div>
            <span className="muted" style={{ display: 'block', fontSize: 11.5 }}>
              Hạn sử dụng:
            </span>
            <span>{batch.expirationDate ? formatDate(batch.expirationDate) : '—'}</span>
          </div>
          <div>
            <span className="muted" style={{ display: 'block', fontSize: 11.5 }}>
              Tồn thực tế:
            </span>
            <span>{(batch.onHandQuantity ?? 0).toLocaleString('vi-VN')} thùng</span>
          </div>
          <div>
            <span className="muted" style={{ display: 'block', fontSize: 11.5 }}>
              Có thể cấp:
            </span>
            <span style={{ fontWeight: 600, color: '#15803D' }}>
              {(batch.availableQuantity ?? 0).toLocaleString('vi-VN')} thùng
            </span>
          </div>
          <div>
            <span className="muted" style={{ display: 'block', fontSize: 11.5 }}>Chưa có tem QR:</span>
            <strong>{capacityReady && capacity ? `${capacity.unlabelledQuantity.toLocaleString('vi-VN')} thùng` : '—'}</strong>
          </div>
          <div className="muted" style={{ gridColumn: '1 / -1' }}>
            Số thùng chưa có tem tính trên hàng còn trong kho, bao gồm hàng đang giữ cho đơn. Hàng đã xuất không tính lại.
          </div>
        </div>

        {/* Quantity Field */}
        <FormField
          label="Số lượng thùng trên tem *"
          hint="Nhập số thùng đại diện trên tem, tối đa bằng số thùng chưa có tem QR."
        >
          <Input
            type="number"
            min="1"
            step="1"
            max={capacityReady ? capacity?.unlabelledQuantity : undefined}
            value={quantity}
            disabled={!canSubmit || generate.isPending}
            onChange={(e) => {
              setQuantity({ batchId: batch.batchId, value: e.target.value });
              if (error) setError(null);
            }}
            placeholder="Ví dụ: 50"
          />
        </FormField>
      </div>
    </Modal>
  );
}

