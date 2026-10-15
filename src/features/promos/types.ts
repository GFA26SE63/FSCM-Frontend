export type PromoType = 'PerSku' | 'Group';
export type PromoStatus = 'Running' | 'Paused' | 'Ended';
export interface PromoSummary {
  code: string; name: string; type: PromoType; validFrom: string; validTo: string; status: PromoStatus; customerCount: number | null; skuCount: number;
}
export interface PromoRule { sku: string; productName: string; minQty: number; discountPct: number }
export interface PromoApplied { orderCode: string; retailerName: string; salesName: string; createdAt: string; detail: string; amount: number }
export interface PromoDetail extends PromoSummary {
  rules: PromoRule[];
  group: { skus: string[]; minQty: number; discountPct: number } | null;
  retailers: { code: string; name: string }[] | null;
  appliedOrders: PromoApplied[];
  totalDiscount: number;
}
export interface PromoInput {
  name: string; type: PromoType; validFrom: string; validTo: string; retailerCodes: string[];
  rules: { sku: string; minQty: number; discountPct: number }[]; groupSkus: string[]; groupMinQty: number; groupDiscountPct: number;
}
export interface ProductOption { sku: string; name: string; status: string }
export interface RetailerOption { code: string; name: string; status: string }
