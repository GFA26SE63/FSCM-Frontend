import { get } from '@/shared/api/http';
import { ApiError } from '@/shared/api/errors';
import type { CurrentUser } from '@/shared/auth/authApi';

import { validateReportFilters } from './filters';
import type {
  ProductRankingResponse,
  ReportFilters,
  SalesGroupOption,
  SalesRankingResponse,
} from './types';

export function canReadRankings(
  user: CurrentUser | null,
): boolean {
  return Boolean(
    user &&
    ['Admin', 'Operator', 'SalesManager'].includes(user.role),
  );
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
  };
}

export const kpiApi = {
  sales: (
    filters: ReportFilters,
    user: CurrentUser,
  ): Promise<SalesRankingResponse> => {
    assertReportAccess(user, filters);

    return get<SalesRankingResponse>(
      '/reports/sales-ranking',
      reportParams(filters),
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
        ...reportParams(filters),
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
};