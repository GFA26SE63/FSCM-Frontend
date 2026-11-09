import { get, getAll } from '@/shared/api/http';
import type { DashboardResponse } from './types';

interface ApiOrder { status: string; finalAmount: number; createdAt: string }
interface ApiSalesEntry { salesUserName: string; recognizedRevenue: number }
interface ApiSalesRanking { entries: ApiSalesEntry[] }
interface ApiProductEntry { rank: number; sku: string; productName: string; normalizedSoldQuantity: number; adjustedNetRevenue: number }
interface ApiProductRanking { entries: ApiProductEntry[] }

const monthRange = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const last = new Date(year, now.getMonth() + 1, 0).getDate();
  return { fromDate: `${year}-${month}-01`, toDate: `${year}-${month}-${String(last).padStart(2, '0')}` };
};

export const dashboardApi = {
  get: async (params: { from?: string; to?: string; areaCode?: string }): Promise<DashboardResponse> => {
    const range = monthRange();
    const from = params.from ?? range.fromDate;
    const to = params.to ?? range.toDate;
    const [orders, sales, products] = await Promise.all([
      getAll<ApiOrder>('/orders'),
      get<ApiSalesRanking>('/reports/sales-ranking', { fromDate: from, toDate: to }),
      get<ApiProductRanking>('/reports/best-selling-products', { fromDate: from, toDate: to, criterion: 'Quantity' }),
    ]);
    const inRange = orders.filter((order) => order.createdAt.slice(0, 10) >= from && order.createdAt.slice(0, 10) <= to);
    const byStatus = new Map<string, number>();
    const byDay = new Map<string, number>();
    for (const order of inRange) {
      byStatus.set(order.status, (byStatus.get(order.status) ?? 0) + 1);
      const day = order.createdAt.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + order.finalAmount);
    }
    const revenue = inRange.reduce((sum, order) => sum + order.finalAmount, 0);
    return {
      from,
      to,
      areaCode: params.areaCode ?? null,
      totalOrders: inRange.length,
      revenueAfterPromo: revenue,
      revenueBeforePromo: revenue,
      pendingOrders: inRange.filter((o) => ['Pending', 'PendingApproval', 'Draft'].includes(o.status)).length,
      rejectedOrders: inRange.filter((o) => ['Rejected', 'Cancelled'].includes(o.status)).length,
      ordersByStatus: [...byStatus].map(([status, count]) => ({ status, count })),
      revenueBySales: sales.entries.map((entry) => ({ name: entry.salesUserName, afterPromo: entry.recognizedRevenue, beforePromo: entry.recognizedRevenue })),
      topProducts: products.entries.map((entry) => ({ rank: entry.rank, sku: entry.sku, productName: entry.productName, qty: entry.normalizedSoldQuantity, revenueAfterPromo: entry.adjustedNetRevenue })),
      revenueByDay: [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date, afterPromo: amount, beforePromo: amount })),
    };
  },
};
