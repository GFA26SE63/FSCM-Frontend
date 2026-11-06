export type DisposalStatus = 'Pending' | 'Disposed' | 'Rejected' | string;
export type DisposalMethod = 'Tiêu hủy tại kho' | 'Trả nhà cung cấp';
export type DisposalReason = 'Hết hạn sử dụng' | 'Hàng hỏng đã khóa';

export interface DisposalLine {
  batchId?: string;
  batchCode: string;
  warehouseId?: string;
  warehouseCode?: string;
  warehouseName?: string;
  sku: string;
  productName: string;
  expiry: string;
  quantity: number;
  unitPrice?: number;
  totalValue?: number;
  lockedQuantity?: number;
  reservedQuantity?: number;
}

export interface Disposal {
  id: string;
  code: string;
  warehouseId?: string;
  warehouseCode: string;
  warehouseName: string;
  createdAt: string;
  createdBy: string;
  reason: DisposalReason | string;
  method: DisposalMethod;
  status: DisposalStatus;
  approvedBy?: string | null;
  approvedAt?: string | null;
  batchCount: number;
  totalQty: number;
  totalValue: number;
  lines: DisposalLine[];
  note?: string | null;
}

export interface DisposalCandidate {
  batchId: string;
  batchCode: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  productId: string;
  sku: string;
  productName: string;
  expiry: string;
  daysOverdue: number;
  onHandQuantity: number;
  reservedQuantity: number;
  lockedQuantity: number;
  availableQuantity: number;
  eligibleQuantity: number;
  unitPrice: number;
  value: number;
  isLocked: boolean;
  lockReason?: string;
  isBlockedByReservation: boolean;
}

export interface CreateDisposalInput {
  warehouseId?: string;
  warehouseCode?: string;
  batchCodes: string[];
  batchIds?: string[];
  reason: DisposalReason | string;
  method: DisposalMethod;
  quantities?: Record<string, number>;
  note?: string;
}

export interface WriteOffAttachment {
  id: string;
  fileName?: string | null;
  contentType?: string | null;
  url?: string | null;
  uploadedAt: string;
}
