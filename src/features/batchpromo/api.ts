import { get, getAll, post } from '@/shared/api/http';
import type { BatchDiscount, DiscountInput, DiscountSuggestion, LabelInfo } from './types';

export const batchPromoApi = {
  list: () => getAll<BatchDiscount>('/batch-discounts'),
  suggestions: () => get<DiscountSuggestion[]>('/batch-discounts/suggestions'),
  create: (input: DiscountInput) => post<{ items: BatchDiscount[] }>('/batch-discounts', input),
  stop: (code: string) => post<BatchDiscount>(`/batch-discounts/${code}/stop`),
  label: (code: string) => get<LabelInfo>(`/labels/${code}`),
};
