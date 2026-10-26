import { get, getAll, post } from '@/shared/api/http';
import type { BatchDiscount, DiscountInput, DiscountSuggestion, LabelInfo, ShelfLifeTable, ShelfLifeTier } from './types';

export const batchPromoApi = {
  list: () => getAll<BatchDiscount>('/batch-discounts'),
  suggestions: () => get<DiscountSuggestion[]>('/batch-discounts/suggestions'),
  create: (input: DiscountInput) => post<{ items: BatchDiscount[] }>('/batch-discounts', input),
  stop: (code: string) => post<BatchDiscount>(`/batch-discounts/${code}/stop`),
  label: (code: string) => get<LabelInfo>(`/labels/${code}`),
  shelfLifeCurrent: () => get<ShelfLifeTable>('/shelf-life-discounts/current'),
  shelfLifeHistory: () => get<ShelfLifeTable[]>('/shelf-life-discounts/history'),
  publishShelfLife: (v: { effectiveFrom: string; note?: string; tiers: ShelfLifeTier[] }) =>
    post<ShelfLifeTable>('/shelf-life-discounts', v),
};
