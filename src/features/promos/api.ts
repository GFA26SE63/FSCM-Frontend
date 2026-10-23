import { get, getAll, post } from '@/shared/api/http';
import type { CategoryOption, ProductOption, PromoDetail, PromoInput, PromoSummary, RetailerOption } from './types';

/**
 * The server pages some list endpoints and returns a plain array for others, so each call has to
 * use the matching helper. Measured against the running API on 23/10/2026:
 *   plain array - /promotions, /categories, /warehouses, /regions, /sales-groups, /inventory
 *   { items }   - /products, /retailers, /users, /orders
 * Using getAll on a plain array reads `.items` off it, gets undefined, and renders an empty screen
 * with no error at all.
 */
export const promoApi = {
  list: () => get<PromoSummary[]>('/promotions'),
  get: (id: string) => get<PromoDetail>(`/promotions/${id}`),
  create: (input: PromoInput) => post<PromoDetail>('/promotions', input),
  /** The server calls it deactivate; the screen says "tạm dừng", which is what it means. */
  pause: (id: string) => post<PromoDetail>(`/promotions/${id}/deactivate`),
  activate: (id: string) => post<PromoDetail>(`/promotions/${id}/activate`),
  products: () => getAll<ProductOption>('/products'),
  categories: () => get<CategoryOption[]>('/categories'),
  retailers: () => getAll<RetailerOption>('/retailers'),
};
