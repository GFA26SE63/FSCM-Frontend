import type {
  PeriodType,
  ProductCriterion,
  RankingTab,
  ReportFilters,
} from './types';

export function vietnamToday(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function getPeriodDates(
  type: PeriodType,
  today = vietnamToday(),
): { fromDate: string; toDate: string } {
  const [yearStr, monthStr] = today.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  if (type === 'month') {
    return {
      fromDate: `${yearStr}-${monthStr}-01`,
      toDate: today,
    };
  }

  if (type === 'lastMonth') {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonthStr = String(prevMonth).padStart(2, '0');
    // last day of previous month
    const lastDay = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
    return {
      fromDate: `${prevYear}-${prevMonthStr}-01`,
      toDate: `${prevYear}-${prevMonthStr}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  if (type === 'quarter') {
    const qStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
    const qStartMonthStr = String(qStartMonth).padStart(2, '0');
    return {
      fromDate: `${yearStr}-${qStartMonthStr}-01`,
      toDate: today,
    };
  }

  if (type === 'year') {
    return {
      fromDate: `${yearStr}-01-01`,
      toDate: today,
    };
  }

  return {
    fromDate: `${yearStr}-${monthStr}-01`,
    toDate: today,
  };
}

export function defaultReportFilters(): ReportFilters {
  const today = vietnamToday();
  const dates = getPeriodDates('month', today);

  return {
    fromDate: dates.fromDate,
    toDate: dates.toDate,
    salesGroupId: '',
    salesUserId: '',
    criterion: 'Quantity',
    periodType: 'month',
  };
}

export function readReportFilters(search: string): ReportFilters {
  const params = new URLSearchParams(search);
  const defaults = defaultReportFilters();

  const periodType = (params.get('periodType') as PeriodType | null) ?? undefined;

  return {
    fromDate: params.get('fromDate') ?? defaults.fromDate,
    toDate: params.get('toDate') ?? defaults.toDate,
    salesGroupId: params.get('salesGroupId') ?? '',
    salesUserId: params.get('salesUserId') ?? '',
    criterion: (params.get('criterion') ?? 'Quantity') as ProductCriterion,
    periodType: periodType ?? 'custom',
  };
}

export function readRankingTab(search: string): RankingTab {
  const tab = new URLSearchParams(search).get('tab');
  if (tab === 'sales') return 'sales';
  if (tab === 'products') return 'products';
  return 'kpi';
}

export function reportSearch(
  filters: ReportFilters,
  tab: RankingTab,
): string {
  const params = new URLSearchParams({
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    criterion: filters.criterion,
    tab,
  });

  if (filters.salesGroupId) {
    params.set('salesGroupId', filters.salesGroupId);
  }

  if (filters.salesUserId) {
    params.set('salesUserId', filters.salesUserId);
  }

  if (filters.periodType) {
    params.set('periodType', filters.periodType);
  }

  return `?${params.toString()}`;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00Z`);

  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    value.slice(0, 4) !== '0000'
  );
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateReportFilters(
  filters: ReportFilters,
  today = vietnamToday(),
): string | undefined {
  if (!validDate(filters.fromDate) || !validDate(filters.toDate)) {
    return 'Nhập đầy đủ ngày bắt đầu và kết thúc hợp lệ.';
  }

  if (filters.fromDate > filters.toDate) {
    return 'Ngày bắt đầu không được sau ngày kết thúc.';
  }

  if (filters.fromDate > today) {
    return 'Kỳ báo cáo không được bắt đầu trong tương lai.';
  }

  if (!['Quantity', 'Revenue'].includes(filters.criterion)) {
    return 'Tiêu chí xếp hạng sản phẩm không hợp lệ.';
  }

  if (filters.salesGroupId && !UUID_REGEX.test(filters.salesGroupId)) {
    return 'Sales Group ID không hợp lệ.';
  }

  if (filters.salesUserId && !UUID_REGEX.test(filters.salesUserId)) {
    return 'Sales User ID không hợp lệ.';
  }

  return undefined;
}

export function scopeText(scope?: string | null): string {
  if (!scope) return 'Phạm vi được cấp quyền';
  const names: Record<string, string> = {
    All: 'Toàn bộ phạm vi báo cáo',
    Group: 'Theo nhóm được phép',
    OwnGroup: 'Nhóm của người dùng',
  };

  return names[scope] ?? scope;
}

export function quantityUnitText(unit?: string | null): string {
  if (!unit) return 'đơn vị';
  return unit === 'carton' ? 'thùng' : unit;
}

export function completionTone(rate?: number | null): 'success' | 'neutral' | 'danger' {
  if (typeof rate !== 'number' || Number.isNaN(rate)) return 'neutral';
  if (rate >= 100) return 'success';
  if (rate >= 70) return 'neutral';
  return 'danger';
}

export function formatCompletion(rate?: number | null): string {
  if (typeof rate !== 'number' || Number.isNaN(rate)) {
    return '—';
  }
  const rounded = Math.round(rate * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

export function safeCompletion(actual?: number | null, target?: number | null): number | null {
  if (typeof actual !== 'number' || typeof target !== 'number' || target <= 0) {
    return null;
  }
  return Math.round((actual / target) * 100 * 10) / 10;
}
