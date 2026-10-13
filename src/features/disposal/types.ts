export interface DisposalLine { sku: string; productName: string; batchCode: string; expiry: string; qty: number }
export interface Disposal {
  code: string; warehouseCode: string; warehouseName: string; createdAt: string; createdBy: string; reason: string;
  method: 'Tiêu hủy tại kho' | 'Trả nhà cung cấp'; batchCount: number; totalQty: number; totalValue: number; lines: DisposalLine[];
}
export interface DisposalCandidate {
  batchCode: string; warehouseCode: string; warehouseName: string; sku: string; productName: string; expiry: string; daysOverdue: number; qty: number; value: number;
}
export interface DisposalInput { batchCodes: string[]; method: Disposal['method'] }
