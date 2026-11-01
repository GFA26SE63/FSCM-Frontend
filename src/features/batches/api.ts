import { get, post } from '@/shared/api/http';
import { daysBetween } from '@/shared/lib/dates';
import type {
  BatchDetail,
  BatchFilters,
  BatchInventoryItem,
  CreateInventoryLockInput,
  ExpiryStatus,
  InventoryHistoryItem,
  InventoryLockItem,
  ReleaseInventoryLockInput,
} from './types';

function isUuid(value?: string | null): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeBatch(raw: Record<string, unknown>): BatchInventoryItem {
  const batchId = String(raw.batchId ?? raw.id ?? '');
  const batchCode = String(raw.batchCode ?? raw.code ?? '');
  const expirationDate = String(raw.expirationDate ?? raw.expiry ?? '');
  const warehouseId = String(raw.warehouseId ?? '');
  const warehouseCode = String(raw.warehouseCode ?? '');
  const warehouseName = String(raw.warehouseName ?? warehouseCode);
  const productId = String(raw.productId ?? '');
  const sku = String(raw.sku ?? '');
  const productName = String(raw.productName ?? '');

  const onHand = Number(raw.onHandQuantity ?? raw.onHand ?? 0);
  const reserved = Number(raw.reservedQuantity ?? raw.held ?? 0);
  const locked = Number(raw.lockedQuantity ?? raw.locked ?? 0);
  const available = Number(
    raw.availableQuantity ?? raw.available ?? Math.max(0, onHand - reserved - locked),
  );

  const remaining = daysBetween(getTodayIso(), expirationDate);
  const shelfLifeDays = Number(raw.shelfLifeDays ?? 365);
  const remainingPct = shelfLifeDays > 0 ? Math.round((remaining / shelfLifeDays) * 100) : 0;

  let expiryStatus: ExpiryStatus = (raw.expiryStatus as ExpiryStatus) ?? 'Normal';
  if (!raw.expiryStatus) {
    if (remaining <= 0) expiryStatus = 'Expired';
    else if (remaining <= 45) expiryStatus = 'NearExpiry';
    else expiryStatus = 'Normal';
  }

  return {
    batchId,
    batchCode,
    warehouseId,
    warehouseCode,
    warehouseName,
    productId,
    sku,
    productName,
    expirationDate,
    expiryStatus,
    stockStatus: String(raw.stockStatus ?? (available > 0 ? 'InStock' : 'OutOfStock')),
    onHandQuantity: onHand,
    reservedQuantity: reserved,
    lockedQuantity: locked,
    availableQuantity: available,
    hasLockRequiringResolution: Boolean(raw.hasLockRequiringResolution),
    version: Number(raw.version ?? 1),
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),

    // Backwards compatibility aliases
    code: batchCode,
    onHand,
    held: reserved,
    available,
    expiry: expirationDate,
    remainingDays: remaining,
    remainingPct,
    shelfLifeDays,
    discountPct: typeof raw.discountPct === 'number' ? raw.discountPct : null,
    discountUntil: typeof raw.discountUntil === 'string' ? raw.discountUntil : null,
    discountCode: typeof raw.discountCode === 'string' ? raw.discountCode : null,
  };
}

