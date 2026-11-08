export type PromoStatus = 'Running' | 'Paused' | 'Ended';

export interface PromoProductRule { productId: string; minimumQuantity: number; discountPercent: number }

export interface PromoSummary {
  campaignMode?: "PerSku" | "ProductGroup";
  productRules?: PromoProductRule[];
  id: string;
  code: string;
  name: string;
  promotionType: string;
  minimumQuantity: number;
  discountPercent: number;
  startAt: string;
  endAt: string;
  isActive: boolean;
}

export interface PromoDetail extends PromoSummary {
  /** Empty product and category lists mean the promotion names nothing and applies to nothing. */
  productIds: string[];
  categoryIds: string[];
  /** Empty = every retailer. */
  retailerIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PromoInput {
  campaignMode?: "PerSku" | "ProductGroup";
  productRules?: PromoProductRule[];
  activateOnSave?: boolean;
  name: string;
  minimumQuantity: number;
  discountPercent: number;
  startAt: string;
  endAt: string;
  productIds: string[];
  categoryIds: string[];
  retailerIds: string[];
}

export interface ProductOption { id: string; sku: string; name: string; status: string }
export interface CategoryOption { id: string; code: string; name: string }
export interface RetailerOption {
  id: string; code: string; name: string; status: string;
  contactName?: string; phone?: string; address?: string;
  salesGroupCode?: string; creditTermDays?: number;
}
