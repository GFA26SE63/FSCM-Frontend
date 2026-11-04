export type PickingStatus = 'Pending' | 'InProgress' | 'Completed' | 'Exception';

export interface PickingItem {
  id: string;
  allocationId: string;
  sku: string;
  productName: string;
  batchId: string;
  batchCode: string;
  expirationDate: string;
  requestedQuantity: number;
  pickedQuantity: number;
  remainingQuantity: number;
  status: string;
}

export interface PickingList {
  id: string;
  pickingCode: string;
  orderId: string;
  orderCode: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  retailerCode: string;
  retailerName: string;
  assignedToUserId: string | null;
  status: PickingStatus;
  version: number;
  startedAt: string | null;
  confirmedAt: string | null;
  items: PickingItem[];
  scans: { operationKey: string; qrCode: string; quantity: number; performedByUserId: string; occurredAt: string }[];
}

export interface WarehouseOption { id: string; code: string; name: string }
