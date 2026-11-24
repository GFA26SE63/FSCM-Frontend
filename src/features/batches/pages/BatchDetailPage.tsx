import { SimpleTable } from '@/shared/ui';
import { useState } from 'react';
import { Link, useParams } from '@/shared/router/compat';
import { useReturnToList } from '@/shared/router/listState';
import {
  //Chip,
  QueryState,
  useToast,
} from '@/shared/ui';
import { formatDate, formatDateTime } from '@/shared/lib';
import { formatLockReason } from '@/shared/lib/status';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { useBatch, useBatchCartons, useBatchLocks } from '../hooks';
import { useReceiptUserNames } from '@/features/receipts/userNames';
import { QrLabelsPanel } from '@/features/qr-labels';
import {
  LockBatchDialog,
  ReleaseBatchLockDialog,
} from '../components/BatchLockDialog';
import type { BatchCarton, InventoryHistoryItem, InventoryLockItem } from '../types';

/**
 * Resolves the pallet IDs associated with a specific transaction in batch history.
 *
 * Relationship analysis:
 * - Receipt transactions (Receipt / GoodsReceipt / PurchaseReceipt / PN-*):
 *   Cartons created or received via a Goods Receipt have `receiptCode` matching `referenceCode`.
 *   Each carton records its assigned `palletCode` (or null if unassigned).
 *   We collect and deduplicate all pallet codes from cartons belonging to that receipt.
 * - Explicit Carton / Pallet references:
 *   If referenceCode directly matches a cartonCode or palletCode in the batch's carton inventory.
 * - Other transactions (Lock, Release, OrderReserve, TransferReserve, Disposal, Adjustment):
 *   In FSCM, allocation, locking, adjustment, and disposal operate at the batch level, not the pallet level.
 *   The Backend does not record pallet IDs for these transactions.
 *   Per specification: "Do not assign the same pallet to every transaction merely because the transactions
 *   belong to the same Batch. If no pallet is assigned or associated, display 'Chưa gán pallet'."
 */
function getPalletsForTransaction(h: InventoryHistoryItem, cartons: BatchCarton[]): string[] {
  if (!h.referenceCode || !cartons.length) return [];
  const ref = h.referenceCode.trim().toLowerCase();

  // 1. Match by receiptCode (Goods Receipt transactions)
  const matchingByReceipt = cartons.filter(
    (c) => c.receiptCode && c.receiptCode.trim().toLowerCase() === ref,
  );
  if (matchingByReceipt.length > 0) {
    const pallets = matchingByReceipt
      .map((c) => c.palletCode?.trim())
      .filter((p): p is string => Boolean(p));
    return Array.from(new Set(pallets));
  }

  // 2. Direct match by palletCode (if referenceCode is a Pallet ID)
  const matchingPallet = cartons.find(
    (c) => c.palletCode && c.palletCode.trim().toLowerCase() === ref,
  );
  if (matchingPallet && matchingPallet.palletCode) {
    return [matchingPallet.palletCode.trim()];
  }

  // 3. Direct match by cartonCode (if referenceCode is a Carton ID)
  const matchingByCarton = cartons.filter(
    (c) => c.cartonCode && c.cartonCode.trim().toLowerCase() === ref,
  );
  if (matchingByCarton.length > 0) {
    const pallets = matchingByCarton
      .map((c) => c.palletCode?.trim())
      .filter((p): p is string => Boolean(p));
    return Array.from(new Set(pallets));
  }

  return [];
}

