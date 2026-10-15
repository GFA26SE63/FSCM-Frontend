export type TransferStatus = 'InTransit' | 'Received' | 'Cancelled';
export type TransferKind = 'Replenishment' | 'NearExpiryRotation';
export interface Transfer {
  code: string;
  kind: TransferKind;
  fromWarehouse: string;
  fromWarehouseName: string;
  fromType: 'Central' | 'Regional';
  fromKeeper: string | null;
  toWarehouse: string;
  toWarehouseName: string;
  toType: 'Central' | 'Regional';
  toKeeper: string | null;
  sku: string;
  productName: string;
  sourceBatch: string;
  destinationBatch: string;
  expiry: string;
  qty: number;
  createdAt: string;
  createdBy: string;
  status: TransferStatus;
  labelCode: string;
  receivedNote: string;
  score: number | null;
  note: string;
}
export interface ReplenishmentSuggestion {
  toWarehouse: string; toWarehouseName: string; fromWarehouse: string; fromWarehouseName: string;
  sku: string; productName: string; sourceBatch: string; expiry: string; have: number; min: number; qty: number;
}
export interface TransferInput { kind: TransferKind; fromWarehouse: string; toWarehouse: string; sourceBatch: string; qty: number; note?: string }
export interface WarehouseOption { code: string; name: string; status: string }
export interface BatchOption { code: string; warehouseCode: string; sku: string; productName: string; available: number; expiry: string; expiryStatus: string }
