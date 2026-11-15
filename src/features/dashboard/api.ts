import { get } from '@/shared/api/http';
import type { DashboardResponse, DashboardFilters } from './types';

export const dashboardApi = {
  get: (params: DashboardFilters) => get<DashboardResponse>('/dashboard', {
    fromDate: params.fromDate, toDate: params.toDate,
    regionId: params.regionId || undefined, warehouseId: params.warehouseId || undefined,
    salesGroupId: params.salesGroupId || undefined,
  }),
};
