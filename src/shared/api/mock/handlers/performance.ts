import { db } from '../fixtures';
import { MockRouter } from '../router';
import { product } from './common';

const kpiRows = () =>
  [...db.kpi]
    .sort((a, b) => b.after - a.after)
    .map((x, i, arr) => ({
      ...x, rank: i + 1, promoPct: Math.round(((x.before - x.after) / x.before) * 1000) / 10, achievedPct: Math.round((x.after / x.target) * 100),
      result: x.after >= x.target ? 'Achieved' : 'NotAchieved', gapToNext: i === 0 ? 0 : arr[i - 1].after - x.after + 1,
    }));

export function registerPerformance(r: MockRouter) {
  r.get('/kpi/sales', ({ query }) => ({ period: query.period ?? '2026-09', items: kpiRows() }));
  r.get('/rankings/sales', ({ query }) => ({ period: query.period ?? '2026-09', items: kpiRows() }));
  r.get('/rankings/products', ({ query }) => ({
    period: query.period ?? '2026-09',
    items: [...db.topProducts].sort((a, b) => b[1] - a[1]).map(([sku, qty, revenue], i) => ({ rank: i + 1, sku, productName: product(sku).name, qty, revenueAfterPromo: revenue })),
  }));
  r.get('/kpi/sales/:name', ({ params }) => kpiRows().find((x) => x.name === params.name) ?? null);

  r.get('/dashboard', ({ query }) => {
    const counts: Record<string, number> = {};
    db.orders.forEach((o) => (counts[o.status] = (counts[o.status] ?? 0) + 1));
    const after = 941_200_000;
    const before = 957_650_000;
    // deterministic daily curve for 1..27 Sep (sums to the month-to-date figure)
    const weights = Array.from({ length: 27 }, (_, i) => 0.7 + 0.5 * Math.abs(Math.sin(i * 0.9)) + (i % 7 === 6 ? -0.35 : 0));
    const wSum = weights.reduce((a, b) => a + b, 0);
    const revenueByDay = weights.map((w, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, afterPromo: Math.round(((after * w) / wSum) / 1000) * 1000, beforePromo: Math.round(((before * w) / wSum) / 1000) * 1000 }));
    return {
      from: query.from ?? '2026-09-01', to: query.to ?? '2026-09-30', areaCode: query.areaCode ?? null,
      totalOrders: 96, revenueAfterPromo: after, revenueBeforePromo: before,
      pendingOrders: counts.Pending ?? 0, rejectedOrders: counts.Rejected ?? 0,
      ordersByStatus: Object.entries(counts).map(([status, count]) => ({ status, count })),
      revenueBySales: kpiRows().slice(0, 5).map((x) => ({ name: x.name, afterPromo: x.after, beforePromo: x.before })),
      topProducts: [...db.topProducts].sort((a, b) => b[1] - a[1]).map(([sku, qty, revenue], i) => ({ rank: i + 1, sku, productName: product(sku).name, qty, revenueAfterPromo: revenue })),
      revenueByDay,
    };
  });
}
