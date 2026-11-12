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

/** Dòng hàng của phiếu trên màn hình danh sách (dữ liệu GraphQL đã nối). */
export interface PickingRowItem {
  id: string;
  sku: string;
  productName: string;
  batchCode: string;
  expirationDate: string;
  requestedQuantity: number;
  pickedQuantity: number;
  remainingQuantity: number;
  status: string;
}

/** Phiếu soạn trên màn hình danh sách (một trang GraphQL). */
export interface PickingListRow {
  id: string;
  pickingCode: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  orderCode: string;
  retailerCode: string;
  retailerName: string;
  status: PickingStatus;
  startedAt: string | null;
  confirmedAt: string | null;
  items: PickingRowItem[];
}

export interface PickingListPage {
  rows: PickingListRow[];
  /** Tổng số phiếu theo bộ lọc hiện tại (Backend). */
  totalCount: number;
  pageInfo: { hasNextPage: boolean; hasPreviousPage: boolean; startCursor: string | null; endCursor: string | null };
  /** Số phiếu theo trạng thái trên cùng bộ lọc (Backend). */
  statusCounts: Record<'InProgress' | 'Completed' | 'Exception', number>;
}
