export interface KpiRow {
  name: string; group: string; before: number; after: number; orders: number; stores: number; newStores: number; target: number;
  rank: number; promoPct: number; achievedPct: number; result: 'Achieved' | 'NotAchieved'; gapToNext: number;
}
export interface KpiResponse { period: string; items: KpiRow[] }
export interface ProductRank { rank: number; sku: string; productName: string; qty: number; revenueAfterPromo: number }
export interface ProductRankResponse { period: string; items: ProductRank[] }
