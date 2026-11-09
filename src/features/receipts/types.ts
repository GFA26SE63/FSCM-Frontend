export interface ReceiptLine {
  sku: string;
  productName: string;
  batchCode: string;
  expiry: string;
  qty: number;
  labels: number;
  lot: string;
}

export interface Receipt {
  code: string;
  warehouseCode: string;
  warehouseName: string;
  receivedAt: string;
  receivedBy: string;
  note: string;
  batchCount: number;
  totalQty: number;
  lines: ReceiptLine[];
}

export interface ReceiptInput {
  warehouseCode: string;
  note: string;
  lines: {
    sku: string;
    expiry: string;
    qty: number;
    labels: number;
    lot: string;
  }[];
}

export interface WarehouseOption {
  code: string;
  name: string;
  status: string;
}

export interface ProductOption {
  sku: string;
  name: string;
  status: string;
}

// Contract GET /goods-receipts/{receiptId} hiện tại của BE.
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

  status: string;

  receivedAt: string | null;
  approvedAt: string | null;
  createdAt: string;

  version: number;
  lines: ReceiptDetailLine[];
}