export const batchApi = {
  list: async (filters?: BatchFilters): Promise<BatchInventoryItem[]> => {
    // 100% Real API call to Backend
    const rawList = await get<Record<string, unknown>[]>('/inventory', {
      warehouseId: isUuid(filters?.warehouseId) ? filters?.warehouseId : undefined,
      productId: isUuid(filters?.productId) ? filters?.productId : undefined,
      includeExpired: filters?.includeExpired ?? false,
    });

    let items = Array.isArray(rawList) ? rawList.map(normalizeBatch) : [];

    if (!filters) return items;

    if (filters.warehouseId && !isUuid(filters.warehouseId)) {
      const qWh = filters.warehouseId.toLowerCase();
      items = items.filter(
        (b) =>
          b.warehouseCode.toLowerCase() === qWh ||
          b.warehouseName.toLowerCase() === qWh,
      );
    }

    if (filters.productId && !isUuid(filters.productId)) {
      const qProd = filters.productId.toLowerCase();
      items = items.filter((b) => b.sku.toLowerCase() === qProd);
    }

    if (filters.expiryStatus) {
      items = items.filter((b) => b.expiryStatus === filters.expiryStatus);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      items = items.filter(
        (b) =>
          b.batchCode.toLowerCase().includes(q) ||
          b.sku.toLowerCase().includes(q) ||
          b.productName.toLowerCase().includes(q) ||
          b.warehouseName.toLowerCase().includes(q),
      );
    }

    return items;
  },

  get: async (batchIdOrCode: string): Promise<BatchDetail> => {
    let base: BatchInventoryItem | null = null;

    // 100% Real API call to Backend
    if (isUuid(batchIdOrCode)) {
      try {
        const raw = await get<Record<string, unknown>>(
          `/inventory/batches/${encodeURIComponent(batchIdOrCode)}`,
        );
        if (raw && (raw.batchId || raw.id || raw.batchCode || raw.code)) {
          base = normalizeBatch(raw);
        }
      } catch {
        // Fall back to querying list
      }
    }

    if (!base) {
      const all = await batchApi.list({ includeExpired: true });
      const found = all.find(
        (b) =>
          (b.batchId && b.batchId.toLowerCase() === batchIdOrCode.toLowerCase()) ||
          b.batchCode.toLowerCase() === batchIdOrCode.toLowerCase(),
      );
      if (found) {
        base = found;
      } else {
        throw new Error(`Không tìm thấy lô hàng: ${batchIdOrCode}`);
      }
    }

    let history: InventoryHistoryItem[];
    try {
      history = await batchApi.getHistory(
        isUuid(base.batchId) ? base.batchId : undefined,
        isUuid(base.warehouseId) ? base.warehouseId : undefined,
      );
    } catch {
      history = [];
    }

    let locks: InventoryLockItem[];
    try {
      locks = await batchApi.getLocks({
        batchId: isUuid(base.batchId) ? base.batchId : undefined,
        warehouseId: isUuid(base.warehouseId) ? base.warehouseId : undefined,
      });
    } catch {
      locks = [];
    }

    return {
      ...base,
      history,
      locks,
    };
  },

  getHistory: async (
    batchId?: string,
    warehouseId?: string,
  ): Promise<InventoryHistoryItem[]> => {
    // 100% Real API call to Backend
    const raw = await get<InventoryHistoryItem[]>('/inventory/history', {
      batchId: isUuid(batchId) ? batchId : undefined,
      warehouseId: isUuid(warehouseId) ? warehouseId : undefined,
    });
    return Array.isArray(raw) ? raw : [];
  },

  getLocks: async (params?: {
    batchId?: string;
    warehouseId?: string;
    status?: string;
  }): Promise<InventoryLockItem[]> => {
    // 100% Real API call to Backend
    const raw = await get<InventoryLockItem[]>('/inventory-locks', {
      batchId: isUuid(params?.batchId) ? params?.batchId : undefined,
      warehouseId: isUuid(params?.warehouseId) ? params?.warehouseId : undefined,
      status: params?.status || undefined,
    });
    return Array.isArray(raw) ? raw : [];
  },

  getLock: (lockId: string): Promise<InventoryLockItem> =>
    get<InventoryLockItem>(`/inventory-locks/${encodeURIComponent(lockId)}`),

  createLock: (input: CreateInventoryLockInput): Promise<void> =>
    post<void>('/inventory-locks', input),

  releaseLock: (
    lockId: string,
    input: ReleaseInventoryLockInput,
  ): Promise<InventoryLockItem> =>
    post<InventoryLockItem>(
      `/inventory-locks/${encodeURIComponent(lockId)}/release`,
      input,
    ),
};