export function BatchDetailPage() {
  const { code = '' } = useParams();
  const returnToList = useReturnToList();
  const query = useBatch(code);
  const { user } = useAuth();
  const toast = useToast();

  const canLock = can(user, 'inventory.lock');
  const canUnlock = can(user, 'inventory.unlock');

  const isKeeper = user?.role === 'WarehouseKeeper';
  const assignedWhIds = user?.scope?.warehouseIds ?? [];
  const assignedWhCode = user?.warehouseCode;

  const [lockOpen, setLockOpen] = useState(false);
  const [releaseTarget, setReleaseTarget] = useState<InventoryLockItem | null>(null);

  const batch = query.data;
  const { data: locks = [] } = useBatchLocks({
    batchId: batch?.batchId,
  });

  const activeLock = locks.find((l) => l.status === 'Active');
  const cartons = useBatchCartons(batch?.batchId, batch?.batchCode);
  const users = useReceiptUserNames((batch?.history ?? []).map((h) => h.createdByUserId));

  const handleDisposalNotice = () => {
    toast.show('Chức năng này hiện chưa sử dụng được.');
  };

  return (
    <QueryState query={query}>
      {(b) => {
        const canLockThisBatch =
          canLock &&
          (!isKeeper ||
            (b.warehouseId && assignedWhIds.includes(b.warehouseId)) ||
            (b.warehouseCode && b.warehouseCode === assignedWhCode));

        const isLocked = b.lockedQuantity > 0 || !!activeLock;
        const isExpired = b.expiryStatus === 'Expired';
        const isNear = b.expiryStatus === 'NearExpiry' || b.expiryStatus === 'Near-date';

        const statusLabel = isLocked
          ? 'Có hàng khóa'
          : isExpired
            ? 'Hết hạn'
            : isNear
              ? 'Cận hạn'
              : 'Còn hạn';

        const statusStyle = isLocked
          ? { background: '#FDECEA', color: '#B42318' }
          : isExpired
            ? { background: '#FDECEA', color: '#B42318' }
            : isNear
              ? { background: '#FEF3E2', color: '#8A3B09' }
              : { background: '#E5F4EA', color: '#15703A' };

        const discountRuleText =
          b.discountPct != null
            ? `Giảm ${b.discountPct}% (${b.discountCode || 'Chính sách cận hạn'})`
            : 'Không áp dụng giảm giá';

        return (
          <div
            className="vscroll"
            style={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            {/* Top Bar matching Prototype Generic Detail */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                className="btn"
                onClick={() => returnToList('/batches')}
              >
                ← Quay lại
              </button>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 18 }}>
                  Lô hàng {b.batchCode}
                </span>
                <span className="chip" style={statusStyle}>
                  {statusLabel}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>

                {isLocked ? (
                  <>
                    {canUnlock && activeLock && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setReleaseTarget(activeLock)}
                      >
                        Mở khóa
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-danger-solid"
                      onClick={handleDisposalNotice}
                    >
                      Lập phiếu hủy
                    </button>
                  </>
                ) : (
                  canLockThisBatch && (
                    <button
                      type="button"
                      className="btn btn-danger-solid"
                      onClick={() => setLockOpen(true)}
                    >
                      Khóa hàng hỏng / hết hạn
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Fields Card - 2-column grid matching prototype */}
            <section className="card" style={{ padding: '20px 24px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  columnGap: 64,
                  rowGap: 14,
                }}
              >
                <div className="fv">
                  <span className="fl">Mã lô hàng</span>
                  <span className="fval">{b.batchCode}</span>
                </div>
                <div className="fv">
                  <span className="fl">Sản phẩm</span>
                  <span className="fval">{b.sku} · {b.productName}</span>
                </div>
                <div className="fv">
                  <span className="fl">Kho lưu trữ</span>
                  <span className="fval">{b.warehouseName}</span>
                </div>
                <div className="fv">
                  <span className="fl">Hạn sử dụng</span>
                  <span className="fval">
                    {formatDate(b.expirationDate)} · còn {(b.remainingDays ?? 0) > 0 ? b.remainingDays : 0} ngày (
                    {(b.remainingDays ?? 0) > 0 ? (b.remainingPct ?? 0) : 0}% tổng hạn dùng)
                  </span>
                </div>
                <div className="fv">
                  <span className="fl">Tồn thực tế</span>
                  <span className="fval">{b.onHandQuantity.toLocaleString('vi-VN')} thùng</span>
                </div>
                <div className="fv">
                  <span className="fl">Đã giữ cho đơn</span>
                  <span className="fval">{b.reservedQuantity.toLocaleString('vi-VN')} thùng</span>
                </div>
                <div className="fv">
                  <span className="fl">Bị khóa</span>
                  <span className="fval">
                    {isLocked
                      ? `${b.lockedQuantity.toLocaleString('vi-VN')} thùng · ${formatLockReason(activeLock?.reason)}`
                      : '0'}
                  </span>
                </div>
                <div className="fv">
                  <span className="fl">Có thể cấp</span>
                  <span className="fval">
                    {(isExpired ? 0 : b.availableQuantity).toLocaleString('vi-VN')} thùng
                  </span>
                </div>
                <div className="fv" style={{ gridColumn: 'span 2' }}>
                  <span className="fl">Chính sách giảm giá hạn sử dụng</span>
                  <span className="fval">
                    {discountRuleText}
                  </span>
                </div>
              </div>
            </section>

            {/* Warning block if locked */}
            {isLocked && (
              <section
                className="card"
                style={{
                  padding: 16,
                  background: '#FFF8E6',
                  borderColor: '#F0D590',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <h2 className="sec" style={{ color: '#8A3B09' }}>
                  Hàng bị khóa: {formatLockReason(activeLock?.reason)}
                </h2>
                <span style={{ fontSize: 13.5, lineHeight: 1.55 }}>
                  {activeLock?.note ? `${activeLock.note}. ` : ''}Số lượng bị khóa sẽ không được cấp phát cho đơn hàng mới.
                  {b.hasLockRequiringResolution && (
                    <> Lượng khóa ảnh hưởng đến số lượng đã giữ cho đơn hàng. Vui lòng kiểm tra và xử lý các đơn hàng liên quan trước khi xuất hủy.</>
                  )}
                </span>
              </section>
            )}

            {/* Table 1: Đơn hàng đang giữ lô hàng này */}
            <section
              className="card"
              style={{
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="sec">Đơn hàng đang giữ lô hàng này</h2>
              </div>
              <p className="muted">
                {b.reservedQuantity === 0
                  ? 'Không có đơn hàng nào đang giữ lô hàng này.'
                  : `Đang có ${b.reservedQuantity.toLocaleString('vi-VN')} thùng được giữ cho các đơn hàng xuất kho.`}
              </p>
            </section>

            {/* Table 2: Lịch sử nhập – xuất – khóa */}
            <section
              className="card"
              style={{
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="sec">Lịch sử nhập – xuất – khóa</h2>
              </div>
              <div className="tbl-wrap">
                <SimpleTable paginate rows={(b.history ?? []).map((h, i) => {
                        const typeName =
                          h.transactionType === 'Receipt' || h.transactionType === 'GoodsReceipt'
                            ? 'Nhập kho'
                            : h.transactionType === 'Issue' || h.transactionType === 'Shipment'
                              ? 'Xuất kho'
                              : h.transactionType === 'Lock'
                                ? 'Khóa hàng'
                                : h.transactionType === 'Release'
                                  ? 'Mở khóa'
                                  : h.transactionType === 'Disposal'
                                    ? 'Xuất hủy'
                                    : h.transactionType;

                        const pallets = getPalletsForTransaction(h, cartons.data ?? []);

                        const qtyDelta =
                          h.onHandDelta !== 0
                            ? (h.onHandDelta > 0 ? `+${h.onHandDelta}` : `${h.onHandDelta}`)
                            : h.reservedDelta !== 0
                              ? (h.reservedDelta > 0 ? `+${h.reservedDelta}` : `${h.reservedDelta}`)
                              : '—';

                         return { h, i, typeName, pallets, qtyDelta }; })} empty="Chưa có ghi nhận giao dịch nhập / xuất nào cho lô hàng này." columns={[{ header: "Thời điểm", cell: ({ h }) => <>{formatDateTime(h.occurredAt)}</> },
{ header: "Loại giao dịch", width: '200px', cell: ({ typeName }) => <>
                              <span
                                className="chip"
                                style={
                                  typeName === 'Nhập kho'
                                    ? { background: '#E5F4EA', color: '#15703A' }
                                    : typeName === 'Xuất kho'
                                      ? { background: '#E8EEFD', color: '#1D4ED8' }
                                      : typeName === 'Khóa hàng'
                                        ? { background: '#FDECEA', color: '#B42318' }
                                        : typeName === 'Mở khóa'
                                          ? { background: '#FEF3E2', color: '#8A3B09' }
                                          : { background: '#ECEEF1', color: '#374151' }
                                }
                              >
                                {typeName}
                              </span>
                            </> },
{ header: "Chứng từ", cell: ({ h }) => <>
                              {h.referenceCode ? (
                                h.referenceCode.startsWith('PN-') ? (
                                  <Link
                                    to={`/receipts/${encodeURIComponent(h.referenceCode)}`}
                                    style={{ fontWeight: 600, wordBreak: 'break-all' }}
                                    title={h.referenceCode}
                                  >
                                    {h.referenceCode}
                                  </Link>
                                ) : h.referenceCode.startsWith('PNK-') || h.referenceCode.startsWith('WH-REC-') ? (
                                  <Link
                                    to={`/warehouse-inbound/${encodeURIComponent(h.referenceCode)}`}
                                    style={{ fontWeight: 600 }}
                                  >
                                    {h.referenceCode}
                                  </Link>
                                ) : (
                                  <span style={{ fontWeight: 600, wordBreak: 'break-all' }} title={h.referenceCode}>
                                    {h.referenceCode}
                                  </span>
                                )
                              ) : (
                                '—'
                              )}
                            </> },
{ header: "Pallet ID", cell: ({ pallets }) => <>
                              {pallets.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  {pallets.map((pid) => (
                                    <span key={pid} style={{ fontWeight: 600, wordBreak: 'break-all' }} title={pid}>
                                      {pid}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="muted" style={{ fontStyle: 'italic', fontSize: '13px' }}>
                                  Chưa gán pallet
                                </span>
                              )}
                            </> },
{ header: "Số lượng", cell: ({ qtyDelta }) => <>{qtyDelta}</> },
{ header: "Người thực hiện", cell: ({ h }) => <>{users.nameOf(h.createdByUserId)}</> }]} />
              </div>
            </section>

            {/* Table 3: Danh sách nhãn QR */}
            {b.batchId && (
              <QrLabelsPanel
                batchId={b.batchId}
                batchCode={b.batchCode}
                batch={b}
              />
            )}

            {/* Lock and Unlock Modals */}
            {canLock && (
              <LockBatchDialog
                open={lockOpen}
                batch={b}
                onClose={() => setLockOpen(false)}
              />
            )}
            {canUnlock && (
              <ReleaseBatchLockDialog
                open={releaseTarget !== null}
                lock={releaseTarget}
                onClose={() => setReleaseTarget(null)}
              />
            )}
          </div>
        );
      }}
    </QueryState>
  );
}
