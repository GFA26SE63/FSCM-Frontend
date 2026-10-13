export interface DashboardStatusCount { status: string; count: number }
export interface DashboardSalesRevenue { name: string; afterPromo: number; beforePromo: number }
export interface DashboardTopProduct { rank: number; sku: string; productName: string; qty: number; revenueAfterPromo: number }
export interface DashboardDay { date: string; afterPromo: number; beforePromo: number }

/** GET /dashboard?from=&to=&areaCode= – Admin overview. Revenue is always shown after promotion (decided 02/10). */
export interface DashboardResponse {
  from: string;
  to: string;
  areaCode: string | null;
  totalOrders: number;
  revenueAfterPromo: number;
  revenueBeforePromo: number;
  pendingOrders: number;
  rejectedOrders: number;
  ordersByStatus: DashboardStatusCount[];
  revenueBySales: DashboardSalesRevenue[];
  topProducts: DashboardTopProduct[];
  revenueByDay: DashboardDay[];
}
