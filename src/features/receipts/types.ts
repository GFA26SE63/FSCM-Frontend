export interface ReceiptLine { sku: string; productName: string; batchCode: string; expiry: string; qty: number; labels: number; lot: string }
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
  lines: { sku: string; expiry: string; qty: number; labels: number; lot: string }[];
}
export interface WarehouseOption { code: string; name: string; status: string }
export interface ProductOption { sku: string; name: string; status: string }
