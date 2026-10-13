export type ExpiryStatus = 'Normal' | 'NearExpiry' | 'Expired' | 'Disposed';
export interface Batch {
  code: string; warehouseCode: string; warehouseName: string; sku: string; productName: string; expiry: string;
  onHand: number; held: number; available: number; shelfLifeDays: number; remainingDays: number; remainingPct: number;
  expiryStatus: ExpiryStatus; discountPct: number | null; discountUntil: string | null; discountCode: string | null;
}
export interface BatchMovement { at: string; type: string; document: string; qty: number; by: string }
export interface BatchDetail extends Batch { history: BatchMovement[] }
