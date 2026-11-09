export interface WarehouseOption {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  status: string;
  keepers?: { userId: string; fullName: string; email: string }[];
}

export interface ProductOption {
  id: string;
  sku: string;
  name: string;
  status: string;
}

export interface ReceiveGoodsLineRequest {
  productId: string;
  sourceLotCode?: string | null;
  quantity: number;
  productionDate: string; // YYYY-MM-DD
  expirationDate: string; // YYYY-MM-DD
}

export interface CreateGoodsReceiptRequest {
  warehouseId: string;
  lines: ReceiveGoodsLineRequest[];
}

export interface ReceiptDetailLine {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  sourceLotCode: string | null;
  receivedQuantity: number;
  productionDate: string;
  expirationDate: string;
  batchId: string | null;
  batchCode: string | null;
}

export interface ReceiptDetail {
  id: string;
  receiptCode: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  createdByUserId: string;
  approvedByUserId: string | null;
  status: string; // 'Pending' | 'Received'
  receivedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  version: number;
  lines: ReceiptDetailLine[];
}

export interface ReceiptListItem extends ReceiptDetail {
  code: string; // alias for receiptCode
  batchCount: number;
  totalQty: number;
}

// Backward compatibility interfaces
export interface ReceiptLine {
  sku: string;
  productName: string;
  batchCode: string;
  expiry: string;
  qty: number;
  labels: number;
  lot: string;
}

export interface Receipt extends ReceiptListItem {
  receivedBy?: string;
  note?: string;
}

export interface ReceiptInput {
  warehouseId: string;
  warehouseCode?: string;
  lines: {
    productId: string;
    sku?: string;
    productionDate: string;
    expirationDate: string;
    quantity: number;
    sourceLotCode?: string | null;
  }[];
}
