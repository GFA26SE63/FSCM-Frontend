import { get, getAll, post } from '@/shared/api/http';
import type { ProductOption, PromoDetail, PromoInput, PromoSummary, RetailerOption } from './types';

export const promoApi = {
  list: () => getAll<PromoSummary>('/promotions'),
  get: (code: string) => get<PromoDetail>(`/promotions/${code}`),
  create: (input: PromoInput) => post<PromoDetail>('/promotions', input),
  pause: (code: string) => post<PromoDetail>(`/promotions/${code}/pause`),
  activate: (code: string) => post<PromoDetail>(`/promotions/${code}/activate`),
  products: () => getAll<ProductOption>('/products'),
  retailers: () => getAll<RetailerOption>('/retailers'),
};
