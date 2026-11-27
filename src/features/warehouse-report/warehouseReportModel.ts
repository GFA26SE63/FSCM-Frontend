/** "Báo cáo kho vận" — types and pure helpers (GET /reports/warehouse-logistics). */
import type { ExcelColumn, ExcelSheet } from '@/shared/lib/excel';

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
  allSkus?: boolean;
  /** Warehouses picked by the user; the report loads only once at least one is chosen. */
  warehouseIds?: string[];
}

export interface WarehouseOption {
  id: string;
  code: string;
  name: string;
  regionId: string;
}

/** Same limit as the backend; keeps one screen from rendering too many warehouse tables. */
export const MAX_WAREHOUSES = 50;

/** Warehouses offered in the picker: those of the chosen region (all when no region), sorted by code. */
export function selectableWarehouses(all: WarehouseOption[], regionId: string): WarehouseOption[] {
  return all.filter((w) => !regionId || w.regionId === regionId).sort((a, b) => a.code.localeCompare(b.code, 'vi'));
}

/** Keeps only the picked ids that are still selectable (e.g. after the region filter changes). */
export function keepSelectable(ids: string[], options: WarehouseOption[]): string[] {
  const allowed = new Set(options.map((w) => w.id));
  return ids.filter((id) => allowed.has(id));
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
    ...(f.allSkus ? { allSkus: 'true' } : {}),
    ...(f.regionId ? { regionId: f.regionId } : {}),
    ...(f.warehouseIds?.length ? { warehouseIds: f.warehouseIds.join(',') } : {}),
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

export interface WarehouseChartPoint {
  id: string;
  code: string;
  name: string;
  valid: number;
  nearExpiry: number;
  salesIssue: number;
  factoryReceipt: number;
}

export interface SkuWarehouseSlice {
  warehouseId: string;
  code: string;
  name: string;
  valid: number;
  nearExpiry: number;
  salesIssue: number;
  onHand: number;
  product: WarehouseReportProductStock;
  warehouse: WarehouseReportWarehouse;
}

export type WarehouseHealthStatus = 'shortage' | 'overstock' | 'balanced' | 'idle';

export interface WarehouseSkuHighlight {
  productId: string;
  sku: string;
  name: string;
  valid: number;
  nearExpiry: number;
  salesIssue: number;
}

export interface WarehouseHealthRow {
  warehouse: WarehouseReportWarehouse;
  valid: number;
  nearExpiry: number;
  expired: number;
  locked: number;
  available: number;
  salesIssue: number;
  factoryReceipt: number;
  sellThroughRate: number;
  daysOfSupply: number | null;
  status: WarehouseHealthStatus;
  topSellingSku: WarehouseSkuHighlight | null;
  slowestSku: WarehouseSkuHighlight | null;
}

export interface SkuComparisonRow {
  productId: string;
  sku: string;
  name: string;
  rank: number;
  totalValid: number;
  totalNearExpiry: number;
  totalSales: number;
  highestStock: SkuWarehouseSlice | null;
  slowestStock: SkuWarehouseSlice | null;
  topSales: SkuWarehouseSlice | null;
  transferSuggestion: {
    fromCode: string;
    fromName: string;
    toCode: string;
    toName: string;
    excessValid: number;
    toSales: number;
    toValid: number;
  } | null;
  slices: SkuWarehouseSlice[];
}

export function buildWarehouseHealth(report: WarehouseReport, productId?: string): WarehouseHealthRow[] {
  const rawDays = (Date.parse(report.toDate) - Date.parse(report.fromDate)) / 86_400_000;
  const periodDays = Number.isFinite(rawDays) && rawDays >= 0 ? Math.max(1, Math.round(rawDays) + 1) : 30;

  return report.warehouses
    .map((w) => {
      const items = productId ? w.products.filter((p) => p.productId === productId) : w.products;
      const valid = items.reduce((s, p) => s + (p.valid ?? 0), 0);
      const nearExpiry = items.reduce((s, p) => s + (p.nearExpiry ?? 0), 0);
      const expired = items.reduce((s, p) => s + (p.expired ?? 0), 0);
      const locked = items.reduce((s, p) => s + (p.locked ?? 0), 0);
      const salesIssue = items.reduce((s, p) => s + (p.salesIssue ?? 0), 0);
      const factoryReceipt = items.reduce((s, p) => s + (p.factoryReceipt ?? 0), 0);
      const available = valid + nearExpiry;
      const denom = available + salesIssue;
      const sellThroughRate = denom > 0 ? Math.round((salesIssue / denom) * 100) : 0;
      const dailyVelocity = salesIssue / periodDays;
      const daysOfSupply = dailyVelocity > 0 ? Math.round(available / dailyVelocity) : null;

      let status: WarehouseHealthStatus = 'balanced';
      if (available === 0 && salesIssue === 0) {
        status = 'idle';
      } else if ((salesIssue > 0 && available === 0) || (daysOfSupply !== null && daysOfSupply <= 7)) {
        status = 'shortage';
      } else if ((available > 0 && salesIssue === 0) || (daysOfSupply !== null && daysOfSupply >= 45)) {
        status = 'overstock';
      }

      const topProduct = [...items]
        .filter((p) => (p.salesIssue ?? 0) > 0)
        .sort((a, b) => (b.salesIssue ?? 0) - (a.salesIssue ?? 0) || a.rank - b.rank)[0];
      const slowProduct = [...items]
        .filter((p) => (p.valid ?? 0) + (p.nearExpiry ?? 0) > 0)
        .sort((a, b) => {
          const aStock = (a.valid ?? 0) + (a.nearExpiry ?? 0);
          const bStock = (b.valid ?? 0) + (b.nearExpiry ?? 0);
          const aZero = (a.salesIssue ?? 0) === 0 ? 1 : 0;
          const bZero = (b.salesIssue ?? 0) === 0 ? 1 : 0;
          if (aZero !== bZero) return bZero - aZero;
          const aRatio = aStock / Math.max(1, a.salesIssue ?? 0);
          const bRatio = bStock / Math.max(1, b.salesIssue ?? 0);
          return bRatio - aRatio || bStock - aStock;
        })[0];

      return {
        warehouse: w,
        valid,
        nearExpiry,
        expired,
        locked,
        available,
        salesIssue,
        factoryReceipt,
        sellThroughRate,
        daysOfSupply,
        status,
        topSellingSku: topProduct
          ? {
              productId: topProduct.productId,
              sku: topProduct.sku,
              name: topProduct.name,
              valid: topProduct.valid ?? 0,
              nearExpiry: topProduct.nearExpiry ?? 0,
              salesIssue: topProduct.salesIssue ?? 0,
            }
          : null,
        slowestSku: slowProduct
          ? {
              productId: slowProduct.productId,
              sku: slowProduct.sku,
              name: slowProduct.name,
              valid: slowProduct.valid ?? 0,
              nearExpiry: slowProduct.nearExpiry ?? 0,
              salesIssue: slowProduct.salesIssue ?? 0,
            }
          : null,
      };
    })
    .sort((a, b) => {
      const order: Record<WarehouseHealthStatus, number> = { shortage: 0, overstock: 1, balanced: 2, idle: 3 };
      return order[a.status] - order[b.status] || b.salesIssue - a.salesIssue || b.available - a.available;
    });
}

export function buildWarehouseChartData(report: WarehouseReport, productId?: string): WarehouseChartPoint[] {
  return report.warehouses.map((w) => {
    const items = productId ? w.products.filter((p) => p.productId === productId) : w.products;
    return {
      id: w.id,
      code: w.code,
      name: w.name,
      valid: items.reduce((s, p) => s + (p.valid ?? 0), 0),
      nearExpiry: items.reduce((s, p) => s + (p.nearExpiry ?? 0), 0),
      salesIssue: items.reduce((s, p) => s + (p.salesIssue ?? 0), 0),
      factoryReceipt: items.reduce((s, p) => s + (p.factoryReceipt ?? 0), 0),
    };
  });
}

export function buildSkuComparisons(report: WarehouseReport): SkuComparisonRow[] {
  const map = new Map<string, { productId: string; sku: string; name: string; rank: number; slices: SkuWarehouseSlice[] }>();
  for (const w of report.warehouses) {
    for (const p of w.products) {
      let entry = map.get(p.productId);
      if (!entry) {
        entry = { productId: p.productId, sku: p.sku, name: p.name, rank: p.rank, slices: [] };
        map.set(p.productId, entry);
      }
      entry.rank = Math.min(entry.rank, p.rank);
      entry.slices.push({
        warehouseId: w.id,
        code: w.code,
        name: w.name,
        valid: p.valid ?? 0,
        nearExpiry: p.nearExpiry ?? 0,
        salesIssue: p.salesIssue ?? 0,
        onHand: p.onHand ?? 0,
        product: p,
        warehouse: w,
      });
    }
  }
  return [...map.values()]
    .sort((a, b) => a.rank - b.rank || a.sku.localeCompare(b.sku, 'vi'))
    .map((entry) => {
      const totalValid = entry.slices.reduce((s, x) => s + x.valid, 0);
      const totalNearExpiry = entry.slices.reduce((s, x) => s + x.nearExpiry, 0);
      const totalSales = entry.slices.reduce((s, x) => s + x.salesIssue, 0);
      const byStock = [...entry.slices].sort((a, b) => (b.valid + b.nearExpiry) - (a.valid + a.nearExpiry) || a.salesIssue - b.salesIssue);
      const bySales = [...entry.slices].sort((a, b) => b.salesIssue - a.salesIssue || a.valid - b.valid);
      const bySlowest = [...entry.slices]
        .filter((x) => x.valid + x.nearExpiry > 0)
        .sort((a, b) => {
          const aZero = a.salesIssue === 0 ? 1 : 0;
          const bZero = b.salesIssue === 0 ? 1 : 0;
          if (aZero !== bZero) return bZero - aZero;
          return (b.valid + b.nearExpiry) / Math.max(1, b.salesIssue) - (a.valid + a.nearExpiry) / Math.max(1, a.salesIssue);
        });
      const highestStock = byStock[0] && (byStock[0].valid + byStock[0].nearExpiry) > 0 ? byStock[0] : null;
      const slowestStock = bySlowest[0] ?? null;
      const topSales = bySales[0] && bySales[0].salesIssue > 0 ? bySales[0] : null;
      const transferSuggestion =
        highestStock &&
        topSales &&
        highestStock.warehouseId !== topSales.warehouseId &&
        highestStock.valid > topSales.valid
          ? {
              fromCode: highestStock.code,
              fromName: highestStock.name,
              toCode: topSales.code,
              toName: topSales.name,
              excessValid: highestStock.valid,
              toSales: topSales.salesIssue,
              toValid: topSales.valid,
            }
          : null;
      return {
        ...entry,
        totalValid,
        totalNearExpiry,
        totalSales,
        highestStock,
        slowestStock,
        topSales,
        transferSuggestion,
        slices: byStock,
      };
    });
}

/** Column sort chosen by clicking a metric header; null = best-seller rank. */
export type MetricSort = { key: MetricKey; dir: 'desc' | 'asc' } | null;

/** Header click cycle: nhiều nhất → ít nhất → back to rank order. */
export function nextSort(current: MetricSort, key: MetricKey): MetricSort {
  if (!current || current.key !== key) return { key, dir: 'desc' };
  return current.dir === 'desc' ? { key, dir: 'asc' } : null;
}

/** Sorted copy; ties keep the best-seller rank order. */
export function sortProducts(products: WarehouseReportProductStock[], sort: MetricSort): WarehouseReportProductStock[] {
  const byRank = [...products].sort((a, b) => a.rank - b.rank);
  if (!sort) return byRank;
  const sign = sort.dir === 'desc' ? -1 : 1;
  return byRank.sort((a, b) => sign * ((a[sort.key] ?? 0) - (b[sort.key] ?? 0)) || a.rank - b.rank);
}

/** Excel colours (ARGB) matching the on-screen chips in warehouseReport.css. */
export const EXCEL_TONES: Record<string, { fill: string; font: string }> = {
  valid: { fill: 'FFE5F4EA', font: 'FF15703A' },
  near: { fill: 'FFFEF3E2', font: 'FF8A3B09' },
  expired: { fill: 'FFFDECEA', font: 'FFB42318' },
  locked: { fill: 'FFECEEF0', font: 'FF3F474D' },
  disposed: { fill: 'FF3F474D', font: 'FFFFFFFF' },
  'in-factory': { fill: 'FFE8EEFD', font: 'FF1D4ED8' },
  'in-transfer': { fill: 'FFE0F4F7', font: 'FF0E6F7D' },
  'out-sales': { fill: 'FFF1E9FD', font: 'FF6B2FBF' },
  'out-transfer': { fill: 'FFFDEEE3', font: 'FFB4510F' },
};
const GROUP_FILLS: Record<MetricGroup, string> = { stock: 'FF15703A', inbound: 'FF1D4ED8', outbound: 'FF6B2FBF' };

const ddmmyyyy = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : iso);

