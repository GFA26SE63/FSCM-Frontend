import { get } from '@/shared/api/http';
import type { DashboardResponse } from './types';

export const dashboardApi = {
  get: (params: { from?: string; to?: string; areaCode?: string }) => get<DashboardResponse>('/dashboard', params),
};
