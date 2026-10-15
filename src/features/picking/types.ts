export type PickingStatus = 'NotPicked' | 'Picking' | 'Shipped';
export interface PickingLine { sku: string; productName: string; batchCode: string; expiry: string; qty: number }
export interface PickingList {
  code: string;
  orderCode: string;
  warehouseCode: string;
  warehouseName: string;
  keeperName: string | null;
  status: PickingStatus;
  lines: PickingLine[];
  lineCount: number;
  totalQty: number;
}
export interface ShipResult { picking: PickingList; remainingLists: number; orderStatus: string }
