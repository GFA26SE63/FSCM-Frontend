export interface ReceiptLine {
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

export interface Receipt {
  id: string;
  receiptCode: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  createdByUserId: string;
  approvedByUserId: string | null;
  status: 'Pending' | 'Received';
  receivedAt: string | null;
  approvedAt: string | null;
  version: number;
  createdAt: string;
  lines: ReceiptLine[];
}

export interface ReceiptInput {
  warehouseId: string;
  operationKey: string;
  lines: {
    productId: string;
    sourceLotCode: string | null;
    quantity: number;
    productionDate: string;
    expirationDate: string;
  }[];
}

export interface WarehouseOption { id: string; code: string; name: string; isActive: boolean }
export interface ProductOption { id: string; sku: string; name: string; status: string }
