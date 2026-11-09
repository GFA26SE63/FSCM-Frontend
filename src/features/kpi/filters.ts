import type {
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

export function defaultReportFilters(): ReportFilters {
  const today = vietnamToday();

  return {
    fromDate: `${today.slice(0, 7)}-01`,
    toDate: today,
    salesGroupId: '',
    criterion: 'Quantity',
  };
}

export function readReportFilters(search: string): ReportFilters {
  const params = new URLSearchParams(search);
  const defaults = defaultReportFilters();

  return {
    fromDate: params.get('fromDate') ?? defaults.fromDate,
    toDate: params.get('toDate') ?? defaults.toDate,
    salesGroupId: params.get('salesGroupId') ?? '',
    criterion: (
      params.get('criterion') ?? 'Quantity'
    ) as ProductCriterion,
  };
}

export function readRankingTab(search: string): RankingTab {
  return new URLSearchParams(search).get('tab') === 'products'
    ? 'products'
    : 'sales';
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

  if (
    filters.salesGroupId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      .test(filters.salesGroupId)
  ) {
    return 'Sales Group ID không hợp lệ.';
  }

  return undefined;
}

export function scopeText(scope: string): string {
  const names: Record<string, string> = {
    All: 'Toàn bộ phạm vi báo cáo',
    Group: 'Theo nhóm được phép',
    OwnGroup: 'Nhóm của người dùng',
  };

  return names[scope] ?? scope;
}

export function quantityUnitText(unit: string): string {
  return unit === 'carton' ? 'thùng' : unit;
}