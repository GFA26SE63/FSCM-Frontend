import { useMemo, useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import {
  Button,
  Chip,
  DataTable,
  PageHeader,
  StatusChip,
  type Column,
} from '@/shared/ui';
import { formatDate } from '@/shared/lib';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { useWarehouses } from '@/features/warehouses/hooks';
import { useProducts } from '@/features/products/hooks';
import { useBatches, useBatchLocks } from '../hooks';
import {
  LockBatchDialog,
  ReleaseBatchLockDialog,
} from '../components/BatchLockDialog';
import type { BatchInventoryItem, InventoryLockItem } from '../types';

export function BatchesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canLock = can(user, 'inventory.lock');

  // Backend includeExpired toggle
  const [includeExpired, setIncludeExpired] = useState<boolean>(false);

  // Queries (100% Real API)
  const { data: warehouses = [] } = useWarehouses();
  const { data: products = [] } = useProducts();

  const queryFilters = useMemo(
    () => ({
      includeExpired,
    }),
    [includeExpired],
  );

  const query = useBatches(queryFilters);
  const { data: allActiveLocks = [] } = useBatchLocks({ status: 'Active' });

  // Map of batchId/batchCode -> active lock
  const activeLockByBatch = useMemo(() => {
    const map = new Map<string, InventoryLockItem>();
    allActiveLocks.forEach((lock) => {
      if (lock.batchId) map.set(lock.batchId, lock);
      if (lock.batchCode) map.set(lock.batchCode, lock);
    });
    return map;
  }, [allActiveLocks]);

  const rows = useMemo(() => query.data ?? [], [query.data]);

  // Dialog states for F100-FE operations
  const [lockTarget, setLockTarget] = useState<BatchInventoryItem | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<InventoryLockItem | null>(null);

  // Dynamic filter options
  const warehouseOptions = useMemo(() => {
    const set = new Set<string>();
    warehouses.forEach((w) => w.name && set.add(w.name));
    rows.forEach((r) => r.warehouseName && set.add(r.warehouseName));
    return Array.from(set);
  }, [warehouses, rows]);

  const productOptions = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.sku && set.add(p.sku));
    rows.forEach((r) => r.sku && set.add(r.sku));
    return Array.from(set);
  }, [products, rows]);

  const columns: Column<BatchInventoryItem>[] = [
    {
      key: 'code',
      header: 'Batch',
      width: '180px',
      render: (b) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="bold">{b.batchCode}</span>
          {b.hasLockRequiringResolution && (
            <span style={{ fontSize: 11, color: '#C53030', fontWeight: 600 }}>
              Cần xử lý khóa
            </span>
          )}
        </div>
      ),
      text: (b) => b.batchCode,
    },
    {
      key: 'wh',
      header: 'Kho',
      width: '140px',
      render: (b) => <span>{b.warehouseName}</span>,
      text: (b) => b.warehouseName,
    },
    {
      key: 'product',
      header: 'Sản phẩm',
      width: '210px',
      render: (b) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{b.productName}</div>
          <div className="muted small">SKU: {b.sku}</div>
        </div>
      ),
      text: (b) => `${b.sku} ${b.productName}`,
    },
    {
      key: 'expiry',
      header: 'HSD',
      width: '130px',
      render: (b) => {
        const days = b.remainingDays;
        return (
          <div>
            <div>{formatDate(b.expirationDate)}</div>
            {days !== undefined && b.expiryStatus !== 'Disposed' && (
              <div
                className="muted small"
                style={{
                  color: days <= 0 ? '#E53E3E' : days <= 45 ? '#D69E2E' : undefined,
                  fontWeight: days <= 45 ? 600 : 400,
                }}
              >
                {days <= 0 ? 'Đã hết hạn' : `Còn ${days} ngày`}
              </div>
            )}
          </div>
        );
      },
      text: (b) => formatDate(b.expirationDate),
    },
    {
      key: 'status',
      header: 'Tình trạng',
      width: '115px',
      render: (b) => (
        <StatusChip domain="expiry" value={b.expiryStatus} />
      ),
      text: (b) => b.expiryStatus,
    },
    {
      key: 'onHand',
      header: 'Tồn thực tế',
      width: '95px',
      align: 'right',
      render: (b) => (
        <span style={{ fontWeight: 600, color: '#4A5568' }}>
          {b.onHandQuantity.toLocaleString('vi-VN')}
        </span>
      ),
      text: (b) => String(b.onHandQuantity),
    },
    {
      key: 'reserved',
      header: 'Đã giữ',
      width: '85px',
      align: 'right',
      render: (b) => (
        <span
          style={{
            fontWeight: b.reservedQuantity > 0 ? 600 : 400,
            color: b.reservedQuantity > 0 ? '#2B6CB0' : '#A0AEC0',
          }}
        >
          {b.reservedQuantity.toLocaleString('vi-VN')}
        </span>
      ),
      text: (b) => String(b.reservedQuantity),
    },
    {
      key: 'locked',
      header: 'Bị khóa',
      width: '110px',
      align: 'right',
      render: (b) => {
        if (b.lockedQuantity <= 0) {
          return <span style={{ color: '#CBD5E0' }}>0</span>;
        }
        const lock = activeLockByBatch.get(b.batchId) || activeLockByBatch.get(b.batchCode);
        return (
          <div
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: lock ? 'pointer' : undefined }}
            title={lock ? `Lý do: ${lock.reason}${lock.note ? ' - ' + lock.note : ''}` : 'Đang bị khóa kiểm định'}
            onClick={() => lock && canLock && setReleaseTarget(lock)}
          >
            <span style={{ color: '#E53E3E', fontWeight: 700 }}>
              {b.lockedQuantity.toLocaleString('vi-VN')}
            </span>
            <Chip tone="danger">Khóa</Chip>
          </div>
        );
      },
      text: (b) => String(b.lockedQuantity),
    },
    {
      key: 'available',
      header: 'Có thể cấp',
      width: '110px',
      align: 'right',
      render: (b) => (
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 800,
            color: b.availableQuantity > 0 ? '#22543D' : '#A0AEC0',
            background: b.availableQuantity > 0 ? '#F0FFF4' : undefined,
            padding: '2px 6px',
            borderRadius: 4,
            border: b.availableQuantity > 0 ? '1px solid #C6F6D5' : undefined,
          }}
        >
          {b.availableQuantity.toLocaleString('vi-VN')}
        </span>
      ),
      text: (b) => String(b.availableQuantity),
    },
    {
      key: 'lockReason',
      header: 'Lý do khóa / Ghi chú',
      render: (b) => {
        if (b.lockedQuantity <= 0) {
          return <span className="muted small">—</span>;
        }
        const lock = activeLockByBatch.get(b.batchId) || activeLockByBatch.get(b.batchCode);
        if (!lock) {
          return <span style={{ color: '#C53030', fontSize: 12.5 }}>Khóa theo chỉ thị</span>;
        }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12.5 }}>
            <span style={{ fontWeight: 600, color: '#C53030' }}>
              {lock.reason}
            </span>
            {lock.note && <span className="muted small">{lock.note}</span>}
          </div>
        );
      },
      text: (b) => {
        const lock = activeLockByBatch.get(b.batchId) || activeLockByBatch.get(b.batchCode);
        return lock?.reason ?? '';
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Quản lý batch"
        subtitle="Tồn theo kho – SKU – hạn sử dụng. Khả dụng = tồn − tạm giữ / Reserved − bị khóa / Locked."
      />

      <DataTable
        title="Danh sách batch"
        rows={rows}
        loading={query.isLoading}
        error={query.error}
        rowKey={(b) => b.batchId || b.batchCode}
        columns={columns}
        searchPlaceholder="Mã batch, SKU, sản phẩm, kho…"
        filters={[
          {
            label: 'Kho',
            options: warehouseOptions,
            value: (b) => b.warehouseName,
          },
          {
            label: 'Sản phẩm (SKU)',
            options: productOptions,
            value: (b) => b.sku,
          },
          {
            label: 'Tình trạng HSD',
            options: ['Bình thường', 'Cận hạn', 'Hết hạn'],
            value: (b) =>
              b.expiryStatus === 'Normal'
                ? 'Bình thường'
                : b.expiryStatus === 'NearExpiry'
                  ? 'Cận hạn'
                  : 'Hết hạn',
          },
        ]}
        filterExtra={
          <label
            className="lbl"
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              userSelect: 'none',
              alignSelf: 'end',
              paddingBottom: 8,
            }}
          >
            <input
              type="checkbox"
              checked={includeExpired}
              onChange={(e) => setIncludeExpired(e.target.checked)}
            />
            <span style={{ fontSize: 13, fontWeight: 500 }}>Bao gồm lô hết hạn</span>
          </label>
        }
        actions={
          canLock ? (
            <Button
              variant="primary"
              onClick={() => {
                const firstAvail = rows.find((b) => b.availableQuantity > 0);
                if (firstAvail) setLockTarget(firstAvail);
              }}
            >
              Khóa tồn kho
            </Button>
          ) : undefined
        }
        onRowClick={(b) => navigate(`/batches/${b.batchId || b.batchCode}`)}
        rowActionsWidth="210px"
        rowActions={(b) => {
          const activeLock =
            activeLockByBatch.get(b.batchId) || activeLockByBatch.get(b.batchCode);
          return (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Button
                size="sm"
                onClick={() => navigate(`/batches/${b.batchId || b.batchCode}`)}
              >
                Xem
              </Button>

              {canLock && b.availableQuantity > 0 && (
                <Button
                  size="sm"
                  onClick={() => setLockTarget(b)}
                  title="Khóa một phần hoặc toàn bộ số lượng khả dụng "
                >
                  Khóa
                </Button>
              )}

              {canLock && b.lockedQuantity > 0 && activeLock && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setReleaseTarget(activeLock)}
                  title="Mở khóa số lượng đang niêm phong "
                >
                  Mở khóa
                </Button>
              )}
            </div>
          );
        }}
      />

      {/* F100 Dialogs */}
      {canLock && (
        <>
          <LockBatchDialog
            open={lockTarget !== null}
            batch={lockTarget}
            onClose={() => setLockTarget(null)}
          />
          <ReleaseBatchLockDialog
            open={releaseTarget !== null}
            lock={releaseTarget}
            onClose={() => setReleaseTarget(null)}
          />
        </>
      )}
    </>
  );
}
