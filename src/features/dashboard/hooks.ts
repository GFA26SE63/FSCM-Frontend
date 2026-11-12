import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from './api';
import { useAuth } from '@/shared/auth/AuthContext';
import type { DashboardFilters } from './types';

export const useDashboard = (params: DashboardFilters, enabled = true) => {
  const { user } = useAuth();
  return useQuery({ queryKey: ['dashboard', user?.id, user?.role, params],
    queryFn: () => dashboardApi.get(params), enabled: !!user && enabled,
    refetchInterval: user?.role === 'WarehouseKeeper' || user?.role === 'Operator' ? 30_000 : 60_000,
    refetchIntervalInBackground: false,
  });
};
