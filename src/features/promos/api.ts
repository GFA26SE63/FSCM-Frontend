import { get, getAll, post } from '@/shared/api/http';
import type { CategoryOption, ProductOption, PromoDetail, PromoInput, PromoSummary, RetailerOption } from './types';

export const promoApi = {
  list: () => getAll<PromoSummary>('/promotions'),
  get: (id: string) => get<PromoDetail>(`/promotions/${id}`),
  create: (input: PromoInput) => post<PromoDetail>('/promotions', input),
  /** The server calls it deactivate; the screen says "tạm dừng", which is what it means. */
  pause: (id: string) => post<PromoDetail>(`/promotions/${id}/deactivate`),
  activate: (id: string) => post<PromoDetail>(`/promotions/${id}/activate`),
  products: () => getAll<ProductOption>('/products'),
  categories: () => getAll<CategoryOption>('/categories'),
  retailers: () => getAll<RetailerOption>('/retailers'),
};