/**
 * Workbook for "Báo cáo kho vận": sheet 1 has one block per warehouse laid out like the page (grouped headers,
 * coloured metrics, Tổng row); sheet 2 is a flat table (one row per warehouse × SKU) with filters for analysis.
 */
export function warehouseReportSheets(report: WarehouseReport, opts: { regionName?: string; sort: MetricSort; exportedAt: string }): ExcelSheet[] {
  const info = [
    `Nhập / xuất trong kỳ: ${ddmmyyyy(report.fromDate)} – ${ddmmyyyy(report.toDate)} · Tồn kho và Hủy: theo hiện tại của kho`,
    `Khu vực: ${opts.regionName ?? 'Tất cả khu vực'} · Top ${report.top} sản phẩm bán chạy`,
    `Xuất lúc ${opts.exportedAt}`,
  ];
  const metricColumns: ExcelColumn[] = METRICS.map((m) => ({ header: m.short, numeric: true, width: 12, ...EXCEL_TONES[m.tone] }));
  const groups = (lead: number) => [
    { label: '', span: lead },
    ...(Object.keys(GROUP_LABELS) as MetricGroup[]).map((g) => ({
      label: GROUP_LABELS[g], span: METRICS.filter((m) => m.group === g).length, fill: GROUP_FILLS[g],
    })),
  ];
  const byWarehouse: ExcelSheet = {
    name: 'Theo kho',
    title: 'Báo cáo kho vận',
    info,
    blocks: report.warehouses.map((w) => {
      const totals = warehouseTotals(w);
      return {
        title: `${w.code} · ${w.name}${w.regionName ? ` · ${w.regionName}` : ''} · ${w.driverCount} tài xế · ${w.vehicleCount} xe`,
        groups: groups(3),
        columns: [{ header: '#', width: 6, numeric: true }, { header: 'SKU', width: 16 }, { header: 'Sản phẩm', width: 34 }, ...metricColumns],
        rows: sortProducts(w.products, opts.sort).map((p) => [p.rank, p.sku, p.name, ...METRICS.map((m) => p[m.key])]),
        totals: [null, 'Tổng', null, ...METRICS.map((m) => totals[m.key])],
      };
    }),
  };
  const flat: ExcelSheet = {
    name: 'Dữ liệu chi tiết',
    title: 'Báo cáo kho vận · dữ liệu chi tiết',
    info,
    blocks: [{
      columns: [
        { header: 'Mã kho', width: 14 }, { header: 'Kho', width: 26 }, { header: 'Khu vực', width: 18 },
        { header: 'Tài xế', numeric: true, width: 9 }, { header: 'Xe', numeric: true, width: 9 },
        { header: 'Hạng', numeric: true, width: 8 }, { header: 'SKU', width: 16 }, { header: 'Sản phẩm', width: 34 },
        { header: 'Tồn vật lý', numeric: true, width: 12 },
        ...METRICS.map((m) => ({ header: m.label, numeric: true, width: 14, ...EXCEL_TONES[m.tone] })),
      ],
      rows: report.warehouses.flatMap((w) => sortProducts(w.products, opts.sort).map((p) => [
        w.code, w.name, w.regionName, w.driverCount, w.vehicleCount, p.rank, p.sku, p.name, p.onHand,
        ...METRICS.map((m) => p[m.key]),
      ])),
    }],
  };
  return [byWarehouse, flat];
}
