export type InventoryLockStatus = 'Active' | 'Released' | 'WrittenOff';
export type InventoryLockReason = 'Expired' | 'Damaged' | 'QualityHold' | 'Recall' | 'Other';

export interface InventoryBatch {
  batchId: string; batchCode: string; warehouseId: string; warehouseCode: string; warehouseName: string;
  productId: string; sku: string; productName: string; expirationDate: string; expiryStatus: string;
  stockStatus: string; onHandQuantity: number; reservedQuantity: number; lockedQuantity: number;
  availableQuantity: number; hasLockRequiringResolution: boolean; version: number; updatedAt: string;
}

export interface InventoryLock {
  id: string; batchId: string; batchCode: string; warehouseId: string; warehouseCode: string;
  productId: string; sku: string; lockedQuantity: number; status: InventoryLockStatus;
  reason: InventoryLockReason; requiresResolution: boolean; releasedAt?: string | null;
  note?: string | null; version: number; createdAt: string; updatedAt: string;
}
