import { get } from '@/shared/api/http';
import type { KpiResponse, ProductRankResponse } from './types';

interface ApiMetric { code: string; target: number; actual: number }
interface ApiKpiOrder { retailerId: string; revenueBeforePromotion: number; revenueAfterPromotion: number }
interface ApiKpiEntry {
  salesUserName: string; salesGroupCode: string; overallCompletionRate: number; recognizedRevenue: number;
  metrics: ApiMetric[]; orders: ApiKpiOrder[];
}
interface ApiKpiResponse { fromDate: string; toDate: string; entries: ApiKpiEntry[] }
interface ApiProductEntry { rank: number; sku: string; productName: string; normalizedSoldQuantity: number; adjustedNetRevenue: number }
interface ApiProductResponse { fromDate: string; toDate: string; entries: ApiProductEntry[] }

const currentMonth = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const last = new Date(year, now.getMonth() + 1, 0).getDate();
  return { fromDate: `${year}-${month}-01`, toDate: `${year}-${month}-${String(last).padStart(2, '0')}` };
};

export const kpiApi = {
  sales: async (): Promise<KpiResponse> => {
    const response = await get<ApiKpiResponse>('/reports/sales-kpis', currentMonth());
    const sorted = [...response.entries].sort((a, b) => b.recognizedRevenue - a.recognizedRevenue);
    return {
      period: `${response.fromDate} – ${response.toDate}`,
      items: sorted.map((entry, index) => {
        const revenue = entry.metrics.find((m) => m.code.toLowerCase().includes('revenue'));
        const before = entry.orders.reduce((sum, order) => sum + order.revenueBeforePromotion, 0);
        const after = entry.orders.reduce((sum, order) => sum + order.revenueAfterPromotion, 0);
        return {
          name: entry.salesUserName,
          group: entry.salesGroupCode,
          before,
          after,
          orders: entry.orders.length,
          stores: new Set(entry.orders.map((order) => order.retailerId)).size,
          newStores: 0,
          target: revenue?.target ?? 0,
          rank: index + 1,
          promoPct: before > 0 ? Math.round((before - after) / before * 1000) / 10 : 0,
          achievedPct: Math.round(entry.overallCompletionRate * 1000) / 10,
          result: entry.overallCompletionRate >= 1 ? 'Achieved' as const : 'NotAchieved' as const,
          gapToNext: index === 0 ? 0 : Math.max(0, sorted[index - 1].recognizedRevenue - entry.recognizedRevenue),
        };
      }),
    };
  },
  products: async (): Promise<ProductRankResponse> => {
    const response = await get<ApiProductResponse>('/reports/best-selling-products', { ...currentMonth(), criterion: 'Quantity' });
    return {
      period: `${response.fromDate} – ${response.toDate}`,
      items: response.entries.map((entry) => ({ rank: entry.rank, sku: entry.sku, productName: entry.productName, qty: entry.normalizedSoldQuantity, revenueAfterPromo: entry.adjustedNetRevenue })),
    };
  },
};
