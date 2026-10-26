/**
 * Promotions as the server models them: one promotion carries one minimum quantity and one discount
 * percentage, and names what it applies to.
 *
 * The portal used to offer a different percentage per SKU inside one programme. The server has no
 * such shape, so that form could never have been saved. Several percentages now mean several
 * promotions, which is also what the pricing rule assumes: a line takes the single best promotion,
 * never a sum.
 */
export type PromoStatus = 'Running' | 'Paused' | 'Ended';

export interface PromoSummary {
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
export interface RetailerOption { id: string; code: string; name: string; status: string }
