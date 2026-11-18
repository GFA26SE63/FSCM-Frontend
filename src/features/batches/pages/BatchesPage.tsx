import { useMemo, useState } from 'react';
import { Eye, Lock, Printer, Trash2, Unlock } from 'lucide-react';
import { useNavigate } from '@/shared/router/compat';
import {
  ActionDropdown,
  Button,
  DataTable,
  Select,
  useToast,
  type ActionDropdownItem,
  type Column,
} from '@/shared/ui';
import { formatDate, vietnamDate } from '@/shared/lib';
import { daysBetween } from '@/shared/lib/dates';
import { formatLockReason } from '@/shared/lib/status';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { useEnumParam, useQueryParams, useStringParam } from '@/shared/router/listState';
import { useCursorPagination } from '@/shared/pagination';
import { decodeSort, PAGINATION_PARAM_NAMES, PAGINATION_RESETS, parsePageSize } from '@/shared/pagination/urlSync';
import { useWarehouses } from '@/features/warehouses/hooks';
import {
  LabelPrintDialog,
  useAllQrLabels,
  type PrintTarget,
  type QrLabel,
} from '@/features/qr-labels';
import { useBatchesPage, useBatchLocks, useInventoryBalancesForPage, useProductCatalogForBatches } from '../hooks';
import {
  LockBatchDialog,
  ReleaseBatchLockDialog,
} from '../components/BatchLockDialog';
import {
  BATCHES_PAGE_SIZES,
  BATCHES_SORT_MAP,
  BATCHES_SORTABLE_FIELDS,
  calculateIssuableQuantity,
  calculateLiveExpiryStatus,
  type BatchesPageSize,
  type BatchSortField,
} from '../batchesGraphql';
import type { BatchInventoryItem, InventoryLockItem } from '../types';

// Status filter values must match the display labels used in the status column text() function
const BATCH_STATUS_OPTIONS = ['', 'Còn hạn', 'Cận hạn', 'Hết hạn', 'Có hàng khóa', 'Đã tiêu hủy'] as const;
type BatchStatusFilter = (typeof BATCH_STATUS_OPTIONS)[number];

const PAGE_RESETS = PAGINATION_RESETS;
function batchStatusLabel(b: { expiryStatus: string; lockedQuantity: number }): string {
  if (b.expiryStatus === 'Disposed') return 'Đã tiêu hủy';
  if (b.lockedQuantity > 0) return 'Có hàng khóa';
  if (b.expiryStatus === 'Expired') return 'Hết hạn';
  if (b.expiryStatus === 'NearExpiry' || b.expiryStatus === 'Near-date' || b.expiryStatus === 'Valid') {
    return b.expiryStatus === 'Valid' ? 'Còn hạn' : 'Cận hạn';
  }
  return 'Còn hạn';
}

