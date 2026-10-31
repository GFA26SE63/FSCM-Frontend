import { useState } from 'react';
import { useParams } from '@/shared/router/compat';
import {
  Button,
  Callout,
  Card,
  Chip,
  Fields,
  PageHeader,
  QueryState,
  SimpleTable,
  StatusChip,
} from '@/shared/ui';
import { formatCases, formatDate, formatDateTime } from '@/shared/lib';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { useBatch, useBatchLocks } from '../hooks';
import {
  LockBatchDialog,
  ReleaseBatchLockDialog,
} from '../components/BatchLockDialog';
import type { InventoryLockItem } from '../types';

export function BatchDetailPage() {
  const { code = '' } = useParams();
  const query = useBatch(code);
  const { user } = useAuth();

  const canLock = can(user, 'inventory.lock');
  const canViewHistory = can(user, 'inventory.viewHistory');

  const [lockOpen, setLockOpen] = useState(false);
  const [releaseTarget, setReleaseTarget] = useState<InventoryLockItem | null>(null);

  const batch = query.data;
  const { data: locks = [] } = useBatchLocks({
    batchId: batch?.batchId,
  });

  return (
    <QueryState query={query}>
      {(b) => (
        <>
          <PageHeader
            back="/batches"
            title={`Lô hàng (Batch) · ${b.batchCode}`}
            subtitle={`${b.sku} · ${b.productName} · Kho: ${b.warehouseName}`}
            chips={
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <StatusChip domain="expiry" value={b.expiryStatus} />
                {b.lockedQuantity > 0 && (
                  <Chip tone="danger">Bị khóa {b.lockedQuantity} thùng</Chip>
                )}
              </div>
            }
            actions={
              canLock && b.availableQuantity > 0 ? (
                <Button
                  variant="primary"
                  onClick={() => setLockOpen(true)}
                  style={{ background: '#C53030', borderColor: '#C53030' }}
                >
                  Khóa tồn kho
                </Button>
              ) : undefined
            }
          />

          {b.discountPct != null && (
            <Callout tone="info">
              Đang áp dụng chương trình giảm giá cận hạn {b.discountPct}% ({b.discountCode}) đến{' '}
              {formatDate(b.discountUntil)}.
            </Callout>
          )}

          <Card title="Chi tiết số lượng & Hạn sử dụng">
            <Fields
              cols={3}
              items={[
                { label: 'Kho lưu trữ', value: b.warehouseName },
                { label: 'Hạn sử dụng (HSD)', value: formatDate(b.expirationDate) },
                {
                  label: 'Thời gian HSD còn lại',
                  value:
                    b.expiryStatus === 'Disposed'
                      ? 'Đã tiêu hủy'
                      : `${b.remainingDays} ngày (${b.remainingPct}% / ${b.shelfLifeDays} ngày)`,
                },
                {
                  label: 'Tồn thực tế (Physical on-hand)',
                  value: (
                    <span style={{ fontWeight: 600, color: '#2D3748' }}>
                      {formatCases(b.onHandQuantity)}
                    </span>
                  ),
                },
                {
                  label: 'Đang giữ (Reserved)',
                  value: (
                    <span
                      style={{
                        fontWeight: b.reservedQuantity > 0 ? 600 : 400,
                        color: b.reservedQuantity > 0 ? '#3182CE' : undefined,
                      }}
                    >
                      {formatCases(b.reservedQuantity)}
                    </span>
                  ),
                },
                {
                  label: 'Bị khóa (Locked)',
                  value: (
                    <span
                      style={{
                        fontWeight: b.lockedQuantity > 0 ? 700 : 400,
                        color: b.lockedQuantity > 0 ? '#E53E3E' : undefined,
                      }}
                    >
                      {formatCases(b.lockedQuantity)}
                    </span>
                  ),
                },
                {
                  label: 'Lượng có thể cấp (Sellable / Khả dụng)',
                  value: (
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: b.availableQuantity > 0 ? '#22543D' : '#A0AEC0',
                        background: b.availableQuantity > 0 ? '#F0FFF4' : undefined,
                        padding: '2px 8px',
                        borderRadius: 4,
                        border: b.availableQuantity > 0 ? '1px solid #9AE6B4' : undefined,
                      }}
                    >
                      {formatCases(b.availableQuantity)}
                    </span>
                  ),
                },
                { label: 'Trạng thái tồn', value: b.stockStatus },
                {
                  label: 'Cập nhật lần cuối',
                  value: formatDateTime(b.updatedAt),
                },
              ]}
            />
          </Card>

          {/* F100 Active Locks Section */}
          <Card
            title={`Lệnh khóa tồn kho ${locks.length > 0 ? `(${locks.length})` : ''
              }`}
            flush
          >
            {locks.length === 0 ? (
              <div style={{ padding: '20px 24px', color: '#718096', fontSize: 13.5 }}>
                Không có lệnh khóa tồn kho nào cho lô này. Toàn bộ lượng tồn khả dụng đều sẵn sàng xuất bán.
              </div>
            ) : (
              <SimpleTable
                rows={locks}
                columns={[
                  {
                    header: 'Số lượng khóa',
                    align: 'right',
                    cell: (l) => (
                      <span style={{ fontWeight: 700, color: '#E53E3E' }}>
                        {l.lockedQuantity.toLocaleString('vi-VN')} thùng
                      </span>
                    ),
                  },
                  {
                    header: 'Trạng thái',
                    cell: (l) => (
                      <Chip tone={l.status === 'Active' ? 'danger' : 'ok'}>
                        {l.status === 'Active' ? 'Đang khóa' : 'Đã mở khóa'}
                      </Chip>
                    ),
                  },
                  {
                    header: 'Lý do khóa',
                    cell: (l) => (
                      <div>
                        <div style={{ fontWeight: 600 }}>{l.reason}</div>
                        {l.requiresResolution && l.status === 'Active' && (
                          <span style={{ color: '#C53030', fontSize: 11.5 }}>
                            ⚠️ Yêu cầu kiểm tra & xử lý
                          </span>
                        )}
                      </div>
                    ),
                  },
                  {
                    header: 'Ghi chú',
                    cell: (l) => l.note || '—',
                  },
                  {
                    header: 'Thời gian lập',
                    cell: (l) => formatDateTime(l.createdAt),
                  },
                  {
                    header: 'Thao tác',
                    align: 'center',
                    cell: (l) =>
                      l.status === 'Active' && canLock ? (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => setReleaseTarget(l)}
                        >
                          Mở khóa
                        </Button>
                      ) : l.releasedAt ? (
                        <span className="muted small">
                          Đã mở {formatDateTime(l.releasedAt)}
                        </span>
                      ) : (
                        '—'
                      ),
                  },
                ]}
              />
            )}
          </Card>

          {/* Lịch sử biến động tồn kho */}
          {canViewHistory ? (
            <Card
              title="Lịch sử biến động tồn kho (Nhập / Xuất / Khóa / Mở khóa / Hủy)"
              flush
            >
              {(b.history ?? []).length === 0 ? (
                <div style={{ padding: '20px 24px', color: '#718096', fontSize: 13.5 }}>
                  Chưa có ghi nhận giao dịch nhập / xuất nào cho lô này.
                </div>
              ) : (
                <SimpleTable
                  rows={b.history ?? []}
                  columns={[
                    {
                      header: 'Thời gian',
                      cell: (h) => formatDateTime(h.occurredAt),
                    },
                    {
                      header: 'Loại giao dịch',
                      cell: (h) => {
                        const typeMap: Record<string, { label: string; tone: 'ok' | 'info' | 'danger' | 'warn' | 'neutral' | 'violet' }> = {
                          Receipt: { label: 'Nhập kho', tone: 'ok' },
                          Issue: { label: 'Xuất kho', tone: 'info' },
                          Shipment: { label: 'Giao hàng', tone: 'info' },
                          Reservation: { label: 'Tạm giữ', tone: 'info' },
                          Lock: { label: 'Khóa tồn', tone: 'danger' },
                          Release: { label: 'Mở khóa', tone: 'warn' },
                          Disposal: { label: 'Tiêu hủy', tone: 'danger' },
                          Transfer: { label: 'Điều chuyển', tone: 'violet' },
                        };
                        const conf = typeMap[h.transactionType] || { label: h.transactionType, tone: 'neutral' };
                        return <Chip tone={conf.tone}>{conf.label}</Chip>;
                      },
                    },
                    {
                      header: 'Chứng từ / Mã tham chiếu',
                      cell: (h) => (
                        <span style={{ fontWeight: 600 }}>{h.referenceCode}</span>
                      ),
                    },
                    {
                      header: 'Thay đổi tồn thực tế',
                      align: 'right',
                      cell: (h) => (
                        <span
                          style={{
                            fontWeight: 600,
                            color:
                              h.onHandDelta > 0
                                ? '#2F855A'
                                : h.onHandDelta < 0
                                  ? '#C53030'
                                  : '#718096',
                          }}
                        >
                          {h.onHandDelta !== 0
                            ? (h.onHandDelta > 0 ? '+' : '') + h.onHandDelta
                            : '—'}
                        </span>
                      ),
                    },
                    {
                      header: 'Thay đổi đã giữ',
                      align: 'right',
                      cell: (h) => (
                        <span
                          style={{
                            fontWeight: 600,
                            color:
                              h.reservedDelta > 0
                                ? '#2B6CB0'
                                : h.reservedDelta < 0
                                  ? '#C53030'
                                  : '#718096',
                          }}
                        >
                          {h.reservedDelta !== 0
                            ? (h.reservedDelta > 0 ? '+' : '') + h.reservedDelta
                            : '—'}
                        </span>
                      ),
                    },
                    {
                      header: 'Có thể cấp sau GD',
                      align: 'right',
                      cell: (h) => (
                        <span style={{ fontWeight: 700, color: '#276749' }}>
                          {h.availableAfter}
                        </span>
                      ),
                    },
                    {
                      header: 'Ghi chú',
                      cell: (h) => h.note || '—',
                    },
                  ]}
                />
              )}
            </Card>
          ) : (
            <Callout tone="info">
              Tài khoản của bạn không có quyền xem lịch sử biến động chi tiết của lô hàng.
            </Callout>
          )}

          {/* F100 Modals */}
          {canLock && (
            <>
              <LockBatchDialog
                open={lockOpen}
                batch={b}
                onClose={() => setLockOpen(false)}
              />
              <ReleaseBatchLockDialog
                open={releaseTarget !== null}
                lock={releaseTarget}
                onClose={() => setReleaseTarget(null)}
              />
            </>
          )}
        </>
      )}
    </QueryState>
  );
}
