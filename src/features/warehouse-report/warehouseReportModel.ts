/** "Báo cáo kho vận" — types and pure helpers (GET /reports/warehouse-logistics). */

export interface WarehouseReportTopProduct {
  productId: string;
  sku: string;
  name: string;
  rank: number;
  soldQuantity: number;
}

export interface WarehouseReportProductStock {
  productId: string;
  sku: string;
  name: string;
  rank: number;
  onHand: number;
  valid: number;
  nearExpiry: number;
  expired: number;
  locked: number;
  disposed: number;
  factoryReceipt: number;
  transferReceipt: number;
  salesIssue: number;
  transferIssue: number;
}

export interface WarehouseReportWarehouse {
  id: string;
  code: string;
  name: string;
  regionId: string;
  regionName: string;
  driverCount: number;
  vehicleCount: number;
  products: WarehouseReportProductStock[];
}

export interface WarehouseReport {
  fromDate: string;
  toDate: string;
  regionId: string | null;
  top: number;
  topProducts: WarehouseReportTopProduct[];
  warehouses: WarehouseReportWarehouse[];
}

export interface WarehouseReportFilters {
  fromDate: string;
  toDate: string;
  regionId: string;
  top: number;
}

export const DEFAULT_TOP = 10;
export const MAX_TOP = 50;
export const TOP_OPTIONS = [5, 10, 20, 30, 50] as const;
/** Same limit as the backend: at most 367 calendar days, both ends included. */
export const MAX_RANGE_DAYS = 366;

export type MetricKey = Exclude<keyof WarehouseReportProductStock, 'productId' | 'sku' | 'name' | 'rank' | 'onHand'>;
export type MetricGroup = 'stock' | 'inbound' | 'outbound';

/**
 * Column order, labels and colour class. `short` is the table header under its group header.
 * The 5 stock columns are the warehouse's current state (not filtered by date); only inbound/outbound follow the period.
 */
export const METRICS: { key: MetricKey; label: string; short: string; group: MetricGroup; tone: string; hint: string }[] = [
  { key: 'valid', label: 'Còn hạn', short: 'Còn hạn', group: 'stock', tone: 'valid', hint: 'Tồn hiện tại còn hạn, chưa khóa' },
  { key: 'nearExpiry', label: 'Cận hạn', short: 'Cận hạn', group: 'stock', tone: 'near', hint: 'Tồn hiện tại trong ngưỡng cận hạn của SKU, chưa khóa' },
  { key: 'expired', label: 'Hết hạn', short: 'Hết hạn', group: 'stock', tone: 'expired', hint: 'Tồn hiện tại đã quá hạn, chưa khóa' },
  { key: 'locked', label: 'Khóa', short: 'Khóa', group: 'stock', tone: 'locked', hint: 'Tồn hiện tại đang bị khóa (mọi hạn sử dụng)' },
  { key: 'disposed', label: 'Hủy', short: 'Hủy', group: 'stock', tone: 'disposed', hint: 'Tổng số lượng đã tiêu hủy tại kho (không theo khoảng thời gian lọc)' },
  { key: 'factoryReceipt', label: 'Nhập nhà máy', short: 'Nhà máy', group: 'inbound', tone: 'in-factory', hint: 'Nhập từ nhà máy trong khoảng thời gian lọc' },
  { key: 'transferReceipt', label: 'Nhập luân chuyển', short: 'Luân chuyển', group: 'inbound', tone: 'in-transfer', hint: 'Nhập luân chuyển từ kho khác trong khoảng thời gian lọc' },
  { key: 'salesIssue', label: 'Xuất bán', short: 'Bán', group: 'outbound', tone: 'out-sales', hint: 'Xuất bán cho nhà bán lẻ trong khoảng thời gian lọc' },
  { key: 'transferIssue', label: 'Xuất luân chuyển', short: 'Luân chuyển', group: 'outbound', tone: 'out-transfer', hint: 'Xuất luân chuyển sang kho khác trong khoảng thời gian lọc' },
];

export const GROUP_LABELS: Record<MetricGroup, string> = {
  stock: 'Tồn kho hiện tại',
  inbound: 'Nhập trong kỳ',
  outbound: 'Xuất trong kỳ',
};

export function rangeError(fromDate: string, toDate: string): string | null {
  if (!fromDate || !toDate) return 'Chọn đủ Từ ngày và Đến ngày.';
  const days = (Date.parse(toDate) - Date.parse(fromDate)) / 86_400_000;
  if (!Number.isFinite(days)) return 'Ngày không hợp lệ.';
  if (days < 0) return 'Đến ngày phải sau hoặc bằng Từ ngày.';
  if (days > MAX_RANGE_DAYS) return 'Khoảng thời gian tối đa 367 ngày.';
  return null;
}

export function clampTop(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TOP;
  return Math.min(MAX_TOP, Math.max(1, Math.round(value)));
}

export function toReportParams(f: WarehouseReportFilters): Record<string, string | number> {
  return {
    fromDate: f.fromDate,
    toDate: f.toDate,
    top: clampTop(f.top),
    ...(f.regionId ? { regionId: f.regionId } : {}),
  };
}

/** Totals of every metric over the warehouse's best sellers (shown in the warehouse card header). */
export function warehouseTotals(w: WarehouseReportWarehouse): Record<MetricKey, number> {
  const totals = Object.fromEntries(METRICS.map((m) => [m.key, 0])) as Record<MetricKey, number>;
  for (const p of w.products) for (const m of METRICS) totals[m.key] += p[m.key] ?? 0;
  return totals;
}

export function reportSummary(report: WarehouseReport) {
  return {
    warehouses: report.warehouses.length,
    drivers: report.warehouses.reduce((s, w) => s + w.driverCount, 0),
    vehicles: report.warehouses.reduce((s, w) => s + w.vehicleCount, 0),
    products: report.topProducts.length,
  };
}
