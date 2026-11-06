import { del, get, getAll, post } from '@/shared/api/http';
import { ApiError, toApiError } from '@/shared/api/errors';
import { daysBetween } from '@/shared/lib/dates';
import type { BatchInventoryItem, InventoryLockItem } from '@/features/batches/types';
import type { Product } from '@/features/products/types';
import type {
  CreateDisposalInput,
  Disposal,
  DisposalCandidate,
  WriteOffAttachment,
} from './types';

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isUuid(value?: string | null): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export const disposalApi = {
  /**
   * Load real candidate batches eligible for write-off from backend inventory & locks.
   * Merges real data: inventory (expired batches), locks (damaged/expired locks), and product prices.
   */
  candidates: async (warehouseId?: string): Promise<DisposalCandidate[]> => {
    // 1. Fetch real batch inventory with expired batches included
    const rawBatches = await get<BatchInventoryItem[]>('/inventory', {
      includeExpired: true,
      warehouseId: warehouseId && isUuid(warehouseId) ? warehouseId : undefined,
    });
    const batchList = Array.isArray(rawBatches) ? rawBatches : [];

    // 2. Fetch active inventory locks
    const rawLocks = await get<InventoryLockItem[]>('/inventory-locks', {
      status: 'Active',
      warehouseId: warehouseId && isUuid(warehouseId) ? warehouseId : undefined,
    }).catch(() => [] as InventoryLockItem[]);
    const activeLocks = Array.isArray(rawLocks) ? rawLocks : [];

    const lockByBatch = new Map<string, InventoryLockItem>();
    activeLocks.forEach((l) => {
      if (l.batchId) lockByBatch.set(l.batchId, l);
      if (l.batchCode) lockByBatch.set(l.batchCode, l);
    });

    // 3. Fetch products to resolve unit price
    const productPrices = new Map<string, number>();
    try {
      const rawProds = await getAll<Product>('/products');
      rawProds.forEach((p) => {
        if (p.sku && p.currentUnitPrice != null) {
          productPrices.set(p.sku, p.currentUnitPrice);
        }
      });
    } catch {
      // Ignore product price lookup errors
    }

    const today = getTodayIso();
    const candidates: DisposalCandidate[] = [];

    batchList.forEach((b) => {
      const lock = lockByBatch.get(b.batchId) || lockByBatch.get(b.batchCode);
      const isExpired = b.expiryStatus === 'Expired';
      const isLockedForDisposal =
        b.lockedQuantity > 0 || (lock && (lock.reason === 'Expired' || lock.reason === 'Damaged'));

      // Only expired or damaged/locked batches are candidates for write-off
      if (!isExpired && !isLockedForDisposal) {
        return;
      }

      const onHand = Number(b.onHandQuantity ?? 0);
      const reserved = Number(b.reservedQuantity ?? 0);
      const locked = Number(b.lockedQuantity ?? (lock ? lock.lockedQuantity : 0));
      const available = Number(b.availableQuantity ?? Math.max(0, onHand - reserved - locked));

      // Eligible quantity is the portion of physical stock not held for existing customer orders
      const eligibleQuantity = Math.max(0, onHand - reserved);
      const isBlockedByReservation = reserved > 0 && reserved >= onHand;

      const overdueDays = b.expirationDate ? Math.max(0, daysBetween(b.expirationDate, today)) : 0;
      const unitPrice = productPrices.get(b.sku) ?? 0;
      const value = eligibleQuantity * unitPrice;

      candidates.push({
        batchId: b.batchId,
        batchCode: b.batchCode,
        warehouseId: b.warehouseId,
        warehouseCode: b.warehouseCode,
        warehouseName: b.warehouseName || b.warehouseCode,
        productId: b.productId,
        sku: b.sku,
        productName: b.productName || b.sku,
        expiry: b.expirationDate,
        daysOverdue: overdueDays,
        onHandQuantity: onHand,
        reservedQuantity: reserved,
        lockedQuantity: locked,
        availableQuantity: available,
        eligibleQuantity,
        unitPrice,
        value,
        isLocked: Boolean(isLockedForDisposal),
        lockReason: lock?.reason,
        isBlockedByReservation,
      });
    });

    return candidates;
  },

  /**
   * List write-off documents from backend.
   * If backend endpoint is not yet available, returns empty array gracefully (Zero Mock Data).
   */
  list: async (warehouseId?: string): Promise<Disposal[]> => {
    try {
      const raw = await getAll<Disposal>('/write-offs', {
        warehouseId: warehouseId && isUuid(warehouseId) ? warehouseId : undefined,
      });
      return Array.isArray(raw) ? raw : [];
    } catch {
      // Backend GAP: return empty array without crashing or creating fake data
      return [];
    }
  },

  /**
   * Get write-off detail by ID or code.
   */
  get: async (idOrCode: string): Promise<Disposal> => {
    try {
      return await get<Disposal>(`/write-offs/${encodeURIComponent(idOrCode)}`);
    } catch (err) {
      const apiErr = toApiError(err);
      if (apiErr.status === 404) {
        throw new ApiError(
          404,
          'Không tìm thấy phiếu hủy',
          'Phiếu hủy không tồn tại hoặc hệ thống chưa cung cấp chi tiết phiếu.',
        );
      }
      throw apiErr;
    }
  },

  /**
   * Submit write-off request to backend.
   */
  create: async (input: CreateDisposalInput): Promise<Disposal> => {
    try {
      return await post<Disposal>('/write-offs', input);
    } catch (err) {
      const apiErr = toApiError(err);
      if (apiErr.status === 404) {
        throw new ApiError(
          404,
          'Chức năng gửi phiếu hủy hiện chưa khả dụng',
          'Hệ thống máy chủ chưa kích hoạt chức năng lưu phiếu hủy trực tuyến. Dữ liệu quý khách đã chọn vẫn được giữ nguyên trên màn hình.',
        );
      }
      throw apiErr;
    }
  },

  /**
   * Approve write-off (Admin only).
   */
  approve: async (id: string): Promise<Disposal> => {
    try {
      return await post<Disposal>(`/write-offs/${encodeURIComponent(id)}/approve`);
    } catch (err) {
      const apiErr = toApiError(err);
      if (apiErr.status === 404) {
        throw new ApiError(
          404,
          'Chức năng duyệt phiếu hủy hiện chưa khả dụng',
          'Hệ thống chưa hỗ trợ duyệt trực tuyến phiếu hủy này.',
        );
      }
      throw apiErr;
    }
  },

  /**
   * Reject write-off (Admin only).
   */
  reject: async (id: string, reason?: string): Promise<Disposal> => {
    try {
      return await post<Disposal>(`/write-offs/${encodeURIComponent(id)}/reject`, { reason });
    } catch (err) {
      const apiErr = toApiError(err);
      if (apiErr.status === 404) {
        throw new ApiError(
          404,
          'Chức năng từ chối phiếu hủy hiện chưa khả dụng',
          'Hệ thống chưa hỗ trợ thao tác từ chối phiếu hủy này.',
        );
      }
      throw apiErr;
    }
  },

  /**
   * Real Evidence / Attachment API operations (supported by OpenAPI spec).
   */
  uploadAttachment: async (writeOffId: string, file: File): Promise<WriteOffAttachment> => {
    const formData = new FormData();
    formData.append('file', file);
    return post<WriteOffAttachment>(
      `/write-offs/${encodeURIComponent(writeOffId)}/attachments`,
      formData,
    );
  },

  getAttachments: async (writeOffId: string): Promise<WriteOffAttachment[]> => {
    try {
      const raw = await get<WriteOffAttachment[]>(
        `/write-offs/${encodeURIComponent(writeOffId)}/attachments`,
      );
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  },

  deleteAttachment: async (writeOffId: string, attachmentId: string): Promise<void> => {
    await del<void>(
      `/write-offs/${encodeURIComponent(writeOffId)}/attachments/${encodeURIComponent(attachmentId)}`,
    );
  },
};
