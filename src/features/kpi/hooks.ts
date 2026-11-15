import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/shared/auth/AuthContext';
import {
  useLocation,
  useNavigate,
} from '@/shared/router/compat';

import { canReadRankings, kpiApi } from './api';
import {
  readRankingTab,
  readReportFilters,
  reportSearch,
  validateReportFilters,
} from './filters';
import type {
  RankingTab,
  ReportFilters,
} from './types';

const REPORT_PARAMS = ['fromDate', 'toDate', 'criterion', 'tab', 'salesGroupId', 'salesUserId', 'periodType'];

export function useRankingFilters() {
  const location = useLocation();
  const navigate = useNavigate();

  const filters = readReportFilters(location.search);
  const tab = readRankingTab(location.search);

  // Ghi các tham số báo cáo, giữ nguyên trạng thái riêng của từng bảng (tìm kiếm, trang…).
  function write(nextFilters: ReportFilters, nextTab: RankingTab, resetPages: boolean) {
    const params = new URLSearchParams(location.search);
    for (const key of REPORT_PARAMS) params.delete(key);
    if (resetPages) {
      for (const key of [...params.keys()]) if (key.endsWith('.page')) params.delete(key);
    }
    new URLSearchParams(reportSearch(nextFilters, nextTab)).forEach((value, key) => params.set(key, value));
    navigate(`${location.pathname}?${params.toString()}`, { replace: true });
  }

  function updateFilters(patch: Partial<ReportFilters>) {
    write({ ...filters, ...patch }, tab, true);
  }

  function setTab(next: RankingTab) {
    write(filters, next, false);
  }

  return {
    filters,
    tab,
    updateFilters,
    setTab,
    validationError: validateReportFilters(filters),
  };
}

export function useReportGroups() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [
      'rankings',
      'groups',
      user?.id,
      user?.role,
      user?.scope,
      user?.scopeLabels,
    ],
    queryFn: () => {
      if (!user) throw new Error('Bạn cần đăng nhập.');
      return kpiApi.groups(user);
    },
    enabled: canReadRankings(user),
    retry: false,
    gcTime: 0,
  });
}

export function useSalesStaff(salesGroupId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [
      'rankings',
      'sales-staff',
      user?.id,
      user?.role,
      user?.scope,
      salesGroupId,
    ],
    queryFn: () => {
      if (!user) throw new Error('Bạn cần đăng nhập.');
      return kpiApi.salesStaff(user, salesGroupId);
    },
    enabled: canReadRankings(user),
    retry: false,
    gcTime: 0,
  });
}

export function useSalesKpi(
  filters: ReportFilters,
  enabled = true,
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [
      'rankings',
      'kpi',
      user?.id,
      user?.role,
      user?.scope,
      filters.fromDate,
      filters.toDate,
      filters.salesGroupId,
      filters.salesUserId,
    ],
    queryFn: () => {
      if (!user) throw new Error('Bạn cần đăng nhập.');
      return kpiApi.kpi(filters, user);
    },
    enabled:
      enabled &&
      canReadRankings(user) &&
      !validateReportFilters(filters),
    retry: false,
    gcTime: 0,
  });
}

export function useSalesRanking(
  filters: ReportFilters,
  enabled = true,
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [
      'rankings',
      'sales',
      user?.id,
      user?.role,
      user?.scope,
      filters.fromDate,
      filters.toDate,
      filters.salesGroupId,
    ],
    queryFn: () => {
      if (!user) throw new Error('Bạn cần đăng nhập.');
      return kpiApi.sales(filters, user);
    },
    enabled:
      enabled &&
      canReadRankings(user) &&
      !validateReportFilters(filters),
    retry: false,
    gcTime: 0,
  });
}

export function useProductRanking(
  filters: ReportFilters,
  enabled = true,
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [
      'rankings',
      'products',
      user?.id,
      user?.role,
      user?.scope,
      filters,
    ],
    queryFn: () => {
      if (!user) throw new Error('Bạn cần đăng nhập.');
      return kpiApi.products(filters, user);
    },
    enabled:
      enabled &&
      canReadRankings(user) &&
      !validateReportFilters(filters),
    retry: false,
    gcTime: 0,
  });
}
