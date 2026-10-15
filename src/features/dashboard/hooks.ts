import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from './api';

export const useDashboard = (params: { from?: string; to?: string; areaCode?: string }) =>
  useQuery({ queryKey: ['dashboard', params], queryFn: () => dashboardApi.get(params) });
