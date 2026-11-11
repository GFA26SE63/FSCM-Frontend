import { get, put } from '@/shared/api/http';
import { ApiError } from '@/shared/api/errors';
import type { CurrentUser } from '@/shared/auth/authApi';

import { validateReportFilters } from './filters';
import type {
  KpiConfigPayload,
  ProductRankingResponse,
  ReportFilters,
  SalesGroupOption,
  SalesKpiResponse,
  SalesRankingResponse,
  SalesStaffOption,
} from './types';

export function canReadRankings(
  user: CurrentUser | null,
): boolean {
  return Boolean(
    user &&
    ['Admin', 'Operator', 'SalesManager'].includes(user.role),
  );
}

export function canManageKpi(
  user: CurrentUser | null,
): boolean {
  return Boolean(user && user.role === 'Admin');
}

function assertReportAccess(
  user: CurrentUser,
  filters: ReportFilters,
): void {
  if (!canReadRankings(user)) {
    throw new ApiError(403, 'Không có quyền xem báo cáo.');
  }

  const validation = validateReportFilters(filters);

  if (validation) {
    throw new ApiError(400, 'Bộ lọc không hợp lệ', validation);
  }

  if (
    user.role === 'SalesManager' &&
    filters.salesGroupId &&
    !user.scope?.salesGroupIds.includes(filters.salesGroupId)
  ) {
    throw new ApiError(
      403,
      'Không có quyền xem nhóm này',
      'Nhóm được chọn nằm ngoài scope của tài khoản.',
    );
  }
}

function reportParams(filters: ReportFilters) {
  return {
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    salesGroupId: filters.salesGroupId || undefined,
    salesUserId: filters.salesUserId || undefined,
  };
}

interface RawMembership {
  id: string;
  salesGroupId: string;
  salesGroupCode: string | null;
  userId: string;
  userEmail: string | null;
  userFullName: string | null;
  assignedAt: string;
  unassignedAt: string | null;
  isActive: boolean;
}

export const kpiApi = {
  kpi: (
    filters: ReportFilters,
    user: CurrentUser,
  ): Promise<SalesKpiResponse> => {
    assertReportAccess(user, filters);

    return get<SalesKpiResponse>(
      '/reports/sales-kpis',
      reportParams(filters),
    );
  },

  sales: (
    filters: ReportFilters,
    user: CurrentUser,
  ): Promise<SalesRankingResponse> => {
    assertReportAccess(user, filters);

    return get<SalesRankingResponse>(
      '/reports/sales-ranking',
      {
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        salesGroupId: filters.salesGroupId || undefined,
      },
    );
  },

  products: (
    filters: ReportFilters,
    user: CurrentUser,
  ): Promise<ProductRankingResponse> => {
    assertReportAccess(user, filters);

    return get<ProductRankingResponse>(
      '/reports/best-selling-products',
      {
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        salesGroupId: filters.salesGroupId || undefined,
        criterion: filters.criterion,
      },
    );
  },

  groups: async (
    user: CurrentUser,
  ): Promise<SalesGroupOption[]> => {
    if (!canReadRankings(user)) {
      throw new ApiError(403, 'Không có quyền xem báo cáo.');
    }

    if (user.role === 'SalesManager') {
      const ids = [...new Set(user.scope?.salesGroupIds ?? [])];
      const labels = user.scopeLabels?.salesGroups ?? [];

      return ids.map((id) => {
        const label = labels.find((item) => item.id === id);

        return {
          id,
          code: label?.code ?? '',
          name: label?.name ?? id,
        };
      });
    }

    return get<SalesGroupOption[]>('/sales-groups', {
      includeInactive: true,
    });
  },

  salesStaff: async (
    user: CurrentUser,
    salesGroupId?: string,
  ): Promise<SalesStaffOption[]> => {
    if (!canReadRankings(user)) {
      throw new ApiError(403, 'Không có quyền xem báo cáo.');
    }

    // Nếu SalesManager chỉ được xem nhóm thuộc scope
    if (user.role === 'SalesManager' && salesGroupId && !user.scope?.salesGroupIds.includes(salesGroupId)) {
      throw new ApiError(403, 'Nhóm nằm ngoài phạm vi quản lý.');
    }

    const memberships = await get<RawMembership[]>('/territory-assignments/sales', {
      salesGroupId: salesGroupId || undefined,
      includeInactive: false,
    });

    const activeList = Array.isArray(memberships) ? memberships : [];

    const allowedGroupIds =
      user.role === 'SalesManager'
        ? new Set(user.scope?.salesGroupIds ?? [])
        : null;

    const seenUserIds = new Set<string>();
    const result: SalesStaffOption[] = [];

    for (const m of activeList) {
      if (!m.isActive) continue;
      if (allowedGroupIds && !allowedGroupIds.has(m.salesGroupId)) continue;
      if (seenUserIds.has(m.userId)) continue;

      seenUserIds.add(m.userId);
      result.push({
        id: m.userId,
        fullName: m.userFullName || m.userEmail || m.userId,
        email: m.userEmail || '',
        salesGroupId: m.salesGroupId,
      });
    }

    return result.sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));
  },

  getKpiConfig: async (user: CurrentUser): Promise<KpiConfigPayload | null> => {
    if (!canManageKpi(user)) {
      throw new ApiError(403, 'Chỉ Admin mới có quyền cấu hình KPI.');
    }

    try {
      const result = await get<{ value?: KpiConfigPayload }>('/configurations/kpi.weights');
      return result?.value ?? null;
    } catch {
      // Endpoint cấu hình có thể chưa được seed trên backend; trả về null để form mở với giá trị trống
      return null;
    }
  },

  saveKpiConfig: async (
    payload: KpiConfigPayload,
    user: CurrentUser,
  ): Promise<void> => {
    if (!canManageKpi(user)) {
      throw new ApiError(403, 'Chỉ Admin mới có quyền lưu cấu hình KPI.');
    }

    await put('/configurations/kpi.weights', {
      value: payload,
    });
  },
};
