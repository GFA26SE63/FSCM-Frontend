export type ExpiryStatus = 'Normal' | 'NearExpiry' | 'Expired' | 'Disposed';

/**
 * Mapped directly from components.schemas.BatchInventoryResult in apiv1.json
 */
export interface BatchInventoryItem {
  batchId: string;
  batchCode: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  productId: string;
  sku: string;
  productName: string;
  expirationDate: string;
  expiryStatus: ExpiryStatus;
  stockStatus: string;
  onHandQuantity: number;
  reservedQuantity: number;
  lockedQuantity: number;
  availableQuantity: number;
  hasLockRequiringResolution: boolean;
  version: number;
  updatedAt: string;

  // Backwards compatibility aliases
  code?: string;
  onHand?: number;
  held?: number;
  available?: number;
  expiry?: string;
  remainingDays?: number;
  remainingPct?: number;
  shelfLifeDays?: number;
  discountPct?: number | null;
  discountUntil?: string | null;
  discountCode?: string | null;
}

export type Batch = BatchInventoryItem;

/**
 * Mapped from components.schemas.InventoryLockResult in apiv1.json
 */
export interface InventoryLockItem {
  id: string;
  batchId: string;
  batchCode: string;
  warehouseId: string;
  warehouseCode: string;
  productId: string;
  sku: string;
  lockedQuantity: number;
  status: 'Active' | 'Released' | string;
  reason: string;
  requiresResolution: boolean;
  lockedByUserId: string | null;
  releasedByUserId: string | null;
  releasedAt: string | null;
  note: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Mapped from components.schemas.CreateInventoryLockRequest in apiv1.json
 */
export interface CreateInventoryLockInput {
  batchId: string;
  quantity: number;
  reason: string;
  note?: string;
}

/**
 * Mapped from components.schemas.ReleaseInventoryLockRequest in apiv1.json
 */
export interface ReleaseInventoryLockInput {
  expectedVersion: number;
  note?: string;
}

/**
 * Mapped from components.schemas.InventoryHistoryResult in apiv1.json
 */
export interface InventoryHistoryItem {
  id: string;
  batchId: string;
  batchCode: string;
  warehouseCode: string;
  sku: string;
  transactionType: string;
  sourceType: string;
  sourceId: string;
  referenceCode: string;
  onHandDelta: number;
  reservedDelta: number;
  onHandAfter: number;
  reservedAfter: number;
  availableAfter: number;
  note: string | null;
  createdByUserId: string;
  occurredAt: string;
}

export interface BatchFilters {
  warehouseId?: string;
  productId?: string;
  includeExpired?: boolean;
  expiryStatus?: string;
  search?: string;
}

export interface BatchDetail extends BatchInventoryItem {
  history?: InventoryHistoryItem[];
  locks?: InventoryLockItem[];
}