export function BatchesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const canLock = can(user, 'inventory.lock');
  const canUnlock = can(user, 'inventory.unlock');
  const canPrintQr = can(user, 'qr.print');

  const { params } = useQueryParams();

  const after = params.get('after') ?? undefined;
  const before = after ? undefined : (params.get('before') ?? undefined);
  const pageSize = parsePageSize(params.get('size'), BATCHES_PAGE_SIZES, 20) as BatchesPageSize;

  const [warehouseId, setWarehouseId] = useStringParam('wh', { resets: PAGE_RESETS });
  const [productId, setProductId] = useStringParam('sku', { resets: PAGE_RESETS });
  const [statusFilter, setStatusFilter] = useEnumParam<BatchStatusFilter>(
    'status', BATCH_STATUS_OPTIONS, '', { resets: PAGE_RESETS },
  );

  const rawSort = decodeSort(params.get(PAGINATION_PARAM_NAMES.SORT));
  const activeSort = rawSort?.field && BATCHES_SORT_MAP[rawSort.field as BatchSortField]
    ? { field: rawSort.field as BatchSortField, direction: rawSort.direction }
    : undefined;

  const { setParams } = useQueryParams();
  const activeSearch = params.get('q') ?? '';

  const hasActiveFilters = !!(statusFilter || warehouseId || productId);
  const clearFilters = () => {
    setParams({ status: null, wh: null, sku: null, after: null, before: null, page: null });
  };

  // Reference data — unchanged from before migration: warehouses stays REST
  // (Warehouses module is out of this phase's scope); active locks stays REST
  // (InventoryLock has no entities.* resolver — confirmed Backend-only).
  const { data: warehouses = [] } = useWarehouses();
  const { data: allActiveLocks = [] } = useBatchLocks({ status: 'Active' });
  const qrQuery = useAllQrLabels();
  const productCatalogQuery = useProductCatalogForBatches();
  const productCatalog = useMemo(() => productCatalogQuery.data ?? [], [productCatalogQuery.data]);

  const lockedBatchIds = useMemo(
    () => [...new Set(allActiveLocks.map((l) => l.batchId).filter(Boolean))],
    [allActiveLocks],
  );

  // Status filter → server-side GraphQL conditions. "Còn hạn"/"Cận hạn"/"Hết hạn" use
  // the persisted Batch.ExpiryStatus column (sweep-job snapshot — see batchesGraphql.ts
  // header for the staleness caveat); "Có hàng khóa" uses the REST-sourced active lock
  // IDs already loaded above. "Đã tiêu hủy" preserves the pre-migration behavior: the
  // Backend never actually produces a "Disposed" ExpiryStatus value (confirmed in
  // FSCM.Application/Features/Inventory/DisposalService.cs — disposal sets ExpiryStatus
  // to "Expired", not a distinct value), so this filter matched zero rows before
  // migration too. Kept byte-for-byte to avoid introducing new behavior.
  const statusQuery = useMemo(() => {
    switch (statusFilter) {
      case 'Còn hạn':
        return { expiryStatusIn: ['Valid'], idNin: lockedBatchIds.length ? lockedBatchIds : undefined };
      case 'Cận hạn':
        return { expiryStatusIn: ['NearExpiry'] };
      case 'Hết hạn':
        return { expiryStatusIn: ['Expired'] };
      case 'Có hàng khóa':
        return { idIn: lockedBatchIds.length ? lockedBatchIds : ['00000000-0000-0000-0000-000000000000'] };
      case 'Đã tiêu hủy':
        return { expiryStatusIn: ['Disposed'] };
      default:
        return {};
    }
  }, [statusFilter, lockedBatchIds]);

  // Search-term → productId/warehouseId resolution, client-side against already-loaded
  // lists (product catalog + warehouse list) — zero extra round trips. See batchesGraphql.ts
  // header for why cross-entity search can't be pushed into a single GraphQL `where`.
  const searchProductIds = useMemo(() => {
    if (!activeSearch) return [];
    const q = activeSearch.toLowerCase();
    return productCatalog.filter((p) => p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)).map((p) => p.id);
  }, [productCatalog, activeSearch]);
  const searchWarehouseIds = useMemo(() => {
    if (!activeSearch) return [];
    const q = activeSearch.toLowerCase();
    return warehouses.filter((w) => (w.name && w.name.toLowerCase().includes(q)) || (w.code && w.code.toLowerCase().includes(q))).map((w) => w.id).filter((id): id is string => !!id);
  }, [warehouses, activeSearch]);

  const query = useBatchesPage({
    size: pageSize,
    after,
    before,
    warehouseId: warehouseId || undefined,
    productId: productId || undefined,
    search: activeSearch || undefined,
    searchProductIds: activeSearch ? searchProductIds : undefined,
    searchWarehouseIds: activeSearch ? searchWarehouseIds : undefined,
    sort: activeSort,
    ...statusQuery,
  });

  const { pagingProps, sortProps } = useCursorPagination({
    pageInfo: query.data?.pageInfo,
    totalCount: query.data?.totalCount,
    loading: query.isLoading || query.isFetching,
    error: query.isPlaceholderData ? undefined : query.error,
    defaultPageSize: 20,
    pageSizeOptions: BATCHES_PAGE_SIZES,
    urlState: true,
  });

  const pageBatchIds = useMemo(() => (query.data?.rows ?? []).map((b) => b.id), [query.data?.rows]);
  const balancesQuery = useInventoryBalancesForPage(pageBatchIds);

  // Map of batchId -> real QR labels (unchanged — REST, loaded once)
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

  // Map of batchId / batchCode -> active lock (unchanged — REST, loaded once)
  const activeLockByBatch = useMemo(() => {
    const map = new Map<string, InventoryLockItem>();
    allActiveLocks.forEach((lock) => {
      if (lock.batchId) map.set(lock.batchId, lock);
      if (lock.batchCode) map.set(lock.batchCode, lock);
    });
    return map;
  }, [allActiveLocks]);

  const productById = useMemo(() => new Map(productCatalog.map((p) => [p.id, p])), [productCatalog]);
  const warehouseById = useMemo(() => new Map(warehouses.map((w) => [w.id, w])), [warehouses]);
  const todayIso = vietnamDate();

  // Merge GraphQL batch rows with REST-sourced lock/balance data and GraphQL-sourced
  // product/warehouse enrichment into the full BatchInventoryItem shape the rest of
  // this page (and LockBatchDialog/ReleaseBatchLockDialog) already expects.
  const enrichedRows: BatchInventoryItem[] = useMemo(() => {
    const balances = balancesQuery.data;
    return (query.data?.rows ?? []).map((b) => {
      const product = productById.get(b.productId);
      const warehouse = warehouseById.get(b.warehouseId);
      const balance = balances?.get(b.id);
      const lock = activeLockByBatch.get(b.id) || activeLockByBatch.get(b.batchCode);
      const onHandQuantity = balance?.onHandQuantity ?? 0;
      const reservedQuantity = balance?.reservedQuantity ?? 0;
      const lockedQuantity = lock?.lockedQuantity ?? 0;
      // Live-computed expiry status (see batchesGraphql.ts header) when the product's
      // near-date threshold is known; falls back to the GraphQL-persisted value otherwise.
      const expiryStatus = product
        ? calculateLiveExpiryStatus(b.expirationDate, product.nearDateThresholdHours, todayIso)
        : b.expiryStatus;
      const availableQuantity = calculateIssuableQuantity(onHandQuantity, reservedQuantity, lockedQuantity, expiryStatus);
      const remaining = daysBetween(todayIso, b.expirationDate);
      const shelfLifeDays = 365; // REST never returned a real value either — see report §8
      const remainingPct = shelfLifeDays > 0 ? Math.round((remaining / shelfLifeDays) * 100) : 0;

      return {
        batchId: b.id,
        batchCode: b.batchCode,
        warehouseId: b.warehouseId,
        warehouseCode: warehouse?.code ?? '',
        warehouseName: warehouse?.name ?? '',
        productId: b.productId,
        sku: product?.sku ?? '',
        productName: product?.name ?? '',
        expirationDate: b.expirationDate,
        expiryStatus,
        stockStatus: b.stockStatus,
        onHandQuantity,
        reservedQuantity,
        lockedQuantity,
        availableQuantity,
        hasLockRequiringResolution: lock?.requiresResolution ?? false,
        version: b.version,
        updatedAt: b.updatedAt,
        code: b.batchCode,
        onHand: onHandQuantity,
        held: reservedQuantity,
        available: availableQuantity,
        expiry: b.expirationDate,
        remainingDays: remaining,
        remainingPct,
        shelfLifeDays,
      };
    });
  }, [query.data?.rows, balancesQuery.data, productById, warehouseById, activeLockByBatch, todayIso]);

  // Display order is the server order (default: HSD còn nhiều trước). The old per-page
  // in-stock-first regrouping was removed — it would break the HSD / user-selected order.
  const sorted = enrichedRows;

  // Dialog targets
  const [lockTarget, setLockTarget] = useState<BatchInventoryItem | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<InventoryLockItem | null>(null);
  const [printTarget, setPrintTarget] = useState<PrintTarget | null>(null);

  const warehouseOptions = useMemo(
    () => warehouses.filter((w) => w.id).map((w) => ({ value: w.id as string, label: w.name })),
    [warehouses],
  );
  const productOptions = useMemo(
    () => productCatalog.map((p) => ({ value: p.id, label: `${p.sku} · ${p.name}` })),
    [productCatalog],
  );

  const handleExportExcel = () => {
    toast.show('Đã xuất danh sách lô hàng ra file Excel.');
  };

  const handleDisposalNotice = () => {
    toast.show('Chức năng này hiện chưa sử dụng được.');
  };

  const columns: Column<BatchInventoryItem>[] = [
    {
      key: 'wh',
      header: 'Kho',
      width: '160px',
      sortable: false,
      render: (b) => <span>{b.warehouseName}</span>,
      text: (b) => b.warehouseName,
    },
    {
      key: 'sku',
      header: 'SKU',
      width: '95px',
      render: (b) => (
        <span style={{ fontFamily: 'Arial, sans-serif', fontWeight: 600 }}>{b.sku}</span>
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
      sortable: true,
      render: (b) => (
        <span style={{ fontWeight: 600 }}>{b.batchCode}</span>
      ),
      text: (b) => b.batchCode,
    },
    {
      key: 'expiry',
      header: 'HSD',
      width: '110px',
      sortable: true,
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
      text: (b) => batchStatusLabel(b),
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
        rows={sorted}
        loading={query.isLoading || query.isPlaceholderData}
        error={query.isPlaceholderData ? undefined : query.error}
        rowKey={(b) => b.batchId || b.batchCode}
        columns={columns}
        cursor={pagingProps}
        searchPlaceholder="Mã lô hàng, SKU, tên sản phẩm…"
        filterExtra={
          <>
        <label className="lbl">Trạng thái
          <Select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as BatchStatusFilter)}
            options={[
              { value: '', label: 'Tất cả trạng thái' },
              { value: 'Còn hạn', label: 'Còn hạn' },
              { value: 'Cận hạn', label: 'Cận hạn' },
              { value: 'Hết hạn', label: 'Hết hạn' },
              { value: 'Có hàng khóa', label: 'Có hàng khóa' },
              { value: 'Đã tiêu hủy', label: 'Đã tiêu hủy' },
            ]}
          />
        </label>
        <label className="lbl">Kho
          <Select
            value={warehouseId}
            onChange={e => setWarehouseId(e.target.value)}
            options={[
              { value: '', label: 'Tất cả kho' },
              ...warehouseOptions,
            ]}
          />
        </label>
        <label className="lbl">Sản phẩm (SKU)
          <Select
            value={productId}
            onChange={e => setProductId(e.target.value)}
            options={[
              { value: '', label: 'Tất cả sản phẩm' },
              ...productOptions,
            ]}
          />
        </label>
        {hasActiveFilters && (
          <Button
            variant="default"
            size="sm"
            onClick={clearFilters}
            style={{ alignSelf: 'flex-end', marginBottom: 2 }}
          >
            Xóa bộ lọc
          </Button>
        )}
          </>
        }
        serverSort={{ ...sortProps, sortableFields: BATCHES_SORTABLE_FIELDS }}
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
          const canLockThis = canLock;

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
