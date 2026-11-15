export type RankingTab = 'kpi' | 'sales' | 'products';
export type ProductCriterion = 'Quantity' | 'Revenue';
export type PeriodType = 'month' | 'lastMonth' | 'quarter' | 'year' | 'custom';

export interface ReportFilters {
  fromDate: string;
  toDate: string;
  salesGroupId: string;
  salesUserId: string;
  criterion: ProductCriterion;
  periodType?: PeriodType;
}

export interface SalesGroupOption {
  id: string;
  code: string;
  name: string;
}

export interface SalesStaffOption {
  id: string;
  fullName: string;
  email: string;
  salesGroupId: string;
}

export interface SalesKpiMetric {
  code: string;
  name: string;
  target: number;
  actual: number;
  completionRate: number;
  weight: number;
  weightedScore: number;
  unit: string;
}

export interface SalesKpiOrder {
  orderId: string;
  orderCode: string;
  retailerId: string;
  retailerCode: string;
  retailerName: string;
  recognitionDate: string;
  revenueBeforePromotion: number;
  promotionAmount: number;
  revenueAfterPromotion: number;
  approvedAdjustmentAmount: number;
  recognizedRevenue: number;
}

export interface SalesKpiEntry {
  salesUserId: string;
  salesUserName: string;
  salesGroupId: string;
  salesGroupCode: string;
  salesGroupName: string;
  regionId: string;
  overallCompletionRate: number;
  recognizedRevenue: number;
  metrics: SalesKpiMetric[];
  orders: SalesKpiOrder[];
}

export interface SalesKpiResponse {
  fromDate: string;
  toDate: string;
  scope: string;
  configurationVersion: number;
  configurationEffectiveFrom: string;
  recognitionRule: string;
  entries: SalesKpiEntry[];
}

export interface KpiConfigPayload {
  revenueWeight: number;
  orderCountWeight: number;
  newRetailerWeight: number;
  note?: string;
}

export interface SalesRankingEntry {
  rank: number;
  salesUserId: string;
  salesUserName: string;
  salesGroupId: string;
  salesGroupCode: string;
  salesGroupName: string;
  regionId: string;
  orderCount: number;
  recognizedRevenue: number;
}

export interface SalesRankingResponse {
  fromDate: string;
  toDate: string;
  scope: string;
  entries: SalesRankingEntry[];
}

export interface ProductRankingEntry {
  rank: number;
  productId: string;
  sku: string;
  productName: string;
  normalizedSoldQuantity: number;
  quantityUnit: string;
  adjustedNetRevenue: number;
}

export interface ProductRankingResponse {
  fromDate: string;
  toDate: string;
  criterion: ProductCriterion;
  scope: string;
  quantityUnit: string;
  recognitionRule: string;
  entries: ProductRankingEntry[];
}
