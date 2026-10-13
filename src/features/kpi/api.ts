import { get } from '@/shared/api/http';
import type { KpiResponse, ProductRankResponse } from './types';

export const kpiApi = {
  sales: () => get<KpiResponse>('/kpi/sales'),
  products: () => get<ProductRankResponse>('/rankings/products'),
};
