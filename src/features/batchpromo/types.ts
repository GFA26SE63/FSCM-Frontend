export interface BatchDiscount {
  code: string; batchCode: string; discountPct: number; validFrom: string; validTo: string; createdBy: string; status: 'Active' | 'Ended';
  warehouseName: string; warehouseCode: string; sku: string; productName: string; remainingDays: number; remainingPct: number;
}
export interface DiscountSuggestion {
  batchCode: string; warehouseCode: string; warehouseName: string; sku: string; productName: string; expiry: string; remainingDays: number; remainingPct: number;
  available: number; suggestedPct: number; basePrice: number; activeDiscountPct: number | null;
}
export interface DiscountInput { items: { batchCode: string; discountPct: number }[]; validFrom: string; validTo: string }
export interface LabelInfo { code: string; batchCode: string; sku: string; productName: string; expiry: string; qty: number; transferCode: string }
export interface ShelfLifeTier { id?: string; scope: 'Sku' | 'Category'; productId?: string | null; productCategoryId?: string | null; minRemainingPercent: number; maxRemainingPercent: number; discountType: 'Percent' | 'FixedPerUnit'; discountValue: number }
export interface ShelfLifeTable { id: string; version: number; effectiveFrom: string; effectiveTo?: string | null; isActive: boolean; note?: string | null; tiers: ShelfLifeTier[] }
