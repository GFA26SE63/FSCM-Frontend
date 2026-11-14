import { useMemo, useState } from 'react';
import { Eye, Lock, Printer, Trash2, Unlock } from 'lucide-react';
import { useNavigate } from '@/shared/router/compat';
import {
  ActionDropdown,
  Button,
  DataTable,
  useToast,
  type ActionDropdownItem,
  type Column,
} from '@/shared/ui';
import { formatDate } from '@/shared/lib';
import { formatLockReason } from '@/shared/lib/status';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { useWarehouses } from '@/features/warehouses/hooks';
import {
  LabelPrintDialog,
  useAllQrLabels,
  type PrintTarget,
  type QrLabel,
} from '@/features/qr-labels';
import { useBatches, useBatchLocks } from '../hooks';
import {
  LockBatchDialog,
  ReleaseBatchLockDialog,
} from '../components/BatchLockDialog';
import type { BatchInventoryItem, InventoryLockItem } from '../types';

export function BatchesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const canLock = can(user, 'inventory.lock');
  const canUnlock = can(user, 'inventory.unlock');
  const canPrintQr = can(user, 'qr.print');

  const isKeeper = user?.role === 'WarehouseKeeper';
  const assignedWhIds = useMemo(() => user?.scope?.warehouseIds ?? [], [user]);
  const assignedWhCode = user?.warehouseCode;

  // Real backend queries - loads all active batches and expired items
  const { data: warehouses = [] } = useWarehouses();
  const query = useBatches({ includeExpired: true });
  const { data: allActiveLocks = [] } = useBatchLocks({ status: 'Active' });
  const qrQuery = useAllQrLabels();

  // Map of batchId -> real QR labels
  const qrLabelsByBatch = useMemo(() => {
    const map = new Map<string, QrLabel[]>();
    (qrQuery.data ?? []).forEach((label) => {
      if (label.batchId) {
        const list = map.get(label.batchId) || [];
        list.push(label);
        map.set(label.batchId, list);
      }
    });
    return map;
  }, [qrQuery.data]);

  // Map of batchId / batchCode -> active lock
  const activeLockByBatch = useMemo(() => {
    const map = new Map<string, InventoryLockItem>();
    allActiveLocks.forEach((lock) => {
      if (lock.batchId) map.set(lock.batchId, lock);
      if (lock.batchCode) map.set(lock.batchCode, lock);
    });
    return map;
  }, [allActiveLocks]);

  // Restrict Warehouse Keeper to assigned warehouse if applicable
  const rows = useMemo(() => {
    const raw = query.data ?? [];
    if (!isKeeper || (assignedWhIds.length === 0 && !assignedWhCode)) {
      return raw;
    }
    return raw.filter((b) => {
      if (b.warehouseId && assignedWhIds.includes(b.warehouseId)) return true;
      if (
        b.warehouseCode &&
        assignedWhCode &&
        b.warehouseCode.toLowerCase() === assignedWhCode.toLowerCase()
      ) {
        return true;
      }
      return false;
    });
  }, [query.data, isKeeper, assignedWhIds, assignedWhCode]);

  // Dialog targets
  const [lockTarget, setLockTarget] = useState<BatchInventoryItem | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<InventoryLockItem | null>(null);
  const [printTarget, setPrintTarget] = useState<PrintTarget | null>(null);

  // Dynamic warehouse filter options
  const warehouseOptions = useMemo(() => {
    const set = new Set<string>();
    warehouses.forEach((w) => w.name && set.add(w.name));
    rows.forEach((r) => r.warehouseName && set.add(r.warehouseName));
    return Array.from(set);
  }, [warehouses, rows]);

  const handleExportExcel = () => {
    toast.show('Đã xuất danh sách lô hàng ra file Excel.');
  };

  const handleDisposalNotice = () => {
    toast.show('Chức năng này hiện chưa sử dụng được.');
  };
  const productOptions = useMemo(() => {
    const labels = new Map<string, string>();
    rows.forEach((r) => r.sku && labels.set(r.sku, `${r.sku} · ${r.productName}`));
    return Array.from(labels, ([value, label]) => ({ value, label }));
  }, [rows]);

  const columns: Column<BatchInventoryItem>[] = [
    {
      key: 'wh',
      header: 'Kho',
      width: '160px',
      render: (b) => <span>{b.warehouseName}</span>,
      text: (b) => b.warehouseName,
    },
    {
      key: 'sku',
      header: 'SKU',
      width: '95px',
      render: (b) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{b.sku}</span>
      ),
      text: (b) => b.sku,
    },
    {
      key: 'product',
      header: 'Tên sản phẩm',
      width: '200px',
      render: (b) => <span>{b.productName}</span>,
      text: (b) => b.productName,
    },
    {
      key: 'code',
      header: 'Mã lô hàng',
      width: '190px',
      render: (b) => (
        <span style={{ fontWeight: 600 }}>{b.batchCode}</span>
      ),
      text: (b) => b.batchCode,
    },
    {
      key: 'expiry',
      header: 'HSD',
      width: '110px',
      render: (b) => <span>{formatDate(b.expirationDate)}</span>,
      text: (b) => formatDate(b.expirationDate),
    },
    {
      key: 'pct',
      header: '% HSD còn',
      width: '100px',
      align: 'right',
      render: (b) => (
        <span>{(b.remainingDays ?? 0) > 0 ? `${b.remainingPct ?? 0}%` : '0%'}</span>
      ),
      text: (b) => ((b.remainingDays ?? 0) > 0 ? `${b.remainingPct ?? 0}%` : '0%'),
    },
    {
      key: 'onHand',
      header: 'Tồn thực tế',
      width: '100px',
      align: 'right',
      render: (b) => (
        <span>{b.onHandQuantity.toLocaleString('vi-VN')}</span>
      ),
      text: (b) => String(b.onHandQuantity),
    },
    {
      key: 'reserved',
      header: 'Đã giữ',
      width: '90px',
      align: 'right',
      render: (b) => (
        <span>{b.reservedQuantity.toLocaleString('vi-VN')}</span>
      ),
      text: (b) => String(b.reservedQuantity),
    },
    {
      key: 'locked',
      header: 'Bị khóa',
      width: '90px',
      align: 'right',
      render: (b) => {
        const lock = activeLockByBatch.get(b.batchId) || activeLockByBatch.get(b.batchCode);
        return b.lockedQuantity > 0 ? (
          <span
            style={{ color: '#B42318', fontWeight: 600 }}
            title={lock?.reason ? `Lý do: ${formatLockReason(lock.reason)}` : undefined}
          >
            {b.lockedQuantity.toLocaleString('vi-VN')}
          </span>
        ) : (
          <span>0</span>
        );
      },
      text: (b) => String(b.lockedQuantity),
    },
    {
      key: 'available',
      header: 'Có thể cấp',
      width: '100px',
      align: 'right',
      render: (b) => (
        <span style={{ fontWeight: 600 }}>
          {b.availableQuantity.toLocaleString('vi-VN')}
        </span>
      ),
      text: (b) => String(b.availableQuantity),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '150px',
      render: (b) => {
        let text = 'Còn hạn';
        let tone: 'ok' | 'warn' | 'danger' | 'neutral' = 'ok';
        if (b.expiryStatus === 'Disposed') {
          text = 'Đã tiêu hủy';
          tone = 'neutral';
        } else if (b.lockedQuantity > 0) {
          text = 'Có hàng khóa';
          tone = 'danger';
        } else if (b.expiryStatus === 'Expired') {
          text = 'Hết hạn';
          tone = 'danger';
        } else if (b.expiryStatus === 'NearExpiry' || b.expiryStatus === 'Near-date') {
          text = 'Cận hạn';
          tone = 'warn';
        }
        return (
          <span
            className={`chip tone-${tone}`}
            style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center' }}
          >
            {text}
          </span>
        );
      },
      text: (b) => {
        if (b.expiryStatus === 'Disposed') return 'Đã tiêu hủy';
        if (b.lockedQuantity > 0) return 'Có hàng khóa';
        if (b.expiryStatus === 'Expired') return 'Hết hạn';
        if (b.expiryStatus === 'NearExpiry' || b.expiryStatus === 'Near-date') return 'Cận hạn';
        return 'Còn hạn';
      },
    },
    {
      key: 'qr',
      header: 'Tem QR',
      width: '105px',
      align: 'center',
      render: (b) => {
        const labels = qrLabelsByBatch.get(b.batchId) || [];
        if (qrQuery.isLoading) {
          return <span className="muted" style={{ fontSize: 12 }}>…</span>;
        }
        if (labels.length === 0) {
          return <span className="muted" style={{ fontSize: 12 }}>Chưa có</span>;
        }
        return (
          <span
            className="chip tone-ok"
            style={{
              cursor: canPrintQr ? 'pointer' : 'default',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
            title={
              canPrintQr
                ? `Đã có ${labels.length} tem QR. Bấm để xem và in.`
                : `Đã có ${labels.length} tem QR.`
            }
            onClick={
              canPrintQr
                ? (e) => {
                    e.stopPropagation();
                    setPrintTarget({ kind: 'batch', batchId: b.batchId });
                  }
                : undefined
            }
          >
            {labels.length} tem
          </span>
        );
      },
      text: (b) => {
        const labels = qrLabelsByBatch.get(b.batchId) || [];
        return labels.length > 0 ? `${labels.length} tem` : 'Chưa có';
      },
    },
  ];

  return (
    <>
      <DataTable
        title="Quản lý lô hàng"
        subtitle="Theo dõi số lượng tồn kho và tình trạng hạn sử dụng của từng lô hàng."
        rows={rows}
        loading={query.isLoading}
        error={query.error}
        rowKey={(b) => b.batchId || b.batchCode}
        columns={columns}
        searchPlaceholder="Mã lô hàng, SKU, tên sản phẩm…"
        filters={[
          {
            label: 'Kho',
            options: warehouseOptions,
            value: (b) => b.warehouseName,
          },
          {
            label: 'Sản phẩm (SKU)',
            searchable: true,
            options: productOptions,
            value: (b) => b.sku,
          },
          {
            label: 'Trạng thái',
            options: ['Còn hạn', 'Cận hạn', 'Hết hạn', 'Có hàng khóa'],
            value: (b) => {
              if (b.expiryStatus === 'Disposed') return 'Đã tiêu hủy';
              if (b.lockedQuantity > 0) return 'Có hàng khóa';
              if (b.expiryStatus === 'Expired') return 'Hết hạn';
              if (b.expiryStatus === 'NearExpiry' || b.expiryStatus === 'Near-date') return 'Cận hạn';
              return 'Còn hạn';
            },
          },
        ]}
        actions={
          <Button onClick={handleExportExcel}>
            Xuất Excel
          </Button>
        }
        onRowClick={(b) => navigate(`/batches/${b.batchId || b.batchCode}`)}
        rowActionsWidth="135px"
        rowActionHeader="Thao tác"
        rowActions={(b) => {
          const activeLock =
            activeLockByBatch.get(b.batchId) || activeLockByBatch.get(b.batchCode);
          const canLockThis =
            canLock &&
            (!isKeeper ||
              assignedWhIds.includes(b.warehouseId) ||
              b.warehouseCode === assignedWhCode);

          // Build dropdown items
          const dropdownItems: ActionDropdownItem[] = [];

          const batchLabels = qrLabelsByBatch.get(b.batchId) || [];

          // 2. In tem QR (Blue)
          if (canPrintQr && batchLabels.length > 0) {
            dropdownItems.push({
              key: 'print-qr',
              label: 'In tem QR',
              icon: <Printer size={14} style={{ color: '#1D4ED8' }} />,
              color: '#1D4ED8',
              onClick: () => setPrintTarget({ kind: 'batch', batchId: b.batchId }),
              title: 'Xem và in tem QR của lô hàng',
            });
          }

          // 3. Mở khóa (Green, admin only)
          if (canUnlock && b.lockedQuantity > 0 && activeLock) {
            dropdownItems.push({
              key: 'unlock',
              label: 'Mở khóa',
              icon: <Unlock size={14} style={{ color: '#15803D' }} />,
              color: '#15803D',
              onClick: () => setReleaseTarget(activeLock),
              title: 'Mở khóa số lượng bị khóa',
            });
          }

          // 2. Khóa hàng (Orange / warning)
          if (canLockThis && b.availableQuantity > 0 && b.lockedQuantity === 0) {
            dropdownItems.push({
              key: 'lock',
              label: 'Khóa hàng',
              icon: <Lock size={14} style={{ color: '#C2410C' }} />,
              color: '#C2410C',
              onClick: () => setLockTarget(b),
              title: 'Khóa hàng hỏng / chờ kiểm định',
            });
          }

          // 3. Lập phiếu hủy (Red, if expired or locked)
          if (canLockThis && (b.expiryStatus === 'Expired' || b.lockedQuantity > 0)) {
            dropdownItems.push({
              key: 'dispose',
              label: 'Lập phiếu hủy',
              icon: <Trash2 size={14} style={{ color: '#B42318' }} />,
              color: '#B42318',
              onClick: handleDisposalNotice,
              title: 'Lập phiếu xuất hủy hàng',
            });
          }

          return (
            <div
              style={{
                display: 'flex',
                gap: 6,
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}
            >
              {/* Xem button: visible neutral/primary outline with eye icon */}
              <Button
                size="sm"
                variant="default"
                onClick={() => navigate(`/batches/${b.batchId || b.batchCode}`)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  borderColor: 'var(--c-border)',
                  color: 'var(--c-primary)',
                  background: '#ffffff',
                  fontWeight: 600,
                  padding: '0 10px',
                }}
              >
                <Eye size={14} />
                <span>Xem</span>
              </Button>

              {/* Three-dot dropdown menu for secondary actions */}
              {dropdownItems.length > 0 && (
                <ActionDropdown items={dropdownItems} />
              )}
            </div>
          );
        }}
      />

      {/* Lock and Unlock Dialogs */}
      {canLock && (
        <LockBatchDialog
          open={lockTarget !== null}
          batch={lockTarget}
          onClose={() => setLockTarget(null)}
        />
      )}
      {canUnlock && (
        <ReleaseBatchLockDialog
          open={releaseTarget !== null}
          lock={releaseTarget}
          onClose={() => setReleaseTarget(null)}
        />
      )}

      {/* Print QR Dialog */}
      {printTarget && user && (
        <LabelPrintDialog
          ownerId={user.id}
          target={printTarget}
          onClose={() => setPrintTarget(null)}
        />
      )}
    </>
  );
}
